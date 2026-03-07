package cmd

import (
	"fmt"
	"os"
	"strings"

	"github.com/indusbase/cli/internal/config"
	"github.com/indusbase/cli/internal/output"
	"github.com/manifoldco/promptui"
	"github.com/spf13/cobra"
)

// initCmd represents the init command
var initCmd = &cobra.Command{
	Use:   "init",
	Short: "Initialize a new IndusBase project",
	Long: `Initialize a new IndusBase project with interactive prompts.

This command will:
- Prompt for project name and database name
- Create indusbase.yaml configuration file
- Create migrations/ folder
- Create docker-compose.override.yml template`,
	Run: runInit,
}

func init() {
	rootCmd.AddCommand(initCmd)
}

func runInit(cmd *cobra.Command, args []string) {
	output.PrintHeader("IndusBase Project Initialization")

	// Check if config already exists
	if config.ConfigFileExists("indusbase.yaml") {
		prompt := promptui.Prompt{
			Label:     "Config file already exists. Overwrite",
			IsConfirm: true,
		}
		result, _ := prompt.Run()
		if strings.ToLower(result) != "y" {
			output.PrintInfo("Initialization cancelled")
			return
		}
	}

	// Prompt for project name
	projectPrompt := promptui.Prompt{
		Label:   "Project name",
		Default: "my-indusbase-project",
	}
	projectName, err := projectPrompt.Run()
	if err != nil {
		output.PrintError("Failed to get project name: %v", err)
		return
	}

	// Prompt for database name
	dbPrompt := promptui.Prompt{
		Label:   "Database name",
		Default: strings.ReplaceAll(projectName, "-", "_") + "_db",
	}
	dbName, err := dbPrompt.Run()
	if err != nil {
		output.PrintError("Failed to get database name: %v", err)
		return
	}

	// Create config
	cfg := config.NewDefaultConfig(projectName, dbName)

	// Save config
	if err := cfg.SaveToFile("indusbase.yaml"); err != nil {
		output.PrintError("Failed to save config: %v", err)
		return
	}
	output.PrintSuccess("Created indusbase.yaml")

	// Create migrations folder
	if err := os.MkdirAll("migrations", 0755); err != nil {
		output.PrintError("Failed to create migrations folder: %v", err)
		return
	}
	output.PrintSuccess("Created migrations/")

	// Create initial migration
	initialMigration := `-- Initial migration
-- Created by IndusBase CLI

-- Add your initial schema here
`
	if err := os.WriteFile("migrations/001_initial.sql", []byte(initialMigration), 0644); err != nil {
		output.PrintError("Failed to create initial migration: %v", err)
		return
	}
	output.PrintSuccess("Created migrations/001_initial.sql")

	// Create docker-compose.override.yml template
	overrideContent := `# Docker Compose Override
# Customize your local development environment here

# version: '3.8'
# services:
#   postgres:
#     environment:
#       POSTGRES_DB: ` + dbName + `
#   studio:
#     ports:
#       - "3000:3000"
`
	if err := os.WriteFile("docker-compose.override.yml", []byte(overrideContent), 0644); err != nil {
		output.PrintError("Failed to create docker-compose.override.yml: %v", err)
		return
	}
	output.PrintSuccess("Created docker-compose.override.yml")

	// Create .env template
	envContent := `# IndusBase Environment Variables
# Copy to .env and customize as needed

POSTGRES_DB=` + dbName + `
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# IndusBase Services
STUDIO_PORT=3000
AUTH_PORT=8080
QUERY_PORT=8081
`
	if err := os.WriteFile(".env.example", []byte(envContent), 0644); err != nil {
		output.PrintError("Failed to create .env.example: %v", err)
		return
	}
	output.PrintSuccess("Created .env.example")

	output.PrintHeader("Project '%s' initialized successfully!", projectName)
	fmt.Println()
	output.PrintInfo("Next steps:")
	fmt.Println("  1. Copy .env.example to .env and customize")
	fmt.Println("  2. Run 'indus start' to start all services")
	fmt.Println("  3. Visit http://localhost:3000 for the Studio")
}
