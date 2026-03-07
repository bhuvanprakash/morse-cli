package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-meta/internal/models"
	"github.com/indusbase/indus-meta/internal/postgres"
)

// MigrationHandler handles migration-related requests
type MigrationHandler struct {
	db *postgres.DB
}

// NewMigrationHandler creates a new migration handler
func NewMigrationHandler(db *postgres.DB) *MigrationHandler {
	return &MigrationHandler{db: db}
}

// History handles GET /meta/migrations
func (h *MigrationHandler) History(c *gin.Context) {
	migrations, err := h.db.ListMigrations(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "migrations": migrations})
}

// Run handles POST /meta/migrations/run
func (h *MigrationHandler) Run(c *gin.Context) {
	var req models.RunMigrationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	runReq := postgres.RunMigrationRequest{
		Version: req.Version,
		Name:    req.Name,
		SQLUp:   req.SQLUp,
		SQLDown: req.SQLDown,
	}

	if err := h.db.RunMigration(c.Request.Context(), runReq); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Migration executed"})
}

// Rollback handles POST /meta/migrations/rollback
func (h *MigrationHandler) Rollback(c *gin.Context) {
	var req models.RollbackMigrationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	if err := h.db.RollbackMigration(c.Request.Context(), req.Version); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Migration rolled back"})
}
