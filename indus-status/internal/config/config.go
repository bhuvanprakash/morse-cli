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
		ServerPort:     envInt("SERVER_PORT", 8014),
		DatabaseURL:    mustEnv("DATABASE_URL"),
		InternalSecret: mustEnv("INTERNAL_SECRET"),
	}
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
