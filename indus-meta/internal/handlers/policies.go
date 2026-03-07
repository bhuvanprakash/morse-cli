package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-meta/internal/models"
	"github.com/indusbase/indus-meta/internal/postgres"
)

// PolicyHandler handles RLS policy-related requests
type PolicyHandler struct {
	db *postgres.DB
}

// NewPolicyHandler creates a new policy handler
func NewPolicyHandler(db *postgres.DB) *PolicyHandler {
	return &PolicyHandler{db: db}
}

// List handles GET /meta/policies?schema=...&table=...
func (h *PolicyHandler) List(c *gin.Context) {
	schema := c.Query("schema")
	table := c.Query("table")

	if schema == "" {
		schema = "public"
	}
	if table == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "table parameter is required"})
		return
	}

	policies, err := h.db.ListPolicies(c.Request.Context(), schema, table)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "policies": policies, "schema": schema, "table": table})
}

// Create handles POST /meta/policies
func (h *PolicyHandler) Create(c *gin.Context) {
	var req models.CreatePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	if req.Schema == "" {
		req.Schema = "public"
	}

	createReq := postgres.CreatePolicyRequest{
		Schema:     req.Schema,
		Table:      req.Table,
		Name:       req.Name,
		Command:    req.Command,
		Roles:      req.Roles,
		Using:      req.Using,
		WithCheck:  req.WithCheck,
		Permissive: req.Permissive,
	}

	if err := h.db.CreatePolicy(c.Request.Context(), createReq); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "message": "Policy created"})
}

// Drop handles DELETE /meta/policies/:id
func (h *PolicyHandler) Drop(c *gin.Context) {
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

	if err := h.db.DropPolicy(c.Request.Context(), schema, table, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Policy dropped"})
}
