package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-billing/internal/models"
	"github.com/indusbase/indus-billing/internal/repository"
)

type SubscriptionsHandler struct {
	repo *repository.BillingRepository
}

func NewSubscriptionsHandler(repo *repository.BillingRepository) *SubscriptionsHandler {
	return &SubscriptionsHandler{repo: repo}
}

func (h *SubscriptionsHandler) Active(c *gin.Context) {
	projectID := c.Query("project_id")
	if projectID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": gin.H{"code": "PROJECT_ID_REQUIRED", "message": "project_id query param is required"}})
		return
	}
	sub, err := h.repo.ActiveSubscriptionByProject(c.Request.Context(), projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "SUBSCRIPTION_LOOKUP_FAILED", "message": err.Error()}})
		return
	}
	if sub == nil {
		c.JSON(http.StatusOK, gin.H{"data": nil, "error": nil})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": sub, "error": nil})
}

func (h *SubscriptionsHandler) Create(c *gin.Context) {
	var req struct {
		ProjectID      string `json:"project_id" binding:"required"`
		PlanKey        string `json:"plan_key" binding:"required"`
		BusinessName   string `json:"business_name"`
		GSTIN          string `json:"gstin"`
		BillingAddress string `json:"billing_address"`
		StateCode      string `json:"state_code"`
		CountryCode    string `json:"country_code"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": gin.H{"code": "BAD_REQUEST", "message": err.Error()}})
		return
	}
	sub := &models.Subscription{
		ProjectID:      req.ProjectID,
		PlanKey:        req.PlanKey,
		Status:         "active",
		BusinessName:   ptr(req.BusinessName),
		GSTIN:          ptr(req.GSTIN),
		BillingAddress: ptr(req.BillingAddress),
		StateCode:      ptr(req.StateCode),
		CountryCode:    ptr(defaultIfEmpty(req.CountryCode, "IN")),
	}
	if err := h.repo.CreateSubscription(c.Request.Context(), sub); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "SUBSCRIPTION_CREATE_FAILED", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": sub, "error": nil})
}

func (h *SubscriptionsHandler) Update(c *gin.Context) {
	var req struct {
		PlanKey        *string `json:"plan_key"`
		Status         *string `json:"status"`
		EndAt          *string `json:"end_at"`
		BusinessName   *string `json:"business_name"`
		GSTIN          *string `json:"gstin"`
		BillingAddress *string `json:"billing_address"`
		StateCode      *string `json:"state_code"`
		CountryCode    *string `json:"country_code"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": gin.H{"code": "BAD_REQUEST", "message": err.Error()}})
		return
	}
	updates := map[string]interface{}{}
	if req.PlanKey != nil {
		updates["plan_key"] = *req.PlanKey
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if req.EndAt != nil && *req.EndAt != "" {
		if t, err := time.Parse(time.RFC3339, *req.EndAt); err == nil {
			updates["end_at"] = t
		}
	}
	if req.BusinessName != nil {
		updates["business_name"] = *req.BusinessName
	}
	if req.GSTIN != nil {
		updates["gstin"] = *req.GSTIN
	}
	if req.BillingAddress != nil {
		updates["billing_address"] = *req.BillingAddress
	}
	if req.StateCode != nil {
		updates["state_code"] = *req.StateCode
	}
	if req.CountryCode != nil {
		updates["country_code"] = *req.CountryCode
	}
	if err := h.repo.UpdateSubscription(c.Request.Context(), c.Param("id"), updates); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "SUBSCRIPTION_UPDATE_FAILED", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"updated": true, "id": c.Param("id")}, "error": nil})
}

func ptr(v string) *string {
	if v == "" {
		return nil
	}
	return &v
}

func defaultIfEmpty(v, fallback string) string {
	if v == "" {
		return fallback
	}
	return v
}
