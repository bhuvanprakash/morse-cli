package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"net/http"
)

var (
	HttpRequestsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "http_requests_total",
		Help: "Total HTTP requests",
	}, []string{"method", "path", "status"})

	HttpRequestDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "http_request_duration_seconds",
		Help:    "HTTP request duration in seconds",
		Buckets: prometheus.DefBuckets,
	}, []string{"method", "path"})

	ActiveConnections = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "active_connections",
		Help: "Number of active HTTP connections",
	})

	AuthAttemptsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "auth_attempts_total",
		Help: "Total auth attempts",
	}, []string{"type"})
	AuthFailuresTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "auth_failures_total",
		Help: "Total auth failures",
	}, []string{"type", "reason"})
	ActiveSessionsGauge = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "auth_active_sessions",
		Help: "Active sessions count",
	})
	WhatsAppOTPSent = promauto.NewCounter(prometheus.CounterOpts{
		Name: "whatsapp_otp_sent_total",
		Help: "Total WhatsApp OTP sent",
	})
)

func Handler() http.Handler { return promhttp.Handler() }
