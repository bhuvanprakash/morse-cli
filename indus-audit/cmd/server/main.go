package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/indusbase/indus-audit/internal/api"
	"github.com/indusbase/indus-audit/internal/config"
	"github.com/indusbase/indus-audit/internal/db"
	"github.com/indusbase/indus-audit/internal/handlers"
	"github.com/indusbase/indus-audit/internal/repository"
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

	repo := repository.NewAuditRepository(database)
	auditHandler := handlers.NewAuditHandler(repo)
	exportHandler := handlers.NewExportHandler(repo)

	server := api.NewServer(cfg.ServerPort, cfg.InternalSecret, auditHandler, exportHandler)

	go func() {
		logger.Info("audit_server_starting", slog.Int("port", cfg.ServerPort))
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
		logger.Error("server_shutdown_failed", slog.String("error", err.Error()))
		os.Exit(1)
	}
	logger.Info("audit_server_stopped")
}
