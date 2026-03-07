package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-meta/internal/postgres"
)

// TableHandler handles table-related requests
type TableHandler struct {
	db *postgres.DB
}

// NewTableHandler creates a new table handler
func NewTableHandler(db *postgres.DB) *TableHandler {
	return &TableHandler{db: db}
}

// List handles GET /meta/tables?schema=public
func (h *TableHandler) List(c *gin.Context) {
	schema := c.Query("schema")
	if schema == "" {
		schema = "public"
	}

	tables, err := h.db.ListTables(c.Request.Context(), schema)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "tables": tables, "schema": schema})
}

// Get handles GET /meta/tables/:id (format: schema.name or just name)
func (h *TableHandler) Get(c *gin.Context) {
	id := c.Param("id")
	schema := c.Query("schema")
	if schema == "" {
		schema = "public"
	}

	table, err := h.db.GetTable(c.Request.Context(), schema, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "table": table})
}

// Create handles POST /meta/tables
func (h *TableHandler) Create(c *gin.Context) {
	var req postgres.CreateTableRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	if req.Schema == "" {
		req.Schema = "public"
	}

	if err := h.db.CreateTable(c.Request.Context(), req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "message": "Table created"})
}

// Alter handles PATCH /meta/tables/:id
func (h *TableHandler) Alter(c *gin.Context) {
	id := c.Param("id")
	schema := c.Query("schema")
	if schema == "" {
		schema = "public"
	}

	var req struct {
		NewName string `json:"new_name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	if err := h.db.AlterTableName(c.Request.Context(), schema, id, req.NewName); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Table renamed"})
}

// Drop handles DELETE /meta/tables/:id
func (h *TableHandler) Drop(c *gin.Context) {
	id := c.Param("id")
	schema := c.Query("schema")
	if schema == "" {
		schema = "public"
	}

	cascade := c.Query("cascade") == "true"

	if err := h.db.DropTable(c.Request.Context(), schema, id, cascade); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Table dropped"})
}

// EnableRLS handles POST /meta/tables/:id/enable-rls
func (h *TableHandler) EnableRLS(c *gin.Context) {
	id := c.Param("id")
	schema := c.Query("schema")
	if schema == "" {
		schema = "public"
	}

	if err := h.db.EnableRLS(c.Request.Context(), schema, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "RLS enabled"})
}

// DisableRLS handles POST /meta/tables/:id/disable-rls
func (h *TableHandler) DisableRLS(c *gin.Context) {
	id := c.Param("id")
	schema := c.Query("schema")
	if schema == "" {
		schema = "public"
	}

	if err := h.db.DisableRLS(c.Request.Context(), schema, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "RLS disabled"})
}
