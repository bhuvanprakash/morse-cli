package enterprise

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"strings"
	"time"
)

func GenerateSCIMToken() (prefix, token, hash string, err error) {
	tokenBytes := make([]byte, 24)
	if _, err = rand.Read(tokenBytes); err != nil {
		return "", "", "", err
	}
	token = "scim_" + hex.EncodeToString(tokenBytes)
	prefix = token[:12]
	sum := sha256.Sum256([]byte(token))
	hash = hex.EncodeToString(sum[:])
	return prefix, token, hash, nil
}

func HashSCIMToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func ParseBearerToken(authHeader string) (string, bool) {
	parts := strings.SplitN(strings.TrimSpace(authHeader), " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return "", false
	}
	if strings.TrimSpace(parts[1]) == "" {
		return "", false
	}
	return strings.TrimSpace(parts[1]), true
}

type SCIMTokenContext struct {
	TokenID      string
	ConnectionID string
	ProjectID    *string
}

func ValidateSCIMToken(ctx context.Context, db *sql.DB, token string) (*SCIMTokenContext, error) {
	const q = `
SELECT id, connection_id, project_id
FROM indusbase_auth.scim_tokens
WHERE token_hash = $1
  AND revoked_at IS NULL
  AND (expires_at IS NULL OR expires_at > NOW())
LIMIT 1
`
	var out SCIMTokenContext
	err := db.QueryRowContext(ctx, q, HashSCIMToken(token)).
		Scan(&out.TokenID, &out.ConnectionID, &out.ProjectID)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	_, _ = db.ExecContext(ctx, `UPDATE indusbase_auth.scim_tokens SET last_used_at = NOW() WHERE id = $1`, out.TokenID)
	return &out, nil
}

func CreateSCIMToken(ctx context.Context, db *sql.DB, connectionID, name string, expiresAt *time.Time) (*SCIMToken, string, error) {
	prefix, token, hash, err := GenerateSCIMToken()
	if err != nil {
		return nil, "", err
	}

	const q = `
INSERT INTO indusbase_auth.scim_tokens (connection_id, name, token_prefix, token_hash, expires_at)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, connection_id, token_prefix, name, last_used_at, expires_at, revoked_at, created_at
`
	var rec SCIMToken
	err = db.QueryRowContext(ctx, q, connectionID, name, prefix, hash, expiresAt).
		Scan(&rec.ID, &rec.ConnectionID, &rec.TokenPrefix, &rec.Name, &rec.LastUsedAt, &rec.ExpiresAt, &rec.RevokedAt, &rec.CreatedAt)
	if err != nil {
		return nil, "", fmt.Errorf("failed to create SCIM token: %w", err)
	}
	return &rec, token, nil
}
