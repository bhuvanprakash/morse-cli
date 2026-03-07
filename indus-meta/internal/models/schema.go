package models

// Schema represents a database schema
type Schema struct {
	Name        string `json:"name" db:"schema_name"`
	Owner       string `json:"owner" db:"schema_owner"`
	Description string `json:"description,omitempty"`
}

// CreateSchemaRequest represents a request to create a schema
type CreateSchemaRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description,omitempty"`
}
