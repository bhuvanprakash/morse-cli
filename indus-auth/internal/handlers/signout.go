package handlers

import (
	"database/sql"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-auth/internal/repository"
	"github.com/indusbase/indus-auth/internal/response"
)

// SignOutRequest represents the signout request
type SignOutRequest struct {
	RefreshToken string `json:"refresh_token,omitempty"`
	AllSessions  bool   `json:"all_sessions,omitempty"`
}

// SignOutDependencies holds dependencies for signout handler
type SignOutDependencies struct {
	DB *sql.DB
}

// SignOut handles user signout
func SignOut(deps *SignOutDependencies) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req SignOutRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			// Allow empty body - will use session from context if available
			req = SignOutRequest{}
		}

		userID, exists := c.Get("user_id")
		if !exists {
			// Try to get user ID from claims
			claims, exists := c.Get("claims")
			if !exists {
				response.Unauthorized(c, "Not authenticated")
				return
			}
			// Try to extract user ID from claims
			if claimsMap, ok := claims.(map[string]interface{}); ok {
				if uid, ok := claimsMap["user_id"].(string); ok {
					userID = uid
					exists = true
				}
			}
		}

		sessionRepo := repository.NewSessionRepository(deps.DB)

		// If refresh token provided, revoke that specific session
		if req.RefreshToken != "" {
			session, err := sessionRepo.GetByRefreshToken(c.Request.Context(), req.RefreshToken)
			if err != nil {
				response.InternalServerError(c, "Failed to fetch session")
				return
			}
			if session != nil {
				if err := sessionRepo.RevokeSession(c.Request.Context(), session.ID); err != nil {
					response.InternalServerError(c, "Failed to revoke session")
					return
				}
			}
		}

		// If all_sessions is true and we have user ID, revoke all sessions
		if req.AllSessions && exists {
			uid, ok := userID.(string)
			if ok && uid != "" {
				if err := sessionRepo.RevokeAllUserSessions(c.Request.Context(), uid); err != nil {
					response.InternalServerError(c, "Failed to revoke all sessions")
					return
				}
			}
		}

		response.Success(c, gin.H{
			"message": "Signed out successfully",
		})
		emitAudit(c, map[string]interface{}{
			"actor_user_id": userID,
			"actor_type":    "user",
			"action":        "signout",
			"resource_type": "auth_session",
			"resource_id":   req.RefreshToken,
			"severity":      "info",
			"metadata": map[string]interface{}{
				"all_sessions": req.AllSessions,
			},
		})
	}
}
