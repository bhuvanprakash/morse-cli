package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-meta/internal/models"
	"github.com/indusbase/indus-meta/internal/postgres"
)

// ColumnHandler handles column-related requests
type ColumnHandler struct {
	db *postgres.DB
}

// NewColumnHandler creates a new column handler
func NewColumnHandler(db *postgres.DB) *ColumnHandler {
	return &ColumnHandler{db: db}
}

// List handles GET /meta/columns?table_id=schema.table or ?schema=...&table=...
func (h *ColumnHandler) List(c *gin.Context) {
	schema := c.Query("schema")
	table := c.Query("table")

	if schema == "" {
		schema = "public"
	}

	if table == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "table parameter is required"})
		return
	}

	columns, err := h.db.ListColumns(c.Request.Context(), schema, table)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "columns": columns, "schema": schema, "table": table})
}

// Get handles GET /meta/columns/:id
func (h *ColumnHandler) Get(c *gin.Context) {
	id := c.Param("id")
	schema := c.Query("schema")
	table := c.Query("table")

	if schema == "" {
		schema = "public"
	}
	if table == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "table parameter is required"})
		return
	}

	column, err := h.db.GetColumn(c.Request.Context(), schema, table, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "column": column})
}

// Add handles POST /meta/columns
func (h *ColumnHandler) Add(c *gin.Context) {
	schema := c.Query("schema")
	table := c.Query("table")

	if schema == "" {
		schema = "public"
	}
	if table == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "table parameter is required"})
		return
	}

	var req models.AddColumnRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	colDef := models.ColumnDef{
		Name:         req.Name,
		Type:         req.Type,
		Nullable:     req.Nullable,
		DefaultValue: req.DefaultValue,
		Description:  req.Description,
	}

	if err := h.db.AddColumn(c.Request.Context(), schema, table, colDef); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "message": "Column added"})
}

// Alter handles PATCH /meta/columns/:id
func (h *ColumnHandler) Alter(c *gin.Context) {
	id := c.Param("id")
	schema := c.Query("schema")
	table := c.Query("table")

	if schema == "" {
		schema = "public"
	}
	if table == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "table parameter is required"})
		return
	}

	var req models.AlterColumnRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	ctx := c.Request.Context()

	// Handle type change
	if req.Type != nil {
		if err := h.db.AlterColumnType(ctx, schema, table, id, *req.Type); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
			return
		}
	}

	// Handle nullable change
	if req.Nullable != nil {
		if err := h.db.SetColumnNullable(ctx, schema, table, id, *req.Nullable); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
			return
		}
	}

	// Handle default change
	if req.DefaultValue != nil {
		if err := h.db.AlterColumnDefault(ctx, schema, table, id, *req.DefaultValue); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Column altered"})
}

// Drop handles DELETE /meta/columns/:id
func (h *ColumnHandler) Drop(c *gin.Context) {
	id := c.Param("id")
	schema := c.Query("schema")
	table := c.Query("table")

	if schema == "" {
		schema = "public"
	}
	if table == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "table parameter is required"})
		return
	}

	cascade := c.Query("cascade") == "true"

	if err := h.db.DropColumn(c.Request.Context(), schema, table, id, cascade); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Column dropped"})
}
