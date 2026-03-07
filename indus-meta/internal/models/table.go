package models

// Table represents a database table
type Table struct {
	Schema      string   `json:"schema" db:"table_schema"`
	Name        string   `json:"name" db:"table_name"`
	Type        string   `json:"type" db:"table_type"`
	Owner       string   `json:"owner,omitempty"`
	Description string   `json:"description,omitempty"`
	Columns     []Column `json:"columns,omitempty"`
}

// CreateTableRequest represents a request to create a table
type CreateTableRequest struct {
	Schema      string          `json:"schema" binding:"required"`
	Name        string          `json:"name" binding:"required"`
	Columns     []ColumnDef     `json:"columns" binding:"required"`
	Constraints []ConstraintDef `json:"constraints,omitempty"`
	Description string          `json:"description,omitempty"`
}

// ColumnDef represents a column definition
type ColumnDef struct {
	Name         string  `json:"name" binding:"required"`
	Type         string  `json:"type" binding:"required"`
	Nullable     bool    `json:"nullable"`
	DefaultValue *string `json:"default,omitempty"`
	Description  string  `json:"description,omitempty"`
}

// ConstraintDef represents a table constraint
type ConstraintDef struct {
	Type       string   `json:"type" binding:"required"` // primary_key, foreign_key, unique, check
	Name       string   `json:"name,omitempty"`
	Columns    []string `json:"columns,omitempty"`
	References *string  `json:"references,omitempty"`
	Expression *string  `json:"expression,omitempty"`
}
