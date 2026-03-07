package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/indusbase/indus-store/internal/models"
	"github.com/indusbase/indus-store/internal/repository"
)

// BucketHandler handles bucket-related HTTP requests
type BucketHandler struct {
	bucketRepo *repository.BucketRepository
}

// NewBucketHandler creates a new bucket handler
func NewBucketHandler(bucketRepo *repository.BucketRepository) *BucketHandler {
	return &BucketHandler{bucketRepo: bucketRepo}
}

// CreateBucket creates a new bucket
func (h *BucketHandler) CreateBucket(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	ownerID := userID.(uuid.UUID)

	var req models.BucketCreate
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := req.Validate(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if bucket name already exists
	existing, err := h.bucketRepo.GetByName(c.Request.Context(), req.Name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check bucket"})
		return
	}
	if existing != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "bucket name already exists"})
		return
	}

	bucket := models.NewBucket(&req, ownerID)

	if err := h.bucketRepo.Create(c.Request.Context(), bucket); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create bucket"})
		return
	}

	c.JSON(http.StatusCreated, bucket.ToResponse())
}

// ListBuckets lists all buckets for the authenticated user
func (h *BucketHandler) ListBuckets(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	ownerID := userID.(uuid.UUID)

	limit := 100
	offset := 0

	buckets, err := h.bucketRepo.List(c.Request.Context(), ownerID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list buckets"})
		return
	}

	response := make([]models.BucketResponse, len(buckets))
	for i, b := range buckets {
		response[i] = b.ToResponse()
	}

	c.JSON(http.StatusOK, gin.H{
		"buckets":     response,
		"total_count": len(response),
	})
}

// GetBucket retrieves a bucket by ID
func (h *BucketHandler) GetBucket(c *gin.Context) {
	bucketID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid bucket id"})
		return
	}

	bucket, err := h.bucketRepo.GetByID(c.Request.Context(), bucketID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get bucket"})
		return
	}
	if bucket == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "bucket not found"})
		return
	}

	c.JSON(http.StatusOK, bucket.ToResponse())
}

// UpdateBucket updates a bucket
func (h *BucketHandler) UpdateBucket(c *gin.Context) {
	bucketID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid bucket id"})
		return
	}

	bucket, err := h.bucketRepo.GetByID(c.Request.Context(), bucketID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get bucket"})
		return
	}
	if bucket == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "bucket not found"})
		return
	}

	var req models.BucketUpdate
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Apply updates
	if req.Public != nil {
		bucket.Public = *req.Public
	}
	if req.AllowedMimeTypes != nil {
		bucket.AllowedMimeTypes = req.AllowedMimeTypes
	}
	if req.FileSizeLimit != nil {
		bucket.FileSizeLimit = *req.FileSizeLimit
	}

	if err := h.bucketRepo.Update(c.Request.Context(), bucket); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update bucket"})
		return
	}

	c.JSON(http.StatusOK, bucket.ToResponse())
}

// DeleteBucket deletes a bucket
func (h *BucketHandler) DeleteBucket(c *gin.Context) {
	bucketID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid bucket id"})
		return
	}

	bucket, err := h.bucketRepo.GetByID(c.Request.Context(), bucketID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get bucket"})
		return
	}
	if bucket == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "bucket not found"})
		return
	}

	// Check if bucket has objects
	count, err := h.bucketRepo.CountObjects(c.Request.Context(), bucketID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check bucket contents"})
		return
	}
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "bucket is not empty"})
		return
	}

	if err := h.bucketRepo.Delete(c.Request.Context(), bucketID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete bucket"})
		return
	}
	emitAudit(c, map[string]interface{}{
		"action":        "delete_bucket",
		"resource_type": "storage_bucket",
		"resource_id":   bucket.ID.String(),
		"severity":      "warn",
		"metadata": map[string]interface{}{
			"name": bucket.Name,
		},
	})

	c.JSON(http.StatusNoContent, nil)
}

// GetBucketByName retrieves a bucket by name
func (h *BucketHandler) GetBucketByName(c *gin.Context) {
	name := c.Param("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bucket name required"})
		return
	}

	bucket, err := h.bucketRepo.GetByName(c.Request.Context(), name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get bucket"})
		return
	}
	if bucket == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "bucket not found"})
		return
	}

	c.JSON(http.StatusOK, bucket.ToResponse())
}
