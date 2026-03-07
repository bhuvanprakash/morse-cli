package handlers

import (
	"database/sql"
	"encoding/json"
	"net"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-auth/internal/auth"
	"github.com/indusbase/indus-auth/internal/config"
	"github.com/indusbase/indus-auth/internal/db"
	"github.com/indusbase/indus-auth/internal/repository"
	"github.com/indusbase/indus-auth/internal/response"
)

// PhoneHandler handles phone authentication operations
type PhoneHandler struct {
	config      *config.Config
	db          *sql.DB
	redis       *db.RedisClient
	whatsappCfg *auth.WhatsAppOTPConfig
}

// NewPhoneHandler creates a new phone handler instance
func NewPhoneHandler(cfg *config.Config, database *sql.DB, redisClient *db.RedisClient) *PhoneHandler {
	return &PhoneHandler{
		config: cfg,
		db:     database,
		redis:  redisClient,
		whatsappCfg: &auth.WhatsAppOTPConfig{
			GupshupAPIKey: getEnv("GUPSHUP_API_KEY", ""),
			SenderPhone:   getEnv("GUPSHUP_SENDER_PHONE", ""),
			TemplateName:  getEnv("GUPSHUP_TEMPLATE_NAME", "indusbase_otp"),
		},
	}
}

// SendPhoneOTPRequest represents the request to send phone OTP
type SendPhoneOTPRequest struct {
	Phone   string `json:"phone" binding:"required"`
	Purpose string `json:"purpose"` // "login", "signup", "verification"
}

// SendPhoneOTPResponse represents the response for send OTP request
type SendPhoneOTPResponse struct {
	Message       string `json:"message"`
	Phone         string `json:"phone"`
	MaskedPhone   string `json:"masked_phone"`
	TransactionID string `json:"transaction_id,omitempty"`
}

// SendPhoneOTP handles POST /auth/phone/send-otp
func (h *PhoneHandler) SendPhoneOTP(c *gin.Context) {
	var req SendPhoneOTPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request body: "+err.Error())
		return
	}

	// Normalize phone number
	phone := auth.NormalizeIndianPhone(req.Phone)

	// Validate Indian phone format
	if err := auth.ValidateIndianPhoneNumber(phone); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	req.Purpose = normalizePhoneFlowType(req.Purpose)
	if req.Purpose == "" {
		response.BadRequest(c, "Invalid purpose. Must be one of: login, signup, verification")
		return
	}

	// Generate and store OTP
	otp, err := auth.GenerateAndStorePhoneOTP(
		c.Request.Context(),
		h.redis,
		phone,
		req.Purpose,
		6, // 6-digit OTP
		10*time.Minute,
	)
	if err != nil {
		if err.Error() == "rate limit exceeded, please wait before requesting another OTP" {
			response.Error(c, 429, "RATE_LIMIT_EXCEEDED", "Rate limit exceeded. Please wait before requesting another OTP.")
			return
		}
		response.InternalServerError(c, "Failed to generate OTP: "+err.Error())
		return
	}

	// Send OTP via WhatsApp if configured
	if h.whatsappCfg.GupshupAPIKey != "" && h.whatsappCfg.SenderPhone != "" {
		if err := auth.SendWhatsAppOTP(c.Request.Context(), h.whatsappCfg, phone, otp); err != nil {
			// Log error but don't fail - OTP is still stored in Redis
			// In production, you might want to send via SMS fallback
			response.InternalServerError(c, "Failed to send OTP via WhatsApp: "+err.Error())
			return
		}
	}

	// Return success response
	response.Success(c, SendPhoneOTPResponse{
		Message:     "OTP sent successfully via WhatsApp",
		Phone:       phone,
		MaskedPhone: auth.MaskPhone(phone),
	})
}

// VerifyPhoneOTPRequest represents the request to verify phone OTP
type VerifyPhoneOTPRequest struct {
	Phone string `json:"phone" binding:"required"`
	OTP   string `json:"otp" binding:"required"`
	Type  string `json:"type"` // "login", "signup", "verification"
}

// VerifyPhoneOTPResponse represents the response for verify OTP request
type VerifyPhoneOTPResponse struct {
	Success      bool        `json:"success"`
	Message      string      `json:"message"`
	AccessToken  string      `json:"access_token,omitempty"`
	RefreshToken string      `json:"refresh_token,omitempty"`
	TokenType    string      `json:"token_type,omitempty"`
	ExpiresIn    int         `json:"expires_in,omitempty"`
	User         interface{} `json:"user,omitempty"`
	IsNewUser    bool        `json:"is_new_user,omitempty"`
}

// VerifyPhoneOTP handles POST /auth/phone/verify-otp
func (h *PhoneHandler) VerifyPhoneOTP(c *gin.Context) {
	var req VerifyPhoneOTPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request body: "+err.Error())
		return
	}

	// Normalize phone number
	phone := auth.NormalizeIndianPhone(req.Phone)
	req.Type = normalizePhoneFlowType(req.Type)
	if req.Type == "" {
		response.BadRequest(c, "Invalid type. Must be one of: login, signup, verification")
		return
	}

	// Validate Indian phone format
	if err := auth.ValidateIndianPhoneNumber(phone); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	// Verify OTP
	err := auth.VerifyPhoneOTP(c.Request.Context(), h.redis, phone, req.Type, req.OTP)
	if err != nil {
		switch err {
		case auth.ErrInvalidOTP:
			response.BadRequest(c, "Invalid OTP code")
		case auth.ErrExpiredOTP:
			response.BadRequest(c, "OTP has expired")
		case auth.ErrMaxAttemptsOTP:
			response.BadRequest(c, "Maximum attempts exceeded. Please request a new OTP.")
		case auth.ErrOTPNotFound:
			response.BadRequest(c, "OTP not found. Please request a new OTP.")
		default:
			response.InternalServerError(c, "Failed to verify OTP")
		}
		return
	}

	resp := VerifyPhoneOTPResponse{
		Success: true,
		Message: "Phone verified successfully",
	}

	// For verification type, just return success
	if req.Type == "verification" {
		response.Success(c, resp)
		return
	}

	ctx := c.Request.Context()
	userRepo := repository.NewUserRepository(h.db)
	sessionRepo := repository.NewSessionRepository(h.db)

	user, err := userRepo.GetByPhone(ctx, phone)
	if err != nil {
		response.InternalServerError(c, "Failed to fetch user by phone")
		return
	}

	isNewUser := false
	if user == nil {
		if req.Type == "login" {
			response.Unauthorized(c, "No account found for this phone number. Start with signup.")
			return
		}
		metadata, _ := json.Marshal(map[string]interface{}{
			"sign_in_method": "phone_otp",
			"phone":          phone,
		})
		user, err = userRepo.CreatePhoneUser(ctx, phone, syntheticPhoneEmail(phone), displayNameForPhone(phone), metadata)
		if err != nil {
			response.InternalServerError(c, "Failed to create phone user")
			return
		}
		isNewUser = true
	}

	updates := map[string]interface{}{
		"phone":          phone,
		"phone_verified": true,
	}
	if err := userRepo.UpdateUser(ctx, user.ID, updates); err != nil {
		response.InternalServerError(c, "Failed to update phone verification state")
		return
	}
	user.Phone = &phone
	user.PhoneVerified = true
	_ = userRepo.UpdateLastSignIn(ctx, user.ID)

	privateKey, _, err := auth.LoadKeys(h.config.JWTPrivateKeyPath, h.config.JWTPublicKeyPath)
	if err != nil {
		response.InternalServerError(c, "Failed to load JWT signing keys")
		return
	}

	userAgent := c.GetHeader("User-Agent")
	ipAddress := net.ParseIP(c.ClientIP())
	refreshTokenExpiry := time.Now().Add(h.config.JWTRefreshExpiry)
	tempSession, err := sessionRepo.CreateSession(
		ctx,
		user.ID,
		"temp",
		&userAgent,
		ipAddress,
		refreshTokenExpiry,
	)
	if err != nil {
		response.InternalServerError(c, "Failed to create session")
		return
	}

	accessToken, err := auth.GenerateAccessToken(
		user.ID,
		user.Email,
		user.Role,
		h.config.JWTAccessExpiry,
		privateKey,
	)
	if err != nil {
		response.InternalServerError(c, "Failed to generate access token")
		return
	}

	refreshToken, err := auth.GenerateRefreshToken(
		user.ID,
		tempSession.ID,
		h.config.JWTRefreshExpiry,
		privateKey,
	)
	if err != nil {
		response.InternalServerError(c, "Failed to generate refresh token")
		return
	}

	if err := sessionRepo.UpdateRefreshToken(ctx, tempSession.ID, refreshToken, refreshTokenExpiry); err != nil {
		response.InternalServerError(c, "Failed to update session refresh token")
		return
	}

	resp.AccessToken = accessToken
	resp.RefreshToken = refreshToken
	resp.TokenType = "Bearer"
	resp.ExpiresIn = int(h.config.JWTAccessExpiry.Seconds())
	resp.User = user.ToPublic()
	resp.IsNewUser = isNewUser
	resp.Message = "Phone verified and session created successfully"

	emitAudit(c, map[string]interface{}{
		"actor_user_id": user.ID,
		"actor_email":   user.Email,
		"actor_type":    "user",
		"action":        "phone_otp_signin",
		"resource_type": "auth_session",
		"resource_id":   tempSession.ID,
		"severity":      "info",
		"metadata": map[string]interface{}{
			"phone":       phone,
			"flow_type":   req.Type,
			"is_new_user": isNewUser,
		},
	})

	response.Success(c, resp)
}

// ResendPhoneOTPRequest represents the request to resend phone OTP
type ResendPhoneOTPRequest struct {
	Phone   string `json:"phone" binding:"required"`
	Purpose string `json:"purpose" binding:"required"`
}

// ResendPhoneOTP handles resending phone OTP
func (h *PhoneHandler) ResendPhoneOTP(c *gin.Context) {
	var req ResendPhoneOTPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request body: "+err.Error())
		return
	}

	req.Purpose = normalizePhoneFlowType(req.Purpose)
	if req.Purpose == "" {
		response.BadRequest(c, "Invalid purpose. Must be one of: login, signup, verification")
		return
	}

	// Normalize and validate phone
	phone := auth.NormalizeIndianPhone(req.Phone)
	if err := auth.ValidateIndianPhoneNumber(phone); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	// Delete existing OTP
	_ = auth.DeletePhoneOTP(c.Request.Context(), h.redis, phone, req.Purpose)

	// Generate new OTP
	otp, err := auth.GenerateAndStorePhoneOTP(
		c.Request.Context(),
		h.redis,
		phone,
		req.Purpose,
		6,
		10*time.Minute,
	)
	if err != nil {
		if err.Error() == "rate limit exceeded, please wait before requesting another OTP" {
			response.Error(c, 429, "RATE_LIMIT_EXCEEDED", "Rate limit exceeded. Please wait before requesting another OTP.")
			return
		}
		response.InternalServerError(c, "Failed to generate OTP")
		return
	}

	// Send via WhatsApp
	if h.whatsappCfg.GupshupAPIKey != "" && h.whatsappCfg.SenderPhone != "" {
		if err := auth.SendWhatsAppOTP(c.Request.Context(), h.whatsappCfg, phone, otp); err != nil {
			response.InternalServerError(c, "Failed to resend OTP")
			return
		}
	}

	response.Success(c, SendPhoneOTPResponse{
		Message:     "OTP resent successfully",
		Phone:       phone,
		MaskedPhone: auth.MaskPhone(phone),
	})
}

func normalizePhoneFlowType(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "", "login", "signin", "sign_in":
		return "login"
	case "signup", "sign_up", "register":
		return "signup"
	case "verification", "verify":
		return "verification"
	default:
		return ""
	}
}

func syntheticPhoneEmail(phone string) string {
	return phone + "@phone.indusbase.local"
}

func displayNameForPhone(phone string) string {
	if len(phone) >= 4 {
		return "User " + phone[len(phone)-4:]
	}
	return "Phone User"
}

// GetPhoneStatusRequest represents the request to check phone OTP status
type GetPhoneStatusRequest struct {
	Phone string `form:"phone" binding:"required"`
	Type  string `form:"type" binding:"required"`
}

// GetPhoneStatusResponse represents the phone OTP status response
type GetPhoneStatusResponse struct {
	Phone       string    `json:"phone"`
	MaskedPhone string    `json:"masked_phone"`
	HasOTP      bool      `json:"has_otp"`
	ExpiresAt   time.Time `json:"expires_at,omitempty"`
	Attempts    int       `json:"attempts,omitempty"`
}

// GetPhoneStatus handles checking if an OTP exists for a phone number
func (h *PhoneHandler) GetPhoneStatus(c *gin.Context) {
	var req GetPhoneStatusRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		response.BadRequest(c, "Invalid request parameters: "+err.Error())
		return
	}

	phone := auth.NormalizeIndianPhone(req.Phone)

	otpData, err := auth.GetPhoneOTPStatus(c.Request.Context(), h.redis, phone, req.Type)
	if err != nil {
		response.Success(c, GetPhoneStatusResponse{
			Phone:       phone,
			MaskedPhone: auth.MaskPhone(phone),
			HasOTP:      false,
		})
		return
	}

	response.Success(c, GetPhoneStatusResponse{
		Phone:       phone,
		MaskedPhone: auth.MaskPhone(phone),
		HasOTP:      true,
		Attempts:    otpData.Attempts,
	})
}

// Helper function
func getEnv(key, defaultValue string) string {
	if value := ""; value != "" {
		return value
	}
	return defaultValue
}
