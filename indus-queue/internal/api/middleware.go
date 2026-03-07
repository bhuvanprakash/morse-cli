package api

import (
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/indusbase/indus-queue/internal/metrics"
	"github.com/prometheus/client_golang/prometheus"
)

// InternalAuthMiddleware verifies requests from indus-gate
func InternalAuthMiddleware(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Skip auth for health check
			if r.URL.Path == "/health" {
				next.ServeHTTP(w, r)
				return
			}

			if !IsInternalAuthorized(r, secret) {
				Error(w, http.StatusUnauthorized, "invalid authorization secret")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// IsInternalAuthorized validates service-to-service auth.
// Accepts either X-IndusBase-Internal header or Authorization: Bearer <secret>.
func IsInternalAuthorized(r *http.Request, secret string) bool {
	if r.Header.Get("X-IndusBase-Internal") == secret {
		return true
	}
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return false
	}
	parts := strings.SplitN(authHeader, " ", 2)
	return len(parts) == 2 && parts[0] == "Bearer" && parts[1] == secret
}

// LoggingMiddleware logs incoming requests
func LoggingMiddleware(next http.Handler) http.Handler {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		logger.Info("http_request",
			slog.String("method", r.Method),
			slog.String("path", r.URL.Path),
			slog.String("remote_addr", r.RemoteAddr),
			slog.Duration("duration", time.Since(start)),
		)
	})
}

// CORSMiddleware adds CORS headers
func CORSMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

// MetricsMiddleware records Prometheus metrics for every request.
func MetricsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		metrics.ActiveConnections.Inc()
		defer metrics.ActiveConnections.Dec()

		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		timer := prometheus.NewTimer(metrics.HttpRequestDuration.WithLabelValues(r.Method, r.URL.Path))
		defer timer.ObserveDuration()
		next.ServeHTTP(rec, r)

		metrics.HttpRequestsTotal.WithLabelValues(r.Method, r.URL.Path, fmt.Sprintf("%d", rec.status)).Inc()
	})
}
