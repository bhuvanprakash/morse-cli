package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
)

// Object represents a stored object
type Object struct {
	ID             uuid.UUID      `json:"id"`
	BucketID       uuid.UUID      `json:"bucket_id"`
	Name           string         `json:"name"`
	OwnerID        uuid.UUID      `json:"owner_id"`
	Size           int64          `json:"size"`
	MimeType       string         `json:"mime_type"`
	ETag           string         `json:"etag"`
	StorageBackend string         `json:"storage_backend"`
	StoragePath    string         `json:"storage_path"`
	Metadata       ObjectMetadata `json:"metadata"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
}

// ObjectMetadata represents custom metadata for an object
type ObjectMetadata map[string]string

// Value implements driver.Valuer for JSONB
func (m ObjectMetadata) Value() (driver.Value, error) {
	if m == nil {
		return "{}", nil
	}
	return json.Marshal(m)
}

// Scan implements sql.Scanner for JSONB
func (m *ObjectMetadata) Scan(value interface{}) error {
	if value == nil {
		*m = ObjectMetadata{}
		return nil
	}

	var data []byte
	switch v := value.(type) {
	case []byte:
		data = v
	case string:
		data = []byte(v)
	default:
		return errors.New("invalid type for ObjectMetadata")
	}

	if len(data) == 0 || string(data) == "{}" {
		*m = ObjectMetadata{}
		return nil
	}

	return json.Unmarshal(data, m)
}

// ObjectUploadRequest represents an object upload request
type ObjectUploadRequest struct {
	Metadata map[string]string `json:"metadata,omitempty"`
}

// ObjectResponse represents an object in API responses
type ObjectResponse struct {
	ID             uuid.UUID      `json:"id"`
	BucketID       uuid.UUID      `json:"bucket_id"`
	BucketName     string         `json:"bucket_name,omitempty"`
	Name           string         `json:"name"`
	OwnerID        uuid.UUID      `json:"owner_id"`
	Size           int64          `json:"size"`
	MimeType       string         `json:"mime_type"`
	ETag           string         `json:"etag"`
	StorageBackend string         `json:"storage_backend"`
	Metadata       ObjectMetadata `json:"metadata"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
}

// ObjectListResponse represents a list of objects
type ObjectListResponse struct {
	Objects    []ObjectResponse `json:"objects"`
	TotalCount int              `json:"total_count"`
	Limit      int              `json:"limit"`
	Offset     int              `json:"offset"`
}

// SignedURLRequest represents a request for a signed URL
type SignedURLRequest struct {
	Expires     int               `json:"expires,omitempty"`
	ContentType string            `json:"content_type,omitempty"`
	Metadata    map[string]string `json:"metadata,omitempty"`
}

// SignedURLResponse represents a signed URL response
type SignedURLResponse struct {
	URL       string            `json:"url"`
	Path      string            `json:"path"`
	ExpiresIn int               `json:"expires_in"`
	Token     string            `json:"token,omitempty"`
	Metadata  map[string]string `json:"metadata,omitempty"`
}

// UploadTokenRequest represents a request for an upload token
type UploadTokenRequest struct {
	Filename    string            `json:"filename" binding:"required"`
	ContentType string            `json:"content_type,omitempty"`
	Size        int64             `json:"size,omitempty"`
	Metadata    map[string]string `json:"metadata,omitempty"`
}

// UploadTokenResponse represents an upload token response
type UploadTokenResponse struct {
	URL       string            `json:"url"`
	Token     string            `json:"token"`
	ExpiresIn int               `json:"expires_in"`
	Path      string            `json:"path"`
	Metadata  map[string]string `json:"metadata,omitempty"`
}

// ToResponse converts Object to ObjectResponse
func (o *Object) ToResponse() ObjectResponse {
	return ObjectResponse{
		ID:             o.ID,
		BucketID:       o.BucketID,
		Name:           o.Name,
		OwnerID:        o.OwnerID,
		Size:           o.Size,
		MimeType:       o.MimeType,
		ETag:           o.ETag,
		StorageBackend: o.StorageBackend,
		Metadata:       o.Metadata,
		CreatedAt:      o.CreatedAt,
		UpdatedAt:      o.UpdatedAt,
	}
}

// ToResponseWithBucket converts Object to ObjectResponse with bucket name
func (o *Object) ToResponseWithBucket(bucketName string) ObjectResponse {
	resp := o.ToResponse()
	resp.BucketName = bucketName
	return resp
}

// NewObject creates a new object from upload data
func NewObject(bucketID uuid.UUID, name string, ownerID uuid.UUID, size int64, mimeType, etag, storageBackend, storagePath string, metadata ObjectMetadata) *Object {
	now := time.Now().UTC()
	if metadata == nil {
		metadata = ObjectMetadata{}
	}
	return &Object{
		ID:             uuid.New(),
		BucketID:       bucketID,
		Name:           name,
		OwnerID:        ownerID,
		Size:           size,
		MimeType:       mimeType,
		ETag:           etag,
		StorageBackend: storageBackend,
		StoragePath:    storagePath,
		Metadata:       metadata,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
}
