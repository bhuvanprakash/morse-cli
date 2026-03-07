package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/indusbase/cli/internal/config"
	"github.com/indusbase/cli/internal/docker"
	"github.com/indusbase/cli/internal/output"
	"github.com/spf13/cobra"
)

// dbCmd represents the db command
var dbCmd = &cobra.Command{
	Use:   "db",
	Short: "Database management commands",
	Long:  `Manage the IndusBase database with commands for reset, migrate, seed, and psql access.`,
}

// dbResetCmd resets all user tables
var dbResetCmd = &cobra.Command{
	Use:   "reset",
	Short: "Truncate all user tables",
	Long:  `WARNING: This will delete all data from user tables while keeping the schema intact.`,
	Run:   runDbReset,
}

// dbMigrateCmd runs migrations
var dbMigrateCmd = &cobra.Command{
	Use:   "migrate",
	Short: "Run database migrations",
	Long:  `Run all pending migrations from the migrations/ folder.`,
	Run:   runDbMigrate,
}

// dbSeedCmd runs seed script
var dbSeedCmd = &cobra.Command{
	Use:   "seed",
	Short: "Run seed script",
	Long:  `Execute the seed script to populate the database with initial data.`,
	Run:   runDbSeed,
}

// dbPsqlCmd opens psql console
var dbPsqlCmd = &cobra.Command{
	Use:   "psql",
	Short: "Open PostgreSQL console",
	Long:  `Open an interactive psql session in the PostgreSQL container.`,
	Run:   runDbPsql,
}

func init() {
	rootCmd.AddCommand(dbCmd)
	dbCmd.AddCommand(dbResetCmd)
	dbCmd.AddCommand(dbMigrateCmd)
	dbCmd.AddCommand(dbSeedCmd)
	dbCmd.AddCommand(dbPsqlCmd)
}

func runDbReset(cmd *cobra.Command, args []string) {
	client := docker.NewClient("")

	output.PrintWarning("This will DELETE ALL DATA from user tables!")

	cfg, err := config.LoadFromFile("indusbase.yaml")
	if err != nil {
		output.PrintError("Failed to load config: %v", err)
		return
	}

	// Truncate all tables except migrations
	truncateSQL := fmt.Sprintf(`
DO $$ DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != 'schema_migrations') LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END $$;
`)

	output.PrintInfo("Truncating user tables...")
	if err := client.Exec("postgres", []string{"psql", "-U", cfg.Database.User, "-d", cfg.Database.Name, "-c", truncateSQL}); err != nil {
		output.PrintError("Failed to reset database: %v", err)
		return
	}

	output.PrintSuccess("All user tables truncated")
}

func runDbMigrate(cmd *cobra.Command, args []string) {
	client := docker.NewClient("")

	cfg, err := config.LoadFromFile("indusbase.yaml")
	if err != nil {
		output.PrintError("Failed to load config: %v", err)
		return
	}

	// Read all migration files
	migrationsDir := "migrations"
	files, err := os.ReadDir(migrationsDir)
	if err != nil {
		output.PrintError("Failed to read migrations directory: %v", err)
		return
	}

	output.PrintInfo("Running migrations...")

	for _, file := range files {
		if file.IsDir() {
			continue
		}
		if !strings.HasSuffix(file.Name(), ".sql") {
			continue
		}

		path := filepath.Join(migrationsDir, file.Name())
		content, err := os.ReadFile(path)
		if err != nil {
			output.PrintError("Failed to read migration %s: %v", file.Name(), err)
			continue
		}

		output.PrintInfo("Applying %s...", file.Name())
		if err := client.Exec("postgres", []string{"psql", "-U", cfg.Database.User, "-d", cfg.Database.Name, "-c", string(content)}); err != nil {
			output.PrintError("Failed to apply migration %s: %v", file.Name(), err)
			return
		}
	}

	output.PrintSuccess("Migrations completed")
}

func runDbSeed(cmd *cobra.Command, args []string) {
	client := docker.NewClient("")

	cfg, err := config.LoadFromFile("indusbase.yaml")
	if err != nil {
		output.PrintError("Failed to load config: %v", err)
		return
	}

	// Check if seed.sql exists
	if _, err := os.Stat("seed.sql"); os.IsNotExist(err) {
		output.PrintError("seed.sql not found. Create a seed.sql file to populate your database.")
		return
	}

	content, err := os.ReadFile("seed.sql")
	if err != nil {
		output.PrintError("Failed to read seed.sql: %v", err)
		return
	}

	output.PrintInfo("Running seed script...")
	if err := client.Exec("postgres", []string{"psql", "-U", cfg.Database.User, "-d", cfg.Database.Name, "-c", string(content)}); err != nil {
		output.PrintError("Failed to run seed script: %v", err)
		return
	}

	output.PrintSuccess("Seed script executed")
}

func runDbPsql(cmd *cobra.Command, args []string) {
	client := docker.NewClient("")

	cfg, err := config.LoadFromFile("indusbase.yaml")
	if err != nil {
		output.PrintError("Failed to load config: %v", err)
		return
	}

	output.PrintInfo("Opening psql console (type \\q to exit)...")
	if err := client.Exec("postgres", []string{"psql", "-U", cfg.Database.User, "-d", cfg.Database.Name}); err != nil {
		output.PrintError("Failed to open psql: %v", err)
		return
	}
}
