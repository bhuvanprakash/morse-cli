package models

// Extension represents a PostgreSQL extension
type Extension struct {
	Name        string `json:"name" db:"extname"`
	Version     string `json:"version" db:"extversion"`
	Schema      string `json:"schema" db:"nspname"`
	Description string `json:"description,omitempty"`
	Enabled     bool   `json:"enabled"`
}

// EnableExtensionRequest represents a request to enable an extension
type EnableExtensionRequest struct {
	Name   string `json:"name" binding:"required"`
	Schema string `json:"schema,omitempty"` // defaults to public
}
