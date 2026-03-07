package cmd

import (
	"github.com/indusbase/cli/internal/docker"
	"github.com/indusbase/cli/internal/output"
	"github.com/spf13/cobra"
)

var (
	logsTail int
)

// logsCmd represents the logs command
var logsCmd = &cobra.Command{
	Use:   "logs [service]",
	Short: "View service logs",
	Long: `View logs for all services or a specific service.

Examples:
  indus logs              # View logs for all services
  indus logs postgres     # View logs for postgres service
  indus logs --tail 100   # Show last 100 lines`,
	Run: runLogs,
}

func init() {
	rootCmd.AddCommand(logsCmd)
	logsCmd.Flags().IntVar(&logsTail, "tail", 0, "Number of lines to show from end of logs")
}

func runLogs(cmd *cobra.Command, args []string) {
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

	var service string
	if len(args) > 0 {
		service = args[0]
	}

	output.PrintInfo("Following logs (Press Ctrl+C to exit)...")
	if err := client.GetLogs(service, logsTail); err != nil {
		output.PrintError("Failed to get logs: %v", err)
		return
	}
}
