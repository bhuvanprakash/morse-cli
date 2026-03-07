package db

import (
	"context"
	"database/sql"
	_ "embed"
	"time"

	_ "github.com/lib/pq"
)

//go:embed migrations/001_create_config_schema.sql
var migration001 string

func Connect(databaseURL string) (*sql.DB, error) {
	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(20)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(30 * time.Minute)
	if err := db.Ping(); err != nil {
		return nil, err
	}
	return db, nil
}

func RunMigrations(ctx context.Context, db *sql.DB) error {
	_, err := db.ExecContext(ctx, migration001)
	return err
}
