package handlers

import (
	"context"
	"database/sql"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-auth/internal/db"
	"github.com/indusbase/indus-auth/internal/response"
)

// HealthCheck handles the health check endpoint
func HealthCheck(c *gin.Context) {
	response.Success(c, gin.H{
		"status":  "healthy",
		"service": "indus-auth",
		"version": "1.0.0",
	})
}

// ReadinessDependencies holds dependencies for readiness check
type ReadinessDependencies struct {
	DB    *sql.DB
	Redis *db.RedisClient
}

// ReadinessCheck handles the readiness probe endpoint
func ReadinessCheck(deps *ReadinessDependencies) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()

		checks := gin.H{}
		allHealthy := true

		// Check database
		if deps.DB != nil {
			if err := deps.DB.PingContext(ctx); err != nil {
				checks["database"] = "unhealthy"
				allHealthy = false
			} else {
				checks["database"] = "healthy"
			}
		} else {
			checks["database"] = "not configured"
		}

		// Check Redis
		if deps.Redis != nil {
			if err := deps.Redis.Ping(ctx); err != nil {
				checks["redis"] = "unhealthy"
				allHealthy = false
			} else {
				checks["redis"] = "healthy"
			}
		} else {
			checks["redis"] = "not configured"
		}

		status := "ready"
		statusCode := 200
		if !allHealthy {
			status = "not ready"
			statusCode = 503
		}

		c.JSON(statusCode, gin.H{
			"status": status,
			"checks": checks,
		})
	}
}

// LivenessCheck handles the liveness probe endpoint
func LivenessCheck(c *gin.Context) {
	response.Success(c, gin.H{
		"status": "alive",
	})
}
