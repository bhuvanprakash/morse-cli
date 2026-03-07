package config

import (
	"os"
	"strconv"
)

type Config struct {
	ServerPort          int
	DatabaseURL         string
	InternalSecret      string
	StripeSecretKey     string
	StripeWebhookSecret string
	DefaultCurrency     string
	DefaultRegion       string
}

func FromEnv() *Config {
	return &Config{
		ServerPort:          envInt("SERVER_PORT", 8012),
		DatabaseURL:         mustEnv("DATABASE_URL"),
		InternalSecret:      mustEnv("INTERNAL_SECRET"),
		StripeSecretKey:     os.Getenv("STRIPE_SECRET_KEY"),
		StripeWebhookSecret: os.Getenv("STRIPE_WEBHOOK_SECRET"),
		DefaultCurrency:     env("BILLING_CURRENCY", "INR"),
		DefaultRegion:       env("BILLING_REGION", "ap-south-1"),
	}
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		panic("required env missing: " + key)
	}
	return v
}
