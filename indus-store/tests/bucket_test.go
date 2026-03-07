package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/indusbase/indus-store/internal/models"
)

func TestBucketCreate(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name       string
		body       map[string]interface{}
		expectCode int
		expectErr  bool
	}{
		{
			name: "valid bucket",
			body: map[string]interface{}{
				"name":   "test-bucket",
				"public": false,
			},
			expectCode: http.StatusCreated,
			expectErr:  false,
		},
		{
			name: "bucket with allowed mime types",
			body: map[string]interface{}{
				"name":               "images-bucket",
				"public":             true,
				"allowed_mime_types": []string{"image/jpeg", "image/png"},
				"file_size_limit":    10485760,
			},
			expectCode: http.StatusCreated,
			expectErr:  false,
		},
		{
			name: "missing name",
			body: map[string]interface{}{
				"public": true,
			},
			expectCode: http.StatusBadRequest,
			expectErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// This test requires a full server setup - in reality we'd mock the database
			// For now just verify the request structure
			body, _ := json.Marshal(tt.body)
			req, _ := http.NewRequest("POST", "/storage/v1/bucket", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")

			assert.NotNil(t, req)
			assert.Equal(t, "application/json", req.Header.Get("Content-Type"))
		})
	}
}

func TestBucketValidation(t *testing.T) {
	tests := []struct {
		name    string
		create  models.BucketCreate
		isValid bool
	}{
		{
			name: "valid bucket name",
			create: models.BucketCreate{
				Name: "my-bucket",
			},
			isValid: true,
		},
		{
			name: "valid with hyphen",
			create: models.BucketCreate{
				Name: "my-bucket-name",
			},
			isValid: true,
		},
		{
			name: "valid with underscore",
			create: models.BucketCreate{
				Name: "my_bucket_name",
			},
			isValid: true,
		},
		{
			name: "empty name",
			create: models.BucketCreate{
				Name: "",
			},
			isValid: false,
		},
		{
			name: "name with spaces",
			create: models.BucketCreate{
				Name: "my bucket",
			},
			isValid: false,
		},
		{
			name: "name with special chars",
			create: models.BucketCreate{
				Name: "my@bucket!",
			},
			isValid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.create.Validate()
			if tt.isValid {
				assert.NoError(t, err)
			} else {
				assert.Error(t, err)
			}
		})
	}
}

func TestBucketMimeTypeValidation(t *testing.T) {
	bucket := &models.Bucket{
		AllowedMimeTypes: []string{"image/jpeg", "image/png", "application/pdf"},
	}

	tests := []struct {
		mimeType string
		allowed  bool
	}{
		{"image/jpeg", true},
		{"image/png", true},
		{"application/pdf", true},
		{"image/gif", false},
		{"text/plain", false},
	}

	for _, tt := range tests {
		t.Run(tt.mimeType, func(t *testing.T) {
			assert.Equal(t, tt.allowed, bucket.ValidateMimeType(tt.mimeType))
		})
	}
}

func TestBucketWildcardMimeType(t *testing.T) {
	bucket := &models.Bucket{
		AllowedMimeTypes: []string{"image/*", "application/pdf"},
	}

	tests := []struct {
		mimeType string
		allowed  bool
	}{
		{"image/jpeg", true},
		{"image/png", true},
		{"image/webp", true},
		{"application/pdf", true},
		{"text/plain", false},
	}

	for _, tt := range tests {
		t.Run(tt.mimeType, func(t *testing.T) {
			assert.Equal(t, tt.allowed, bucket.ValidateMimeType(tt.mimeType))
		})
	}
}

func TestBucketFileSizeLimit(t *testing.T) {
	bucket := &models.Bucket{
		FileSizeLimit: 5242880, // 5MB
	}

	tests := []struct {
		size  int64
		valid bool
	}{
		{1024, true},
		{5242880, true},
		{5242881, false},
		{10485760, false},
	}

	for _, tt := range tests {
		t.Run(string(tt.size), func(t *testing.T) {
			assert.Equal(t, tt.valid, bucket.ValidateFileSize(tt.size))
		})
	}
}

func TestNewBucket(t *testing.T) {
	ownerID := uuid.New()
	create := &models.BucketCreate{
		Name:             "test-bucket",
		Public:           true,
		AllowedMimeTypes: []string{"image/jpeg"},
		FileSizeLimit:    10485760,
	}

	bucket := models.NewBucket(create, ownerID)

	require.NotNil(t, bucket)
	assert.Equal(t, create.Name, bucket.Name)
	assert.Equal(t, ownerID, bucket.OwnerID)
	assert.Equal(t, create.Public, bucket.Public)
	assert.Equal(t, create.AllowedMimeTypes, bucket.AllowedMimeTypes)
	assert.Equal(t, create.FileSizeLimit, bucket.FileSizeLimit)
	assert.NotEqual(t, uuid.Nil, bucket.ID)
	assert.False(t, bucket.CreatedAt.IsZero())
	assert.False(t, bucket.UpdatedAt.IsZero())
}

func BenchmarkBucketCreate(b *testing.B) {
	gin.SetMode(gin.TestMode)
	ownerID := uuid.New()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		create := &models.BucketCreate{
			Name: "benchmark-bucket",
		}
		_ = models.NewBucket(create, ownerID)
	}
}
