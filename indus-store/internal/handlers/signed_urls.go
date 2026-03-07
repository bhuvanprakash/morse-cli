package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/indusbase/indus-store/internal/models"
	"github.com/indusbase/indus-store/internal/repository"
	"github.com/indusbase/indus-store/internal/signing"
	"github.com/indusbase/indus-store/internal/storage"
)

// SignedURLHandler handles signed URL operations
type SignedURLHandler struct {
	objectRepo    *repository.ObjectRepository
	bucketRepo    *repository.BucketRepository
	storage       storage.Storage
	secret        string
	defaultExpiry int
}

// NewSignedURLHandler creates a new signed URL handler
func NewSignedURLHandler(objectRepo *repository.ObjectRepository, bucketRepo *repository.BucketRepository, storage storage.Storage, secret string, defaultExpiry int) *SignedURLHandler {
	return &SignedURLHandler{
		objectRepo:    objectRepo,
		bucketRepo:    bucketRepo,
		storage:       storage,
		secret:        secret,
		defaultExpiry: defaultExpiry,
	}
}

// CreateSignedDownloadURL creates a signed URL for downloading an object
func (h *SignedURLHandler) CreateSignedDownloadURL(c *gin.Context) {
	bucketName := c.Param("bucket")
	filePath := cleanFilePath(c.Param("filepath"))

	var req models.SignedURLRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get bucket
	bucket, err := h.bucketRepo.GetByName(c.Request.Context(), bucketName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get bucket"})
		return
	}
	if bucket == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "bucket not found"})
		return
	}

	// Get object
	obj, err := h.objectRepo.GetByBucketAndName(c.Request.Context(), bucket.ID, filePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get object"})
		return
	}
	if obj == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "object not found"})
		return
	}

	expiry := req.Expires
	if expiry <= 0 {
		expiry = h.defaultExpiry
	}

	// Generate signed URL
	path := fmt.Sprintf("%s/%s", bucketName, filePath)
	token, err := signing.GenerateDownloadURL(bucketName, filePath, expiry, h.secret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate signed URL"})
		return
	}

	// Build full URL
	scheme := "http"
	if c.Request.TLS != nil {
		scheme = "https"
	}
	fullURL := fmt.Sprintf("%s://%s%s", scheme, c.Request.Host, token)

	c.JSON(http.StatusOK, models.SignedURLResponse{
		URL:       fullURL,
		Path:      path,
		ExpiresIn: expiry,
		Token:     token,
	})
}

// CreateSignedUploadURL creates a signed URL/token for uploading an object
func (h *SignedURLHandler) CreateSignedUploadURL(c *gin.Context) {
	_, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	bucketName := c.Param("bucket")
	filePath := cleanFilePath(c.Param("filepath"))

	var req models.UploadTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get bucket
	bucket, err := h.bucketRepo.GetByName(c.Request.Context(), bucketName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get bucket"})
		return
	}
	if bucket == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "bucket not found"})
		return
	}

	// Validate file size if provided
	if req.Size > 0 && !bucket.ValidateFileSize(req.Size) {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "file too large for bucket"})
		return
	}

	expiry := h.defaultExpiry

	// Generate upload token
	token, url, err := signing.GenerateUploadToken(bucketName, filePath, expiry, req.Size, h.secret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate upload token"})
		return
	}

	// Build full URL
	scheme := "http"
	if c.Request.TLS != nil {
		scheme = "https"
	}
	fullURL := fmt.Sprintf("%s://%s%s", scheme, c.Request.Host, url)

	c.JSON(http.StatusOK, models.UploadTokenResponse{
		URL:       fullURL,
		Token:     token,
		ExpiresIn: expiry,
		Path:      filePath,
		Metadata:  req.Metadata,
	})
}

// ServeSignedDownload serves a file using a signed token
func (h *SignedURLHandler) ServeSignedDownload(c *gin.Context) {
	bucketName := c.Param("bucket")
	filePath := cleanFilePath(c.Param("filepath"))
	token := c.Query("token")
	expiresStr := c.Query("expires")

	if token == "" || expiresStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing token or expires"})
		return
	}

	expires, err := strconv.ParseInt(expiresStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid expires"})
		return
	}

	// Validate token
	path := fmt.Sprintf("%s/%s", bucketName, filePath)
	if !signing.ValidateSignedToken(path, token, expires, h.secret) {
		c.JSON(http.StatusForbidden, gin.H{"error": "invalid or expired token"})
		return
	}

	// Get bucket
	bucket, err := h.bucketRepo.GetByName(c.Request.Context(), bucketName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get bucket"})
		return
	}
	if bucket == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "bucket not found"})
		return
	}

	// Get object
	obj, err := h.objectRepo.GetByBucketAndName(c.Request.Context(), bucket.ID, filePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get object"})
		return
	}
	if obj == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "object not found"})
		return
	}

	// Serve file
	reader, size, err := h.storage.Download(c.Request.Context(), obj.StoragePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to download file"})
		return
	}
	defer reader.Close()

	c.Header("Content-Type", obj.MimeType)
	c.Header("Content-Length", fmt.Sprintf("%d", size))
	c.Header("ETag", obj.ETag)

	c.DataFromReader(http.StatusOK, size, obj.MimeType, reader, nil)
}
