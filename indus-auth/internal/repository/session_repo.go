package repository

import (
	"context"
	"database/sql"
	"fmt"
	"net"
	"time"

	"github.com/google/uuid"
	"github.com/indusbase/indus-auth/internal/models"
)

// SessionRepository handles session database operations
type SessionRepository struct {
	db *sql.DB
}

// NewSessionRepository creates a new session repository
func NewSessionRepository(db *sql.DB) *SessionRepository {
	return &SessionRepository{db: db}
}

// CreateSession creates a new session
func (r *SessionRepository) CreateSession(ctx context.Context, userID, refreshToken string, userAgent *string, ipAddress net.IP, expiresAt time.Time) (*models.Session, error) {
	id := uuid.New().String()

	query := `
		INSERT INTO indusbase_auth.sessions (id, user_id, refresh_token, user_agent, ip_address, expires_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
		RETURNING id, user_id, refresh_token, user_agent, ip_address, is_revoked, expires_at, created_at, updated_at
	`

	session := &models.Session{}
	var ipStr *string
	if ipAddress != nil {
		s := ipAddress.String()
		ipStr = &s
	}

	err := r.db.QueryRowContext(ctx, query, id, userID, refreshToken, userAgent, ipStr, expiresAt).Scan(
		&session.ID, &session.UserID, &session.RefreshToken, &session.UserAgent, &ipStr,
		&session.IsRevoked, &session.ExpiresAt, &session.CreatedAt, &session.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create session: %w", err)
	}

	if ipStr != nil {
		ip := net.ParseIP(*ipStr)
		session.IPAddress = &ip
	}

	return session, nil
}

// GetByRefreshToken gets a session by refresh token
func (r *SessionRepository) GetByRefreshToken(ctx context.Context, refreshToken string) (*models.Session, error) {
	query := `
		SELECT id, user_id, refresh_token, user_agent, ip_address, is_revoked, expires_at, created_at, updated_at
		FROM indusbase_auth.sessions 
		WHERE refresh_token = $1
	`

	session := &models.Session{}
	var ipStr *string
	err := r.db.QueryRowContext(ctx, query, refreshToken).Scan(
		&session.ID, &session.UserID, &session.RefreshToken, &session.UserAgent, &ipStr,
		&session.IsRevoked, &session.ExpiresAt, &session.CreatedAt, &session.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get session by refresh token: %w", err)
	}

	if ipStr != nil {
		ip := net.ParseIP(*ipStr)
		session.IPAddress = &ip
	}

	return session, nil
}

// RevokeSession revokes a session
func (r *SessionRepository) RevokeSession(ctx context.Context, sessionID string) error {
	query := `UPDATE indusbase_auth.sessions SET is_revoked = true, updated_at = NOW() WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, sessionID)
	if err != nil {
		return fmt.Errorf("failed to revoke session: %w", err)
	}
	return nil
}

// RevokeAllUserSessions revokes all sessions for a user
func (r *SessionRepository) RevokeAllUserSessions(ctx context.Context, userID string) error {
	query := `UPDATE indusbase_auth.sessions SET is_revoked = true, updated_at = NOW() WHERE user_id = $1`
	_, err := r.db.ExecContext(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("failed to revoke all user sessions: %w", err)
	}
	return nil
}

// DeleteExpiredSessions deletes all expired sessions
func (r *SessionRepository) DeleteExpiredSessions(ctx context.Context) error {
	query := `DELETE FROM indusbase_auth.sessions WHERE expires_at < NOW()`
	_, err := r.db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to delete expired sessions: %w", err)
	}
	return nil
}

// GetActiveSessionsCount gets the count of active sessions for a user
func (r *SessionRepository) GetActiveSessionsCount(ctx context.Context, userID string) (int, error) {
	query := `
		SELECT COUNT(*) FROM indusbase_auth.sessions 
		WHERE user_id = $1 AND is_revoked = false AND expires_at > NOW()
	`
	var count int
	err := r.db.QueryRowContext(ctx, query, userID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to get active sessions count: %w", err)
	}
	return count, nil
}

// UpdateRefreshToken updates the refresh token for a session (token rotation)
func (r *SessionRepository) UpdateRefreshToken(ctx context.Context, sessionID, newRefreshToken string, newExpiresAt time.Time) error {
	query := `
		UPDATE indusbase_auth.sessions 
		SET refresh_token = $1, expires_at = $2, updated_at = NOW() 
		WHERE id = $3
	`
	_, err := r.db.ExecContext(ctx, query, newRefreshToken, newExpiresAt, sessionID)
	if err != nil {
		return fmt.Errorf("failed to update refresh token: %w", err)
	}
	return nil
}
