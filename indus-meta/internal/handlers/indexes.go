package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-meta/internal/postgres"
)

// IndexHandler handles index-related requests
type IndexHandler struct {
	db *postgres.DB
}

// NewIndexHandler creates a new index handler
func NewIndexHandler(db *postgres.DB) *IndexHandler {
	return &IndexHandler{db: db}
}

// List handles GET /meta/indexes?schema=...&table=...
func (h *IndexHandler) List(c *gin.Context) {
	schema := c.Query("schema")
	if schema == "" {
		schema = "public"
	}

	table := c.Query("table")
	var tablePtr *string
	if table != "" {
		tablePtr = &table
	}

	indexes, err := h.db.ListIndexes(c.Request.Context(), schema, tablePtr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "indexes": indexes, "schema": schema, "table": table})
}

// Create handles POST /meta/indexes
func (h *IndexHandler) Create(c *gin.Context) {
	var req postgres.CreateIndexRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	if req.Schema == "" {
		req.Schema = "public"
	}

	if err := h.db.CreateIndex(c.Request.Context(), req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "message": "Index created"})
}

// Drop handles DELETE /meta/indexes/:id
func (h *IndexHandler) Drop(c *gin.Context) {
	id := c.Param("id")
	schema := c.Query("schema")
	if schema == "" {
		schema = "public"
	}

	if err := h.db.DropIndex(c.Request.Context(), schema, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Index dropped"})
}
