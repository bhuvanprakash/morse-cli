package storage

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

// LocalStorage implements Storage interface for local filesystem
type LocalStorage struct {
	basePath string
	secret   string
}

// NewLocalStorage creates a new local storage instance
func NewLocalStorage(basePath, secret string) (*LocalStorage, error) {
	// Ensure base path exists
	if err := os.MkdirAll(basePath, 0755); err != nil {
		return nil, fmt.Errorf("failed to create storage directory: %w", err)
	}

	return &LocalStorage{
		basePath: basePath,
		secret:   secret,
	}, nil
}

// Upload stores a file locally with atomic write
func (l *LocalStorage) Upload(ctx context.Context, bucket, objectName string, data io.Reader, size int64, mimeType string) (string, string, error) {
	// Generate unique storage path
	objectID := uuid.New().String()
	storagePath := filepath.Join(bucket, objectID[:2], objectID[2:4], objectID)
	fullPath := filepath.Join(l.basePath, storagePath)

	// Create directory structure
	dir := filepath.Dir(fullPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", "", fmt.Errorf("failed to create directory: %w", err)
	}

	// Write to temp file first for atomicity
	tempPath := fullPath + ".tmp"
	file, err := os.OpenFile(tempPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil {
		return "", "", fmt.Errorf("failed to create temp file: %w", err)
	}

	// Copy data and compute hash
	hash := sha256.New()
	tee := io.TeeReader(data, hash)

	written, err := io.Copy(file, tee)
	if err != nil {
		file.Close()
		os.Remove(tempPath)
		return "", "", fmt.Errorf("failed to write file: %w", err)
	}
	file.Close()

	// Verify size
	if written != size {
		os.Remove(tempPath)
		return "", "", fmt.Errorf("size mismatch: expected %d, wrote %d", size, written)
	}

	// Atomic rename
	if err := os.Rename(tempPath, fullPath); err != nil {
		os.Remove(tempPath)
		return "", "", fmt.Errorf("failed to rename file: %w", err)
	}

	// Generate ETag from hash
	etag := fmt.Sprintf("\"%s\"", hex.EncodeToString(hash.Sum(nil)))

	return storagePath, etag, nil
}

// Download retrieves a file
func (l *LocalStorage) Download(ctx context.Context, storagePath string) (io.ReadCloser, int64, error) {
	fullPath := filepath.Join(l.basePath, storagePath)

	file, err := os.Open(fullPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, 0, fmt.Errorf("file not found")
		}
		return nil, 0, fmt.Errorf("failed to open file: %w", err)
	}

	// Get file size
	stat, err := file.Stat()
	if err != nil {
		file.Close()
		return nil, 0, fmt.Errorf("failed to stat file: %w", err)
	}

	return file, stat.Size(), nil
}

// Delete removes a file
func (l *LocalStorage) Delete(ctx context.Context, storagePath string) error {
	fullPath := filepath.Join(l.basePath, storagePath)

	if err := os.Remove(fullPath); err != nil {
		if os.IsNotExist(err) {
			return nil // Already deleted
		}
		return fmt.Errorf("failed to delete file: %w", err)
	}

	return nil
}

// Exists checks if a file exists
func (l *LocalStorage) Exists(ctx context.Context, storagePath string) (bool, error) {
	fullPath := filepath.Join(l.basePath, storagePath)

	_, err := os.Stat(fullPath)
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, fmt.Errorf("failed to stat file: %w", err)
	}

	return true, nil
}

// GeneratePresignedURL creates an HMAC-signed URL for local file access
func (l *LocalStorage) GeneratePresignedURL(ctx context.Context, storagePath, operation string, expirySeconds int) (string, error) {
	if expirySeconds <= 0 {
		expirySeconds = 3600
	}

	expiry := time.Now().Add(time.Duration(expirySeconds) * time.Second).Unix()
	expiryStr := strconv.FormatInt(expiry, 10)

	// Create signature
	data := fmt.Sprintf("%s:%s:%s:%s", operation, storagePath, expiryStr, l.secret)
	h := hmac.New(sha256.New, []byte(l.secret))
	h.Write([]byte(data))
	signature := hex.EncodeToString(h.Sum(nil))

	// Build URL (path will be handled by the handler)
	url := fmt.Sprintf("/storage/v1/object/authenticated/local/%s?token=%s&expires=%s",
		storagePath, signature, expiryStr)

	return url, nil
}

// ValidateSignedToken validates an HMAC-signed token for local storage
func (l *LocalStorage) ValidateSignedToken(storagePath, token string, expiryUnix int64) bool {
	// Check expiry
	if time.Now().Unix() > expiryUnix {
		return false
	}

	// Recreate signature
	expiryStr := strconv.FormatInt(expiryUnix, 10)
	data := fmt.Sprintf("download:%s:%s:%s", storagePath, expiryStr, l.secret)

	h := hmac.New(sha256.New, []byte(l.secret))
	h.Write([]byte(data))
	expected := hex.EncodeToString(h.Sum(nil))

	return hmac.Equal([]byte(token), []byte(expected))
}

// GetFullPath returns the absolute path for a storage path
func (l *LocalStorage) GetFullPath(storagePath string) string {
	return filepath.Join(l.basePath, storagePath)
}

// CleanPath sanitizes a path to prevent directory traversal
func CleanPath(path string) string {
	// Remove any ".." to prevent directory traversal
	path = filepath.Clean("/" + path)
	return strings.TrimPrefix(path, "/")
}
