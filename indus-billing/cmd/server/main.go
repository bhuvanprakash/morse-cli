package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/indusbase/indus-billing/internal/api"
	"github.com/indusbase/indus-billing/internal/config"
	"github.com/indusbase/indus-billing/internal/db"
	"github.com/indusbase/indus-billing/internal/handlers"
	"github.com/indusbase/indus-billing/internal/repository"
	"github.com/indusbase/indus-billing/internal/services"
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

	repo := repository.NewBillingRepository(database)
	for _, plan := range services.DefaultPlans() {
		_ = repo.UpsertPlan(ctx, plan)
	}

	plansHandler := handlers.NewPlansHandler(repo)
	usageHandler := handlers.NewUsageHandler(repo)
	invoicesHandler := handlers.NewInvoicesHandler(repo)
	subscriptionsHandler := handlers.NewSubscriptionsHandler(repo)
	webhooksHandler := handlers.NewWebhooksHandler(cfg.StripeWebhookSecret)

	server := api.NewServer(cfg.ServerPort, plansHandler, usageHandler, invoicesHandler, subscriptionsHandler, webhooksHandler)

	go func() {
		logger.Info("billing_server_starting", slog.Int("port", cfg.ServerPort))
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
	logger.Info("billing_server_stopped")
}
