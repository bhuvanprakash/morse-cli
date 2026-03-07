package api

import (
	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-config/internal/metrics"
)

func RegisterRoutes(router *gin.Engine, deps *ServerDependencies) {
	router.Use(MetricsMiddleware())
	router.GET("/health", deps.HealthHandler.Health)
	router.GET("/metrics", gin.WrapH(metrics.Handler()))
	router.POST("/config/evaluate", deps.FlagHandler.Evaluate)

	admin := router.Group("/")
	admin.Use(RequireAuth(deps.AuthClient), RequireAdmin())
	admin.GET("/config/environments", deps.EnvHandler.List)

	admin.POST("/config/flags", deps.FlagHandler.Create)
	admin.GET("/config/flags", deps.FlagHandler.List)
	admin.GET("/config/flags/:key", deps.FlagHandler.Get)
	admin.PATCH("/config/flags/:key", deps.FlagHandler.Update)
	admin.DELETE("/config/flags/:key", deps.FlagHandler.Delete)

	admin.POST("/config/remote", deps.ConfigHandler.Create)
	admin.GET("/config/remote/export", deps.ConfigHandler.Export)
	admin.GET("/config/remote", deps.ConfigHandler.List)
	admin.GET("/config/remote/:key", deps.ConfigHandler.Get)
	admin.PATCH("/config/remote/:key", deps.ConfigHandler.Update)
	admin.DELETE("/config/remote/:key", deps.ConfigHandler.Delete)
}
