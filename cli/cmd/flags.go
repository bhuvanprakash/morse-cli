package cmd

import (
	"fmt"
	"net/url"

	"github.com/spf13/cobra"
)

var flagsCmd = &cobra.Command{
	Use:   "flags",
	Short: "Manage feature flags",
}

var flagsEvalCmd = &cobra.Command{
	Use:   "eval",
	Short: "Evaluate all feature flags",
	RunE: func(cmd *cobra.Command, args []string) error {
		env, _ := cmd.Flags().GetString("env")
		userID, _ := cmd.Flags().GetString("user-id")
		resp, err := apiRequest("POST", "/config/evaluate", map[string]interface{}{
			"environment": env,
			"user_id":     userID,
		})
		if err != nil {
			return err
		}
		return printJSON(resp)
	},
}

var flagsListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all feature flags",
	RunE: func(cmd *cobra.Command, args []string) error {
		env, _ := cmd.Flags().GetString("env")
		resp, err := apiRequest("GET", "/config/flags?environment="+url.QueryEscape(env), nil)
		if err != nil {
			return err
		}
		return printJSON(resp)
	},
}

var flagsSetCmd = &cobra.Command{
	Use:   "set [key] [value]",
	Short: "Set a feature flag default value",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		env, _ := cmd.Flags().GetString("env")
		resp, err := apiRequest(
			"PATCH",
			fmt.Sprintf("/config/flags/%s?environment=%s", url.PathEscape(args[0]), url.QueryEscape(env)),
			map[string]interface{}{"default_value": args[1]},
		)
		if err != nil {
			return err
		}
		return printJSON(resp)
	},
}

func init() {
	flagsEvalCmd.Flags().String("env", "production", "Environment name")
	flagsEvalCmd.Flags().String("user-id", "", "User ID for targeting")
	flagsListCmd.Flags().String("env", "production", "Environment name")
	flagsSetCmd.Flags().String("env", "production", "Environment name")
	flagsCmd.AddCommand(flagsEvalCmd, flagsListCmd, flagsSetCmd)
	rootCmd.AddCommand(flagsCmd)
}
