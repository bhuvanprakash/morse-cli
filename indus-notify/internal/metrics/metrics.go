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
	NotificationsSent = promauto.NewCounterVec(prometheus.CounterOpts{Name: "notifications_sent_total", Help: "Notifications sent by channel/provider/status"}, []string{"channel", "provider", "status"})
	PushTokensActive = promauto.NewGauge(prometheus.GaugeOpts{Name: "push_tokens_active", Help: "Active push tokens"})
)

func Handler() http.Handler { return promhttp.Handler() }
