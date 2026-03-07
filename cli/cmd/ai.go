package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

var aiCmd = &cobra.Command{
	Use:   "ai",
	Short: "Manage AI vector search collections",
}

var aiListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all AI collections",
	RunE: func(cmd *cobra.Command, args []string) error {
		resp, err := apiRequest("GET", "/ai/collections", nil)
		if err != nil {
			return err
		}
		return printJSON(resp)
	},
}

var aiCreateCmd = &cobra.Command{
	Use:   "create [name]",
	Short: "Create a new AI collection",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		provider, _ := cmd.Flags().GetString("provider")
		resp, err := apiRequest("POST", "/ai/collections", map[string]interface{}{
			"name":               args[0],
			"embedding_provider": provider,
		})
		if err != nil {
			return err
		}
		return printJSON(resp)
	},
}

var aiSearchCmd = &cobra.Command{
	Use:   "search [collection] [query]",
	Short: "Semantic search in a collection",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		limit, _ := cmd.Flags().GetInt("limit")
		resp, err := apiRequest(
			"POST",
			fmt.Sprintf("/ai/collections/%s/search", args[0]),
			map[string]interface{}{"query": args[1], "limit": limit},
		)
		if err != nil {
			return err
		}
		return printJSON(resp)
	},
}

func init() {
	aiCreateCmd.Flags().String("provider", "local", "Embedding provider: openai|cohere|local")
	aiSearchCmd.Flags().Int("limit", 10, "Number of results")
	aiCmd.AddCommand(aiListCmd, aiCreateCmd, aiSearchCmd)
	rootCmd.AddCommand(aiCmd)
}
