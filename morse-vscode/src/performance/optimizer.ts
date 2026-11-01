/**
 * VS Code Extension Performance Optimizer
 * 
 * Performance optimizations for the Morse VS Code extension.
 */

import * as vscode from 'vscode';

// Debounce function for performance
export function debounce<T extends (...args: any[]) => void>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | undefined;
    return (...args: Parameters<T>) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

// Throttle function for performance
export function throttle<T extends (...args: any[]) => void>(
    func: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle = false;
    return (...args: Parameters<T>) => {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}

// Memoize function for caching
export function memoize<T extends (...args: any[]) => any>(
    func: T,
    keyGenerator?: (...args: Parameters<T>) => string
): T {
    const cache = new Map<string, ReturnType<T>>();
    return ((...args: Parameters<T>): ReturnType<T> => {
        const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
        if (cache.has(key)) {
            return cache.get(key)!;
        }
        const result = func(...args);
        cache.set(key, result);
        return result;
    }) as T;
}

// Lazy loader for heavy components
export class LazyLoader<T> {
    private loader: () => Promise<T>;
    private instance: T | undefined;
    private loading: Promise<T> | undefined;

    constructor(loader: () => Promise<T>) {
        this.loader = loader;
    }

    async get(): Promise<T> {
        if (this.instance) {
            return this.instance;
        }

        if (!this.loading) {
            this.loading = this.loader().then((instance) => {
                this.instance = instance;
                return instance;
            });
        }

        return this.loading;
    }

    isLoaded(): boolean {
        return !!this.instance;
    }
}

// Batch processor for efficient operations
export class BatchProcessor<T> {
    private items: T[] = [];
    private processor: (items: T[]) => Promise<void>;
    private delay: number;
    private timeout: NodeJS.Timeout | undefined;

    constructor(
        processor: (items: T[]) => Promise<void>,
        delay: number = 100
    ) {
        this.processor = processor;
        this.delay = delay;
    }

    add(item: T): void {
        this.items.push(item);
        this.schedule();
    }

    private schedule(): void {
        if (this.timeout) clearTimeout(this.timeout);
        this.timeout = setTimeout(() => this.flush(), this.delay);
    }

    async flush(): Promise<void> {
        if (this.items.length === 0) return;

        const batch = [...this.items];
        this.items = [];

        try {
            await this.processor(batch);
        } catch (error) {
            console.error('Batch processing error:', error);
            // Re-add items for retry
            this.items.unshift(...batch);
        }
    }
}

// Cancellation token wrapper with timeout
export function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    cancellationToken?: vscode.CancellationToken
): Promise<T> {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error(`Operation timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        const disposable = cancellationToken?.onCancellationRequested(() => {
            clearTimeout(timeoutId);
            reject(new Error('Operation cancelled'));
        });

        promise
            .then((result) => {
                clearTimeout(timeoutId);
                disposable?.dispose();
                resolve(result);
            })
            .catch((error) => {
                clearTimeout(timeoutId);
                disposable?.dispose();
                reject(error);
            });
    });
}

// Async queue with concurrency control
export class AsyncQueue<T> {
    private queue: (() => Promise<T>)[] = [];
    private running = 0;
    private concurrency: number;

    constructor(concurrency: number = 3) {
        this.concurrency = concurrency;
    }

    async add(task: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.queue.push(async () => {
                try {
                    const result = await task();
                    resolve(result);
                    return result;
                } catch (error) {
                    reject(error);
                    throw error;
                }
            });

            this.process();
        });
    }

    private async process(): Promise<void> {
        if (this.running >= this.concurrency || this.queue.length === 0) {
            return;
        }

        this.running++;
        const task = this.queue.shift()!;

        try {
            await task();
        } finally {
            this.running--;
            this.process();
        }
    }
}

// Resource pool for managing limited resources
export class ResourcePool<T> {
    private resources: T[] = [];
    private available: T[] = [];
    private waiting: ((resource: T) => void)[] = [];
    private createResource: () => T;
    private maxSize: number;

    constructor(
        createResource: () => T,
        initialSize: number = 2,
        maxSize: number = 10
    ) {
        this.createResource = createResource;
        this.maxSize = maxSize;

        // Initialize pool
        for (let i = 0; i < initialSize; i++) {
            const resource = createResource();
            this.resources.push(resource);
            this.available.push(resource);
        }
    }

    async acquire(): Promise<T> {
        if (this.available.length > 0) {
            return this.available.pop()!;
        }

        if (this.resources.length < this.maxSize) {
            const resource = this.createResource();
            this.resources.push(resource);
            return resource;
        }

        return new Promise((resolve) => {
            this.waiting.push(resolve);
        });
    }

    release(resource: T): void {
        if (this.waiting.length > 0) {
            const next = this.waiting.shift()!;
            next(resource);
        } else {
            this.available.push(resource);
        }
    }

    destroy(): void {
        this.resources = [];
        this.available = [];
        this.waiting = [];
    }
}

// Performance metrics collector
export class PerformanceMetrics {
    private metrics: Map<string, number[]> = new Map();

    record(operation: string, duration: number): void {
        if (!this.metrics.has(operation)) {
            this.metrics.set(operation, []);
        }
        this.metrics.get(operation)!.push(duration);
    }

    getStats(operation: string): { avg: number; min: number; max: number; count: number } | undefined {
        const times = this.metrics.get(operation);
        if (!times || times.length === 0) return undefined;

        const sum = times.reduce((a, b) => a + b, 0);
        return {
            avg: sum / times.length,
            min: Math.min(...times),
            max: Math.max(...times),
            count: times.length,
        };
    }

    getSlowOperations(threshold: number = 1000): string[] {
        const slow: string[] = [];
        for (const [operation, times] of this.metrics.entries()) {
            const avg = times.reduce((a, b) => a + b, 0) / times.length;
            if (avg > threshold) {
                slow.push(`${operation}: ${avg.toFixed(2)}ms avg`);
            }
        }
        return slow;
    }

    clear(): void {
        this.metrics.clear();
    }
}

// Global metrics instance
export const metrics = new PerformanceMetrics();

// Decorator for measuring function performance
export function measurePerformance(operationName?: string) {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;
        const name = operationName || `${target.constructor.name}.${propertyKey}`;

        descriptor.value = async function (...args: any[]) {
            const start = performance.now();
            try {
                return await originalMethod.apply(this, args);
            } finally {
                const duration = performance.now() - start;
                metrics.record(name, duration);

                if (duration > 1000) {
                    console.warn(`[Slow Operation] ${name} took ${duration.toFixed(2)}ms`);
                }
            }
        };

        return descriptor;
    };
}