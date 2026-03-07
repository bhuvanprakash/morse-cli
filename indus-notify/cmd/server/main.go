package main

import (
	"context"
	"encoding/base64"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/indusbase/indus-notify/internal/api"
	"github.com/indusbase/indus-notify/internal/audit"
	"github.com/indusbase/indus-notify/internal/config"
	"github.com/indusbase/indus-notify/internal/db"
	"github.com/indusbase/indus-notify/internal/handlers"
	"github.com/indusbase/indus-notify/internal/providers"
	"github.com/indusbase/indus-notify/internal/repository"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	cfg, err := config.FromEnv()
	if err != nil {
		logger.Error("config_load_failed", slog.String("error", err.Error()))
		os.Exit(1)
	}

	database, err := db.Connect(cfg.DatabaseURL)
	if err != nil {
		logger.Error("database_connect_failed", slog.String("error", err.Error()))
		os.Exit(1)
	}
	defer database.Close()

	if err := db.RunMigrations(database); err != nil {
		logger.Error("migration_failed", slog.String("error", err.Error()))
		os.Exit(1)
	}

	deviceRepo := repository.NewDeviceRepository(database)
	templateRepo := repository.NewTemplateRepository(database)
	notificationRepo := repository.NewNotificationRepository(database)
	auditClient := audit.NewClient(cfg.AuditServiceURL, cfg.InternalSecret)

	var pushProvider providers.PushProvider
	var fcm providers.PushProvider
	if cfg.FCMCredentialsJSON != "" {
		credJSON := []byte(cfg.FCMCredentialsJSON)
		if decoded, err := base64.StdEncoding.DecodeString(cfg.FCMCredentialsJSON); err == nil {
			credJSON = decoded
		}
		fcmProvider, err := providers.NewFCMProvider(context.Background(), credJSON)
		if err != nil {
			logger.Warn("fcm_provider_init_failed", slog.String("error", err.Error()))
		} else {
			fcm = fcmProvider
			pushProvider = fcmProvider
		}
	}
	var apns providers.PushProvider
	if cfg.APNSKeyP8 != "" && cfg.APNSKeyID != "" && cfg.APNSTeamID != "" && cfg.APNSBundleID != "" {
		p8 := []byte(cfg.APNSKeyP8)
		if decoded, err := base64.StdEncoding.DecodeString(cfg.APNSKeyP8); err == nil {
			p8 = decoded
		}
		apnsProvider, err := providers.NewAPNSProvider(p8, cfg.APNSKeyID, cfg.APNSTeamID, cfg.APNSBundleID, cfg.APNSProduction)
		if err != nil {
			logger.Warn("apns_provider_init_failed", slog.String("error", err.Error()))
		} else {
			apns = apnsProvider
			if pushProvider == nil {
				pushProvider = apnsProvider
			}
		}
	}
	_ = pushProvider

	var smsPrimary providers.SMSProvider
	var twilioProvider *providers.TwilioProvider
	if cfg.TwoFactorAPIKey != "" {
		smsPrimary = providers.NewTwoFactorProvider(cfg.TwoFactorAPIKey, cfg.TwoFactorSenderID)
	} else if cfg.TwilioAccountSID != "" {
		twilioProvider = providers.NewTwilioProvider(cfg.TwilioAccountSID, cfg.TwilioAuthToken, cfg.TwilioFromNumber)
		smsPrimary = twilioProvider
	}
	if twilioProvider == nil && cfg.TwilioAccountSID != "" && cfg.TwilioAuthToken != "" && cfg.TwilioFromNumber != "" {
		twilioProvider = providers.NewTwilioProvider(cfg.TwilioAccountSID, cfg.TwilioAuthToken, cfg.TwilioFromNumber)
	}

	var emailProvider providers.EmailProvider
	if cfg.SendGridAPIKey != "" {
		emailProvider = providers.NewSendGridProvider(cfg.SendGridAPIKey, cfg.EmailFromName, cfg.EmailFromAddress)
	} else if cfg.SMTPHost != "" {
		emailProvider = providers.NewSMTPProvider(
			cfg.SMTPHost, cfg.SMTPPort,
			cfg.SMTPUsername, cfg.SMTPPassword,
			cfg.EmailFromName, cfg.EmailFromAddress, true,
		)
	}

	deps := &api.Dependencies{
		Config:       cfg,
		Logger:       logger,
		DB:           database,
		AuthClient:   api.NewAuthClient(cfg.AuthServiceURL, cfg.InternalSecret),
		PushHandler:  handlers.NewPushHandler(deviceRepo, notificationRepo, templateRepo, fcm, apns),
		SMSHandler:   handlers.NewSMSHandler(notificationRepo, templateRepo, smsPrimary, twilioProvider, cfg.QueueServiceURL, cfg.InternalSecret),
		EmailHandler: handlers.NewEmailHandler(notificationRepo, templateRepo, emailProvider, cfg.EmailFromName, cfg.EmailFromAddress, cfg.QueueServiceURL, cfg.InternalSecret),
		WAHandler:    handlers.NewWhatsAppHandler(notificationRepo, templateRepo, twilioProvider),
		TplHandler:   handlers.NewTemplateHandler(templateRepo, auditClient),
		History:      handlers.NewHistoryHandler(notificationRepo),
	}

	server := api.NewServer(deps)
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigCh
		_ = server.Stop()
	}()

	if err := server.Start(); err != nil {
		logger.Error("server_failed", slog.String("error", err.Error()))
		os.Exit(1)
	}
}
