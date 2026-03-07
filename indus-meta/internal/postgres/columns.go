package postgres

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/indusbase/indus-meta/internal/models"
)

// ListColumns returns all columns for a table
func (db *DB) ListColumns(ctx context.Context, schema, table string) ([]models.Column, error) {
	query := `
		SELECT 
			column_name,
			data_type,
			is_nullable = 'YES' as is_nullable,
			column_default,
			character_maximum_length,
			ordinal_position
		FROM information_schema.columns
		WHERE table_schema = $1 AND table_name = $2
		ORDER BY ordinal_position
	`

	rows, err := db.QueryContext(ctx, query, schema, table)
	if err != nil {
		return nil, fmt.Errorf("failed to list columns: %w", err)
	}
	defer rows.Close()

	var columns []models.Column
	for rows.Next() {
		var col models.Column
		var nullableStr string
		err := rows.Scan(
			&col.Name,
			&col.Type,
			&nullableStr,
			&col.DefaultValue,
			&col.MaxLength,
			&col.Position,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan column: %w", err)
		}
		col.Nullable = nullableStr == "YES" || nullableStr == "true"
		columns = append(columns, col)
	}

	return columns, rows.Err()
}

// AddColumn adds a column to a table
func (db *DB) AddColumn(ctx context.Context, schema, table string, col models.ColumnDef) error {
	query := fmt.Sprintf("ALTER TABLE %s.%s ADD COLUMN %s %s",
		quoteIdentifier(schema), quoteIdentifier(table),
		quoteIdentifier(col.Name), col.Type)

	if !col.Nullable {
		query += " NOT NULL"
	}
	if col.DefaultValue != nil {
		query += fmt.Sprintf(" DEFAULT %s", *col.DefaultValue)
	}

	_, err := db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to add column: %w", err)
	}
	return nil
}

// AlterColumnType changes the data type of a column
func (db *DB) AlterColumnType(ctx context.Context, schema, table, column, newType string) error {
	query := fmt.Sprintf("ALTER TABLE %s.%s ALTER COLUMN %s TYPE %s",
		quoteIdentifier(schema), quoteIdentifier(table),
		quoteIdentifier(column), newType)

	_, err := db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to alter column type: %w", err)
	}
	return nil
}

// AlterColumnDefault changes the default value of a column
func (db *DB) AlterColumnDefault(ctx context.Context, schema, table, column, defaultVal string) error {
	var query string
	if defaultVal == "" {
		query = fmt.Sprintf("ALTER TABLE %s.%s ALTER COLUMN %s DROP DEFAULT",
			quoteIdentifier(schema), quoteIdentifier(table), quoteIdentifier(column))
	} else {
		query = fmt.Sprintf("ALTER TABLE %s.%s ALTER COLUMN %s SET DEFAULT %s",
			quoteIdentifier(schema), quoteIdentifier(table),
			quoteIdentifier(column), defaultVal)
	}

	_, err := db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to alter column default: %w", err)
	}
	return nil
}

// RenameColumn renames a column
func (db *DB) RenameColumn(ctx context.Context, schema, table, oldName, newName string) error {
	query := fmt.Sprintf("ALTER TABLE %s.%s RENAME COLUMN %s TO %s",
		quoteIdentifier(schema), quoteIdentifier(table),
		quoteIdentifier(oldName), quoteIdentifier(newName))

	_, err := db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to rename column: %w", err)
	}
	return nil
}

// DropColumn drops a column from a table
func (db *DB) DropColumn(ctx context.Context, schema, table, column string, cascade bool) error {
	query := fmt.Sprintf("ALTER TABLE %s.%s DROP COLUMN %s",
		quoteIdentifier(schema), quoteIdentifier(table), quoteIdentifier(column))
	if cascade {
		query += " CASCADE"
	}

	_, err := db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to drop column: %w", err)
	}
	return nil
}

// SetColumnNullable changes whether a column allows NULL values
func (db *DB) SetColumnNullable(ctx context.Context, schema, table, column string, nullable bool) error {
	var query string
	if nullable {
		query = fmt.Sprintf("ALTER TABLE %s.%s ALTER COLUMN %s DROP NOT NULL",
			quoteIdentifier(schema), quoteIdentifier(table), quoteIdentifier(column))
	} else {
		query = fmt.Sprintf("ALTER TABLE %s.%s ALTER COLUMN %s SET NOT NULL",
			quoteIdentifier(schema), quoteIdentifier(table), quoteIdentifier(column))
	}

	_, err := db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to set column nullable: %w", err)
	}
	return nil
}

// GetColumn returns a single column's information
func (db *DB) GetColumn(ctx context.Context, schema, table, column string) (*models.Column, error) {
	query := `
		SELECT 
			column_name,
			data_type,
			is_nullable = 'YES' as is_nullable,
			column_default,
			character_maximum_length,
			ordinal_position
		FROM information_schema.columns
		WHERE table_schema = $1 AND table_name = $2 AND column_name = $3
	`

	var col models.Column
	var nullableStr string
	err := db.QueryRowContext(ctx, query, schema, table, column).Scan(
		&col.Name,
		&col.Type,
		&nullableStr,
		&col.DefaultValue,
		&col.MaxLength,
		&col.Position,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("column not found: %s.%s.%s", schema, table, column)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get column: %w", err)
	}
	col.Nullable = nullableStr == "YES" || nullableStr == "true"

	return &col, nil
}
