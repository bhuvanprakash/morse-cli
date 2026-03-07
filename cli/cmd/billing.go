package cmd

import (
	"net/url"

	"github.com/spf13/cobra"
)

var billingCmd = &cobra.Command{
	Use:   "billing",
	Short: "Billing and usage operations",
}

var billingPlansCmd = &cobra.Command{
	Use:   "plans",
	Short: "List billing plans",
	RunE: func(cmd *cobra.Command, args []string) error {
		resp, err := apiRequest("GET", "/billing/plans", nil)
		if err != nil {
			return err
		}
		return printJSON(resp)
	},
}

var billingUsageCmd = &cobra.Command{
	Use:   "usage",
	Short: "Get billing usage for a project",
	RunE: func(cmd *cobra.Command, args []string) error {
		projectID, _ := cmd.Flags().GetString("project-id")
		path := "/billing/usage"
		if projectID != "" {
			path += "?project_id=" + url.QueryEscape(projectID)
		}
		resp, err := apiRequest("GET", path, nil)
		if err != nil {
			return err
		}
		return printJSON(resp)
	},
}

var billingPreviewCmd = &cobra.Command{
	Use:   "invoice-preview",
	Short: "Preview invoice for current period",
	RunE: func(cmd *cobra.Command, args []string) error {
		projectID, _ := cmd.Flags().GetString("project-id")
		path := "/billing/invoices/preview"
		if projectID != "" {
			path += "?project_id=" + url.QueryEscape(projectID)
		}
		resp, err := apiRequest("GET", path, nil)
		if err != nil {
			return err
		}
		return printJSON(resp)
	},
}

func init() {
	billingUsageCmd.Flags().String("project-id", "", "Project ID")
	billingPreviewCmd.Flags().String("project-id", "", "Project ID")
	billingCmd.AddCommand(billingPlansCmd, billingUsageCmd, billingPreviewCmd)
	rootCmd.AddCommand(billingCmd)
}
