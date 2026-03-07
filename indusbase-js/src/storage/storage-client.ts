import { FetchClient } from '../lib/fetch.js';
import { BucketClient } from './bucket-client.js';
import { Bucket } from './types.js';

export interface CreateBucketOptions {
    public?: boolean;
    fileSizeLimit?: number;
    allowedMimeTypes?: string[];
}

export class StorageClient {
    private fetchClient: FetchClient;
    private buckets: Map<string, BucketClient> = new Map();

    constructor(fetchClient: FetchClient) {
        this.fetchClient = fetchClient;
    }

    /**
     * Get a bucket client
     */
    from(bucketName: string): BucketClient {
        if (this.buckets.has(bucketName)) {
            return this.buckets.get(bucketName)!;
        }

        const bucket = new BucketClient(this.fetchClient, bucketName);
        this.buckets.set(bucketName, bucket);
        return bucket;
    }

    /**
     * Create a new bucket
     */
    async createBucket(name: string, options: CreateBucketOptions = {}): Promise<{ data: Bucket | null; error: null }> {
        const { data } = await this.fetchClient.request<Bucket>('/storage/v1/bucket', {
            method: 'POST',
            body: JSON.stringify({
                name,
                public: options.public ?? false,
                file_size_limit: options.fileSizeLimit,
                allowed_mime_types: options.allowedMimeTypes,
            }),
        });

        return { data, error: null };
    }

    /**
     * Get a bucket by ID
     */
    async getBucket(id: string): Promise<{ data: Bucket; error: null }> {
        const { data } = await this.fetchClient.request<Bucket>(`/storage/v1/bucket/${id}`);
        return { data, error: null };
    }

    /**
     * List all buckets
     */
    async listBuckets(): Promise<{ data: Bucket[]; error: null }> {
        const { data } = await this.fetchClient.request<Bucket[]>('/storage/v1/bucket');
        return { data, error: null };
    }

    /**
     * Delete a bucket
     */
    async deleteBucket(id: string): Promise<{ data: { message: string }; error: null }> {
        const { data } = await this.fetchClient.request<{ message: string }>(`/storage/v1/bucket/${id}`, {
            method: 'DELETE',
        });

        // Remove from cache if exists
        this.buckets.delete(id);

        return { data, error: null };
    }

    /**
     * Update a bucket
     */
    async updateBucket(
        id: string,
        options: Partial<CreateBucketOptions>
    ): Promise<{ data: { message: string }; error: null }> {
        const { data } = await this.fetchClient.request<{ message: string }>(`/storage/v1/bucket/${id}`, {
            method: 'PUT',
            body: JSON.stringify({
                public: options.public,
                file_size_limit: options.fileSizeLimit,
                allowed_mime_types: options.allowedMimeTypes,
            }),
        });

        return { data, error: null };
    }

    /**
     * Empty a bucket (remove all objects)
     */
    async emptyBucket(id: string): Promise<{ data: { message: string }; error: null }> {
        const { data } = await this.fetchClient.request<{ message: string }>(`/storage/v1/bucket/${id}/empty`, {
            method: 'POST',
        });

        return { data, error: null };
    }
}
