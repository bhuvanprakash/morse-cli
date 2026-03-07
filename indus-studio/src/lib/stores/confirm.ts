import { writable } from 'svelte/store';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'danger';
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
  resolver?: (value: boolean) => void;
}

const state = writable<ConfirmState>({
  open: false,
  title: '',
  message: '',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  variant: 'default',
});

export const confirmState = { subscribe: state.subscribe };

export const confirmDialog = {
  open(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      state.set({
        open: true,
        title: options.title,
        message: options.message,
        confirmText: options.confirmText ?? 'Confirm',
        cancelText: options.cancelText ?? 'Cancel',
        variant: options.variant ?? 'default',
        resolver: resolve,
      });
    });
  },
  resolve(value: boolean): void {
    state.update((current) => {
      current.resolver?.(value);
      return {
        open: false,
        title: '',
        message: '',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        variant: 'default',
      };
    });
  },
};
