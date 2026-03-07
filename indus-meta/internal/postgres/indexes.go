package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/indusbase/indus-meta/internal/models"
)

// ListIndexes returns all indexes for a schema (or specific table if provided)
func (db *DB) ListIndexes(ctx context.Context, schema string, table *string) ([]models.Index, error) {
	query := `
		SELECT 
			i.schemaname,
			i.tablename,
			i.indexname,
			ix.indisunique as is_unique,
			ix.indisprimary as is_primary
		FROM pg_indexes i
		JOIN pg_class c ON c.relname = i.indexname
		JOIN pg_index ix ON ix.indexrelid = c.oid
		WHERE i.schemaname = $1
	`
	args := []interface{}{schema}

	if table != nil {
		query += " AND i.tablename = $2"
		args = append(args, *table)
	}

	query += " ORDER BY i.indexname"

	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list indexes: %w", err)
	}
	defer rows.Close()

	var indexes []models.Index
	for rows.Next() {
		var idx models.Index
		if err := rows.Scan(&idx.Schema, &idx.Table, &idx.Name, &idx.Unique, &idx.Primary); err != nil {
			return nil, fmt.Errorf("failed to scan index: %w", err)
		}
		indexes = append(indexes, idx)
	}

	return indexes, rows.Err()
}

// CreateIndexRequest represents an index creation request
type CreateIndexRequest struct {
	Schema  string
	Table   string
	Name    string
	Columns []string
	Unique  bool
	Type    string // btree, hash, gin, gist, etc.
}

// CreateIndex creates a new index
func (db *DB) CreateIndex(ctx context.Context, req CreateIndexRequest) error {
	if req.Schema == "" || req.Table == "" || req.Name == "" || len(req.Columns) == 0 {
		return fmt.Errorf("schema, table, name, and columns are required")
	}

	var query string
	if req.Unique {
		query = "CREATE UNIQUE INDEX "
	} else {
		query = "CREATE INDEX "
	}

	query += fmt.Sprintf("%s ON %s.%s",
		quoteIdentifier(req.Name),
		quoteIdentifier(req.Schema),
		quoteIdentifier(req.Table))

	if req.Type != "" {
		query += fmt.Sprintf(" USING %s", req.Type)
	}

	// Quote column names
	var cols []string
	for _, col := range req.Columns {
		cols = append(cols, quoteIdentifier(col))
	}
	query += fmt.Sprintf(" (%s)", strings.Join(cols, ", "))

	_, err := db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to create index: %w", err)
	}
	return nil
}

// DropIndex drops an index
func (db *DB) DropIndex(ctx context.Context, schema, indexName string) error {
	query := fmt.Sprintf("DROP INDEX %s.%s",
		quoteIdentifier(schema), quoteIdentifier(indexName))

	_, err := db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to drop index: %w", err)
	}
	return nil
}

// GetIndex returns details of a specific index
func (db *DB) GetIndex(ctx context.Context, schema, indexName string) (*models.Index, error) {
	query := `
		SELECT 
			i.schemaname,
			i.tablename,
			i.indexname,
			ix.indisunique as is_unique,
			ix.indisprimary as is_primary
		FROM pg_indexes i
		JOIN pg_class c ON c.relname = i.indexname
		JOIN pg_index ix ON ix.indexrelid = c.oid
		WHERE i.schemaname = $1 AND i.indexname = $2
	`

	var idx models.Index
	err := db.QueryRowContext(ctx, query, schema, indexName).Scan(
		&idx.Schema, &idx.Table, &idx.Name, &idx.Unique, &idx.Primary,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("index not found: %s.%s", schema, indexName)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get index: %w", err)
	}

	return &idx, nil
}
