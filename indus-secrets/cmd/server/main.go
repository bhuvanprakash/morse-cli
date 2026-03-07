package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/indusbase/indus-secrets/internal/api"
	"github.com/indusbase/indus-secrets/internal/config"
	"github.com/indusbase/indus-secrets/internal/db"
	"github.com/indusbase/indus-secrets/internal/handlers"
	"github.com/indusbase/indus-secrets/internal/repository"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	cfg := config.FromEnv()

	database, err := db.Connect(cfg.DatabaseURL)
	if err != nil {
		logger.Error("db_connect_failed", slog.String("error", err.Error()))
		os.Exit(1)
	}
	defer database.Close()
	if err := db.RunMigrations(context.Background(), database); err != nil {
		logger.Error("migration_failed", slog.String("error", err.Error()))
		os.Exit(1)
	}

	repo := repository.NewSecretRepository(database)
	handler := handlers.NewSecretsHandler(repo, cfg.PlatformEncryptionKey, cfg.InternalSecret, cfg.AuditServiceURL)
	server := api.NewServer(cfg.ServerPort, handler)

	go func() {
		logger.Info("secrets_server_starting", slog.Int("port", cfg.ServerPort))
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("server_failed", slog.String("error", err.Error()))
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		logger.Error("shutdown_failed", slog.String("error", err.Error()))
		os.Exit(1)
	}
	logger.Info("secrets_server_stopped")
}
