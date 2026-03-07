package cmd

import (
	"os"

	"github.com/spf13/cobra"
)

var (
	// Version is set during build
	Version = "dev"
	// ConfigFile is the path to the config file
	ConfigFile string
)

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "indus",
	Short: "IndusBase CLI - Developer tools for IndusBase",
	Long: `IndusBase CLI is a developer tool for managing local IndusBase instances.

It provides commands for initializing projects, managing services,
viewing logs, database operations, and deploying to IndusBase Cloud.

Examples:
  indus init          # Initialize a new project
  indus start         # Start all services
  indus logs          # View service logs
  indus db psql       # Open PostgreSQL console`,
	Version: Version,
}

// Execute adds all child commands to the root command and sets flags appropriately.
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

func init() {
	rootCmd.PersistentFlags().StringVar(&ConfigFile, "config", "", "config file (default is indusbase.yaml)")
}
