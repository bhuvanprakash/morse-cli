package storage

import (
	"context"
	"fmt"
	"io"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

// S3Storage implements Storage interface for S3/MinIO backends
type S3Storage struct {
	client *s3.Client
	bucket string
}

// S3Config holds configuration for S3 storage
type S3Config struct {
	Endpoint  string
	Region    string
	AccessKey string
	SecretKey string
	Bucket    string
}

// NewS3Storage creates a new S3 storage instance
func NewS3Storage(cfg S3Config) (*S3Storage, error) {
	// Create custom resolver for MinIO or custom S3 endpoint
	staticResolver := aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...interface{}) (aws.Endpoint, error) {
		if cfg.Endpoint != "" {
			return aws.Endpoint{
				URL:               cfg.Endpoint,
				HostnameImmutable: true,
				Source:            aws.EndpointSourceCustom,
			}, nil
		}
		return aws.Endpoint{}, &aws.EndpointNotFoundError{}
	})

	// Load AWS configuration
	awsCfg, err := config.LoadDefaultConfig(context.Background(),
		config.WithRegion(cfg.Region),
		config.WithEndpointResolverWithOptions(staticResolver),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			cfg.AccessKey,
			cfg.SecretKey,
			"",
		)),
	)
	if err != nil {
		return nil, fmt.Errorf("unable to load AWS config: %w", err)
	}

	// Create S3 client
	client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.UsePathStyle = true // Required for MinIO
	})

	storage := &S3Storage{
		client: client,
		bucket: cfg.Bucket,
	}

	// Ensure bucket exists
	if err := storage.ensureBucket(context.Background()); err != nil {
		return nil, fmt.Errorf("failed to ensure bucket exists: %w", err)
	}

	return storage, nil
}

// ensureBucket creates the bucket if it doesn't exist
func (s *S3Storage) ensureBucket(ctx context.Context) error {
	_, err := s.client.HeadBucket(ctx, &s3.HeadBucketInput{
		Bucket: aws.String(s.bucket),
	})
	if err != nil {
		// Try to create bucket
		_, err = s.client.CreateBucket(ctx, &s3.CreateBucketInput{
			Bucket: aws.String(s.bucket),
			CreateBucketConfiguration: &types.CreateBucketConfiguration{
				LocationConstraint: types.BucketLocationConstraint("us-east-1"),
			},
		})
		if err != nil {
			return fmt.Errorf("failed to create bucket: %w", err)
		}
	}
	return nil
}

// Upload stores an object in S3
func (s *S3Storage) Upload(ctx context.Context, bucket, objectName string, data io.Reader, size int64, mimeType string) (string, string, error) {
	// Use bucket as prefix in the object key for multi-tenant isolation
	key := fmt.Sprintf("%s/%s", bucket, objectName)

	putInput := &s3.PutObjectInput{
		Bucket:        aws.String(s.bucket),
		Key:           aws.String(key),
		Body:          data,
		ContentLength: aws.Int64(size),
	}

	if mimeType != "" {
		putInput.ContentType = aws.String(mimeType)
	}

	result, err := s.client.PutObject(ctx, putInput)
	if err != nil {
		return "", "", fmt.Errorf("failed to upload to S3: %w", err)
	}

	etag := ""
	if result.ETag != nil {
		etag = *result.ETag
	}

	return key, etag, nil
}

// Download retrieves an object from S3
func (s *S3Storage) Download(ctx context.Context, storagePath string) (io.ReadCloser, int64, error) {
	result, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(storagePath),
	})
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get object from S3: %w", err)
	}

	size := int64(0)
	if result.ContentLength != nil {
		size = *result.ContentLength
	}

	return result.Body, size, nil
}

// Delete removes an object from S3
func (s *S3Storage) Delete(ctx context.Context, storagePath string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(storagePath),
	})
	if err != nil {
		return fmt.Errorf("failed to delete from S3: %w", err)
	}

	return nil
}

// Exists checks if an object exists in S3
func (s *S3Storage) Exists(ctx context.Context, storagePath string) (bool, error) {
	_, err := s.client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(storagePath),
	})
	if err != nil {
		// Check if it's a not found error
		var notFound *types.NotFound
		if fmt.Sprintf("%T", err) == "*types.NotFound" || notFound != nil {
			return false, nil
		}
		return false, fmt.Errorf("failed to head object: %w", err)
	}

	return true, nil
}

// GeneratePresignedURL creates a pre-signed URL for S3 access
func (s *S3Storage) GeneratePresignedURL(ctx context.Context, storagePath, operation string, expirySeconds int) (string, error) {
	if expirySeconds <= 0 {
		expirySeconds = 3600
	}

	presignClient := s3.NewPresignClient(s.client)
	expireDuration := time.Duration(expirySeconds) * time.Second

	var url string
	var err error

	switch operation {
	case "download", "get":
		req, presignErr := presignClient.PresignGetObject(ctx, &s3.GetObjectInput{
			Bucket: aws.String(s.bucket),
			Key:    aws.String(storagePath),
		}, s3.WithPresignExpires(expireDuration))
		if presignErr != nil {
			return "", fmt.Errorf("failed to presign get: %w", presignErr)
		}
		url = req.URL

	case "upload", "put":
		req, presignErr := presignClient.PresignPutObject(ctx, &s3.PutObjectInput{
			Bucket: aws.String(s.bucket),
			Key:    aws.String(storagePath),
		}, s3.WithPresignExpires(expireDuration))
		if presignErr != nil {
			return "", fmt.Errorf("failed to presign put: %w", presignErr)
		}
		url = req.URL

	default:
		return "", fmt.Errorf("unsupported operation: %s", operation)
	}

	if err != nil {
		return "", err
	}

	return url, nil
}
