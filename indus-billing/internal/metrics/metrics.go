package metrics

import (
	"net/http"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	UsageQueriesTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "billing_usage_queries_total",
		Help: "Total usage query requests",
	})
	InvoicePreviewTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "billing_invoice_preview_total",
		Help: "Total invoice preview requests",
	})
	StripeWebhookTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "billing_stripe_webhook_total",
		Help: "Total Stripe webhook events by verification status",
	}, []string{"status"})
)

func Handler() http.Handler {
	return promhttp.Handler()
}
