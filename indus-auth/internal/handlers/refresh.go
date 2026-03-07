package handlers

import (
	"crypto/rsa"
	"database/sql"
	"net"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-auth/internal/auth"
	"github.com/indusbase/indus-auth/internal/config"
	"github.com/indusbase/indus-auth/internal/repository"
	"github.com/indusbase/indus-auth/internal/response"
)

// RefreshTokenRequest represents the refresh token request
type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

// RefreshTokenResponse represents the refresh token response
type RefreshTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
}

// RefreshTokenDependencies holds dependencies for refresh token handler
type RefreshTokenDependencies struct {
	Config     *config.Config
	DB         *sql.DB
	PrivateKey *rsa.PrivateKey
	PublicKey  *rsa.PublicKey
}

// RefreshToken handles token refresh with rotation
func RefreshToken(deps *RefreshTokenDependencies) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req RefreshTokenRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.BadRequest(c, "Invalid request body: "+err.Error())
			return
		}

		// Validate refresh token
		claims, err := auth.ValidateRefreshToken(req.RefreshToken, deps.PublicKey)
		if err != nil {
			response.Unauthorized(c, "Invalid refresh token")
			return
		}

		sessionRepo := repository.NewSessionRepository(deps.DB)
		userRepo := repository.NewUserRepository(deps.DB)

		// Get session from database
		session, err := sessionRepo.GetByRefreshToken(c.Request.Context(), req.RefreshToken)
		if err != nil {
			response.InternalServerError(c, "Failed to fetch session")
			return
		}
		if session == nil {
			response.Unauthorized(c, "Session not found")
			return
		}

		// Check if session is valid
		if session.IsRevoked {
			response.Unauthorized(c, "Session has been revoked")
			return
		}
		if session.IsExpired() {
			response.Unauthorized(c, "Session has expired")
			return
		}

		// Verify session ID matches
		if session.ID != claims.SessionID {
			response.Unauthorized(c, "Invalid session")
			return
		}

		// Get user
		user, err := userRepo.GetByID(c.Request.Context(), claims.UserID)
		if err != nil {
			response.InternalServerError(c, "Failed to fetch user")
			return
		}
		if user == nil {
			response.Unauthorized(c, "User not found")
			return
		}

		// Check if user is active
		if !user.IsActive() {
			response.Forbidden(c, "Account is not active")
			return
		}

		// Generate new tokens (token rotation)
		newAccessToken, err := auth.GenerateAccessToken(
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

		newRefreshTokenExpiry := time.Now().Add(deps.Config.JWTRefreshExpiry)
		newRefreshToken, err := auth.GenerateRefreshToken(
			user.ID,
			session.ID,
			deps.Config.JWTRefreshExpiry,
			deps.PrivateKey,
		)
		if err != nil {
			response.InternalServerError(c, "Failed to generate refresh token")
			return
		}

		// Update session with new refresh token (rotation)
		if err := sessionRepo.UpdateRefreshToken(c.Request.Context(), session.ID, newRefreshToken, newRefreshTokenExpiry); err != nil {
			response.InternalServerError(c, "Failed to update session")
			return
		}

		// Get client info for logging
		userAgent := c.GetHeader("User-Agent")
		ipAddress := net.ParseIP(c.ClientIP())
		_ = userAgent
		_ = ipAddress

		response.Success(c, RefreshTokenResponse{
			AccessToken:  newAccessToken,
			RefreshToken: newRefreshToken,
			TokenType:    "Bearer",
			ExpiresIn:    int(deps.Config.JWTAccessExpiry.Seconds()),
		})
	}
}
