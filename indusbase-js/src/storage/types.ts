/**
 * Storage bucket
 */
export interface Bucket {
    id: string;
    name: string;
    owner?: string;
    file_size_limit?: number;
    allowed_mime_types?: string[];
    created_at: string;
    updated_at: string;
    public: boolean;
}

/**
 * Storage object/file
 */
export interface StorageObject {
    name: string;
    bucket_id: string;
    owner?: string;
    id: string;
    updated_at: string;
    created_at: string;
    last_accessed_at: string;
    metadata?: Record<string, unknown>;
    buckets?: Bucket;
}

/**
 * Signed URL response
 */
export interface SignedUrlResponse {
    signedUrl: string;
    path: string;
    token: string;
}

/**
 * File options for upload
 */
export interface FileOptions {
    cacheControl?: string;
    contentType?: string;
    upsert?: boolean;
    duplex?: string;
}

/**
 * Upload response
 */
export interface UploadResponse {
    path: string;
    id: string;
    fullPath: string;
}

/**
 * List options for objects
 */
export interface ListOptions {
    limit?: number;
    offset?: number;
    sortBy?: {
        column: string;
        order: 'asc' | 'desc';
    };
    search?: string;
    prefix?: string;
}

/**
 * List bucket response
 */
export interface ListBucketResponse {
    name: string;
    id: string;
    created_at: string;
    updated_at: string;
    public: boolean;
}

/**
 * Move/Copy response
 */
export interface MoveResponse {
    message: string;
}

/**
 * Remove response
 */
export interface RemoveResponse {
    data: StorageObject[];
}

/**
 * Transform options for image manipulation
 */
export interface TransformOptions {
    width?: number;
    height?: number;
    resize?: 'cover' | 'contain' | 'fill';
    format?: 'auto' | 'avif' | 'webp';
    quality?: number;
}
