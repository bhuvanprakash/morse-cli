package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"slices"

	"github.com/indusbase/indus-meta/internal/models"
)

// AllowedExtensions is the whitelist of extensions that can be enabled
var AllowedExtensions = []string{
	"uuid-ossp",
	"pgcrypto",
	"pg_trgm",
	"vector",
	"postgis",
	"pg_stat_statements",
	"hstore",
	"ltree",
	"citext",
}

// ListExtensions returns all available extensions with their status
func (db *DB) ListExtensions(ctx context.Context) ([]models.Extension, error) {
	query := `
		SELECT 
			e.name,
			COALESCE(i.extversion, '') as version,
			COALESCE(n.nspname, 'public') as schema,
			e.comment as description,
			i.extname IS NOT NULL as enabled
		FROM pg_available_extensions e
		LEFT JOIN pg_extension i ON i.extname = e.name
		LEFT JOIN pg_namespace n ON n.oid = i.extnamespace
		ORDER BY e.name
	`

	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list extensions: %w", err)
	}
	defer rows.Close()

	var extensions []models.Extension
	for rows.Next() {
		var ext models.Extension
		if err := rows.Scan(&ext.Name, &ext.Version, &ext.Schema, &ext.Description, &ext.Enabled); err != nil {
			return nil, fmt.Errorf("failed to scan extension: %w", err)
		}
		extensions = append(extensions, ext)
	}

	return extensions, rows.Err()
}

// EnableExtension enables an extension if it's in the whitelist
func (db *DB) EnableExtension(ctx context.Context, name string) error {
	if !slices.Contains(AllowedExtensions, name) {
		return fmt.Errorf("extension %s is not in the allowed list", name)
	}

	query := fmt.Sprintf("CREATE EXTENSION IF NOT EXISTS %s", quoteIdentifier(name))

	_, err := db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to enable extension: %w", err)
	}
	return nil
}

// DisableExtension disables an extension
func (db *DB) DisableExtension(ctx context.Context, name string) error {
	query := fmt.Sprintf("DROP EXTENSION IF EXISTS %s", quoteIdentifier(name))

	_, err := db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to disable extension: %w", err)
	}
	return nil
}

// GetExtension returns a single extension by name
func (db *DB) GetExtension(ctx context.Context, name string) (*models.Extension, error) {
	query := `
		SELECT 
			e.name,
			COALESCE(i.extversion, '') as version,
			COALESCE(n.nspname, 'public') as schema,
			e.comment as description,
			i.extname IS NOT NULL as enabled
		FROM pg_available_extensions e
		LEFT JOIN pg_extension i ON i.extname = e.name
		LEFT JOIN pg_namespace n ON n.oid = i.extnamespace
		WHERE e.name = $1
	`

	var ext models.Extension
	err := db.QueryRowContext(ctx, query, name).Scan(
		&ext.Name, &ext.Version, &ext.Schema, &ext.Description, &ext.Enabled,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("extension not found: %s", name)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get extension: %w", err)
	}

	return &ext, nil
}

// IsExtensionEnabled checks if an extension is enabled
func (db *DB) IsExtensionEnabled(ctx context.Context, name string) (bool, error) {
	query := `
		SELECT EXISTS(
			SELECT 1 FROM pg_extension WHERE extname = $1
		)
	`

	var exists bool
	err := db.QueryRowContext(ctx, query, name).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check extension: %w", err)
	}

	return exists, nil
}
