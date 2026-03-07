package handlers

import (
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/indusbase/indus-store/internal/models"
	"github.com/indusbase/indus-store/internal/repository"
	"github.com/indusbase/indus-store/internal/storage"
)

// ObjectHandler handles object-related HTTP requests
type ObjectHandler struct {
	objectRepo *repository.ObjectRepository
	bucketRepo *repository.BucketRepository
	storage    storage.Storage
	backend    string
}

// NewObjectHandler creates a new object handler
func NewObjectHandler(objectRepo *repository.ObjectRepository, bucketRepo *repository.BucketRepository, storage storage.Storage, backend string) *ObjectHandler {
	return &ObjectHandler{
		objectRepo: objectRepo,
		bucketRepo: bucketRepo,
		storage:    storage,
		backend:    backend,
	}
}

// UploadObject handles file uploads
func (h *ObjectHandler) UploadObject(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	ownerID := userID.(uuid.UUID)

	bucketName := c.Param("bucket")
	filePath := c.Param("filepath")

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

	// Parse multipart form
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no file provided"})
		return
	}
	defer file.Close()

	// Validate file size
	if !bucket.ValidateFileSize(header.Size) {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "file too large"})
		return
	}

	// Detect mime type
	mimeType := header.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = detectMimeType(header.Filename)
	}

	// Validate mime type
	if !bucket.ValidateMimeType(mimeType) {
		c.JSON(http.StatusUnsupportedMediaType, gin.H{"error": "mime type not allowed"})
		return
	}

	// Clean filepath
	filePath = cleanFilePath(filePath)
	if filePath == "" {
		filePath = header.Filename
	}

	// Check if object already exists
	existing, err := h.objectRepo.GetByBucketAndName(c.Request.Context(), bucket.ID, filePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check existing object"})
		return
	}

	// Upload to storage
	storagePath, etag, err := h.storage.Upload(c.Request.Context(), bucketName, filePath, file, header.Size, mimeType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to upload file"})
		return
	}

	// Get metadata from form
	metadata := models.ObjectMetadata{}
	if metaStr := c.PostForm("metadata"); metaStr != "" {
		// Simple key=value parsing
		for _, pair := range strings.Split(metaStr, ",") {
			parts := strings.SplitN(pair, "=", 2)
			if len(parts) == 2 {
				metadata[parts[0]] = parts[1]
			}
		}
	}

	if existing != nil {
		// Delete old file
		h.storage.Delete(c.Request.Context(), existing.StoragePath)

		// Update existing object
		existing.Size = header.Size
		existing.MimeType = mimeType
		existing.ETag = etag
		existing.StoragePath = storagePath
		existing.Metadata = metadata

		if err := h.objectRepo.Update(c.Request.Context(), existing); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update object"})
			return
		}

		c.JSON(http.StatusOK, existing.ToResponse())
		return
	}

	// Create new object
	obj := models.NewObject(bucket.ID, filePath, ownerID, header.Size, mimeType, etag, h.backend, storagePath, metadata)

	if err := h.objectRepo.Create(c.Request.Context(), obj); err != nil {
		// Clean up storage
		h.storage.Delete(c.Request.Context(), storagePath)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save object metadata"})
		return
	}

	c.JSON(http.StatusCreated, obj.ToResponse())
}

// DownloadObject handles authenticated downloads
func (h *ObjectHandler) DownloadObject(c *gin.Context) {
	bucketName := c.Param("bucket")
	filePath := cleanFilePath(c.Param("filepath"))

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

	// Stream file
	reader, size, err := h.storage.Download(c.Request.Context(), obj.StoragePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to download file"})
		return
	}
	defer reader.Close()

	c.Header("Content-Type", obj.MimeType)
	c.Header("Content-Length", fmt.Sprintf("%d", size))
	c.Header("ETag", obj.ETag)
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filepath.Base(obj.Name)))

	io.Copy(c.Writer, reader)
}

// DownloadPublicObject handles public downloads
func (h *ObjectHandler) DownloadPublicObject(c *gin.Context) {
	bucketName := c.Param("bucket")
	filePath := cleanFilePath(c.Param("filepath"))

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

	// Check if bucket is public
	if !bucket.Public {
		c.JSON(http.StatusForbidden, gin.H{"error": "bucket is not public"})
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

	// Stream file
	reader, size, err := h.storage.Download(c.Request.Context(), obj.StoragePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to download file"})
		return
	}
	defer reader.Close()

	c.Header("Content-Type", obj.MimeType)
	c.Header("Content-Length", fmt.Sprintf("%d", size))
	c.Header("ETag", obj.ETag)

	io.Copy(c.Writer, reader)
}

// DeleteObject deletes an object
func (h *ObjectHandler) DeleteObject(c *gin.Context) {
	bucketName := c.Param("bucket")
	filePath := cleanFilePath(c.Param("filepath"))

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

	// Delete from storage
	if err := h.storage.Delete(c.Request.Context(), obj.StoragePath); err != nil {
		// Log error but continue to delete metadata
		fmt.Printf("Failed to delete from storage: %v\n", err)
	}

	// Delete from database
	if err := h.objectRepo.Delete(c.Request.Context(), obj.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete object"})
		return
	}
	emitAudit(c, map[string]interface{}{
		"action":        "delete_object",
		"resource_type": "storage_object",
		"resource_id":   obj.ID.String(),
		"severity":      "warn",
		"metadata": map[string]interface{}{
			"bucket": bucketName,
			"path":   filePath,
			"size":   obj.Size,
		},
	})

	c.JSON(http.StatusNoContent, nil)
}

// ListObjects lists objects in a bucket
func (h *ObjectHandler) ListObjects(c *gin.Context) {
	bucketName := c.Param("bucket")

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

	prefix := c.DefaultQuery("prefix", "")
	limit := 100
	offset := 0

	objects, err := h.objectRepo.List(c.Request.Context(), bucket.ID, prefix, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list objects"})
		return
	}

	count, err := h.objectRepo.Count(c.Request.Context(), bucket.ID, prefix)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to count objects"})
		return
	}

	response := make([]models.ObjectResponse, len(objects))
	for i, obj := range objects {
		response[i] = obj.ToResponseWithBucket(bucket.Name)
	}

	c.JSON(http.StatusOK, models.ObjectListResponse{
		Objects:    response,
		TotalCount: count,
		Limit:      limit,
		Offset:     offset,
	})
}

// cleanFilePath sanitizes a file path
func cleanFilePath(path string) string {
	path = strings.Trim(path, "/")
	path = strings.ReplaceAll(path, "..", "")
	return path
}

// detectMimeType detects mime type from filename
func detectMimeType(filename string) string {
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".gif":
		return "image/gif"
	case ".webp":
		return "image/webp"
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
	case ".xml":
		return "application/xml"
	case ".mp4":
		return "video/mp4"
	case ".webm":
		return "video/webm"
	case ".mp3":
		return "audio/mpeg"
	case ".wav":
		return "audio/wav"
	default:
		return "application/octet-stream"
	}
}

// maxFileSize returns the maximum file size from a multipart header
func maxFileSize(header *multipart.FileHeader) int64 {
	return header.Size
}
