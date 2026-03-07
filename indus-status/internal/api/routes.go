package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-status/internal/handlers"
	"github.com/indusbase/indus-status/internal/metrics"
)

func registerRoutes(
	r *gin.Engine,
	internalSecret string,
	status *handlers.StatusHandler,
	incidents *handlers.IncidentsHandler,
	maintenance *handlers.MaintenanceHandler,
	subscribers *handlers.SubscribersHandler,
) {
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "ok"}, "error": nil})
	})
	r.GET("/metrics", gin.WrapH(metrics.Handler()))

	r.GET("/status/public", status.Public)
	r.GET("/status/incidents/public", status.PublicIncidents)
	r.POST("/status/subscribe", subscribers.Subscribe)

	r.GET("/status/incidents", incidents.List)
	r.POST("/status/incidents", incidents.Create)
	r.PATCH("/status/incidents/:id", incidents.Update)
	r.POST("/status/incidents/:id/resolve", incidents.Resolve)
	r.POST("/status/maintenance", maintenance.Create)
	r.GET("/status/maintenance", maintenance.List)

	internal := r.Group("/status/internal", internalAuth(internalSecret))
	internal.POST("/alertmanager", incidents.AlertmanagerWebhook)
}
