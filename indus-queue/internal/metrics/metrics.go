package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"net/http"
)

var (
	HttpRequestsTotal = promauto.NewCounterVec(prometheus.CounterOpts{Name: "http_requests_total", Help: "Total HTTP requests"}, []string{"method", "path", "status"})
	HttpRequestDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{Name: "http_request_duration_seconds", Help: "HTTP request duration in seconds", Buckets: prometheus.DefBuckets}, []string{"method", "path"})
	ActiveConnections = promauto.NewGauge(prometheus.GaugeOpts{Name: "active_connections", Help: "Number of active HTTP connections"})

	PendingJobsGauge = promauto.NewGaugeVec(prometheus.GaugeOpts{Name: "pending_jobs", Help: "Pending jobs by queue"}, []string{"queue"})
	ProcessedJobsTotal = promauto.NewCounterVec(prometheus.CounterOpts{Name: "processed_jobs_total", Help: "Processed jobs by queue and status"}, []string{"queue", "status"})
	DeadJobsTotal = promauto.NewCounter(prometheus.CounterOpts{Name: "dead_jobs_total", Help: "Total dead jobs"})
	WebhookDeliveriesTotal = promauto.NewCounterVec(prometheus.CounterOpts{Name: "webhook_deliveries_total", Help: "Webhook deliveries by status"}, []string{"status"})
)

func Handler() http.Handler { return promhttp.Handler() }
