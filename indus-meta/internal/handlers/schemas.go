package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-meta/internal/models"
	"github.com/indusbase/indus-meta/internal/postgres"
)

// SchemaHandler handles schema-related requests
type SchemaHandler struct {
	db *postgres.DB
}

// NewSchemaHandler creates a new schema handler
func NewSchemaHandler(db *postgres.DB) *SchemaHandler {
	return &SchemaHandler{db: db}
}

// List handles GET /meta/schemas
func (h *SchemaHandler) List(c *gin.Context) {
	schemas, err := h.db.ListSchemas(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "schemas": schemas})
}

// Create handles POST /meta/schemas
func (h *SchemaHandler) Create(c *gin.Context) {
	var req models.CreateSchemaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	if err := h.db.CreateSchema(c.Request.Context(), req.Name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "message": "Schema created"})
}

// Drop handles DELETE /meta/schemas/:name
func (h *SchemaHandler) Drop(c *gin.Context) {
	name := c.Param("name")
	cascade := c.Query("cascade") == "true"

	if err := h.db.DropSchema(c.Request.Context(), name, cascade); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Schema dropped"})
}
