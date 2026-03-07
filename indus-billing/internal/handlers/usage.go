package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-billing/internal/metrics"
	"github.com/indusbase/indus-billing/internal/repository"
)

type UsageHandler struct {
	repo *repository.BillingRepository
}

func NewUsageHandler(repo *repository.BillingRepository) *UsageHandler {
	return &UsageHandler{repo: repo}
}

func (h *UsageHandler) List(c *gin.Context) {
	projectID := c.Query("project_id")
	if projectID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": gin.H{"code": "PROJECT_ID_REQUIRED", "message": "project_id query param is required"}})
		return
	}
	metrics.UsageQueriesTotal.Inc()
	_ = h.repo.UpsertDailyUsageRollups(c.Request.Context(), projectID)
	days, _ := strconv.Atoi(c.DefaultQuery("days", "30"))
	items, err := h.repo.DailyUsage(c.Request.Context(), projectID, days)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "USAGE_QUERY_FAILED", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items, "error": nil})
}

func (h *UsageHandler) Summary(c *gin.Context) {
	projectID := c.Query("project_id")
	if projectID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": gin.H{"code": "PROJECT_ID_REQUIRED", "message": "project_id query param is required"}})
		return
	}
	metrics.UsageQueriesTotal.Inc()
	_ = h.repo.UpsertDailyUsageRollups(c.Request.Context(), projectID)
	summary, err := h.repo.UsageSummary(c.Request.Context(), projectID, c.Query("from"), c.Query("to"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "USAGE_SUMMARY_FAILED", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": summary, "error": nil})
}
