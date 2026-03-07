package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-meta/internal/models"
	"github.com/indusbase/indus-meta/internal/postgres"
)

// RoleHandler handles role-related requests
type RoleHandler struct {
	db *postgres.DB
}

// NewRoleHandler creates a new role handler
func NewRoleHandler(db *postgres.DB) *RoleHandler {
	return &RoleHandler{db: db}
}

// List handles GET /meta/roles
func (h *RoleHandler) List(c *gin.Context) {
	roles, err := h.db.ListRoles(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "roles": roles})
}

// Create handles POST /meta/roles
func (h *RoleHandler) Create(c *gin.Context) {
	var req models.CreateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	options := postgres.RoleOptions{
		Login:      req.Login,
		Superuser:  req.Superuser,
		CreateDB:   req.CreateDB,
		CreateRole: req.CreateRole,
		Inherit:    req.Inherit,
	}

	if err := h.db.CreateRole(c.Request.Context(), req.Name, req.Password, options); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "message": "Role created"})
}

// Alter handles PATCH /meta/roles/:name
func (h *RoleHandler) Alter(c *gin.Context) {
	name := c.Param("name")

	var req models.AlterRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	options := postgres.RoleOptions{}
	if req.Login != nil {
		options.Login = *req.Login
	}
	if req.Superuser != nil {
		options.Superuser = *req.Superuser
	}
	if req.CreateDB != nil {
		options.CreateDB = *req.CreateDB
	}
	if req.CreateRole != nil {
		options.CreateRole = *req.CreateRole
	}
	if req.Password != nil {
		options.Password = req.Password
	}

	if err := h.db.AlterRole(c.Request.Context(), name, options); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Role altered"})
}

// Drop handles DELETE /meta/roles/:name
func (h *RoleHandler) Drop(c *gin.Context) {
	name := c.Param("name")

	if err := h.db.DropRole(c.Request.Context(), name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Role dropped"})
}

// Grant handles POST /meta/roles/:name/grant
func (h *RoleHandler) Grant(c *gin.Context) {
	name := c.Param("name")

	var req models.GrantPrivilegeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	if err := h.db.GrantPrivilege(c.Request.Context(), name, req.Privilege, req.Schema, req.Object); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Privilege granted"})
}
