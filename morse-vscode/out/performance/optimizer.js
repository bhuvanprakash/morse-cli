"use strict";
/**
 * VS Code Extension Performance Optimizer
 *
 * Performance optimizations for the Morse VS Code extension.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.metrics = exports.PerformanceMetrics = exports.ResourcePool = exports.AsyncQueue = exports.BatchProcessor = exports.LazyLoader = void 0;
exports.debounce = debounce;
exports.throttle = throttle;
exports.memoize = memoize;
exports.withTimeout = withTimeout;
exports.measurePerformance = measurePerformance;
// Debounce function for performance
function debounce(func, wait) {
    let timeout;
    return (...args) => {
        if (timeout)
            clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}
// Throttle function for performance
function throttle(func, limit) {
    let inThrottle = false;
    return (...args) => {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}
// Memoize function for caching
function memoize(func, keyGenerator) {
    const cache = new Map();
    return ((...args) => {
        const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
        if (cache.has(key)) {
            return cache.get(key);
        }
        const result = func(...args);
        cache.set(key, result);
        return result;
    });
}
// Lazy loader for heavy components
class LazyLoader {
    loader;
    instance;
    loading;
    constructor(loader) {
        this.loader = loader;
    }
    async get() {
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
    isLoaded() {
        return !!this.instance;
    }
}
exports.LazyLoader = LazyLoader;
// Batch processor for efficient operations
class BatchProcessor {
    items = [];
    processor;
    delay;
    timeout;
    constructor(processor, delay = 100) {
        this.processor = processor;
        this.delay = delay;
    }
    add(item) {
        this.items.push(item);
        this.schedule();
    }
    schedule() {
        if (this.timeout)
            clearTimeout(this.timeout);
        this.timeout = setTimeout(() => this.flush(), this.delay);
    }
    async flush() {
        if (this.items.length === 0)
            return;
        const batch = [...this.items];
        this.items = [];
        try {
            await this.processor(batch);
        }
        catch (error) {
            console.error('Batch processing error:', error);
            // Re-add items for retry
            this.items.unshift(...batch);
        }
    }
}
exports.BatchProcessor = BatchProcessor;
// Cancellation token wrapper with timeout
function withTimeout(promise, timeoutMs, cancellationToken) {
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
class AsyncQueue {
    queue = [];
    running = 0;
    concurrency;
    constructor(concurrency = 3) {
        this.concurrency = concurrency;
    }
    async add(task) {
        return new Promise((resolve, reject) => {
            this.queue.push(async () => {
                try {
                    const result = await task();
                    resolve(result);
                    return result;
                }
                catch (error) {
                    reject(error);
                    throw error;
                }
            });
            this.process();
        });
    }
    async process() {
        if (this.running >= this.concurrency || this.queue.length === 0) {
            return;
        }
        this.running++;
        const task = this.queue.shift();
        try {
            await task();
        }
        finally {
            this.running--;
            this.process();
        }
    }
}
exports.AsyncQueue = AsyncQueue;
// Resource pool for managing limited resources
class ResourcePool {
    resources = [];
    available = [];
    waiting = [];
    createResource;
    maxSize;
    constructor(createResource, initialSize = 2, maxSize = 10) {
        this.createResource = createResource;
        this.maxSize = maxSize;
        // Initialize pool
        for (let i = 0; i < initialSize; i++) {
            const resource = createResource();
            this.resources.push(resource);
            this.available.push(resource);
        }
    }
    async acquire() {
        if (this.available.length > 0) {
            return this.available.pop();
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
    release(resource) {
        if (this.waiting.length > 0) {
            const next = this.waiting.shift();
            next(resource);
        }
        else {
            this.available.push(resource);
        }
    }
    destroy() {
        this.resources = [];
        this.available = [];
        this.waiting = [];
    }
}
exports.ResourcePool = ResourcePool;
// Performance metrics collector
class PerformanceMetrics {
    metrics = new Map();
    record(operation, duration) {
        if (!this.metrics.has(operation)) {
            this.metrics.set(operation, []);
        }
        this.metrics.get(operation).push(duration);
    }
    getStats(operation) {
        const times = this.metrics.get(operation);
        if (!times || times.length === 0)
            return undefined;
        const sum = times.reduce((a, b) => a + b, 0);
        return {
            avg: sum / times.length,
            min: Math.min(...times),
            max: Math.max(...times),
            count: times.length,
        };
    }
    getSlowOperations(threshold = 1000) {
        const slow = [];
        for (const [operation, times] of this.metrics.entries()) {
            const avg = times.reduce((a, b) => a + b, 0) / times.length;
            if (avg > threshold) {
                slow.push(`${operation}: ${avg.toFixed(2)}ms avg`);
            }
        }
        return slow;
    }
    clear() {
        this.metrics.clear();
    }
}
exports.PerformanceMetrics = PerformanceMetrics;
// Global metrics instance
exports.metrics = new PerformanceMetrics();
// Decorator for measuring function performance
function measurePerformance(operationName) {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        const name = operationName || `${target.constructor.name}.${propertyKey}`;
        descriptor.value = async function (...args) {
            const start = performance.now();
            try {
                return await originalMethod.apply(this, args);
            }
            finally {
                const duration = performance.now() - start;
                exports.metrics.record(name, duration);
                if (duration > 1000) {
                    console.warn(`[Slow Operation] ${name} took ${duration.toFixed(2)}ms`);
                }
            }
        };
        return descriptor;
    };
}
//# sourceMappingURL=optimizer.js.map