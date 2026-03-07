package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/indusbase/indus-meta/internal/models"
)

// TableInfo extends models.Table with row count
type TableInfo struct {
	models.Table
	RowCount int64 `json:"row_count,omitempty"`
}

// ListTables returns all tables in a schema with row counts
func (db *DB) ListTables(ctx context.Context, schemaName string) ([]TableInfo, error) {
	query := `
		SELECT 
			t.table_schema,
			t.table_name,
			t.table_type,
			COALESCE(ps.n_live_tup, 0) as row_count
		FROM information_schema.tables t
		LEFT JOIN pg_stat_user_tables ps ON 
			ps.schemaname = t.table_schema AND ps.relname = t.table_name
		WHERE t.table_schema = $1
		ORDER BY t.table_name
	`

	rows, err := db.QueryContext(ctx, query, schemaName)
	if err != nil {
		return nil, fmt.Errorf("failed to list tables: %w", err)
	}
	defer rows.Close()

	var tables []TableInfo
	for rows.Next() {
		var t TableInfo
		if err := rows.Scan(&t.Schema, &t.Name, &t.Type, &t.RowCount); err != nil {
			return nil, fmt.Errorf("failed to scan table: %w", err)
		}
		tables = append(tables, t)
	}

	return tables, rows.Err()
}

// GetTable returns detailed table information including columns
func (db *DB) GetTable(ctx context.Context, schemaName, tableName string) (*TableInfo, error) {
	// Get table info
	query := `
		SELECT 
			t.table_schema,
			t.table_name,
			t.table_type,
			COALESCE(ps.n_live_tup, 0) as row_count
		FROM information_schema.tables t
		LEFT JOIN pg_stat_user_tables ps ON 
			ps.schemaname = t.table_schema AND ps.relname = t.table_name
		WHERE t.table_schema = $1 AND t.table_name = $2
	`

	var table TableInfo
	err := db.QueryRowContext(ctx, query, schemaName, tableName).Scan(
		&table.Schema, &table.Name, &table.Type, &table.RowCount,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("table not found: %s.%s", schemaName, tableName)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get table: %w", err)
	}

	// Get columns
	columns, err := db.ListColumns(ctx, schemaName, tableName)
	if err != nil {
		return nil, fmt.Errorf("failed to get columns: %w", err)
	}
	table.Columns = columns

	return &table, nil
}

// CreateTableRequest represents a table creation request
type CreateTableRequest struct {
	Schema      string
	Name        string
	Columns     []models.ColumnDef
	Constraints []models.ConstraintDef
}

// CreateTable creates a new table with the specified columns and constraints
func (db *DB) CreateTable(ctx context.Context, req CreateTableRequest) error {
	if req.Schema == "" || req.Name == "" {
		return fmt.Errorf("schema and name are required")
	}
	if len(req.Columns) == 0 {
		return fmt.Errorf("at least one column is required")
	}

	var parts []string
	for _, col := range req.Columns {
		colDef := fmt.Sprintf("%s %s", quoteIdentifier(col.Name), col.Type)
		if !col.Nullable {
			colDef += " NOT NULL"
		}
		if col.DefaultValue != nil {
			colDef += fmt.Sprintf(" DEFAULT %s", *col.DefaultValue)
		}
		parts = append(parts, colDef)
	}

	// Add constraints
	for _, cons := range req.Constraints {
		switch cons.Type {
		case "primary_key":
			name := cons.Name
			if name == "" {
				name = fmt.Sprintf("%s_pkey", req.Name)
			}
			parts = append(parts, fmt.Sprintf("CONSTRAINT %s PRIMARY KEY (%s)",
				quoteIdentifier(name), strings.Join(cons.Columns, ", ")))
		case "unique":
			name := cons.Name
			if name == "" {
				name = fmt.Sprintf("%s_%s_unique", req.Name, strings.Join(cons.Columns, "_"))
			}
			parts = append(parts, fmt.Sprintf("CONSTRAINT %s UNIQUE (%s)",
				quoteIdentifier(name), strings.Join(cons.Columns, ", ")))
		case "check":
			if cons.Expression == nil {
				continue
			}
			name := cons.Name
			if name == "" {
				name = fmt.Sprintf("%s_check", req.Name)
			}
			parts = append(parts, fmt.Sprintf("CONSTRAINT %s CHECK (%s)",
				quoteIdentifier(name), *cons.Expression))
		}
	}

	query := fmt.Sprintf("CREATE TABLE %s.%s (%s)",
		quoteIdentifier(req.Schema),
		quoteIdentifier(req.Name),
		strings.Join(parts, ", "))

	_, err := db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to create table: %w", err)
	}

	return nil
}

// AlterTableName renames a table
func (db *DB) AlterTableName(ctx context.Context, schema, oldName, newName string) error {
	query := fmt.Sprintf("ALTER TABLE %s.%s RENAME TO %s",
		quoteIdentifier(schema), quoteIdentifier(oldName), quoteIdentifier(newName))
	_, err := db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to rename table: %w", err)
	}
	return nil
}

// DropTable drops a table
func (db *DB) DropTable(ctx context.Context, schema, name string, cascade bool) error {
	query := fmt.Sprintf("DROP TABLE %s.%s", quoteIdentifier(schema), quoteIdentifier(name))
	if cascade {
		query += " CASCADE"
	}
	_, err := db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to drop table: %w", err)
	}
	return nil
}

// EnableRLS enables row level security on a table
func (db *DB) EnableRLS(ctx context.Context, schema, table string) error {
	query := fmt.Sprintf("ALTER TABLE %s.%s ENABLE ROW LEVEL SECURITY",
		quoteIdentifier(schema), quoteIdentifier(table))
	_, err := db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to enable RLS: %w", err)
	}
	return nil
}

// DisableRLS disables row level security on a table
func (db *DB) DisableRLS(ctx context.Context, schema, table string) error {
	query := fmt.Sprintf("ALTER TABLE %s.%s DISABLE ROW LEVEL SECURITY",
		quoteIdentifier(schema), quoteIdentifier(table))
	_, err := db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to disable RLS: %w", err)
	}
	return nil
}

// quoteIdentifier safely quotes a SQL identifier
func quoteIdentifier(name string) string {
	return fmt.Sprintf("\"%s\"", strings.ReplaceAll(name, "\"", "\"\""))
}
