package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-billing/internal/metrics"
	"github.com/indusbase/indus-billing/internal/repository"
)

type InvoicesHandler struct {
	repo *repository.BillingRepository
}

func NewInvoicesHandler(repo *repository.BillingRepository) *InvoicesHandler {
	return &InvoicesHandler{repo: repo}
}

func (h *InvoicesHandler) List(c *gin.Context) {
	invoices, err := h.repo.ListInvoices(c.Request.Context(), c.Query("project_id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "INVOICE_LIST_FAILED", "message": err.Error()}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": invoices, "error": nil})
}

func (h *InvoicesHandler) Get(c *gin.Context) {
	invoice, err := h.repo.GetInvoice(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "INVOICE_GET_FAILED", "message": err.Error()}})
		return
	}
	if invoice == nil {
		c.JSON(http.StatusNotFound, gin.H{"data": nil, "error": gin.H{"code": "NOT_FOUND", "message": "invoice not found"}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": invoice, "error": nil})
}

func (h *InvoicesHandler) Preview(c *gin.Context) {
	projectID := c.Query("project_id")
	if projectID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"data": nil, "error": gin.H{"code": "PROJECT_ID_REQUIRED", "message": "project_id is required"}})
		return
	}
	metrics.InvoicePreviewTotal.Inc()
	_ = h.repo.UpsertDailyUsageRollups(c.Request.Context(), projectID)
	sub, err := h.repo.ActiveSubscriptionByProject(c.Request.Context(), projectID)
	if err != nil && err != sql.ErrNoRows {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "SUBSCRIPTION_LOOKUP_FAILED", "message": err.Error()}})
		return
	}
	plans, err := h.repo.ListPlans(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "PLAN_LOOKUP_FAILED", "message": err.Error()}})
		return
	}

	planKey := "free"
	if sub != nil && sub.PlanKey != "" {
		planKey = sub.PlanKey
	}
	var selectedPlan map[string]interface{}
	for _, plan := range plans {
		if plan.Key == planKey {
			selectedPlan = map[string]interface{}{
				"key":         plan.Key,
				"name":        plan.Name,
				"monthly_inr": plan.MonthlyINR,
				"limits":      plan.Limits,
				"overage_inr": plan.OverageINR,
			}
			break
		}
	}
	usage, err := h.repo.UsageSummary(c.Request.Context(), projectID, "", "")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"data": nil, "error": gin.H{"code": "USAGE_SUMMARY_FAILED", "message": err.Error()}})
		return
	}

	lineItems := []map[string]interface{}{}
	subtotal := int64(0)
	if selectedPlan != nil {
		subtotal += int64(selectedPlan["monthly_inr"].(int64))
		lineItems = append(lineItems, map[string]interface{}{
			"name":       "Base plan (" + planKey + ")",
			"quantity":   1,
			"unit_price": selectedPlan["monthly_inr"],
			"amount":     selectedPlan["monthly_inr"],
		})
	}

	limits, _ := selectedPlan["limits"].(map[string]int64)
	overageINR, _ := selectedPlan["overage_inr"].(map[string]float64)
	for metric, qty := range usage {
		limit := limits[metric]
		if qty > limit {
			excess := qty - limit
			rate := overageINR[metric]
			amount := int64(float64(excess) * rate)
			if amount > 0 {
				subtotal += amount
				lineItems = append(lineItems, map[string]interface{}{
					"name":       metric + " overage",
					"quantity":   excess,
					"unit_price": rate,
					"amount":     amount,
				})
			}
		}
	}

	gstAmount := int64(float64(subtotal) * 0.18)
	total := subtotal + gstAmount
	lineJSON, _ := json.Marshal(lineItems)
	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"project_id":     projectID,
		"currency":       "INR",
		"period_start":   time.Now().UTC().AddDate(0, 0, -30).Format("2006-01-02"),
		"period_end":     time.Now().UTC().Format("2006-01-02"),
		"plan":           selectedPlan,
		"usage_summary":  usage,
		"line_items":     json.RawMessage(lineJSON),
		"subtotal":       subtotal,
		"gst_rate":       18,
		"gst_amount":     gstAmount,
		"total":          total,
		"amount_display": "Rs." + formatINR(total),
	}, "error": nil})
}

func formatINR(amount int64) string {
	return fmt.Sprintf("%d", amount)
}
