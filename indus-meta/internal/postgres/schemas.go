package postgres

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/indusbase/indus-meta/internal/models"
)

// ListSchemas returns all schemas in the database
func (db *DB) ListSchemas(ctx context.Context) ([]models.Schema, error) {
	query := `
		SELECT 
			schema_name,
			schema_owner
		FROM information_schema.schemata
		WHERE schema_name NOT LIKE 'pg_%' 
		AND schema_name != 'information_schema'
		ORDER BY schema_name
	`

	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list schemas: %w", err)
	}
	defer rows.Close()

	var schemas []models.Schema
	for rows.Next() {
		var s models.Schema
		if err := rows.Scan(&s.Name, &s.Owner); err != nil {
			return nil, fmt.Errorf("failed to scan schema: %w", err)
		}
		schemas = append(schemas, s)
	}

	return schemas, rows.Err()
}

// CreateSchema creates a new schema
func (db *DB) CreateSchema(ctx context.Context, name string) error {
	query := fmt.Sprintf("CREATE SCHEMA %s", quoteIdentifier(name))

	_, err := db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to create schema: %w", err)
	}
	return nil
}

// DropSchema drops a schema
func (db *DB) DropSchema(ctx context.Context, name string, cascade bool) error {
	query := fmt.Sprintf("DROP SCHEMA %s", quoteIdentifier(name))
	if cascade {
		query += " CASCADE"
	}

	_, err := db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to drop schema: %w", err)
	}
	return nil
}

// GetSchema returns a single schema by name
func (db *DB) GetSchema(ctx context.Context, name string) (*models.Schema, error) {
	query := `
		SELECT 
			schema_name,
			schema_owner
		FROM information_schema.schemata
		WHERE schema_name = $1
	`

	var s models.Schema
	err := db.QueryRowContext(ctx, query, name).Scan(&s.Name, &s.Owner)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("schema not found: %s", name)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get schema: %w", err)
	}

	return &s, nil
}

// SchemaExists checks if a schema exists
func (db *DB) SchemaExists(ctx context.Context, name string) (bool, error) {
	query := `
		SELECT EXISTS(
			SELECT 1 FROM information_schema.schemata WHERE schema_name = $1
		)
	`

	var exists bool
	err := db.QueryRowContext(ctx, query, name).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check schema: %w", err)
	}

	return exists, nil
}
