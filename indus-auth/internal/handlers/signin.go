package handlers

import (
	"crypto/rsa"
	"database/sql"
	"net"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-auth/internal/auth"
	"github.com/indusbase/indus-auth/internal/config"
	"github.com/indusbase/indus-auth/internal/db"
	"github.com/indusbase/indus-auth/internal/models"
	"github.com/indusbase/indus-auth/internal/repository"
	"github.com/indusbase/indus-auth/internal/response"
	"github.com/indusbase/indus-auth/pkg/crypto"
	"github.com/indusbase/indus-auth/pkg/validator"
)

// SignInRequest represents the signin request body
type SignInRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// SignInResponse represents the signin response
type SignInResponse struct {
	AccessToken  string            `json:"access_token"`
	RefreshToken string            `json:"refresh_token"`
	TokenType    string            `json:"token_type"`
	ExpiresIn    int               `json:"expires_in"`
	User         models.PublicUser `json:"user"`
}

// SignInDependencies holds dependencies for signin handler
type SignInDependencies struct {
	Config     *config.Config
	DB         *sql.DB
	Redis      *db.RedisClient
	PrivateKey *rsa.PrivateKey
}

// SignIn handles user authentication
func SignIn(deps *SignInDependencies) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req SignInRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.BadRequest(c, "Invalid request body: "+err.Error())
			return
		}

		// Validate email
		if err := validator.ValidateEmail(req.Email); err != nil {
			response.BadRequest(c, err.Error())
			return
		}

		userRepo := repository.NewUserRepository(deps.DB)

		// Get user by email
		user, err := userRepo.GetByEmail(c.Request.Context(), req.Email)
		if err != nil {
			response.InternalServerError(c, "Failed to fetch user")
			return
		}
		if user == nil {
			response.Unauthorized(c, "Invalid credentials")
			return
		}

		// Check if user is active
		if !user.IsActive() {
			response.Forbidden(c, "Account is not active")
			return
		}

		// Verify password
		if !crypto.VerifyPassword(user.PasswordHash, req.Password) {
			response.Unauthorized(c, "Invalid credentials")
			return
		}

		// Check if email is verified
		if !user.EmailVerified {
			emitAudit(c, map[string]interface{}{
				"actor_email":   req.Email,
				"actor_type":    "user",
				"action":        "signin_failed",
				"resource_type": "auth_session",
				"resource_id":   req.Email,
				"severity":      "warn",
				"metadata": map[string]interface{}{
					"reason": "email_not_verified",
				},
			})
			response.Forbidden(c, "Email not verified")
			return
		}

		// Update last sign in
		_ = userRepo.UpdateLastSignIn(c.Request.Context(), user.ID)

		// Create session
		sessionRepo := repository.NewSessionRepository(deps.DB)

		// Get client info
		userAgent := c.GetHeader("User-Agent")
		ipAddress := net.ParseIP(c.ClientIP())

		// Generate refresh token first to get session ID
		refreshTokenExpiry := time.Now().Add(deps.Config.JWTRefreshExpiry)
		tempSession, err := sessionRepo.CreateSession(
			c.Request.Context(),
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

		// Generate tokens
		accessToken, err := auth.GenerateAccessToken(
			user.ID,
			user.Email,
			user.Role,
			deps.Config.JWTAccessExpiry,
			deps.PrivateKey,
		)
		if err != nil {
			response.InternalServerError(c, "Failed to generate access token")
			return
		}

		refreshToken, err := auth.GenerateRefreshToken(
			user.ID,
			tempSession.ID,
			deps.Config.JWTRefreshExpiry,
			deps.PrivateKey,
		)
		if err != nil {
			response.InternalServerError(c, "Failed to generate refresh token")
			return
		}

		// Update session with actual refresh token
		_ = sessionRepo.UpdateRefreshToken(c.Request.Context(), tempSession.ID, refreshToken, refreshTokenExpiry)

		response.Success(c, SignInResponse{
			AccessToken:  accessToken,
			RefreshToken: refreshToken,
			TokenType:    "Bearer",
			ExpiresIn:    int(deps.Config.JWTAccessExpiry.Seconds()),
			User:         user.ToPublic(),
		})
		emitAudit(c, map[string]interface{}{
			"actor_user_id": user.ID,
			"actor_email":   user.Email,
			"actor_type":    "user",
			"action":        "signin",
			"resource_type": "auth_session",
			"resource_id":   tempSession.ID,
			"severity":      "info",
		})
	}
}
