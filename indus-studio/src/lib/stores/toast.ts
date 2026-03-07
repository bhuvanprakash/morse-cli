import { writable } from 'svelte/store';

export type ToastType = 'success' | 'error' | 'loading' | 'info' | 'custom';

export interface ToastOptions {
    duration?: number;
    position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
    icon?: string;
}

export interface ToastEntry {
    id: string;
    message: string;
    type: ToastType;
    duration: number;
    position: NonNullable<ToastOptions['position']>;
    icon?: string;
    createdAt: number;
}

const DEFAULT_POSITION: NonNullable<ToastOptions['position']> = 'bottom-right';
const toastStateStore = writable<ToastEntry[]>([]);
let nextToastId = 0;

function createToast(message: string, type: ToastType, options?: ToastOptions): string {
    const now = Date.now();
    let existingId = '';
    toastStateStore.update((items) => {
        const duplicate = items.find((item) =>
            item.message === message &&
            item.type === type &&
            now - item.createdAt < 2000
        );
        if (duplicate) {
            existingId = duplicate.id;
            return items;
        }
        return items;
    });
    if (existingId) {
        return existingId;
    }

    const id = `toast-${++nextToastId}`;
    const entry: ToastEntry = {
        id,
        message,
        type,
        duration: options?.duration ?? (type === 'error' ? 5000 : type === 'loading' ? 0 : 3000),
        position: options?.position ?? DEFAULT_POSITION,
        icon: options?.icon,
        createdAt: now
    };

    toastStateStore.update((items) => [...items, entry]);
    return id;
}

function updateToast(toastId: string, patch: Partial<ToastEntry>): void {
    toastStateStore.update((items) =>
        items.map((item) => (item.id === toastId ? { ...item, ...patch } : item))
    );
}

export const toastState = {
    subscribe: toastStateStore.subscribe
};

export const toastStore = {
    success(message: string, options?: ToastOptions): string {
        return createToast(message, 'success', options);
    },

    error(message: string, options?: ToastOptions): string {
        return createToast(message, 'error', options);
    },

    info(message: string, options?: ToastOptions): string {
        return createToast(message, 'info', options);
    },

    loading(message: string, options?: ToastOptions): string {
        return createToast(message, 'loading', {
            ...options,
            duration: 0
        });
    },

    dismiss(toastId?: string): void {
        toastStateStore.update((items) =>
            toastId ? items.filter((item) => item.id !== toastId) : []
        );
    },

    promise<T>(
        promise: Promise<T>,
        messages: {
            loading: string;
            success: string;
            error: string;
        }
    ): Promise<T> {
        const loadingId = this.loading(messages.loading);

        return promise
            .then((result) => {
                updateToast(loadingId, {
                    message: messages.success,
                    type: 'success',
                    duration: 3000
                });
                return result;
            })
            .catch((error) => {
                updateToast(loadingId, {
                    message: messages.error,
                    type: 'error',
                    duration: 5000
                });
                throw error;
            });
    },

    custom(message: string, options?: ToastOptions & { icon?: string }): void {
        createToast(message, 'custom', {
            duration: options?.duration ?? 3000,
            position: options?.position ?? DEFAULT_POSITION,
            icon: options?.icon
        });
    }
};

// Helper for API error handling
export function handleApiError(error: unknown, fallbackMessage = 'An error occurred'): void {
    const err = error as { message?: string; code?: string };
    const message = err.message || err.code || fallbackMessage;
    toastStore.error(message);
}

// Helper for success actions
export function showSuccess(message: string): void {
    toastStore.success(message);
}
