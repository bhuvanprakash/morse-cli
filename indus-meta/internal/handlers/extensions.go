package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-meta/internal/postgres"
)

// ExtensionHandler handles extension-related requests
type ExtensionHandler struct {
	db *postgres.DB
}

// NewExtensionHandler creates a new extension handler
func NewExtensionHandler(db *postgres.DB) *ExtensionHandler {
	return &ExtensionHandler{db: db}
}

// List handles GET /meta/extensions
func (h *ExtensionHandler) List(c *gin.Context) {
	extensions, err := h.db.ListExtensions(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "extensions": extensions})
}

// Enable handles POST /meta/extensions/:name
func (h *ExtensionHandler) Enable(c *gin.Context) {
	name := c.Param("name")
	if name == "" {
		var req struct {
			Name string `json:"name" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
			return
		}
		name = req.Name
	}

	if err := h.db.EnableExtension(c.Request.Context(), name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "message": "Extension enabled"})
}

// Disable handles DELETE /meta/extensions/:name
func (h *ExtensionHandler) Disable(c *gin.Context) {
	name := c.Param("name")

	if err := h.db.DisableExtension(c.Request.Context(), name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Extension disabled"})
}
