package repository

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/google/uuid"
	"github.com/indusbase/indus-store/internal/models"
)

// ObjectRepository handles database operations for objects
type ObjectRepository struct {
	db *sql.DB
}

// NewObjectRepository creates a new object repository
func NewObjectRepository(db *sql.DB) *ObjectRepository {
	return &ObjectRepository{db: db}
}

// Create inserts a new object
func (r *ObjectRepository) Create(ctx context.Context, obj *models.Object) error {
	query := `
		INSERT INTO indusbase_storage.objects (
			id, bucket_id, name, owner_id, size, mime_type, etag, 
			storage_backend, storage_path, metadata, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`

	_, err := r.db.ExecContext(ctx, query,
		obj.ID,
		obj.BucketID,
		obj.Name,
		obj.OwnerID,
		obj.Size,
		obj.MimeType,
		obj.ETag,
		obj.StorageBackend,
		obj.StoragePath,
		obj.Metadata,
		obj.CreatedAt,
		obj.UpdatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to create object: %w", err)
	}

	return nil
}

// GetByID retrieves an object by ID
func (r *ObjectRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Object, error) {
	query := `
		SELECT id, bucket_id, name, owner_id, size, mime_type, etag, 
			storage_backend, storage_path, metadata, created_at, updated_at
		FROM indusbase_storage.objects
		WHERE id = $1
	`

	obj := &models.Object{}
	var metadata models.ObjectMetadata

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&obj.ID,
		&obj.BucketID,
		&obj.Name,
		&obj.OwnerID,
		&obj.Size,
		&obj.MimeType,
		&obj.ETag,
		&obj.StorageBackend,
		&obj.StoragePath,
		&metadata,
		&obj.CreatedAt,
		&obj.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get object: %w", err)
	}

	obj.Metadata = metadata
	return obj, nil
}

// GetByBucketAndName retrieves an object by bucket ID and name
func (r *ObjectRepository) GetByBucketAndName(ctx context.Context, bucketID uuid.UUID, name string) (*models.Object, error) {
	query := `
		SELECT id, bucket_id, name, owner_id, size, mime_type, etag, 
			storage_backend, storage_path, metadata, created_at, updated_at
		FROM indusbase_storage.objects
		WHERE bucket_id = $1 AND name = $2
	`

	obj := &models.Object{}
	var metadata models.ObjectMetadata

	err := r.db.QueryRowContext(ctx, query, bucketID, name).Scan(
		&obj.ID,
		&obj.BucketID,
		&obj.Name,
		&obj.OwnerID,
		&obj.Size,
		&obj.MimeType,
		&obj.ETag,
		&obj.StorageBackend,
		&obj.StoragePath,
		&metadata,
		&obj.CreatedAt,
		&obj.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get object: %w", err)
	}

	obj.Metadata = metadata
	return obj, nil
}

// List retrieves objects in a bucket
func (r *ObjectRepository) List(ctx context.Context, bucketID uuid.UUID, prefix string, limit, offset int) ([]models.Object, error) {
	query := `
		SELECT id, bucket_id, name, owner_id, size, mime_type, etag, 
			storage_backend, storage_path, metadata, created_at, updated_at
		FROM indusbase_storage.objects
		WHERE bucket_id = $1 AND name LIKE $2
		ORDER BY created_at DESC
		LIMIT $3 OFFSET $4
	`

	if limit <= 0 {
		limit = 100
	}

	pattern := prefix + "%"

	rows, err := r.db.QueryContext(ctx, query, bucketID, pattern, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to list objects: %w", err)
	}
	defer rows.Close()

	var objects []models.Object
	for rows.Next() {
		var obj models.Object
		var metadata models.ObjectMetadata

		err := rows.Scan(
			&obj.ID,
			&obj.BucketID,
			&obj.Name,
			&obj.OwnerID,
			&obj.Size,
			&obj.MimeType,
			&obj.ETag,
			&obj.StorageBackend,
			&obj.StoragePath,
			&metadata,
			&obj.CreatedAt,
			&obj.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan object: %w", err)
		}

		obj.Metadata = metadata
		objects = append(objects, obj)
	}

	return objects, rows.Err()
}

// Count counts objects in a bucket with optional prefix
func (r *ObjectRepository) Count(ctx context.Context, bucketID uuid.UUID, prefix string) (int, error) {
	query := `
		SELECT COUNT(*) FROM indusbase_storage.objects
		WHERE bucket_id = $1 AND name LIKE $2
	`

	pattern := prefix + "%"

	var count int
	err := r.db.QueryRowContext(ctx, query, bucketID, pattern).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count objects: %w", err)
	}

	return count, nil
}

// Update updates an object
func (r *ObjectRepository) Update(ctx context.Context, obj *models.Object) error {
	query := `
		UPDATE indusbase_storage.objects
		SET metadata = $1, updated_at = $2
		WHERE id = $3
	`

	_, err := r.db.ExecContext(ctx, query,
		obj.Metadata,
		obj.UpdatedAt,
		obj.ID,
	)

	if err != nil {
		return fmt.Errorf("failed to update object: %w", err)
	}

	return nil
}

// Delete deletes an object
func (r *ObjectRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM indusbase_storage.objects WHERE id = $1`

	_, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete object: %w", err)
	}

	return nil
}

// DeleteByBucketAndName deletes an object by bucket and name
func (r *ObjectRepository) DeleteByBucketAndName(ctx context.Context, bucketID uuid.UUID, name string) error {
	query := `DELETE FROM indusbase_storage.objects WHERE bucket_id = $1 AND name = $2`

	_, err := r.db.ExecContext(ctx, query, bucketID, name)
	if err != nil {
		return fmt.Errorf("failed to delete object: %w", err)
	}

	return nil
}

// GetStoragePathsByBucket retrieves all storage paths for a bucket
func (r *ObjectRepository) GetStoragePathsByBucket(ctx context.Context, bucketID uuid.UUID) ([]string, error) {
	query := `SELECT storage_path FROM indusbase_storage.objects WHERE bucket_id = $1`

	rows, err := r.db.QueryContext(ctx, query, bucketID)
	if err != nil {
		return nil, fmt.Errorf("failed to get storage paths: %w", err)
	}
	defer rows.Close()

	var paths []string
	for rows.Next() {
		var path string
		if err := rows.Scan(&path); err != nil {
			return nil, fmt.Errorf("failed to scan path: %w", err)
		}
		paths = append(paths, path)
	}

	return paths, rows.Err()
}
