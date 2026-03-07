package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-status/internal/repository"
)

type MaintenanceHandler struct {
	repo *repository.StatusRepository
}

func NewMaintenanceHandler(repo *repository.StatusRepository) *MaintenanceHandler {
	return &MaintenanceHandler{repo: repo}
}

func (h *MaintenanceHandler) Create(c *gin.Context) {
	var req struct {
		Title       string `json:"title" binding:"required"`
		Description string `json:"description"`
		StartsAt    string `json:"starts_at" binding:"required"`
		EndsAt      string `json:"ends_at" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": gin.H{"code": "BAD_REQUEST", "message": err.Error()}})
		return
	}
	if err := h.repo.CreateMaintenance(c.Request.Context(), req.Title, req.Description, req.StartsAt, req.EndsAt); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "MAINTENANCE_CREATE_FAILED", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": gin.H{"created": true}, "error": nil})
}

func (h *MaintenanceHandler) List(c *gin.Context) {
	items, err := h.repo.ListMaintenance(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "MAINTENANCE_LIST_FAILED", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items, "error": nil})
}
