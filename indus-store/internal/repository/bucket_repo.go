package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/google/uuid"
	"github.com/indusbase/indus-store/internal/models"
)

// BucketRepository handles database operations for buckets
type BucketRepository struct {
	db *sql.DB
}

// NewBucketRepository creates a new bucket repository
func NewBucketRepository(db *sql.DB) *BucketRepository {
	return &BucketRepository{db: db}
}

// Create inserts a new bucket
func (r *BucketRepository) Create(ctx context.Context, bucket *models.Bucket) error {
	query := `
		INSERT INTO indusbase_storage.buckets (id, name, owner_id, public, allowed_mime_types, file_size_limit, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`

	_, err := r.db.ExecContext(ctx, query,
		bucket.ID,
		bucket.Name,
		bucket.OwnerID,
		bucket.Public,
		pqArray(bucket.AllowedMimeTypes),
		bucket.FileSizeLimit,
		bucket.CreatedAt,
		bucket.UpdatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to create bucket: %w", err)
	}

	return nil
}

// GetByID retrieves a bucket by ID
func (r *BucketRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Bucket, error) {
	query := `
		SELECT id, name, owner_id, public, allowed_mime_types, file_size_limit, created_at, updated_at
		FROM indusbase_storage.buckets
		WHERE id = $1
	`

	bucket := &models.Bucket{}
	var mimeTypes []string

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&bucket.ID,
		&bucket.Name,
		&bucket.OwnerID,
		&bucket.Public,
		pqArray(&mimeTypes),
		&bucket.FileSizeLimit,
		&bucket.CreatedAt,
		&bucket.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get bucket: %w", err)
	}

	bucket.AllowedMimeTypes = mimeTypes
	return bucket, nil
}

// GetByName retrieves a bucket by name
func (r *BucketRepository) GetByName(ctx context.Context, name string) (*models.Bucket, error) {
	query := `
		SELECT id, name, owner_id, public, allowed_mime_types, file_size_limit, created_at, updated_at
		FROM indusbase_storage.buckets
		WHERE name = $1
	`

	bucket := &models.Bucket{}
	var mimeTypes []string

	err := r.db.QueryRowContext(ctx, query, name).Scan(
		&bucket.ID,
		&bucket.Name,
		&bucket.OwnerID,
		&bucket.Public,
		pqArray(&mimeTypes),
		&bucket.FileSizeLimit,
		&bucket.CreatedAt,
		&bucket.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get bucket: %w", err)
	}

	bucket.AllowedMimeTypes = mimeTypes
	return bucket, nil
}

// List retrieves buckets for an owner
func (r *BucketRepository) List(ctx context.Context, ownerID uuid.UUID, limit, offset int) ([]models.Bucket, error) {
	query := `
		SELECT id, name, owner_id, public, allowed_mime_types, file_size_limit, created_at, updated_at
		FROM indusbase_storage.buckets
		WHERE owner_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	if limit <= 0 {
		limit = 100
	}

	rows, err := r.db.QueryContext(ctx, query, ownerID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to list buckets: %w", err)
	}
	defer rows.Close()

	var buckets []models.Bucket
	for rows.Next() {
		var bucket models.Bucket
		var mimeTypes []string

		err := rows.Scan(
			&bucket.ID,
			&bucket.Name,
			&bucket.OwnerID,
			&bucket.Public,
			pqArray(&mimeTypes),
			&bucket.FileSizeLimit,
			&bucket.CreatedAt,
			&bucket.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan bucket: %w", err)
		}

		bucket.AllowedMimeTypes = mimeTypes
		buckets = append(buckets, bucket)
	}

	return buckets, rows.Err()
}

// Update updates a bucket
func (r *BucketRepository) Update(ctx context.Context, bucket *models.Bucket) error {
	query := `
		UPDATE indusbase_storage.buckets
		SET public = $1, allowed_mime_types = $2, file_size_limit = $3, updated_at = $4
		WHERE id = $5
	`

	_, err := r.db.ExecContext(ctx, query,
		bucket.Public,
		pqArray(bucket.AllowedMimeTypes),
		bucket.FileSizeLimit,
		bucket.UpdatedAt,
		bucket.ID,
	)

	if err != nil {
		return fmt.Errorf("failed to update bucket: %w", err)
	}

	return nil
}

// Delete deletes a bucket
func (r *BucketRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM indusbase_storage.buckets WHERE id = $1`

	_, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete bucket: %w", err)
	}

	return nil
}

// CountObjects counts objects in a bucket
func (r *BucketRepository) CountObjects(ctx context.Context, bucketID uuid.UUID) (int, error) {
	query := `SELECT COUNT(*) FROM indusbase_storage.objects WHERE bucket_id = $1`

	var count int
	err := r.db.QueryRowContext(ctx, query, bucketID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count objects: %w", err)
	}

	return count, nil
}

// pqArray converts a string slice to a PostgreSQL array
func pqArray(a interface{}) interface{} {
	return a
}
