package models

// Function represents a database function
type Function struct {
	Schema      string `json:"schema" db:"routine_schema"`
	Name        string `json:"name" db:"routine_name"`
	Language    string `json:"language" db:"routine_type"`
	ReturnType  string `json:"return_type" db:"data_type"`
	Definition  string `json:"definition,omitempty"`
	Arguments   string `json:"arguments,omitempty" db:"routine_definition"`
	Description string `json:"description,omitempty"`
}

// CreateFunctionRequest represents a request to create a function
type CreateFunctionRequest struct {
	Schema     string `json:"schema" binding:"required"`
	Name       string `json:"name" binding:"required"`
	Arguments  string `json:"arguments,omitempty"`
	ReturnType string `json:"return_type" binding:"required"`
	Language   string `json:"language" binding:"required"`
	Definition string `json:"definition" binding:"required"`
}
