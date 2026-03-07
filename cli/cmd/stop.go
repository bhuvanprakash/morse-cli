package cmd

import (
	"github.com/indusbase/cli/internal/docker"
	"github.com/indusbase/cli/internal/output"
	"github.com/spf13/cobra"
)

var (
	stopVolumes bool
)

// stopCmd represents the stop command
var stopCmd = &cobra.Command{
	Use:   "stop",
	Short: "Stop all IndusBase services",
	Long: `Stop all IndusBase services using docker-compose down.

Use the --volumes flag to also remove volumes (this will delete all data).`,
	Run: runStop,
}

func init() {
	rootCmd.AddCommand(stopCmd)
	stopCmd.Flags().BoolVar(&stopVolumes, "volumes", false, "Also remove volumes (WARNING: this will delete all data)")
}

func runStop(cmd *cobra.Command, args []string) {
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

	if stopVolumes {
		output.PrintWarning("This will stop all services AND REMOVE ALL DATA!")
		output.PrintWarning("Database data will be permanently deleted.")
	}

	// Stop services
	if err := client.StopServices(stopVolumes); err != nil {
		output.PrintError("Failed to stop services: %v", err)
		return
	}

	if stopVolumes {
		output.PrintSuccess("All services stopped and volumes removed")
	} else {
		output.PrintSuccess("All services stopped")
	}

	output.PrintInfo("Data is preserved. Run 'indus start' to restart services.")
}
