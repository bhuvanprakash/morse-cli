package tests

import (
	"bytes"
	"context"
	"io"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/indusbase/indus-store/internal/models"
	"github.com/indusbase/indus-store/internal/signing"
	"github.com/indusbase/indus-store/internal/storage"
)

func TestLocalStorageUpload(t *testing.T) {
	// Create temp directory for tests
	store, err := storage.NewLocalStorage(t.TempDir(), "test-secret")
	require.NoError(t, err)

	ctx := context.Background()
	content := []byte("Hello, World!")
	reader := bytes.NewReader(content)

	storagePath, etag, err := store.Upload(ctx, "test-bucket", "test.txt", reader, int64(len(content)), "text/plain")
	require.NoError(t, err)
	assert.NotEmpty(t, storagePath)
	assert.NotEmpty(t, etag)

	// Verify file exists
	exists, err := store.Exists(ctx, storagePath)
	require.NoError(t, err)
	assert.True(t, exists)

	// Download and verify
	downloadReader, size, err := store.Download(ctx, storagePath)
	require.NoError(t, err)
	defer downloadReader.Close()

	assert.Equal(t, int64(len(content)), size)

	downloaded, err := io.ReadAll(downloadReader)
	require.NoError(t, err)
	assert.Equal(t, content, downloaded)
}

func TestLocalStorageDelete(t *testing.T) {
	store, err := storage.NewLocalStorage(t.TempDir(), "test-secret")
	require.NoError(t, err)

	ctx := context.Background()
	content := []byte("Delete me")
	reader := bytes.NewReader(content)

	storagePath, _, err := store.Upload(ctx, "test-bucket", "delete.txt", reader, int64(len(content)), "text/plain")
	require.NoError(t, err)

	// Verify exists
	exists, err := store.Exists(ctx, storagePath)
	require.NoError(t, err)
	assert.True(t, exists)

	// Delete
	err = store.Delete(ctx, storagePath)
	require.NoError(t, err)

	// Verify deleted
	exists, err = store.Exists(ctx, storagePath)
	require.NoError(t, err)
	assert.False(t, exists)
}

func TestSigningTokenGeneration(t *testing.T) {
	secret := "test-secret-key"
	path := "bucket/file.txt"
	expiry := int64(1234567890)

	token := signing.GenerateSignedToken(path, expiry, secret)
	assert.NotEmpty(t, token)

	// Validate token
	valid := signing.ValidateSignedToken(path, token, expiry, secret)
	assert.True(t, valid)

	// Invalid path
	valid = signing.ValidateSignedToken("wrong-path", token, expiry, secret)
	assert.False(t, valid)

	// Expired
	valid = signing.ValidateSignedToken(path, token, 1000, secret)
	assert.False(t, valid)

	// Wrong secret
	valid = signing.ValidateSignedToken(path, token, expiry, "wrong-secret")
	assert.False(t, valid)
}

func TestUploadTokenGeneration(t *testing.T) {
	secret := "test-secret-key"
	bucket := "my-bucket"
	filename := "upload.txt"
	expirySeconds := 3600
	maxSize := int64(1048576)

	token, url, err := signing.GenerateUploadToken(bucket, filename, expirySeconds, maxSize, secret)
	require.NoError(t, err)
	assert.NotEmpty(t, token)
	assert.NotEmpty(t, url)
	assert.Contains(t, url, bucket)
	assert.Contains(t, url, filename)
}

func TestObjectMetadata(t *testing.T) {
	meta := models.ObjectMetadata{
		"key1": "value1",
		"key2": "value2",
	}

	assert.Equal(t, "value1", meta["key1"])
	assert.Equal(t, "value2", meta["key2"])

	// Test nil metadata
	var nilMeta models.ObjectMetadata
	assert.Nil(t, nilMeta)
}

func TestCleanFilePath(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"/path/to/file.txt", "path/to/file.txt"},
		{"path/to/file.txt", "path/to/file.txt"},
		{"/../etc/passwd", "etc/passwd"},
		{"/path/../other/file.txt", "path/other/file.txt"},
		{"///multiple///slashes", "multiple/slashes"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := storage.CleanPath(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestMimeTypeDetection(t *testing.T) {
	tests := []struct {
		filename string
		expected string
	}{
		{"image.jpg", "image/jpeg"},
		{"image.jpeg", "image/jpeg"},
		{"image.png", "image/png"},
		{"image.gif", "image/gif"},
		{"document.pdf", "application/pdf"},
		{"file.txt", "text/plain"},
		{"index.html", "text/html"},
		{"style.css", "text/css"},
		{"script.js", "application/javascript"},
		{"data.json", "application/json"},
		{"unknown.xyz", "application/octet-stream"},
	}

	for _, tt := range tests {
		t.Run(tt.filename, func(t *testing.T) {
			result := detectMimeType(tt.filename)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func detectMimeType(filename string) string {
	ext := strings.ToLower(filename)
	ext = ext[strings.LastIndex(ext, "."):]

	switch ext {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".gif":
		return "image/gif"
	case ".pdf":
		return "application/pdf"
	case ".txt":
		return "text/plain"
	case ".html", ".htm":
		return "text/html"
	case ".css":
		return "text/css"
	case ".js":
		return "application/javascript"
	case ".json":
		return "application/json"
	default:
		return "application/octet-stream"
	}
}

func BenchmarkLocalStorageUpload(b *testing.B) {
	store, _ := storage.NewLocalStorage(b.TempDir(), "test-secret")
	ctx := context.Background()
	content := []byte("Benchmark content for testing upload performance")

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		reader := bytes.NewReader(content)
		_, _, _ = store.Upload(ctx, "bench-bucket", "file.txt", reader, int64(len(content)), "text/plain")
	}
}

func BenchmarkSigningToken(b *testing.B) {
	secret := "test-secret"
	path := "bucket/file.txt"
	expiry := int64(1234567890)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = signing.GenerateSignedToken(path, expiry, secret)
	}
}
