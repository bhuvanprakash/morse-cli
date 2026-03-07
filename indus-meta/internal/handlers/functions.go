package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-meta/internal/models"
	"github.com/indusbase/indus-meta/internal/postgres"
)

// FunctionHandler handles function-related requests
type FunctionHandler struct {
	db *postgres.DB
}

// NewFunctionHandler creates a new function handler
func NewFunctionHandler(db *postgres.DB) *FunctionHandler {
	return &FunctionHandler{db: db}
}

// List handles GET /meta/functions?schema=...
func (h *FunctionHandler) List(c *gin.Context) {
	schema := c.Query("schema")
	if schema == "" {
		schema = "public"
	}

	functions, err := h.db.ListFunctions(c.Request.Context(), schema)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "functions": functions, "schema": schema})
}

// Create handles POST /meta/functions
func (h *FunctionHandler) Create(c *gin.Context) {
	var req models.CreateFunctionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	if req.Schema == "" {
		req.Schema = "public"
	}

	createReq := postgres.CreateFunctionRequest{
		Schema:     req.Schema,
		Name:       req.Name,
		Arguments:  req.Arguments,
		ReturnType: req.ReturnType,
		Language:   req.Language,
		Definition: req.Definition,
	}

	if err := h.db.CreateFunction(c.Request.Context(), createReq); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "message": "Function created"})
}

// Drop handles DELETE /meta/functions/:id
func (h *FunctionHandler) Drop(c *gin.Context) {
	id := c.Param("id")
	schema := c.Query("schema")
	if schema == "" {
		schema = "public"
	}

	if err := h.db.DropFunction(c.Request.Context(), schema, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Function dropped"})
}
