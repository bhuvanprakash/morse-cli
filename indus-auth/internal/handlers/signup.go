package handlers

import (
	"context"
	"database/sql"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-auth/internal/auth"
	"github.com/indusbase/indus-auth/internal/config"
	"github.com/indusbase/indus-auth/internal/db"
	"github.com/indusbase/indus-auth/internal/repository"
	"github.com/indusbase/indus-auth/internal/response"
	"github.com/indusbase/indus-auth/pkg/crypto"
	"github.com/indusbase/indus-auth/pkg/email"
	"github.com/indusbase/indus-auth/pkg/validator"
)

// SignUpRequest represents the signup request body
type SignUpRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
	Name     string `json:"name" binding:"required"`
}

// SignUpResponse represents the signup response
type SignUpResponse struct {
	UserID        string `json:"user_id"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Message       string `json:"message"`
}

// SignUpDependencies holds dependencies for signup handler
type SignUpDependencies struct {
	Config      *config.Config
	DB          *sql.DB
	Redis       *db.RedisClient
	EmailClient *email.Client
}

// SignUp handles user registration
func SignUp(deps *SignUpDependencies) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req SignUpRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.BadRequest(c, "Invalid request body: "+err.Error())
			return
		}

		// Validate email
		if err := validator.ValidateEmail(req.Email); err != nil {
			response.BadRequest(c, err.Error())
			return
		}

		// Validate password
		if err := validator.ValidatePassword(req.Password); err != nil {
			response.BadRequest(c, err.Error())
			return
		}

		// Validate name
		if err := validator.ValidateName(req.Name); err != nil {
			response.BadRequest(c, err.Error())
			return
		}

		userRepo := repository.NewUserRepository(deps.DB)

		// Check if email already exists
		existingUser, err := userRepo.GetByEmail(c.Request.Context(), req.Email)
		if err != nil {
			response.InternalServerError(c, "Failed to check existing user")
			return
		}
		if existingUser != nil {
			response.Conflict(c, "Email already registered")
			return
		}

		// Hash password
		passwordHash, err := crypto.HashPassword(req.Password, deps.Config.BCryptCost)
		if err != nil {
			response.InternalServerError(c, "Failed to process password")
			return
		}

		// Create user
		user, err := userRepo.CreateUser(c.Request.Context(), req.Email, passwordHash, req.Name, nil)
		if err != nil {
			response.InternalServerError(c, "Failed to create user")
			return
		}

		// Generate and send OTP
		otp, err := auth.GenerateAndStoreOTP(
			c.Request.Context(),
			deps.Redis,
			req.Email,
			"email_verification",
			deps.Config.OTPLength,
			deps.Config.OTPExpiry,
		)
		if err != nil {
			// User created but OTP failed - still return success, they can resend
			response.Success(c, SignUpResponse{
				UserID:        user.ID,
				Email:         user.Email,
				EmailVerified: false,
				Message:       "User created but failed to send verification email. Please request a new OTP.",
			})
			return
		}

		// Send OTP email
		if deps.EmailClient != nil && deps.EmailClient.IsConfigured() {
			go func() {
				ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
				defer cancel()
				_ = auth.SendOTPEmail(ctx, deps.EmailClient, req.Email, otp, "email_verification")
			}()
		}

		response.Success(c, SignUpResponse{
			UserID:        user.ID,
			Email:         user.Email,
			EmailVerified: false,
			Message:       "User created successfully. Please verify your email with the OTP sent.",
		})
	}
}
