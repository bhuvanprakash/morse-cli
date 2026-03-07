package handlers

import (
	"database/sql"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-auth/internal/repository"
	"github.com/indusbase/indus-auth/internal/response"
)

// AdminListUsersDependencies holds dependencies for admin list users handler
type AdminListUsersDependencies struct {
	DB *sql.DB
}

// AdminListUsers lists all users (admin only)
func AdminListUsers(deps *AdminListUsersDependencies) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Parse pagination
		offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
		if limit > 100 {
			limit = 100
		}

		userRepo := repository.NewUserRepository(deps.DB)
		users, err := userRepo.ListUsers(c.Request.Context(), offset, limit)
		if err != nil {
			response.InternalServerError(c, "Failed to list users")
			return
		}

		// Convert to public users
		publicUsers := make([]interface{}, len(users))
		for i, user := range users {
			publicUsers[i] = user.ToPublic()
		}

		response.Success(c, gin.H{
			"users":  publicUsers,
			"offset": offset,
			"limit":  limit,
		})
	}
}

// AdminGetUserDependencies holds dependencies for admin get user handler
type AdminGetUserDependencies struct {
	DB *sql.DB
}

// AdminGetUser gets a specific user (admin only)
func AdminGetUser(deps *AdminGetUserDependencies) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.Param("id")
		if userID == "" {
			response.BadRequest(c, "User ID is required")
			return
		}

		userRepo := repository.NewUserRepository(deps.DB)
		user, err := userRepo.GetByID(c.Request.Context(), userID)
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

// AdminBanUserRequest represents the ban user request
type AdminBanUserRequest struct {
	Reason string `json:"reason,omitempty"`
}

// AdminBanUserDependencies holds dependencies for admin ban user handler
type AdminBanUserDependencies struct {
	DB *sql.DB
}

// AdminBanUser bans a user (admin only)
func AdminBanUser(deps *AdminBanUserDependencies) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.Param("id")
		if userID == "" {
			response.BadRequest(c, "User ID is required")
			return
		}

		var req AdminBanUserRequest
		_ = c.ShouldBindJSON(&req)

		// Prevent banning yourself
		currentUserID, _ := c.Get("user_id")
		if currentUserID == userID {
			response.BadRequest(c, "Cannot ban yourself")
			return
		}

		userRepo := repository.NewUserRepository(deps.DB)
		sessionRepo := repository.NewSessionRepository(deps.DB)

		// Ban user
		if err := userRepo.BanUser(c.Request.Context(), userID); err != nil {
			response.InternalServerError(c, "Failed to ban user")
			return
		}

		// Revoke all sessions
		_ = sessionRepo.RevokeAllUserSessions(c.Request.Context(), userID)

		response.Success(c, gin.H{
			"message": "User banned successfully",
			"reason":  req.Reason,
		})
	}
}

// AdminUnbanUserDependencies holds dependencies for admin unban user handler
type AdminUnbanUserDependencies struct {
	DB *sql.DB
}

// AdminUnbanUser unbans a user (admin only)
func AdminUnbanUser(deps *AdminUnbanUserDependencies) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.Param("id")
		if userID == "" {
			response.BadRequest(c, "User ID is required")
			return
		}

		userRepo := repository.NewUserRepository(deps.DB)

		// Update user status to active
		if err := userRepo.UpdateUser(c.Request.Context(), userID, map[string]interface{}{
			"status": "active",
		}); err != nil {
			response.InternalServerError(c, "Failed to unban user")
			return
		}

		response.Success(c, gin.H{
			"message": "User unbanned successfully",
		})
	}
}

// AdminDeleteUserDependencies holds dependencies for admin delete user handler
type AdminDeleteUserDependencies struct {
	DB *sql.DB
}

// AdminDeleteUser permanently deletes a user (admin only)
func AdminDeleteUser(deps *AdminDeleteUserDependencies) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.Param("id")
		if userID == "" {
			response.BadRequest(c, "User ID is required")
			return
		}

		// Prevent deleting yourself
		currentUserID, _ := c.Get("user_id")
		if currentUserID == userID {
			response.BadRequest(c, "Cannot delete yourself")
			return
		}

		userRepo := repository.NewUserRepository(deps.DB)
		sessionRepo := repository.NewSessionRepository(deps.DB)

		// Revoke all sessions first
		_ = sessionRepo.RevokeAllUserSessions(c.Request.Context(), userID)

		// Delete user
		if err := userRepo.DeleteUser(c.Request.Context(), userID); err != nil {
			response.InternalServerError(c, "Failed to delete user")
			return
		}

		response.Success(c, gin.H{
			"message": "User deleted successfully",
		})
	}
}
