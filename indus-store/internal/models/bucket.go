package models

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

// Bucket represents a storage bucket
type Bucket struct {
	ID               uuid.UUID `json:"id"`
	Name             string    `json:"name"`
	OwnerID          uuid.UUID `json:"owner_id"`
	Public           bool      `json:"public"`
	AllowedMimeTypes []string  `json:"allowed_mime_types,omitempty"`
	FileSizeLimit    int64     `json:"file_size_limit"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// BucketCreate represents the request to create a bucket
type BucketCreate struct {
	Name             string   `json:"name" binding:"required,min=1,max=255"`
	Public           bool     `json:"public"`
	AllowedMimeTypes []string `json:"allowed_mime_types,omitempty"`
	FileSizeLimit    int64    `json:"file_size_limit"`
}

// BucketUpdate represents the request to update a bucket
type BucketUpdate struct {
	Public           *bool    `json:"public,omitempty"`
	AllowedMimeTypes []string `json:"allowed_mime_types,omitempty"`
	FileSizeLimit    *int64   `json:"file_size_limit,omitempty"`
}

// BucketResponse represents a bucket in API responses
type BucketResponse struct {
	ID               uuid.UUID `json:"id"`
	Name             string    `json:"name"`
	OwnerID          uuid.UUID `json:"owner_id"`
	Public           bool      `json:"public"`
	AllowedMimeTypes []string  `json:"allowed_mime_types,omitempty"`
	FileSizeLimit    int64     `json:"file_size_limit"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// Validate validates bucket creation data
func (b *BucketCreate) Validate() error {
	if b.Name == "" {
		return errors.New("bucket name is required")
	}

	if len(b.Name) > 255 {
		return errors.New("bucket name must be less than 255 characters")
	}

	// Validate name format (alphanumeric, hyphens, underscores)
	for _, c := range b.Name {
		if !isValidBucketChar(c) {
			return errors.New("bucket name can only contain alphanumeric characters, hyphens, and underscores")
		}
	}

	// Default file size limit: 50MB
	if b.FileSizeLimit <= 0 {
		b.FileSizeLimit = 52428800
	}

	return nil
}

// ValidateMimeType checks if a MIME type is allowed for this bucket
func (b *Bucket) ValidateMimeType(mimeType string) bool {
	// If no allowed types specified, allow all
	if len(b.AllowedMimeTypes) == 0 {
		return true
	}

	for _, allowed := range b.AllowedMimeTypes {
		if allowed == mimeType {
			return true
		}
		// Support wildcards like "image/*"
		if len(allowed) > 0 && allowed[len(allowed)-1] == '*' {
			prefix := allowed[:len(allowed)-1]
			if len(mimeType) >= len(prefix) && mimeType[:len(prefix)] == prefix {
				return true
			}
		}
	}

	return false
}

// ValidateFileSize checks if a file size is within the bucket limit
func (b *Bucket) ValidateFileSize(size int64) bool {
	return size <= b.FileSizeLimit
}

// ToResponse converts Bucket to BucketResponse
func (b *Bucket) ToResponse() BucketResponse {
	return BucketResponse{
		ID:               b.ID,
		Name:             b.Name,
		OwnerID:          b.OwnerID,
		Public:           b.Public,
		AllowedMimeTypes: b.AllowedMimeTypes,
		FileSizeLimit:    b.FileSizeLimit,
		CreatedAt:        b.CreatedAt,
		UpdatedAt:        b.UpdatedAt,
	}
}

// isValidBucketChar checks if a character is valid in a bucket name
func isValidBucketChar(c rune) bool {
	return (c >= 'a' && c <= 'z') ||
		(c >= 'A' && c <= 'Z') ||
		(c >= '0' && c <= '9') ||
		c == '-' || c == '_'
}

// NewBucket creates a new bucket from create data
func NewBucket(create *BucketCreate, ownerID uuid.UUID) *Bucket {
	now := time.Now().UTC()
	return &Bucket{
		ID:               uuid.New(),
		Name:             create.Name,
		OwnerID:          ownerID,
		Public:           create.Public,
		AllowedMimeTypes: create.AllowedMimeTypes,
		FileSizeLimit:    create.FileSizeLimit,
		CreatedAt:        now,
		UpdatedAt:        now,
	}
}
