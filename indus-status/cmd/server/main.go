package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/indusbase/indus-status/internal/api"
	"github.com/indusbase/indus-status/internal/config"
	"github.com/indusbase/indus-status/internal/db"
	"github.com/indusbase/indus-status/internal/handlers"
	"github.com/indusbase/indus-status/internal/repository"
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

	ctx := context.Background()
	if err := db.RunMigrations(ctx, database); err != nil {
		logger.Error("migration_failed", slog.String("error", err.Error()))
		os.Exit(1)
	}

	repo := repository.NewStatusRepository(database)
	status := handlers.NewStatusHandler(repo)
	incidents := handlers.NewIncidentsHandler(repo)
	maintenance := handlers.NewMaintenanceHandler(repo)
	subscribers := handlers.NewSubscribersHandler(repo)

	server := api.NewServer(cfg.ServerPort, cfg.InternalSecret, status, incidents, maintenance, subscribers)

	go func() {
		logger.Info("status_server_starting", slog.Int("port", cfg.ServerPort))
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("server_failed", slog.String("error", err.Error()))
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Error("shutdown_failed", slog.String("error", err.Error()))
		os.Exit(1)
	}
	logger.Info("status_server_stopped")
}
