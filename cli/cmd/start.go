package cmd

import (
	"context"
	"fmt"
	"time"

	"github.com/indusbase/cli/internal/docker"
	"github.com/indusbase/cli/internal/output"
	"github.com/indusbase/cli/internal/spinner"
	"github.com/spf13/cobra"
)

// startCmd represents the start command
var startCmd = &cobra.Command{
	Use:   "start",
	Short: "Start all IndusBase services",
	Long: `Start all IndusBase services using docker-compose.

This command will:
- Check if docker-compose.yml exists
- Pull Docker images if needed
- Start all services in detached mode
- Perform health checks
- Display service URLs`,
	Run: runStart,
}

func init() {
	rootCmd.AddCommand(startCmd)
}

func runStart(cmd *cobra.Command, args []string) {
	client := docker.NewClient("")

	// Check Docker is running
	if err := client.CheckDockerRunning(); err != nil {
		output.PrintError("%v", err)
		return
	}

	// Check compose file exists
	if err := client.CheckComposeFileExists(); err != nil {
		output.PrintError("%v", err)
		return
	}

	// Pull images with spinner
	s := spinner.New("Pulling Docker images...")
	s.Start()
	if err := client.PullImages(); err != nil {
		s.Error("Failed to pull images")
		output.PrintError("%v", err)
		return
	}
	s.Success("Images pulled successfully")

	// Start services
	s = spinner.New("Starting services...")
	s.Start()
	if err := client.StartServices(); err != nil {
		s.Error("Failed to start services")
		output.PrintError("%v", err)
		return
	}
	s.Success("Services started")

	// Get list of services for health check
	services, err := client.ListServices()
	if err != nil {
		output.PrintWarning("Could not list services: %v", err)
		services = []string{"postgres", "studio", "auth", "query"}
	}

	// Health check
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	s = spinner.New("Waiting for services to be healthy...")
	s.Start()
	if err := client.HealthCheck(ctx, services); err != nil {
		s.Error("Health check failed")
		output.PrintError("%v", err)
		output.PrintInfo("Some services may still be starting. Check logs with 'indus logs'")
		return
	}
	s.Success("All services are healthy")

	// Print status
	output.PrintHeader("IndusBase is running!")

	// Get service URLs
	urls, err := client.GetServiceURLs()
	if err != nil {
		output.PrintWarning("Could not get service URLs: %v", err)
	}

	// Print service status
	output.PrintInfo("Services:")
	serviceNames := []string{"studio", "auth", "query", "postgres"}
	for _, name := range serviceNames {
		url := urls[name]
		if url != "" {
			output.PrintServiceStatus(name, "running", url)
		} else {
			output.PrintServiceStatus(name, "running", "")
		}
	}

	fmt.Println()
	output.PrintInfo("Studio: http://localhost:3000")
	output.PrintInfo("Use 'indus logs' to view logs")
	output.PrintInfo("Use 'indus stop' to stop services")
}
