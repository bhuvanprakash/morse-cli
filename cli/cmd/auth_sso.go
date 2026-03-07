package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

var authCmd = &cobra.Command{
	Use:   "auth",
	Short: "Authentication and enterprise identity commands",
}

var authSSOCmd = &cobra.Command{
	Use:   "sso",
	Short: "Manage enterprise SSO connections",
}

var authSSOListCmd = &cobra.Command{
	Use:   "list",
	Short: "List enterprise SSO connections",
	RunE: func(cmd *cobra.Command, args []string) error {
		resp, err := apiRequest("GET", "/auth/enterprise/connections", nil)
		if err != nil {
			return err
		}
		return printJSON(resp)
	},
}

var authSSOCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create enterprise SSO connection",
	RunE: func(cmd *cobra.Command, args []string) error {
		name, _ := cmd.Flags().GetString("name")
		slug, _ := cmd.Flags().GetString("slug")
		domain, _ := cmd.Flags().GetString("domain")
		providerType, _ := cmd.Flags().GetString("provider-type")
		providerName, _ := cmd.Flags().GetString("provider-name")
		projectID, _ := cmd.Flags().GetString("project-id")
		orgID, _ := cmd.Flags().GetString("org-id")

		if name == "" || slug == "" || domain == "" || providerType == "" || providerName == "" {
			return fmt.Errorf("name, slug, domain, provider-type and provider-name are required")
		}
		payload := map[string]interface{}{
			"name":          name,
			"slug":          slug,
			"domain":        domain,
			"provider_type": providerType,
			"provider_name": providerName,
			"config":        map[string]interface{}{},
		}
		if projectID != "" {
			payload["project_id"] = projectID
		}
		if orgID != "" {
			payload["org_id"] = orgID
		}
		resp, err := apiRequest("POST", "/auth/enterprise/connections", payload)
		if err != nil {
			return err
		}
		return printJSON(resp)
	},
}

var authDomainCmd = &cobra.Command{
	Use:   "domain",
	Short: "Enterprise domain verification commands",
}

var authDomainVerifyCmd = &cobra.Command{
	Use:   "verify [domain]",
	Short: "Create/verify enterprise domain ownership",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		token, _ := cmd.Flags().GetString("token")
		orgID, _ := cmd.Flags().GetString("org-id")
		projectID, _ := cmd.Flags().GetString("project-id")
		payload := map[string]interface{}{"domain": args[0]}
		if token != "" {
			payload["verification_token"] = token
		}
		if orgID != "" {
			payload["org_id"] = orgID
		}
		if projectID != "" {
			payload["project_id"] = projectID
		}
		resp, err := apiRequest("POST", "/auth/enterprise/domains/verify", payload)
		if err != nil {
			return err
		}
		return printJSON(resp)
	},
}

var authSCIMCmd = &cobra.Command{
	Use:   "scim",
	Short: "SCIM token operations",
}

var authSCIMTokenCreateCmd = &cobra.Command{
	Use:   "token-create [connection-id]",
	Short: "Create a SCIM provisioning token for a connection",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		name, _ := cmd.Flags().GetString("name")
		projectID, _ := cmd.Flags().GetString("project-id")
		expiresAt, _ := cmd.Flags().GetString("expires-at")
		if name == "" {
			name = "SCIM Token"
		}
		payload := map[string]interface{}{"name": name}
		if projectID != "" {
			payload["project_id"] = projectID
		}
		if expiresAt != "" {
			payload["expires_at"] = expiresAt
		}
		path := fmt.Sprintf("/auth/enterprise/connections/%s/scim/tokens", args[0])
		resp, err := apiRequest("POST", path, payload)
		if err != nil {
			return err
		}
		return printJSON(resp)
	},
}

func init() {
	authSSOCreateCmd.Flags().String("name", "", "Connection display name")
	authSSOCreateCmd.Flags().String("slug", "", "Connection slug")
	authSSOCreateCmd.Flags().String("domain", "", "Verified domain for this enterprise connection")
	authSSOCreateCmd.Flags().String("provider-type", "saml", "Provider type: saml|oidc")
	authSSOCreateCmd.Flags().String("provider-name", "", "Provider display name (Okta, Azure AD)")
	authSSOCreateCmd.Flags().String("project-id", "", "Project ID")
	authSSOCreateCmd.Flags().String("org-id", "", "Organization ID")

	authDomainVerifyCmd.Flags().String("token", "", "Verification token for final domain verification")
	authDomainVerifyCmd.Flags().String("project-id", "", "Project ID")
	authDomainVerifyCmd.Flags().String("org-id", "", "Organization ID")

	authSCIMTokenCreateCmd.Flags().String("name", "SCIM Token", "Token name")
	authSCIMTokenCreateCmd.Flags().String("project-id", "", "Project ID for token scope")
	authSCIMTokenCreateCmd.Flags().String("expires-at", "", "Expiry timestamp RFC3339")

	authSSOCmd.AddCommand(authSSOListCmd, authSSOCreateCmd)
	authDomainCmd.AddCommand(authDomainVerifyCmd)
	authSCIMCmd.AddCommand(authSCIMTokenCreateCmd)
	authCmd.AddCommand(authSSOCmd, authDomainCmd, authSCIMCmd)
	rootCmd.AddCommand(authCmd)
}
