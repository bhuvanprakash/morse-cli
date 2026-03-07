package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-billing/internal/handlers"
	"github.com/indusbase/indus-billing/internal/metrics"
)

func registerRoutes(r *gin.Engine, plans *handlers.PlansHandler, usage *handlers.UsageHandler, invoices *handlers.InvoicesHandler, subs *handlers.SubscriptionsHandler, webhooks *handlers.WebhooksHandler) {
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "ok"}, "error": nil})
	})
	r.GET("/metrics", gin.WrapH(metrics.Handler()))

	r.GET("/billing/plans", plans.List)
	r.GET("/billing/usage", usage.List)
	r.GET("/billing/usage/summary", usage.Summary)
	r.GET("/billing/invoices", invoices.List)
	r.GET("/billing/invoices/:id", invoices.Get)
	r.GET("/billing/invoices/preview", invoices.Preview)
	r.GET("/billing/subscriptions/active", subs.Active)
	r.POST("/billing/subscriptions", subs.Create)
	r.PATCH("/billing/subscriptions/:id", subs.Update)
	r.POST("/billing/webhooks/stripe", webhooks.Stripe)
}
