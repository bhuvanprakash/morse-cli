package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/indusbase/indus-meta/internal/models"
)

// RoleOptions represents options for creating or altering a role
type RoleOptions struct {
	Login      bool
	Superuser  bool
	CreateDB   bool
	CreateRole bool
	Inherit    bool
	Password   *string
}

// ListRoles returns all roles in the database
func (db *DB) ListRoles(ctx context.Context) ([]models.Role, error) {
	query := `
		SELECT 
			rolname,
			rolsuper,
			rolinherit,
			rolcreaterole,
			rolcreatedb,
			rolcanlogin
		FROM pg_roles
		WHERE rolname NOT LIKE 'pg_%'
		ORDER BY rolname
	`

	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list roles: %w", err)
	}
	defer rows.Close()

	var roles []models.Role
	for rows.Next() {
		var r models.Role
		if err := rows.Scan(&r.Name, &r.Superuser, &r.Inherit, &r.CreateRole, &r.CreateDB, &r.Login); err != nil {
			return nil, fmt.Errorf("failed to scan role: %w", err)
		}
		roles = append(roles, r)
	}

	return roles, rows.Err()
}

// CreateRole creates a new role
func (db *DB) CreateRole(ctx context.Context, roleName, password string, options RoleOptions) error {
	var parts []string

	if options.Superuser {
		parts = append(parts, "SUPERUSER")
	} else {
		parts = append(parts, "NOSUPERUSER")
	}

	if options.CreateDB {
		parts = append(parts, "CREATEDB")
	} else {
		parts = append(parts, "NOCREATEDB")
	}

	if options.CreateRole {
		parts = append(parts, "CREATEROLE")
	} else {
		parts = append(parts, "NOCREATEROLE")
	}

	if options.Inherit {
		parts = append(parts, "INHERIT")
	} else {
		parts = append(parts, "NOINHERIT")
	}

	if options.Login {
		parts = append(parts, "LOGIN")
	} else {
		parts = append(parts, "NOLOGIN")
	}

	if password != "" {
		parts = append(parts, fmt.Sprintf("PASSWORD '%s'", escapeSQLString(password)))
	}

	query := fmt.Sprintf("CREATE ROLE %s %s", quoteIdentifier(roleName), strings.Join(parts, " "))

	_, err := db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to create role: %w", err)
	}
	return nil
}

// AlterRole alters an existing role
func (db *DB) AlterRole(ctx context.Context, roleName string, options RoleOptions) error {
	var parts []string

	if options.Superuser {
		parts = append(parts, "SUPERUSER")
	} else {
		parts = append(parts, "NOSUPERUSER")
	}

	if options.CreateDB {
		parts = append(parts, "CREATEDB")
	} else {
		parts = append(parts, "NOCREATEDB")
	}

	if options.CreateRole {
		parts = append(parts, "CREATEROLE")
	} else {
		parts = append(parts, "NOCREATEROLE")
	}

	if options.Inherit {
		parts = append(parts, "INHERIT")
	} else {
		parts = append(parts, "NOINHERIT")
	}

	if options.Login {
		parts = append(parts, "LOGIN")
	} else {
		parts = append(parts, "NOLOGIN")
	}

	if options.Password != nil {
		if *options.Password == "" {
			parts = append(parts, "PASSWORD NULL")
		} else {
			parts = append(parts, fmt.Sprintf("PASSWORD '%s'", escapeSQLString(*options.Password)))
		}
	}

	query := fmt.Sprintf("ALTER ROLE %s %s", quoteIdentifier(roleName), strings.Join(parts, " "))

	_, err := db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to alter role: %w", err)
	}
	return nil
}

// DropRole drops a role
func (db *DB) DropRole(ctx context.Context, roleName string) error {
	query := fmt.Sprintf("DROP ROLE %s", quoteIdentifier(roleName))

	_, err := db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to drop role: %w", err)
	}
	return nil
}

// GrantPrivilege grants privileges to a role
func (db *DB) GrantPrivilege(ctx context.Context, role, privilege, schema, table string) error {
	var query string

	if table == "ALL TABLES" {
		query = fmt.Sprintf("GRANT %s ON ALL TABLES IN SCHEMA %s TO %s",
			privilege, quoteIdentifier(schema), quoteIdentifier(role))
	} else {
		query = fmt.Sprintf("GRANT %s ON %s.%s TO %s",
			privilege, quoteIdentifier(schema), quoteIdentifier(table), quoteIdentifier(role))
	}

	_, err := db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to grant privilege: %w", err)
	}
	return nil
}

// RevokePrivilege revokes privileges from a role
func (db *DB) RevokePrivilege(ctx context.Context, role, privilege, schema, table string) error {
	var query string

	if table == "ALL TABLES" {
		query = fmt.Sprintf("REVOKE %s ON ALL TABLES IN SCHEMA %s FROM %s",
			privilege, quoteIdentifier(schema), quoteIdentifier(role))
	} else {
		query = fmt.Sprintf("REVOKE %s ON %s.%s FROM %s",
			privilege, quoteIdentifier(schema), quoteIdentifier(table), quoteIdentifier(role))
	}

	_, err := db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to revoke privilege: %w", err)
	}
	return nil
}

// GetRole returns a single role by name
func (db *DB) GetRole(ctx context.Context, roleName string) (*models.Role, error) {
	query := `
		SELECT 
			rolname,
			rolsuper,
			rolinherit,
			rolcreaterole,
			rolcreatedb,
			rolcanlogin
		FROM pg_roles
		WHERE rolname = $1
	`

	var r models.Role
	err := db.QueryRowContext(ctx, query, roleName).Scan(
		&r.Name, &r.Superuser, &r.Inherit, &r.CreateRole, &r.CreateDB, &r.Login,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("role not found: %s", roleName)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get role: %w", err)
	}

	return &r, nil
}

// escapeSQLString escapes a string for safe use in SQL
func escapeSQLString(s string) string {
	return strings.ReplaceAll(s, "'", "''")
}
