package cmd

import (
	"github.com/spf13/cobra"
)

var notifyCmd = &cobra.Command{
	Use:   "notify",
	Short: "Send notifications (push, SMS, email)",
}

var notifySMSCmd = &cobra.Command{
	Use:   "sms [phone] [message]",
	Short: "Send SMS to an Indian phone number",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		dltID, _ := cmd.Flags().GetString("dlt-id")
		resp, err := apiRequest("POST", "/notify/sms", map[string]interface{}{
			"to":              args[0],
			"body":            args[1],
			"dlt_template_id": dltID,
		})
		if err != nil {
			return err
		}
		return printJSON(resp)
	},
}

var notifyPushCmd = &cobra.Command{
	Use:   "push [user-id] [title] [body]",
	Short: "Send a push notification to a user",
	Args:  cobra.ExactArgs(3),
	RunE: func(cmd *cobra.Command, args []string) error {
		resp, err := apiRequest("POST", "/notify/push", map[string]interface{}{
			"user_id": args[0],
			"title":   args[1],
			"body":    args[2],
		})
		if err != nil {
			return err
		}
		return printJSON(resp)
	},
}

var notifyStatsCmd = &cobra.Command{
	Use:   "stats",
	Short: "Show notification delivery statistics",
	RunE: func(cmd *cobra.Command, args []string) error {
		resp, err := apiRequest("GET", "/notify/stats", nil)
		if err != nil {
			return err
		}
		return printJSON(resp)
	},
}

func init() {
	notifySMSCmd.Flags().String("dlt-id", "", "DLT Template ID (required for India)")
	notifyCmd.AddCommand(notifySMSCmd, notifyPushCmd, notifyStatsCmd)
	rootCmd.AddCommand(notifyCmd)
}
