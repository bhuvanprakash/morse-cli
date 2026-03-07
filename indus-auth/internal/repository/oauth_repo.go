package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/indusbase/indus-auth/internal/models"
)

// OAuthRepository handles OAuth account database operations
type OAuthRepository struct {
	db *sql.DB
}

// NewOAuthRepository creates a new OAuth repository
func NewOAuthRepository(db *sql.DB) *OAuthRepository {
	return &OAuthRepository{db: db}
}

// UpsertOAuthAccount creates or updates an OAuth account
func (r *OAuthRepository) UpsertOAuthAccount(ctx context.Context, userID, provider, providerUserID string, email, name, avatarURL, accessToken, refreshToken *string, expiresAt *time.Time) (*models.OAuthAccount, error) {
	id := uuid.New().String()

	query := `
		INSERT INTO indusbase_auth.oauth_accounts 
		(id, user_id, provider, provider_user_id, email, name, avatar_url, access_token, refresh_token, expires_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
		ON CONFLICT (provider, provider_user_id) 
		DO UPDATE SET 
			email = EXCLUDED.email,
			name = EXCLUDED.name,
			avatar_url = EXCLUDED.avatar_url,
			access_token = EXCLUDED.access_token,
			refresh_token = EXCLUDED.refresh_token,
			expires_at = EXCLUDED.expires_at,
			updated_at = NOW()
		RETURNING id, user_id, provider, provider_user_id, email, name, avatar_url, access_token, refresh_token, expires_at, created_at, updated_at
	`

	account := &models.OAuthAccount{}
	err := r.db.QueryRowContext(ctx, query, id, userID, provider, providerUserID, email, name, avatarURL, accessToken, refreshToken, expiresAt).Scan(
		&account.ID, &account.UserID, &account.Provider, &account.ProviderUserID, &account.Email,
		&account.Name, &account.AvatarURL, &account.AccessToken, &account.RefreshToken, &account.ExpiresAt,
		&account.CreatedAt, &account.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to upsert OAuth account: %w", err)
	}

	return account, nil
}

// GetByProvider gets an OAuth account by provider and provider user ID
func (r *OAuthRepository) GetByProvider(ctx context.Context, provider, providerUserID string) (*models.OAuthAccount, error) {
	query := `
		SELECT id, user_id, provider, provider_user_id, email, name, avatar_url, access_token, refresh_token, expires_at, created_at, updated_at
		FROM indusbase_auth.oauth_accounts 
		WHERE provider = $1 AND provider_user_id = $2
	`

	account := &models.OAuthAccount{}
	err := r.db.QueryRowContext(ctx, query, provider, providerUserID).Scan(
		&account.ID, &account.UserID, &account.Provider, &account.ProviderUserID, &account.Email,
		&account.Name, &account.AvatarURL, &account.AccessToken, &account.RefreshToken, &account.ExpiresAt,
		&account.CreatedAt, &account.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get OAuth account: %w", err)
	}

	return account, nil
}

// GetUserByProviderEmail gets a user by OAuth provider email
func (r *OAuthRepository) GetUserByProviderEmail(ctx context.Context, email string) (*models.User, error) {
	query := `
		SELECT u.id, u.email, u.phone, u.password_hash, u.name, u.role, u.email_verified, u.phone_verified, 
		       u.status, u.avatar_url, u.metadata, u.last_sign_in_at, u.created_at, u.updated_at, u.deleted_at
		FROM indusbase_auth.users u
		JOIN indusbase_auth.oauth_accounts oa ON oa.user_id = u.id
		WHERE oa.email = $1 AND u.deleted_at IS NULL
		LIMIT 1
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
		return nil, fmt.Errorf("failed to get user by provider email: %w", err)
	}

	return user, nil
}

// GetAccountsByUserID gets all OAuth accounts for a user
func (r *OAuthRepository) GetAccountsByUserID(ctx context.Context, userID string) ([]*models.OAuthAccount, error) {
	query := `
		SELECT id, user_id, provider, provider_user_id, email, name, avatar_url, expires_at, created_at, updated_at
		FROM indusbase_auth.oauth_accounts 
		WHERE user_id = $1
	`

	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get OAuth accounts: %w", err)
	}
	defer rows.Close()

	var accounts []*models.OAuthAccount
	for rows.Next() {
		account := &models.OAuthAccount{}
		err := rows.Scan(
			&account.ID, &account.UserID, &account.Provider, &account.ProviderUserID, &account.Email,
			&account.Name, &account.AvatarURL, &account.ExpiresAt, &account.CreatedAt, &account.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan OAuth account: %w", err)
		}
		accounts = append(accounts, account)
	}

	return accounts, rows.Err()
}

// DeleteOAuthAccount deletes an OAuth account
func (r *OAuthRepository) DeleteOAuthAccount(ctx context.Context, accountID string) error {
	query := `DELETE FROM indusbase_auth.oauth_accounts WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, accountID)
	if err != nil {
		return fmt.Errorf("failed to delete OAuth account: %w", err)
	}
	return nil
}
