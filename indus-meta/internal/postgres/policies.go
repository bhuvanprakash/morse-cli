package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/indusbase/indus-meta/internal/models"
)

// CreatePolicyRequest represents a policy creation request
type CreatePolicyRequest struct {
	Schema     string
	Table      string
	Name       string
	Command    string // ALL, SELECT, INSERT, UPDATE, DELETE
	Roles      []string
	Using      string // for SELECT, UPDATE, DELETE
	WithCheck  string // for INSERT, UPDATE
	Permissive bool   // true = PERMISSIVE, false = RESTRICTIVE
}

// ListPolicies returns all RLS policies for a table
func (db *DB) ListPolicies(ctx context.Context, schema, table string) ([]models.Policy, error) {
	query := `
		SELECT 
			schemaname,
			tablename,
			policyname,
			cmd,
			permissive,
			COALESCE(roles::text, '') as roles,
			qual,
			with_check
		FROM pg_policies
		WHERE schemaname = $1 AND tablename = $2
		ORDER BY policyname
	`

	rows, err := db.QueryContext(ctx, query, schema, table)
	if err != nil {
		return nil, fmt.Errorf("failed to list policies: %w", err)
	}
	defer rows.Close()

	var policies []models.Policy
	for rows.Next() {
		var p models.Policy
		if err := rows.Scan(&p.Schema, &p.Table, &p.Name, &p.Command, &p.Permissive, &p.Roles, &p.Using, &p.WithCheck); err != nil {
			return nil, fmt.Errorf("failed to scan policy: %w", err)
		}
		policies = append(policies, p)
	}

	return policies, rows.Err()
}

// CreatePolicy creates a new RLS policy
func (db *DB) CreatePolicy(ctx context.Context, req CreatePolicyRequest) error {
	if req.Schema == "" || req.Table == "" || req.Name == "" || req.Command == "" {
		return fmt.Errorf("schema, table, name, and command are required")
	}

	var parts []string

	// PERMISSIVE or RESTRICTIVE
	if req.Permissive {
		parts = append(parts, "PERMISSIVE")
	} else {
		parts = append(parts, "RESTRICTIVE")
	}

	// Command
	parts = append(parts, req.Command)

	// Roles
	if len(req.Roles) > 0 {
		parts = append(parts, "TO", strings.Join(req.Roles, ", "))
	} else {
		parts = append(parts, "TO PUBLIC")
	}

	// USING expression
	if req.Using != "" {
		parts = append(parts, fmt.Sprintf("USING (%s)", req.Using))
	}

	// WITH CHECK expression
	if req.WithCheck != "" {
		parts = append(parts, fmt.Sprintf("WITH CHECK (%s)", req.WithCheck))
	}

	query := fmt.Sprintf("CREATE POLICY %s ON %s.%s %s",
		quoteIdentifier(req.Name),
		quoteIdentifier(req.Schema),
		quoteIdentifier(req.Table),
		strings.Join(parts, " "))

	_, err := db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to create policy: %w", err)
	}
	return nil
}

// DropPolicy drops an RLS policy
func (db *DB) DropPolicy(ctx context.Context, schema, table, policyName string) error {
	query := fmt.Sprintf("DROP POLICY %s ON %s.%s",
		quoteIdentifier(policyName),
		quoteIdentifier(schema),
		quoteIdentifier(table))

	_, err := db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to drop policy: %w", err)
	}
	return nil
}

// GetPolicy returns a single policy by name
func (db *DB) GetPolicy(ctx context.Context, schema, table, policyName string) (*models.Policy, error) {
	query := `
		SELECT 
			schemaname,
			tablename,
			policyname,
			cmd,
			permissive,
			COALESCE(roles::text, '') as roles,
			qual,
			with_check
		FROM pg_policies
		WHERE schemaname = $1 AND tablename = $2 AND policyname = $3
	`

	var p models.Policy
	err := db.QueryRowContext(ctx, query, schema, table, policyName).Scan(
		&p.Schema, &p.Table, &p.Name, &p.Command, &p.Permissive, &p.Roles, &p.Using, &p.WithCheck,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("policy not found: %s.%s.%s", schema, table, policyName)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get policy: %w", err)
	}

	return &p, nil
}

// IsRLSEnabled checks if RLS is enabled on a table
func (db *DB) IsRLSEnabled(ctx context.Context, schema, table string) (bool, error) {
	query := `
		SELECT relrowsecurity 
		FROM pg_class c
		JOIN pg_namespace n ON n.oid = c.relnamespace
		WHERE n.nspname = $1 AND c.relname = $2
	`

	var enabled bool
	err := db.QueryRowContext(ctx, query, schema, table).Scan(&enabled)
	if err == sql.ErrNoRows {
		return false, fmt.Errorf("table not found: %s.%s", schema, table)
	}
	if err != nil {
		return false, fmt.Errorf("failed to check RLS status: %w", err)
	}

	return enabled, nil
}
