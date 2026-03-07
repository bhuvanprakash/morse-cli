package models

import "time"

// Migration represents a database migration record
type Migration struct {
	ID        int       `json:"id" db:"id"`
	Version   string    `json:"version" db:"version"`
	Name      string    `json:"name" db:"name"`
	AppliedAt time.Time `json:"applied_at" db:"applied_at"`
	Checksum  string    `json:"checksum,omitempty" db:"checksum"`
}

// RunMigrationRequest represents a request to run a migration
type RunMigrationRequest struct {
	Version string `json:"version" binding:"required"`
	Name    string `json:"name" binding:"required"`
	SQLUp   string `json:"sql_up" binding:"required"`
	SQLDown string `json:"sql_down,omitempty"`
}

// RollbackMigrationRequest represents a request to rollback a migration
type RollbackMigrationRequest struct {
	Version string `json:"version" binding:"required"`
}
