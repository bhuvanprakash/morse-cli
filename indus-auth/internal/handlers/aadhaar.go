package handlers

import (
	"crypto/rsa"
	"database/sql"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-auth/internal/auth"
	"github.com/indusbase/indus-auth/internal/config"
	"github.com/indusbase/indus-auth/internal/db"
	"github.com/indusbase/indus-auth/internal/response"
)

// AadhaarHandler handles Aadhaar eKYC operations
type AadhaarHandler struct {
	config     *config.Config
	db         *sql.DB
	redis      *db.RedisClient
	aadhaarCfg *auth.AadhaarConfig
}

// NewAadhaarHandler creates a new Aadhaar handler instance
func NewAadhaarHandler(cfg *config.Config, database *sql.DB, redisClient *db.RedisClient) (*AadhaarHandler, error) {
	handler := &AadhaarHandler{
		config: cfg,
		db:     database,
		redis:  redisClient,
	}

	// Initialize Aadhaar config from environment
	if err := handler.initAadhaarConfig(); err != nil {
		return nil, err
	}

	return handler, nil
}

// initAadhaarConfig initializes Aadhaar configuration from environment variables
func (h *AadhaarHandler) initAadhaarConfig() error {
	auaCode := os.Getenv("UIDAI_AUA_CODE")
	if auaCode == "" {
		// Aadhaar is optional, return nil if not configured
		return nil
	}

	subAUACode := os.Getenv("UIDAI_SUB_AUA_CODE")
	if subAUACode == "" {
		subAUACode = auaCode
	}

	licenseKey := os.Getenv("UIDAI_ASA_LICENSE_KEY")
	production := os.Getenv("UIDAI_PRODUCTION") == "true"

	// Load private key
	privateKeyPath := os.Getenv("UIDAI_PRIVATE_KEY_PATH")
	var privateKey *rsa.PrivateKey
	if privateKeyPath != "" {
		keyData, err := os.ReadFile(privateKeyPath)
		if err != nil {
			return err
		}
		privateKey, err = auth.ParsePrivateKey(keyData)
		if err != nil {
			return err
		}
	}

	// Load UIDAI public key
	publicKeyPath := os.Getenv("UIDAI_PUBLIC_KEY_PATH")
	var publicKey *rsa.PublicKey
	if publicKeyPath != "" {
		keyData, err := os.ReadFile(publicKeyPath)
		if err != nil {
			return err
		}
		publicKey, err = auth.ParsePublicKey(keyData)
		if err != nil {
			return err
		}
	}

	h.aadhaarCfg = &auth.AadhaarConfig{
		AUACode:       auaCode,
		SubAUACode:    subAUACode,
		ASALicenseKey: licenseKey,
		PrivateKey:    privateKey,
		UIDPublicKey:  publicKey,
		Production:    production,
	}

	return nil
}

// isConfigured returns true if Aadhaar is properly configured
func (h *AadhaarHandler) isConfigured() bool {
	return h.aadhaarCfg != nil && h.aadhaarCfg.AUACode != ""
}

// SendAadhaarOTPRequest represents the request to send Aadhaar OTP
type SendAadhaarOTPRequest struct {
	AadhaarNumber string `json:"aadhaar_number" binding:"required"`
}

// SendAadhaarOTPResponse represents the response for send OTP request
type SendAadhaarOTPResponse struct {
	Success       bool   `json:"success"`
	TransactionID string `json:"transaction_id,omitempty"`
	MaskedAadhaar string `json:"masked_aadhaar"`
	Message       string `json:"message"`
	ErrorCode     string `json:"error_code,omitempty"`
}

// SendAadhaarOTP handles POST /auth/aadhaar/send-otp
func (h *AadhaarHandler) SendAadhaarOTP(c *gin.Context) {
	if !h.isConfigured() {
		response.InternalServerError(c, "Aadhaar eKYC is not configured")
		return
	}

	var req SendAadhaarOTPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request body: "+err.Error())
		return
	}

	// Generate transaction ID
	transactionID := auth.GenerateTransactionID(h.aadhaarCfg.AUACode)

	// Request OTP from UIDAI
	otpResp, err := auth.RequestAadhaarOTP(c.Request.Context(), h.aadhaarCfg, req.AadhaarNumber, transactionID)
	if err != nil {
		response.InternalServerError(c, "Failed to request OTP: "+err.Error())
		return
	}

	resp := SendAadhaarOTPResponse{
		Success:       otpResp.Success,
		TransactionID: otpResp.TransactionID,
		MaskedAadhaar: auth.MaskAadhaar(req.AadhaarNumber),
		Message:       otpResp.Message,
		ErrorCode:     otpResp.ErrorCode,
	}

	if otpResp.Success {
		response.Success(c, resp)
	} else {
		response.Error(c, http.StatusBadRequest, "AADHAAR_OTP_FAILED", resp.Message)
	}
}

// VerifyAadhaarOTPRequest represents the request to verify Aadhaar OTP
type VerifyAadhaarOTPRequest struct {
	AadhaarNumber string `json:"aadhaar_number" binding:"required"`
	TransactionID string `json:"transaction_id" binding:"required"`
	OTP           string `json:"otp" binding:"required"`
}

// VerifyAadhaarOTPResponse represents the response for verify OTP request
type VerifyAadhaarOTPResponse struct {
	Success    bool                 `json:"success"`
	Message    string               `json:"message"`
	ErrorCode  string               `json:"error_code,omitempty"`
	KYCData    *auth.AadhaarKYCData `json:"kyc_data,omitempty"`
	VerifiedAt time.Time            `json:"verified_at,omitempty"`
}

// VerifyAadhaarOTP handles POST /auth/aadhaar/verify-otp
func (h *AadhaarHandler) VerifyAadhaarOTP(c *gin.Context) {
	if !h.isConfigured() {
		response.InternalServerError(c, "Aadhaar eKYC is not configured")
		return
	}

	var req VerifyAadhaarOTPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request body: "+err.Error())
		return
	}

	// Validate OTP format
	if len(req.OTP) != 6 {
		response.BadRequest(c, "OTP must be 6 digits")
		return
	}

	// Verify OTP with UIDAI
	verifyResp, err := auth.VerifyAadhaarOTP(c.Request.Context(), h.aadhaarCfg, req.AadhaarNumber, req.TransactionID, req.OTP)
	if err != nil {
		response.InternalServerError(c, "Failed to verify OTP: "+err.Error())
		return
	}

	resp := VerifyAadhaarOTPResponse{
		Success:    verifyResp.Success,
		Message:    verifyResp.Message,
		ErrorCode:  verifyResp.ErrorCode,
		KYCData:    verifyResp.KYCData,
		VerifiedAt: verifyResp.VerifiedAt,
	}

	if verifyResp.Success {
		// Store verification result in database (optional)
		// You can link this to a user account
		response.Success(c, resp)
	} else {
		response.Error(c, http.StatusBadRequest, "AADHAAR_VERIFICATION_FAILED", resp.Message)
	}
}

// GetAadhaarStatusRequest represents the request to check Aadhaar status
type GetAadhaarStatusRequest struct {
	UserID string `form:"user_id" binding:"required"`
}

// GetAadhaarStatusResponse represents the Aadhaar status response
type GetAadhaarStatusResponse struct {
	UserID     string               `json:"user_id"`
	Verified   bool                 `json:"verified"`
	MaskedUID  string               `json:"masked_uid,omitempty"`
	VerifiedAt time.Time            `json:"verified_at,omitempty"`
	KYCData    *auth.AadhaarKYCData `json:"kyc_data,omitempty"`
}

// GetAadhaarStatus handles GET /auth/aadhaar/status
func (h *AadhaarHandler) GetAadhaarStatus(c *gin.Context) {
	userID := c.Query("user_id")
	if userID == "" {
		response.BadRequest(c, "user_id is required")
		return
	}

	// Get status from database
	status, err := auth.GetAadhaarStatus(c.Request.Context(), h.db, userID)
	if err != nil {
		response.InternalServerError(c, "Failed to get Aadhaar status")
		return
	}

	response.Success(c, status)
}

// ValidateAadhaarRequest represents the request to validate Aadhaar format
type ValidateAadhaarRequest struct {
	AadhaarNumber string `json:"aadhaar_number" binding:"required"`
}

// ValidateAadhaarResponse represents the validation response
type ValidateAadhaarResponse struct {
	Valid     bool   `json:"valid"`
	Message   string `json:"message,omitempty"`
	MaskedUID string `json:"masked_uid,omitempty"`
}

// ValidateAadhaar handles POST /auth/aadhaar/validate
func (h *AadhaarHandler) ValidateAadhaar(c *gin.Context) {
	var req ValidateAadhaarRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request body: "+err.Error())
		return
	}

	validator := &auth.AadhaarValidator{}
	err := validator.ValidateAadhaar(req.AadhaarNumber)

	resp := ValidateAadhaarResponse{
		Valid:     err == nil,
		MaskedUID: auth.MaskAadhaar(req.AadhaarNumber),
	}

	if err != nil {
		resp.Message = err.Error()
	}

	response.Success(c, resp)
}

// AadhaarConfigResponse represents the Aadhaar configuration status
type AadhaarConfigResponse struct {
	Configured   bool   `json:"configured"`
	Production   bool   `json:"production"`
	AUACode      string `json:"aua_code,omitempty"`
	HasPublicKey bool   `json:"has_public_key"`
}

// GetConfig handles GET /auth/aadhaar/config
func (h *AadhaarHandler) GetConfig(c *gin.Context) {
	resp := AadhaarConfigResponse{
		Configured: h.isConfigured(),
	}

	if h.aadhaarCfg != nil {
		resp.Production = h.aadhaarCfg.Production
		resp.AUACode = h.aadhaarCfg.AUACode
		resp.HasPublicKey = h.aadhaarCfg.UIDPublicKey != nil
	}

	response.Success(c, resp)
}

// AadhaarDependencies holds dependencies for Aadhaar handlers
type AadhaarDependencies struct {
	Config *config.Config
	DB     *sql.DB
	Redis  *db.RedisClient
}

// RegisterAadhaarRoutes registers Aadhaar routes with the provided dependencies
func RegisterAadhaarRoutes(router *gin.RouterGroup, deps *AadhaarDependencies) {
	handler, err := NewAadhaarHandler(deps.Config, deps.DB, deps.Redis)
	if err != nil {
		// Log error but don't crash - Aadhaar is optional
		return
	}

	// Aadhaar eKYC routes
	aadhaar := router.Group("/aadhaar")
	{
		aadhaar.GET("/config", handler.GetConfig)
		aadhaar.POST("/validate", handler.ValidateAadhaar)
		aadhaar.POST("/send-otp", handler.SendAadhaarOTP)
		aadhaar.POST("/verify-otp", handler.VerifyAadhaarOTP)
		aadhaar.GET("/status", handler.GetAadhaarStatus)
	}
}
