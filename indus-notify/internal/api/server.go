package api

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-notify/internal/config"
	"github.com/indusbase/indus-notify/internal/handlers"
)

type Dependencies struct {
	Config       *config.Config
	Logger       *slog.Logger
	DB           *sql.DB
	AuthClient   *AuthClient
	PushHandler  *handlers.PushHandler
	SMSHandler   *handlers.SMSHandler
	EmailHandler *handlers.EmailHandler
	WAHandler    *handlers.WhatsAppHandler
	TplHandler   *handlers.TemplateHandler
	History      *handlers.HistoryHandler
}

type Server struct {
	router     *gin.Engine
	httpServer *http.Server
	config     *config.Config
	logger     *slog.Logger
}

func NewServer(deps *Dependencies) *Server {
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(RequestIDMiddleware())
	router.Use(LoggerMiddleware(deps.Logger))
	router.Use(gin.Recovery())
	router.Use(CORSMiddleware())
	SetupRoutes(router, deps)

	return &Server{
		router: router,
		httpServer: &http.Server{
			Addr:              fmt.Sprintf(":%d", deps.Config.ServerPort),
			Handler:           router,
			ReadHeaderTimeout: 10 * time.Second,
			ReadTimeout:       30 * time.Second,
			WriteTimeout:      30 * time.Second,
			IdleTimeout:       120 * time.Second,
		},
		config: deps.Config,
		logger: deps.Logger,
	}
}

func (s *Server) Start() error {
	s.logger.Info("server_starting", slog.Int("port", s.config.ServerPort))
	return s.httpServer.ListenAndServe()
}

func (s *Server) Stop() error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	s.logger.Info("server_stopping")
	return s.httpServer.Shutdown(ctx)
}
