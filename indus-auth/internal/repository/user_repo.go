package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/indusbase/indus-auth/internal/models"
)

// UserRepository handles user database operations
type UserRepository struct {
	db *sql.DB
}

// NewUserRepository creates a new user repository
func NewUserRepository(db *sql.DB) *UserRepository {
	return &UserRepository{db: db}
}

// CreateUser creates a new user
func (r *UserRepository) CreateUser(ctx context.Context, email, passwordHash, name string, metadata json.RawMessage) (*models.User, error) {
	id := uuid.New().String()

	query := `
		INSERT INTO indusbase_auth.users (id, email, password_hash, name, metadata, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
		RETURNING id, email, password_hash, name, role, email_verified, phone_verified, status, metadata, created_at, updated_at
	`

	user := &models.User{}
	err := r.db.QueryRowContext(ctx, query, id, email, passwordHash, name, metadata).Scan(
		&user.ID, &user.Email, &user.PasswordHash, &user.Name, &user.Role,
		&user.EmailVerified, &user.PhoneVerified, &user.Status, &user.Metadata,
		&user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	return user, nil
}

// GetByPhone gets a user by phone number
func (r *UserRepository) GetByPhone(ctx context.Context, phone string) (*models.User, error) {
	query := `
		SELECT id, email, phone, password_hash, name, role, email_verified, phone_verified,
		       status, avatar_url, metadata, last_sign_in_at, created_at, updated_at, deleted_at
		FROM indusbase_auth.users
		WHERE phone = $1 AND deleted_at IS NULL
	`

	user := &models.User{}
	err := r.db.QueryRowContext(ctx, query, phone).Scan(
		&user.ID, &user.Email, &user.Phone, &user.PasswordHash, &user.Name, &user.Role,
		&user.EmailVerified, &user.PhoneVerified, &user.Status, &user.AvatarURL,
		&user.Metadata, &user.LastSignInAt, &user.CreatedAt, &user.UpdatedAt, &user.DeletedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get user by phone: %w", err)
	}

	return user, nil
}

// CreatePhoneUser creates a new phone-verified user with a synthetic internal email.
func (r *UserRepository) CreatePhoneUser(ctx context.Context, phone, email, name string, metadata json.RawMessage) (*models.User, error) {
	id := uuid.New().String()

	query := `
		INSERT INTO indusbase_auth.users (
			id, email, phone, password_hash, name, role, email_verified, phone_verified, status, metadata, created_at, updated_at
		)
		VALUES ($1, $2, $3, NULL, $4, 'user', FALSE, TRUE, 'active', $5, NOW(), NOW())
		RETURNING id, email, phone, password_hash, name, role, email_verified, phone_verified, status, metadata, created_at, updated_at
	`

	user := &models.User{}
	err := r.db.QueryRowContext(ctx, query, id, email, phone, name, metadata).Scan(
		&user.ID, &user.Email, &user.Phone, &user.PasswordHash, &user.Name, &user.Role,
		&user.EmailVerified, &user.PhoneVerified, &user.Status, &user.Metadata,
		&user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create phone user: %w", err)
	}

	return user, nil
}

// GetByEmail gets a user by email
func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	query := `
		SELECT id, email, phone, password_hash, name, role, email_verified, phone_verified, 
		       status, avatar_url, metadata, last_sign_in_at, created_at, updated_at, deleted_at
		FROM indusbase_auth.users 
		WHERE email = $1 AND deleted_at IS NULL
	`

	user := &models.User{}
	err := r.db.QueryRowContext(ctx, query, email).Scan(
		&user.ID, &user.Email, &user.Phone, &user.PasswordHash, &user.Name, &user.Role,
		&user.EmailVerified, &user.PhoneVerified, &user.Status, &user.AvatarURL,
		&user.Metadata, &user.LastSignInAt, &user.CreatedAt, &user.UpdatedAt, &user.DeletedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get user by email: %w", err)
	}

	return user, nil
}

// GetByID gets a user by ID
func (r *UserRepository) GetByID(ctx context.Context, id string) (*models.User, error) {
	query := `
		SELECT id, email, phone, password_hash, name, role, email_verified, phone_verified, 
		       status, avatar_url, metadata, last_sign_in_at, created_at, updated_at, deleted_at
		FROM indusbase_auth.users 
		WHERE id = $1 AND deleted_at IS NULL
	`

	user := &models.User{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&user.ID, &user.Email, &user.Phone, &user.PasswordHash, &user.Name, &user.Role,
		&user.EmailVerified, &user.PhoneVerified, &user.Status, &user.AvatarURL,
		&user.Metadata, &user.LastSignInAt, &user.CreatedAt, &user.UpdatedAt, &user.DeletedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get user by ID: %w", err)
	}

	return user, nil
}

// UpdateLastSignIn updates the user's last sign in time
func (r *UserRepository) UpdateLastSignIn(ctx context.Context, userID string) error {
	query := `UPDATE indusbase_auth.users SET last_sign_in_at = NOW(), updated_at = NOW() WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("failed to update last sign in: %w", err)
	}
	return nil
}

// UpdateEmailVerified marks the user's email as verified
func (r *UserRepository) UpdateEmailVerified(ctx context.Context, userID string, verified bool) error {
	query := `UPDATE indusbase_auth.users SET email_verified = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, verified, userID)
	if err != nil {
		return fmt.Errorf("failed to update email verified: %w", err)
	}
	return nil
}

// BanUser bans a user by setting status to 'banned'
func (r *UserRepository) BanUser(ctx context.Context, userID string) error {
	query := `UPDATE indusbase_auth.users SET status = 'banned', updated_at = NOW() WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("failed to ban user: %w", err)
	}
	return nil
}

// UpdateUserMeta updates user metadata
func (r *UserRepository) UpdateUserMeta(ctx context.Context, userID string, metadata json.RawMessage) error {
	query := `UPDATE indusbase_auth.users SET metadata = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, metadata, userID)
	if err != nil {
		return fmt.Errorf("failed to update user metadata: %w", err)
	}
	return nil
}

// UpdateUser updates user fields
func (r *UserRepository) UpdateUser(ctx context.Context, userID string, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return nil
	}

	query := "UPDATE indusbase_auth.users SET "
	args := []interface{}{}
	i := 1

	for key, value := range updates {
		if i > 1 {
			query += ", "
		}
		query += key + " = $" + fmt.Sprintf("%d", i)
		args = append(args, value)
		i++
	}

	query += ", updated_at = NOW() WHERE id = $" + fmt.Sprintf("%d", i)
	args = append(args, userID)

	_, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}
	return nil
}

// DeleteUser soft deletes a user
func (r *UserRepository) DeleteUser(ctx context.Context, userID string) error {
	query := `UPDATE indusbase_auth.users SET deleted_at = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, time.Now(), userID)
	if err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}
	return nil
}

// ListUsers lists users with pagination
func (r *UserRepository) ListUsers(ctx context.Context, offset, limit int) ([]*models.User, error) {
	query := `
		SELECT id, email, phone, name, role, email_verified, phone_verified, 
		       status, avatar_url, metadata, last_sign_in_at, created_at, updated_at
		FROM indusbase_auth.users 
		WHERE deleted_at IS NULL
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2
	`

	rows, err := r.db.QueryContext(ctx, query, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to list users: %w", err)
	}
	defer rows.Close()

	var users []*models.User
	for rows.Next() {
		user := &models.User{}
		err := rows.Scan(
			&user.ID, &user.Email, &user.Phone, &user.Name, &user.Role,
			&user.EmailVerified, &user.PhoneVerified, &user.Status, &user.AvatarURL,
			&user.Metadata, &user.LastSignInAt, &user.CreatedAt, &user.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan user: %w", err)
		}
		users = append(users, user)
	}

	return users, rows.Err()
}
