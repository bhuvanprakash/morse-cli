import { w as writable } from "./index.js";
const state = writable({
  open: false,
  title: "",
  message: "",
  confirmText: "Confirm",
  cancelText: "Cancel",
  variant: "default"
});
const confirmState = { subscribe: state.subscribe };
const confirmDialog = {
  open(options) {
    return new Promise((resolve) => {
      state.set({
        open: true,
        title: options.title,
        message: options.message,
        confirmText: options.confirmText ?? "Confirm",
        cancelText: options.cancelText ?? "Cancel",
        variant: options.variant ?? "default",
        resolver: resolve
      });
    });
  },
  resolve(value) {
    state.update((current) => {
      current.resolver?.(value);
      return {
        open: false,
        title: "",
        message: "",
        confirmText: "Confirm",
        cancelText: "Cancel",
        variant: "default"
      };
    });
  }
};
export {
  confirmDialog as a,
  confirmState as c
};
