package postgres

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"

	"github.com/indusbase/indus-meta/internal/models"
)

// RunMigrationRequest represents a migration run request
type RunMigrationRequest struct {
	Version string
	Name    string
	SQLUp   string
	SQLDown string
}

// createMigrationsTable creates the migrations table if it doesn't exist
func (db *DB) createMigrationsTable(ctx context.Context) error {
	query := `
		CREATE TABLE IF NOT EXISTS indusbase_meta.migrations (
			id SERIAL PRIMARY KEY,
			version VARCHAR(255) UNIQUE NOT NULL,
			name VARCHAR(255) NOT NULL,
			sql_up TEXT NOT NULL,
			sql_down TEXT,
			checksum VARCHAR(64) NOT NULL,
			applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		)
	`

	// First ensure the schema exists
	_, err := db.ExecContext(ctx, "CREATE SCHEMA IF NOT EXISTS indusbase_meta")
	if err != nil {
		return fmt.Errorf("failed to create schema: %w", err)
	}

	_, err = db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to create migrations table: %w", err)
	}

	return nil
}

// computeChecksum computes SHA256 checksum of SQL
func computeChecksum(sql string) string {
	hash := sha256.Sum256([]byte(sql))
	return hex.EncodeToString(hash[:])
}

// ListMigrations returns all migrations from the migrations table
func (db *DB) ListMigrations(ctx context.Context) ([]models.Migration, error) {
	// Ensure table exists
	if err := db.createMigrationsTable(ctx); err != nil {
		return nil, err
	}

	query := `
		SELECT id, version, name, applied_at, checksum
		FROM indusbase_meta.migrations
		ORDER BY applied_at DESC
	`

	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list migrations: %w", err)
	}
	defer rows.Close()

	var migrations []models.Migration
	for rows.Next() {
		var m models.Migration
		if err := rows.Scan(&m.ID, &m.Version, &m.Name, &m.AppliedAt, &m.Checksum); err != nil {
			return nil, fmt.Errorf("failed to scan migration: %w", err)
		}
		migrations = append(migrations, m)
	}

	return migrations, rows.Err()
}

// RunMigration runs a migration in a transaction
func (db *DB) RunMigration(ctx context.Context, req RunMigrationRequest) error {
	// Ensure table exists
	if err := db.createMigrationsTable(ctx); err != nil {
		return err
	}

	// Check if migration already exists
	var existingChecksum string
	err := db.QueryRowContext(ctx,
		"SELECT checksum FROM indusbase_meta.migrations WHERE version = $1",
		req.Version).Scan(&existingChecksum)

	if err == nil {
		// Migration exists, verify checksum
		newChecksum := computeChecksum(req.SQLUp)
		if existingChecksum != newChecksum {
			return fmt.Errorf("migration checksum mismatch for version %s", req.Version)
		}
		// Migration already applied with same checksum
		return nil
	} else if err != sql.ErrNoRows {
		return fmt.Errorf("failed to check migration: %w", err)
	}

	// Run migration in transaction
	return db.WithTx(func(tx *sql.Tx) error {
		// Execute migration SQL
		_, err := tx.Exec(req.SQLUp)
		if err != nil {
			return fmt.Errorf("failed to execute migration: %w", err)
		}

		// Record migration
		checksum := computeChecksum(req.SQLUp)
		_, err = tx.Exec(
			"INSERT INTO indusbase_meta.migrations (version, name, sql_up, sql_down, checksum) VALUES ($1, $2, $3, $4, $5)",
			req.Version, req.Name, req.SQLUp, req.SQLDown, checksum,
		)
		if err != nil {
			return fmt.Errorf("failed to record migration: %w", err)
		}

		return nil
	})
}

// RollbackMigration rolls back a migration
func (db *DB) RollbackMigration(ctx context.Context, version string) error {
	// Get migration details
	var sqlDown string
	err := db.QueryRowContext(ctx,
		"SELECT sql_down FROM indusbase_meta.migrations WHERE version = $1",
		version).Scan(&sqlDown)

	if err == sql.ErrNoRows {
		return fmt.Errorf("migration not found: %s", version)
	}
	if err != nil {
		return fmt.Errorf("failed to get migration: %w", err)
	}

	if sqlDown == "" {
		return fmt.Errorf("migration %s has no rollback SQL", version)
	}

	// Run rollback in transaction
	return db.WithTx(func(tx *sql.Tx) error {
		// Execute rollback SQL
		_, err := tx.Exec(sqlDown)
		if err != nil {
			return fmt.Errorf("failed to execute rollback: %w", err)
		}

		// Remove migration record
		_, err = tx.Exec("DELETE FROM indusbase_meta.migrations WHERE version = $1", version)
		if err != nil {
			return fmt.Errorf("failed to remove migration record: %w", err)
		}

		return nil
	})
}

// GetMigration returns a single migration by version
func (db *DB) GetMigration(ctx context.Context, version string) (*models.Migration, error) {
	query := `
		SELECT id, version, name, applied_at, checksum
		FROM indusbase_meta.migrations
		WHERE version = $1
	`

	var m models.Migration
	err := db.QueryRowContext(ctx, query, version).Scan(
		&m.ID, &m.Version, &m.Name, &m.AppliedAt, &m.Checksum,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("migration not found: %s", version)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get migration: %w", err)
	}

	return &m, nil
}

// GetMigrationStatus returns the status of a migration
func (db *DB) GetMigrationStatus(ctx context.Context, version string) (applied bool, checksum string, err error) {
	query := `
		SELECT checksum
		FROM indusbase_meta.migrations
		WHERE version = $1
	`

	err = db.QueryRowContext(ctx, query, version).Scan(&checksum)
	if err == sql.ErrNoRows {
		return false, "", nil
	}
	if err != nil {
		return false, "", err
	}

	return true, checksum, nil
}
