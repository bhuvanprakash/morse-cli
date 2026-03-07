package models

// Index represents a database index
type Index struct {
	Name    string   `json:"name" db:"index_name"`
	Schema  string   `json:"schema" db:"schema_name"`
	Table   string   `json:"table" db:"table_name"`
	Columns []string `json:"columns"`
	Unique  bool     `json:"unique" db:"is_unique"`
	Primary bool     `json:"primary" db:"is_primary"`
	Type    string   `json:"type,omitempty"`
}

// CreateIndexRequest represents a request to create an index
type CreateIndexRequest struct {
	Schema  string   `json:"schema" binding:"required"`
	Table   string   `json:"table" binding:"required"`
	Name    string   `json:"name" binding:"required"`
	Columns []string `json:"columns" binding:"required"`
	Unique  bool     `json:"unique"`
	Type    string   `json:"type,omitempty"` // btree, hash, gin, gist, etc.
}
