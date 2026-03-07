package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-status/internal/metrics"
	"github.com/indusbase/indus-status/internal/repository"
)

type SubscribersHandler struct {
	repo *repository.StatusRepository
}

func NewSubscribersHandler(repo *repository.StatusRepository) *SubscribersHandler {
	return &SubscribersHandler{repo: repo}
}

func (h *SubscribersHandler) Subscribe(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required,email"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": gin.H{"code": "BAD_REQUEST", "message": err.Error()}})
		return
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))
	if err := h.repo.Subscribe(c.Request.Context(), email); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "SUBSCRIBE_FAILED", "message": err.Error()}})
		return
	}
	if count, err := h.repo.SubscriberCount(c.Request.Context()); err == nil {
		metrics.SubscribersTotal.Set(float64(count))
	}
	c.JSON(http.StatusCreated, gin.H{"data": gin.H{"subscribed": true, "email": email}, "error": nil})
}
