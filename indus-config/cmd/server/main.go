package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/indusbase/indus-config/internal/api"
	"github.com/indusbase/indus-config/internal/audit"
	"github.com/indusbase/indus-config/internal/config"
	"github.com/indusbase/indus-config/internal/db"
	"github.com/indusbase/indus-config/internal/handlers"
	"github.com/indusbase/indus-config/internal/repository"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	cfg := config.FromEnv()

	ctx := context.Background()
	database, err := db.Connect(cfg.DatabaseURL)
	if err != nil {
		logger.Error("database_connect_failed", slog.String("error", err.Error()))
		os.Exit(1)
	}
	defer database.Close()

	if err := db.RunMigrations(ctx, database); err != nil {
		logger.Error("migration_failed", slog.String("error", err.Error()))
		os.Exit(1)
	}

	envRepo := repository.NewEnvironmentRepository(database)
	flagRepo := repository.NewFlagRepository(database)
	configRepo := repository.NewConfigRepository(database)
	auditClient := audit.NewClient(cfg.AuditServiceURL, cfg.InternalSecret)

	healthHandler := handlers.NewHealthHandler(logger)
	remoteConfigHandler := handlers.NewRemoteConfigHandler(configRepo, envRepo, cfg.ConfigEncryptionKey)
	flagsHandler := handlers.NewFlagsHandler(flagRepo, configRepo, envRepo, cfg.CacheTTL, remoteConfigHandler.DecryptValue, auditClient)
	envHandler := handlers.NewEnvironmentHandler(envRepo)

	server := api.NewServer(&api.ServerDependencies{
		Logger:        logger,
		AuthClient:    api.NewAuthClient(cfg.AuthServiceURL, cfg.InternalSecret),
		FlagHandler:   flagsHandler,
		ConfigHandler: remoteConfigHandler,
		EnvHandler:    envHandler,
		HealthHandler: healthHandler,
	})

	httpServer := &http.Server{
		Addr:              ":" + itoa(cfg.ServerPort),
		Handler:           server,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		logger.Info("server_starting", slog.Int("port", cfg.ServerPort))
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("server_failed", slog.String("error", err.Error()))
			os.Exit(1)
		}
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	logger.Info("server_stopping")
	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		logger.Error("server_shutdown_failed", slog.String("error", err.Error()))
		os.Exit(1)
	}
}

func itoa(v int) string {
	return fmt.Sprintf("%d", v)
}
