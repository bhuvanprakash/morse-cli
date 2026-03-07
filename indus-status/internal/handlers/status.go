package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-status/internal/repository"
)

type StatusHandler struct {
	repo *repository.StatusRepository
}

func NewStatusHandler(repo *repository.StatusRepository) *StatusHandler {
	return &StatusHandler{repo: repo}
}

func (h *StatusHandler) Public(c *gin.Context) {
	components, err := h.repo.Components(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "COMPONENTS_FAILED", "message": err.Error()}})
		return
	}
	incidents, err := h.repo.ListIncidents(c.Request.Context(), true)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "INCIDENTS_FAILED", "message": err.Error()}})
		return
	}
	maintenance, _ := h.repo.ListMaintenance(c.Request.Context())
	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"components":  components,
		"incidents":   incidents,
		"maintenance": maintenance,
	}, "error": nil})
}

func (h *StatusHandler) PublicIncidents(c *gin.Context) {
	incidents, err := h.repo.ListIncidents(c.Request.Context(), true)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "INCIDENTS_FAILED", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": incidents, "error": nil})
}
