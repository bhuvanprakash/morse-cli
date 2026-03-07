package models

// Column represents a table column
type Column struct {
	Name         string  `json:"name" db:"column_name"`
	Type         string  `json:"type" db:"data_type"`
	Nullable     bool    `json:"nullable" db:"is_nullable"`
	DefaultValue *string `json:"default,omitempty" db:"column_default"`
	MaxLength    *int    `json:"max_length,omitempty" db:"character_maximum_length"`
	Description  string  `json:"description,omitempty"`
	Position     int     `json:"position" db:"ordinal_position"`
}

// AddColumnRequest represents a request to add a column
type AddColumnRequest struct {
	Name         string  `json:"name" binding:"required"`
	Type         string  `json:"type" binding:"required"`
	Nullable     bool    `json:"nullable"`
	DefaultValue *string `json:"default,omitempty"`
	Description  string  `json:"description,omitempty"`
}

// AlterColumnRequest represents a request to alter a column
type AlterColumnRequest struct {
	Type         *string `json:"type,omitempty"`
	Nullable     *bool   `json:"nullable,omitempty"`
	DefaultValue *string `json:"default,omitempty"`
	Description  *string `json:"description,omitempty"`
}
