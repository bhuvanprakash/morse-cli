package api

import (
	"fmt"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-meta/internal/metrics"
	"github.com/prometheus/client_golang/prometheus"
)

func MetricsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		metrics.ActiveConnections.Inc()
		defer metrics.ActiveConnections.Dec()
		path := c.FullPath()
		if path == "" { path = c.Request.URL.Path }
		timer := prometheus.NewTimer(metrics.HttpRequestDuration.WithLabelValues(c.Request.Method, path))
		c.Next()
		timer.ObserveDuration()
		metrics.HttpRequestsTotal.WithLabelValues(c.Request.Method, path, fmt.Sprintf("%d", c.Writer.Status())).Inc()
	}
}
