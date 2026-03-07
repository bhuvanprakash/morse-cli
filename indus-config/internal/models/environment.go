package models

import (
	"time"

	"github.com/google/uuid"
)

type Environment struct {
	ID           uuid.UUID `json:"id" db:"id"`
	Name         string    `json:"name" db:"name"`
	Description  string    `json:"description" db:"description"`
	IsProduction bool      `json:"is_production" db:"is_production"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
}
