package handlers

import (
	"context"
	"database/sql"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-auth/internal/auth"
	"github.com/indusbase/indus-auth/internal/db"
	"github.com/indusbase/indus-auth/internal/repository"
	"github.com/indusbase/indus-auth/internal/response"
	"github.com/indusbase/indus-auth/pkg/email"
	"github.com/indusbase/indus-auth/pkg/validator"
)

// VerifyOTPRequest represents the OTP verification request
type VerifyOTPRequest struct {
	Email string `json:"email" binding:"required,email"`
	Code  string `json:"code" binding:"required"`
	Type  string `json:"type" binding:"required"` // email_verification, password_reset, etc.
}

// VerifyOTPResponse represents the OTP verification response
type VerifyOTPResponse struct {
	Message  string `json:"message"`
	Verified bool   `json:"verified"`
}

// VerifyOTPDependencies holds dependencies for verify OTP handler
type VerifyOTPDependencies struct {
	DB    *sql.DB
	Redis *db.RedisClient
}

// VerifyOTP handles OTP verification
func VerifyOTP(deps *VerifyOTPDependencies) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req VerifyOTPRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.BadRequest(c, "Invalid request body: "+err.Error())
			return
		}

		// Validate email
		if err := validator.ValidateEmail(req.Email); err != nil {
			response.BadRequest(c, err.Error())
			return
		}

		// Verify OTP
		err := auth.VerifyOTP(c.Request.Context(), deps.Redis, req.Email, req.Type, req.Code)
		if err != nil {
			emitAudit(c, map[string]interface{}{
				"actor_email":   req.Email,
				"actor_type":    "user",
				"action":        "verify_otp_failed",
				"resource_type": "otp",
				"resource_id":   req.Email,
				"severity":      "warn",
				"metadata": map[string]interface{}{
					"type":   req.Type,
					"reason": err.Error(),
				},
			})
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

		// If email verification, update user
		if req.Type == "email_verification" {
			userRepo := repository.NewUserRepository(deps.DB)
			user, err := userRepo.GetByEmail(c.Request.Context(), req.Email)
			if err != nil {
				response.InternalServerError(c, "Failed to fetch user")
				return
			}
			if user != nil {
				_ = userRepo.UpdateEmailVerified(c.Request.Context(), user.ID, true)
			}
		}

		response.Success(c, VerifyOTPResponse{
			Message:  "OTP verified successfully",
			Verified: true,
		})
		emitAudit(c, map[string]interface{}{
			"actor_email":   req.Email,
			"actor_type":    "user",
			"action":        "verify_otp",
			"resource_type": "otp",
			"resource_id":   req.Email,
			"severity":      "info",
			"metadata": map[string]interface{}{
				"type": req.Type,
			},
		})
	}
}

// ResendOTPRequest represents the resend OTP request
type ResendOTPRequest struct {
	Email string `json:"email" binding:"required,email"`
	Type  string `json:"type" binding:"required"`
}

// ResendOTPDependencies holds dependencies for resend OTP handler
type ResendOTPDependencies struct {
	DB          *sql.DB
	Redis       *db.RedisClient
	EmailClient *email.Client
	OTPLength   int
	OTPExpiry   time.Duration
}

// ResendOTP handles OTP resending
func ResendOTP(deps *ResendOTPDependencies) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req ResendOTPRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.BadRequest(c, "Invalid request body: "+err.Error())
			return
		}

		// Validate email
		if err := validator.ValidateEmail(req.Email); err != nil {
			response.BadRequest(c, err.Error())
			return
		}

		// Generate new OTP
		otp, err := auth.GenerateAndStoreOTP(
			c.Request.Context(),
			deps.Redis,
			req.Email,
			req.Type,
			deps.OTPLength,
			deps.OTPExpiry,
		)
		if err != nil {
			response.BadRequest(c, err.Error())
			return
		}

		// Send OTP email
		if deps.EmailClient != nil && deps.EmailClient.IsConfigured() {
			go func() {
				ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
				defer cancel()
				_ = auth.SendOTPEmail(ctx, deps.EmailClient, req.Email, otp, req.Type)
			}()
		}

		response.Success(c, gin.H{
			"message": "OTP resent successfully",
		})
	}
}
