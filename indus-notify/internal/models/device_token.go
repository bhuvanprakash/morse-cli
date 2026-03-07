package models

import (
	"time"

	"github.com/google/uuid"
)

type DevicePlatform string

const (
	PlatformFCM  DevicePlatform = "fcm"
	PlatformAPNS DevicePlatform = "apns"
	PlatformWeb  DevicePlatform = "web"
)

type DeviceToken struct {
	ID         uuid.UUID      `json:"id" db:"id"`
	UserID     uuid.UUID      `json:"user_id" db:"user_id"`
	Token      string         `json:"token" db:"token"`
	Platform   DevicePlatform `json:"platform" db:"platform"`
	DeviceName *string        `json:"device_name,omitempty" db:"device_name"`
	AppVersion *string        `json:"app_version,omitempty" db:"app_version"`
	IsActive   bool           `json:"is_active" db:"is_active"`
	LastSeenAt time.Time      `json:"last_seen_at" db:"last_seen_at"`
	CreatedAt  time.Time      `json:"created_at" db:"created_at"`
}

type RegisterDeviceRequest struct {
	Token      string         `json:"token" validate:"required"`
	Platform   DevicePlatform `json:"platform" validate:"required,oneof=fcm apns web"`
	DeviceName string         `json:"device_name"`
	AppVersion string         `json:"app_version"`
}
