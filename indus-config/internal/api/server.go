package api

import (
	"log/slog"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-config/internal/handlers"
)

type ServerDependencies struct {
	Logger       *slog.Logger
	AuthClient   *AuthClient
	FlagHandler  *handlers.FlagsHandler
	ConfigHandler *handlers.RemoteConfigHandler
	EnvHandler   *handlers.EnvironmentHandler
	HealthHandler *handlers.HealthHandler
}

func NewServer(deps *ServerDependencies) *gin.Engine {
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(RequestIDMiddleware())
	router.Use(LoggerMiddleware(deps.Logger))
	router.Use(CORSMiddleware())
	RegisterRoutes(router, deps)
	return router
}
