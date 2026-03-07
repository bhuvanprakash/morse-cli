package storage

import (
	"context"
	"io"
)

// Storage defines the interface for object storage backends
type Storage interface {
	// Upload stores an object and returns the storage path and ETag
	Upload(ctx context.Context, bucket, objectName string, data io.Reader, size int64, mimeType string) (storagePath, etag string, err error)

	// Download retrieves an object by its storage path
	Download(ctx context.Context, storagePath string) (io.ReadCloser, int64, error)

	// Delete removes an object by its storage path
	Delete(ctx context.Context, storagePath string) error

	// Exists checks if an object exists
	Exists(ctx context.Context, storagePath string) (bool, error)

	// GeneratePresignedURL creates a signed URL for temporary access
	GeneratePresignedURL(ctx context.Context, storagePath, operation string, expirySeconds int) (string, error)
}

// BackendType represents the storage backend type
type BackendType string

const (
	BackendLocal BackendType = "local"
	BackendS3    BackendType = "s3"
)
