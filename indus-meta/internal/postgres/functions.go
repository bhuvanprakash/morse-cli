package postgres

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/indusbase/indus-meta/internal/models"
)

// CreateFunctionRequest represents a function creation request
type CreateFunctionRequest struct {
	Schema     string
	Name       string
	Arguments  string
	ReturnType string
	Language   string
	Definition string
}

// ListFunctions returns all functions in a schema
func (db *DB) ListFunctions(ctx context.Context, schema string) ([]models.Function, error) {
	query := `
		SELECT 
			routine_schema,
			routine_name,
			routine_type,
			data_type,
			routine_definition
		FROM information_schema.routines
		WHERE routine_schema = $1
		AND routine_type = 'FUNCTION'
		ORDER BY routine_name
	`

	rows, err := db.QueryContext(ctx, query, schema)
	if err != nil {
		return nil, fmt.Errorf("failed to list functions: %w", err)
	}
	defer rows.Close()

	var functions []models.Function
	for rows.Next() {
		var f models.Function
		if err := rows.Scan(&f.Schema, &f.Name, &f.Language, &f.ReturnType, &f.Arguments); err != nil {
			return nil, fmt.Errorf("failed to scan function: %w", err)
		}
		functions = append(functions, f)
	}

	return functions, rows.Err()
}

// CreateFunction creates a new function
func (db *DB) CreateFunction(ctx context.Context, req CreateFunctionRequest) error {
	if req.Schema == "" || req.Name == "" || req.ReturnType == "" || req.Language == "" || req.Definition == "" {
		return fmt.Errorf("schema, name, return type, language, and definition are required")
	}

	args := req.Arguments
	if args == "" {
		args = "()"
	}

	query := fmt.Sprintf(
		"CREATE OR REPLACE FUNCTION %s.%s %s RETURNS %s LANGUAGE %s AS $$\n%s\n$$",
		quoteIdentifier(req.Schema),
		quoteIdentifier(req.Name),
		args,
		req.ReturnType,
		req.Language,
		req.Definition,
	)

	_, err := db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to create function: %w", err)
	}
	return nil
}

// DropFunction drops a function
func (db *DB) DropFunction(ctx context.Context, schema, functionName string) error {
	query := fmt.Sprintf("DROP FUNCTION IF EXISTS %s.%s",
		quoteIdentifier(schema), quoteIdentifier(functionName))

	_, err := db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to drop function: %w", err)
	}
	return nil
}

// GetFunction returns a single function by name
func (db *DB) GetFunction(ctx context.Context, schema, functionName string) (*models.Function, error) {
	query := `
		SELECT 
			routine_schema,
			routine_name,
			routine_type,
			data_type,
			routine_definition
		FROM information_schema.routines
		WHERE routine_schema = $1 AND routine_name = $2
		AND routine_type = 'FUNCTION'
	`

	var f models.Function
	err := db.QueryRowContext(ctx, query, schema, functionName).Scan(
		&f.Schema, &f.Name, &f.Language, &f.ReturnType, &f.Arguments,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("function not found: %s.%s", schema, functionName)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get function: %w", err)
	}

	return &f, nil
}
