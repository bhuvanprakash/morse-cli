package handlers

import (
	"database/sql"
	"encoding/json"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-auth/internal/repository"
	"github.com/indusbase/indus-auth/internal/response"
)

// UpdateUserRequest represents the update user request
type UpdateUserRequest struct {
	Name      string          `json:"name,omitempty"`
	AvatarURL *string         `json:"avatar_url,omitempty"`
	Metadata  json.RawMessage `json:"metadata,omitempty"`
}

// GetUserDependencies holds dependencies for get user handler
type GetUserDependencies struct {
	DB *sql.DB
}

// GetUser gets the current user
func GetUser(deps *GetUserDependencies) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("user_id")
		if !exists {
			response.Unauthorized(c, "Not authenticated")
			return
		}

		uid, ok := userID.(string)
		if !ok {
			response.Unauthorized(c, "Invalid user ID")
			return
		}

		userRepo := repository.NewUserRepository(deps.DB)
		user, err := userRepo.GetByID(c.Request.Context(), uid)
		if err != nil {
			response.InternalServerError(c, "Failed to fetch user")
			return
		}
		if user == nil {
			response.NotFound(c, "User not found")
			return
		}

		response.Success(c, user.ToPublic())
	}
}

// UpdateUserDependencies holds dependencies for update user handler
type UpdateUserDependencies struct {
	DB *sql.DB
}

// UpdateUser updates the current user
func UpdateUser(deps *UpdateUserDependencies) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("user_id")
		if !exists {
			response.Unauthorized(c, "Not authenticated")
			return
		}

		uid, ok := userID.(string)
		if !ok {
			response.Unauthorized(c, "Invalid user ID")
			return
		}

		var req UpdateUserRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.BadRequest(c, "Invalid request body: "+err.Error())
			return
		}

		userRepo := repository.NewUserRepository(deps.DB)

		// Build updates map
		updates := make(map[string]interface{})
		if req.Name != "" {
			updates["name"] = req.Name
		}
		if req.AvatarURL != nil {
			updates["avatar_url"] = *req.AvatarURL
		}
		if req.Metadata != nil {
			updates["metadata"] = req.Metadata
		}

		if len(updates) == 0 {
			response.BadRequest(c, "No fields to update")
			return
		}

		if err := userRepo.UpdateUser(c.Request.Context(), uid, updates); err != nil {
			response.InternalServerError(c, "Failed to update user")
			return
		}

		// Fetch updated user
		user, err := userRepo.GetByID(c.Request.Context(), uid)
		if err != nil {
			response.InternalServerError(c, "Failed to fetch updated user")
			return
		}

		response.Success(c, user.ToPublic())
	}
}

// DeleteUserDependencies holds dependencies for delete user handler
type DeleteUserDependencies struct {
	DB *sql.DB
}

// DeleteUser deletes the current user (soft delete)
func DeleteUser(deps *DeleteUserDependencies) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("user_id")
		if !exists {
			response.Unauthorized(c, "Not authenticated")
			return
		}

		uid, ok := userID.(string)
		if !ok {
			response.Unauthorized(c, "Invalid user ID")
			return
		}

		userRepo := repository.NewUserRepository(deps.DB)

		if err := userRepo.DeleteUser(c.Request.Context(), uid); err != nil {
			response.InternalServerError(c, "Failed to delete user")
			return
		}

		response.Success(c, gin.H{
			"message": "User deleted successfully",
		})
	}
}
