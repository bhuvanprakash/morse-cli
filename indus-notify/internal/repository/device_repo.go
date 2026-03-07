package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/google/uuid"
	"github.com/indusbase/indus-notify/internal/models"
	"github.com/lib/pq"
)

type DeviceRepository struct {
	db *sql.DB
}

func NewDeviceRepository(db *sql.DB) *DeviceRepository {
	return &DeviceRepository{db: db}
}

func (r *DeviceRepository) Upsert(ctx context.Context, userID uuid.UUID, req *models.RegisterDeviceRequest) (*models.DeviceToken, error) {
	query := `
		INSERT INTO indusbase_notify.device_tokens (user_id, token, platform, device_name, app_version, is_active, last_seen_at)
		VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''), true, NOW())
		ON CONFLICT (user_id, token) DO UPDATE SET
			platform = EXCLUDED.platform,
			device_name = EXCLUDED.device_name,
			app_version = EXCLUDED.app_version,
			is_active = true,
			last_seen_at = NOW()
		RETURNING id, user_id, token, platform, device_name, app_version, is_active, last_seen_at, created_at`
	device := &models.DeviceToken{}
	err := r.db.QueryRowContext(ctx, query, userID, req.Token, req.Platform, req.DeviceName, req.AppVersion).
		Scan(&device.ID, &device.UserID, &device.Token, &device.Platform, &device.DeviceName, &device.AppVersion, &device.IsActive, &device.LastSeenAt, &device.CreatedAt)
	if err != nil {
		return nil, err
	}
	return device, nil
}

func (r *DeviceRepository) Deactivate(ctx context.Context, token string, userID *uuid.UUID) error {
	query := `UPDATE indusbase_notify.device_tokens SET is_active = false, last_seen_at = NOW() WHERE token = $1`
	args := []interface{}{token}
	if userID != nil {
		query += ` AND user_id = $2`
		args = append(args, *userID)
	}
	_, err := r.db.ExecContext(ctx, query, args...)
	return err
}

func (r *DeviceRepository) DeactivateInvalid(ctx context.Context, tokens []string) error {
	if len(tokens) == 0 {
		return nil
	}
	query := `UPDATE indusbase_notify.device_tokens SET is_active = false, last_seen_at = NOW() WHERE token = ANY($1)`
	_, err := r.db.ExecContext(ctx, query, pq.Array(tokens))
	return err
}

func (r *DeviceRepository) ListByUser(ctx context.Context, userID uuid.UUID) ([]models.DeviceToken, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, user_id, token, platform, device_name, app_version, is_active, last_seen_at, created_at
		FROM indusbase_notify.device_tokens
		WHERE user_id = $1 AND is_active = true
		ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var devices []models.DeviceToken
	for rows.Next() {
		var device models.DeviceToken
		if err := rows.Scan(&device.ID, &device.UserID, &device.Token, &device.Platform, &device.DeviceName, &device.AppVersion, &device.IsActive, &device.LastSeenAt, &device.CreatedAt); err != nil {
			return nil, err
		}
		devices = append(devices, device)
	}
	return devices, rows.Err()
}

func (r *DeviceRepository) ListByUserString(ctx context.Context, rawUserID string) ([]models.DeviceToken, error) {
	userID, err := uuid.Parse(rawUserID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id: %w", err)
	}
	return r.ListByUser(ctx, userID)
}
