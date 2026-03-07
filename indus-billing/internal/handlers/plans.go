package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-billing/internal/repository"
)

type PlansHandler struct {
	repo *repository.BillingRepository
}

func NewPlansHandler(repo *repository.BillingRepository) *PlansHandler {
	return &PlansHandler{repo: repo}
}

func (h *PlansHandler) List(c *gin.Context) {
	plans, err := h.repo.ListPlans(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "PLANS_LIST_FAILED", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": plans, "error": nil})
}
