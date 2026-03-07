import { FetchClient } from '../lib/fetch.js';
import { StorageError } from '../lib/errors.js';
import {
    FileOptions,
    ListOptions,
    RemoveResponse,
    SignedUrlResponse,
    StorageObject,
    TransformOptions,
    UploadResponse,
} from './types.js';

export class BucketClient {
    private fetchClient: FetchClient;
    private bucketName: string;

    constructor(fetchClient: FetchClient, bucketName: string) {
        this.fetchClient = fetchClient;
        this.bucketName = bucketName;
    }

    /**
     * Upload a file
     */
    async upload(
        path: string,
        file: File | Blob | ArrayBuffer | FormData | string,
        options?: FileOptions
    ): Promise<{ data: UploadResponse; error: null }> {
        // Ensure path doesn't start with /
        const cleanPath = path.replace(/^\//, '');
        const url = `/storage/v1/object/${this.bucketName}/${cleanPath}`;

        const headers: Record<string, string> = {};

        if (options?.cacheControl) {
            headers['Cache-Control'] = options.cacheControl;
        }
        if (options?.contentType) {
            headers['Content-Type'] = options.contentType;
        }
        if (options?.upsert) {
            headers['x-upsert'] = 'true';
        }

        let body: BodyInit;
        if (typeof file === 'string') {
            body = file;
        } else if (file instanceof FormData) {
            body = file;
        } else if (file instanceof Blob || file instanceof File) {
            body = file;
        } else {
            body = new Blob([file]);
        }

        const { data } = await this.fetchClient.request<UploadResponse>(url, {
            method: 'POST',
            headers,
            body,
        });

        return { data, error: null };
    }

    /**
     * Download a file
     */
    async download(path: string): Promise<{ data: Blob; error: null }> {
        const cleanPath = path.replace(/^\//, '');
        const url = `/storage/v1/object/${this.bucketName}/${cleanPath}`;

        const baseUrl = this.fetchClient.getBaseUrl();
        const response = await fetch(`${baseUrl}${url}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${this.fetchClient.getAccessToken() ?? this.fetchClient.getAnonKey()}`,
                apikey: this.fetchClient.getAnonKey(),
            },
        });

        if (!response.ok) {
            throw new StorageError(
                'Failed to download file',
                'DOWNLOAD_ERROR',
                response.status,
                {},
                path,
                this.bucketName
            );
        }

        const blob = await response.blob();
        return { data: blob, error: null };
    }

    /**
     * Get public URL for a file
     */
    getPublicUrl(path: string, options?: { download?: boolean; transform?: TransformOptions }): {
        data: { publicUrl: string };
    } {
        const cleanPath = path.replace(/^\//, '');
        let url = `${this.fetchClient.getBaseUrl()}/storage/v1/object/public/${this.bucketName}/${cleanPath}`;

        if (options?.download) {
            url += '?download=1';
        }

        if (options?.transform) {
            const params = new URLSearchParams();
            if (options.transform.width) params.set('width', String(options.transform.width));
            if (options.transform.height) params.set('height', String(options.transform.height));
            if (options.transform.resize) params.set('resize', options.transform.resize);
            if (options.transform.format) params.set('format', options.transform.format);
            if (options.transform.quality) params.set('quality', String(options.transform.quality));

            const sep = url.includes('?') ? '&' : '?';
            url += sep + params.toString();
        }

        return { data: { publicUrl: url } };
    }

    /**
     * Create a signed URL for temporary access
     */
    async createSignedUrl(path: string, expiresIn: number): Promise<{ data: SignedUrlResponse; error: null }> {
        const cleanPath = path.replace(/^\//, '');
        const { data } = await this.fetchClient.request<SignedUrlResponse>(
            `/storage/v1/object/sign/${this.bucketName}/${cleanPath}`,
            {
                method: 'POST',
                body: JSON.stringify({ expiresIn }),
            }
        );

        return { data, error: null };
    }

    /**
     * Create signed URLs for multiple files
     */
    async createSignedUrls(paths: string[], expiresIn: number): Promise<{ data: SignedUrlResponse[]; error: null }> {
        const { data } = await this.fetchClient.request<SignedUrlResponse[]>(
            '/storage/v1/object/sign/' + this.bucketName,
            {
                method: 'POST',
                body: JSON.stringify({ paths, expiresIn }),
            }
        );

        return { data, error: null };
    }

    /**
     * Remove files
     */
    async remove(paths: string[]): Promise<{ data: RemoveResponse; error: null }> {
        const { data } = await this.fetchClient.request<RemoveResponse>(
            '/storage/v1/object/' + this.bucketName,
            {
                method: 'DELETE',
                body: JSON.stringify({ prefixes: paths }),
            }
        );

        return { data, error: null };
    }

    /**
     * List objects in the bucket
     */
    async list(prefix?: string, options: ListOptions = {}): Promise<{ data: StorageObject[]; error: null }> {
        const body: Record<string, unknown> = {
            prefix: prefix ?? '',
            limit: options.limit ?? 100,
            offset: options.offset ?? 0,
            search: options.search,
        };

        if (options.sortBy) {
            body.sortBy = options.sortBy;
        }

        const { data } = await this.fetchClient.request<StorageObject[]>(
            '/storage/v1/object/list/' + this.bucketName,
            {
                method: 'POST',
                body: JSON.stringify(body),
            }
        );

        return { data, error: null };
    }

    /**
     * Move a file
     */
    async move(fromPath: string, toPath: string): Promise<{ data: { message: string }; error: null }> {
        const { data } = await this.fetchClient.request<{ message: string }>(
            '/storage/v1/object/move',
            {
                method: 'POST',
                body: JSON.stringify({
                    bucketId: this.bucketName,
                    sourceKey: fromPath,
                    destinationKey: toPath,
                }),
            }
        );

        return { data, error: null };
    }

    /**
     * Copy a file
     */
    async copy(fromPath: string, toPath: string): Promise<{ data: { message: string }; error: null }> {
        const { data } = await this.fetchClient.request<{ message: string }>(
            '/storage/v1/object/copy',
            {
                method: 'POST',
                body: JSON.stringify({
                    bucketId: this.bucketName,
                    sourceKey: fromPath,
                    destinationKey: toPath,
                }),
            }
        );

        return { data, error: null };
    }
}
