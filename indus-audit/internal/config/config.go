package config

import (
	"os"
	"strconv"
)

type Config struct {
	ServerPort     int
	DatabaseURL    string
	InternalSecret string
}

func FromEnv() *Config {
	return &Config{
		ServerPort:     getEnvAsInt("SERVER_PORT", 8011),
		DatabaseURL:    requireEnv("DATABASE_URL"),
		InternalSecret: requireEnv("INTERNAL_SECRET"),
	}
}

func requireEnv(key string) string {
	value := os.Getenv(key)
	if value == "" {
		panic("required env var missing: " + key)
	}
	return value
}

func getEnvAsInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	out, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return out
}
