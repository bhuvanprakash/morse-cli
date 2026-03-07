package api

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-meta/internal/config"
)

// InternalOnly validates that requests come from internal services
func InternalOnly(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip auth for health check
		if c.Request.URL.Path == "/health" {
			c.Next()
			return
		}

		// Get internal secret header
		secret := c.GetHeader("X-IndusBase-Internal")
		if secret == "" {
			JSONError(c, http.StatusUnauthorized, "Missing X-IndusBase-Internal header")
			c.Abort()
			return
		}

		// Validate secret
		if secret != cfg.InternalSecret {
			JSONError(c, http.StatusForbidden, "Invalid internal secret")
			c.Abort()
			return
		}

		c.Next()
	}
}

// Logger is a simple logging middleware
func Logger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		raw := c.Request.URL.RawQuery

		// Process request
		c.Next()

		// Log after request
		latency := time.Since(start)
		clientIP := c.ClientIP()
		method := c.Request.Method
		statusCode := c.Writer.Status()

		if raw != "" {
			path = path + "?" + raw
		}

		fmt.Printf("[%s] %s | %3d | %13v | %15s | %s\n",
			time.Now().Format("2006/01/02 15:04:05"),
			method,
			statusCode,
			latency,
			clientIP,
			path,
		)
	}
}
