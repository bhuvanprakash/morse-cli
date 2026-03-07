package db

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "github.com/lib/pq"
)

// Connect connects to the PostgreSQL database
func Connect(databaseURL string) (*sql.DB, error) {
	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Test connection
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	// Configure connection pool
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)

	return db, nil
}

// RunMigrations runs database migrations
func RunMigrations(db *sql.DB) error {
	if err := ensureMigrationTable(db); err != nil {
		return err
	}

	migrations := []struct {
		name string
		file string
	}{
		{"001_create_queue_schema", "001_create_queue_schema.sql"},
		{"002_create_webhooks_schema", "002_create_webhooks_schema.sql"},
	}

	for _, migration := range migrations {
		if err := runMigration(db, migration.name, migration.file); err != nil {
			return fmt.Errorf("failed to run migration %s: %w", migration.name, err)
		}
	}

	return nil
}

func runMigration(db *sql.DB, name, filename string) error {
	applied, err := isMigrationApplied(db, name)
	if err != nil {
		return err
	}
	if applied {
		return nil
	}

	// Read migration file
	content, err := os.ReadFile(filepath.Join("internal", "db", "migrations", filename))
	if err != nil {
		return fmt.Errorf("failed to read migration file %s: %w", filename, err)
	}

	// Execute migration
	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin migration transaction: %w", err)
	}
	defer tx.Rollback()

	_, err = tx.Exec(string(content))
	if err != nil {
		return fmt.Errorf("failed to execute migration %s: %w", name, err)
	}

	_, err = tx.Exec(`
		INSERT INTO indusbase_queue.schema_migrations (name, applied_at)
		VALUES ($1, NOW())
	`, name)
	if err != nil {
		return fmt.Errorf("failed to record migration %s: %w", name, err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit migration %s: %w", name, err)
	}

	return nil
}

// MigrateUp runs migrations up to a specific version
func MigrateUp(ctx context.Context, db *sql.DB) error {
	_ = ctx
	return RunMigrations(db)
}

// MigrateDown rolls back the last migration
func MigrateDown(ctx context.Context, db *sql.DB) error {
	_ = ctx
	if err := ensureMigrationTable(db); err != nil {
		return err
	}

	rows, err := db.Query(`
		SELECT name
		FROM indusbase_queue.schema_migrations
		ORDER BY applied_at DESC, name DESC
	`)
	if err != nil {
		return fmt.Errorf("failed to list applied migrations: %w", err)
	}
	defer rows.Close()

	var applied []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return fmt.Errorf("failed to scan applied migration: %w", err)
		}
		applied = append(applied, name)
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("failed to read applied migrations: %w", err)
	}
	if len(applied) == 0 {
		return nil
	}

	latest := applied[0]
	downFile := filepath.Join("internal", "db", "migrations", latest+"_down.sql")
	content, err := os.ReadFile(downFile)
	if err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("rollback for migration %s is not available", latest)
		}
		return fmt.Errorf("failed to read rollback for %s: %w", latest, err)
	}

	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin rollback transaction: %w", err)
	}
	defer tx.Rollback()

	if _, err := tx.Exec(string(content)); err != nil {
		return fmt.Errorf("failed to rollback migration %s: %w", latest, err)
	}
	if _, err := tx.Exec(`DELETE FROM indusbase_queue.schema_migrations WHERE name = $1`, latest); err != nil {
		return fmt.Errorf("failed to delete migration record %s: %w", latest, err)
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit rollback %s: %w", latest, err)
	}
	return nil
}

func ensureMigrationTable(db *sql.DB) error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS indusbase_queue.schema_migrations (
			name TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to ensure schema_migrations table: %w", err)
	}
	return nil
}

func isMigrationApplied(db *sql.DB, name string) (bool, error) {
	var exists bool
	err := db.QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM indusbase_queue.schema_migrations WHERE name = $1
		)
	`, name).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check migration %s: %w", name, err)
	}
	return exists, nil
}
