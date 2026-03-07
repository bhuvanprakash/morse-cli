package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/indusbase/cli/internal/output"
	"github.com/manifoldco/promptui"
	"github.com/spf13/cobra"
)

// loginCmd represents the login command
var loginCmd = &cobra.Command{
	Use:   "login",
	Short: "Authenticate with IndusBase Cloud",
	Long: `Authenticate with IndusBase Cloud for deployment and management.

This command will:
- Prompt for IndusBase Cloud URL
- Open a browser for OAuth authentication
- Save the authentication token to ~/.indus/token`,
	Run: runLogin,
}

func init() {
	rootCmd.AddCommand(loginCmd)
}

func runLogin(cmd *cobra.Command, args []string) {
	output.PrintHeader("IndusBase Cloud Login")

	// Prompt for cloud URL
	urlPrompt := promptui.Prompt{
		Label:   "IndusBase Cloud URL",
		Default: "https://cloud.indusbase.com",
	}
	cloudURL, err := urlPrompt.Run()
	if err != nil {
		output.PrintError("Failed to get URL: %v", err)
		return
	}

	output.PrintInfo("Opening browser for authentication...")
	output.PrintInfo("Cloud URL: %s", cloudURL)

	// Create ~/.indus directory
	homeDir, err := os.UserHomeDir()
	if err != nil {
		output.PrintError("Failed to get home directory: %v", err)
		return
	}

	indusDir := filepath.Join(homeDir, ".indus")
	if err := os.MkdirAll(indusDir, 0700); err != nil {
		output.PrintError("Failed to create .indus directory: %v", err)
		return
	}

	// For now, print instructions
	output.PrintWarning("OAuth login is not yet implemented")
	output.PrintInfo("")
	output.PrintInfo("To authenticate manually:")
	output.PrintInfo("1. Visit %s/settings/tokens", cloudURL)
	output.PrintInfo("2. Generate a new access token")
	output.PrintInfo("3. Save it to %s/token", indusDir)
	output.PrintInfo("")

	// Create token file with instructions
	tokenPath := filepath.Join(indusDir, "token")
	tokenInstructions := fmt.Sprintf(`# IndusBase Cloud Token
# Place your token here or set INDUSBASE_DEPLOY_TOKEN environment variable
# Token file location: %s
`, tokenPath)

	if _, err := os.Stat(tokenPath); os.IsNotExist(err) {
		if err := os.WriteFile(tokenPath, []byte(tokenInstructions), 0600); err != nil {
			output.PrintError("Failed to create token file: %v", err)
			return
		}
		output.PrintSuccess("Created %s", tokenPath)
	}

	output.PrintInfo("Once you've added your token, you can use 'indus deploy'")
}
