package config

import (
	"os"
	"strconv"
)

type Config struct {
	ServerPort     int
	DatabaseURL    string
	InternalSecret string

	FCMCredentialsJSON string
	APNSKeyP8          string
	APNSKeyID          string
	APNSTeamID         string
	APNSBundleID       string
	APNSProduction     bool

	TwoFactorAPIKey   string
	TwoFactorSenderID string
	TwilioAccountSID  string
	TwilioAuthToken   string
	TwilioFromNumber  string

	SendGridAPIKey   string
	SMTPHost         string
	SMTPPort         int
	SMTPUsername     string
	SMTPPassword     string
	EmailFromName    string
	EmailFromAddress string

	WhatsAppAPIKey string
	WhatsAppSender string

	AuthServiceURL  string
	QueueServiceURL string
	AuditServiceURL string
}

func FromEnv() (*Config, error) {
	port, _ := strconv.Atoi(getEnvDefault("SERVER_PORT", "8009"))
	smtpPort, _ := strconv.Atoi(getEnvDefault("SMTP_PORT", "587"))
	apnsProduction := getEnvDefault("APNS_PRODUCTION", "false") == "true"

	return &Config{
		ServerPort:         port,
		DatabaseURL:        requireEnv("DATABASE_URL"),
		InternalSecret:     requireEnv("INTERNAL_SECRET"),
		FCMCredentialsJSON: os.Getenv("FCM_CREDENTIALS_JSON"),
		APNSKeyP8:          os.Getenv("APNS_KEY_P8"),
		APNSKeyID:          os.Getenv("APNS_KEY_ID"),
		APNSTeamID:         os.Getenv("APNS_TEAM_ID"),
		APNSBundleID:       os.Getenv("APNS_BUNDLE_ID"),
		APNSProduction:     apnsProduction,
		TwoFactorAPIKey:    os.Getenv("TWOFACTOR_API_KEY"),
		TwoFactorSenderID:  os.Getenv("TWOFACTOR_SENDER_ID"),
		TwilioAccountSID:   os.Getenv("TWILIO_ACCOUNT_SID"),
		TwilioAuthToken:    os.Getenv("TWILIO_AUTH_TOKEN"),
		TwilioFromNumber:   os.Getenv("TWILIO_FROM_NUMBER"),
		SendGridAPIKey:     os.Getenv("SENDGRID_API_KEY"),
		SMTPHost:           getEnvDefault("SMTP_HOST", ""),
		SMTPPort:           smtpPort,
		SMTPUsername:       os.Getenv("SMTP_USERNAME"),
		SMTPPassword:       os.Getenv("SMTP_PASSWORD"),
		EmailFromName:      getEnvDefault("EMAIL_FROM_NAME", "IndusBase"),
		EmailFromAddress:   getEnvDefault("EMAIL_FROM_ADDRESS", "noreply@indusbase.com"),
		WhatsAppAPIKey:     os.Getenv("WHATSAPP_API_KEY"),
		WhatsAppSender:     os.Getenv("WHATSAPP_SENDER"),
		AuthServiceURL:     getEnvDefault("AUTH_SERVICE_URL", "http://indus-auth:8001"),
		QueueServiceURL:    getEnvDefault("QUEUE_SERVICE_URL", "http://indus-queue:8008"),
		AuditServiceURL:    getEnvDefault("AUDIT_SERVICE_URL", "http://indus-audit:8011"),
	}, nil
}

func requireEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		panic("required env var missing: " + key)
	}
	return v
}

func getEnvDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
