package config

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

// IndusConfig represents the project configuration
type IndusConfig struct {
	Project  ProjectConfig  `yaml:"project"`
	Database DatabaseConfig `yaml:"database"`
	Services ServicesConfig `yaml:"services"`
}

// ProjectConfig contains project metadata
type ProjectConfig struct {
	Name    string `yaml:"name"`
	Version string `yaml:"version"`
}

// DatabaseConfig contains database settings
type DatabaseConfig struct {
	Name     string `yaml:"name"`
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	User     string `yaml:"user"`
	Password string `yaml:"password"`
}

// ServicesConfig contains service port mappings
type ServicesConfig struct {
	Studio StudioConfig `yaml:"studio"`
	Auth   AuthConfig   `yaml:"auth"`
	Query  QueryConfig  `yaml:"query"`
}

// StudioConfig contains studio service settings
type StudioConfig struct {
	Port int `yaml:"port"`
}

// AuthConfig contains auth service settings
type AuthConfig struct {
	Port int `yaml:"port"`
}

// QueryConfig contains query service settings
type QueryConfig struct {
	Port int `yaml:"port"`
}

// DefaultConfig returns a default configuration
type DefaultConfig IndusConfig

// NewDefaultConfig creates a new default configuration
func NewDefaultConfig(projectName, dbName string) *IndusConfig {
	return &IndusConfig{
		Project: ProjectConfig{
			Name:    projectName,
			Version: "1.0.0",
		},
		Database: DatabaseConfig{
			Name:     dbName,
			Host:     "localhost",
			Port:     5432,
			User:     "postgres",
			Password: "postgres",
		},
		Services: ServicesConfig{
			Studio: StudioConfig{Port: 3000},
			Auth:   AuthConfig{Port: 8080},
			Query:  QueryConfig{Port: 8081},
		},
	}
}

// LoadFromFile loads configuration from a YAML file
func LoadFromFile(path string) (*IndusConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var config IndusConfig
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	return &config, nil
}

// SaveToFile saves configuration to a YAML file
func (c *IndusConfig) SaveToFile(path string) error {
	data, err := yaml.Marshal(c)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	if err := os.WriteFile(path, data, 0644); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	return nil
}

// ConfigFileExists checks if the config file exists
func ConfigFileExists(path string) bool {
	_, err := os.Stat(path)
	return !os.IsNotExist(err)
}
