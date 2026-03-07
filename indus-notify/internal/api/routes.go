package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-notify/internal/metrics"
)

func SetupRoutes(router *gin.Engine, deps *Dependencies) {
	router.Use(MetricsMiddleware())

	router.GET("/health", func(c *gin.Context) {
		OK(c, gin.H{"status": "ok"})
	})
	router.GET("/metrics", gin.WrapH(metrics.Handler()))

	notify := router.Group("/notify")
	notify.Use(RequireAuth(deps.AuthClient))
	{
		notify.POST("/push", deps.PushHandler.Send)
		notify.POST("/push/register", deps.PushHandler.Register)
		notify.DELETE("/push/register/:token", deps.PushHandler.Deactivate)
		notify.GET("/push/tokens", RequireAdmin(), deps.PushHandler.ListTokens)

		notify.POST("/sms", deps.SMSHandler.Send)
		notify.POST("/sms/batch", deps.SMSHandler.SendBatch)

		notify.POST("/email", deps.EmailHandler.Send)
		notify.POST("/email/batch", deps.EmailHandler.SendBatch)

		notify.POST("/whatsapp", deps.WAHandler.Send)

		notify.POST("/templates", deps.TplHandler.Create)
		notify.GET("/templates", deps.TplHandler.List)
		notify.GET("/templates/:name", deps.TplHandler.Get)
		notify.PUT("/templates/:name", deps.TplHandler.Update)
		notify.DELETE("/templates/:name", deps.TplHandler.Delete)
		notify.POST("/templates/:name/preview", deps.TplHandler.Preview)

		notify.GET("/history", deps.History.List)
		notify.GET("/stats", deps.History.Stats)
	}

	router.NoRoute(func(c *gin.Context) {
		Error(c, http.StatusNotFound, "NOT_FOUND", "route not found")
	})
}
