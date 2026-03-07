import { w as writable } from "./index.js";
const DEFAULT_POSITION = "bottom-right";
const toastStateStore = writable([]);
let nextToastId = 0;
function createToast(message, type, options) {
  const now = Date.now();
  let existingId = "";
  toastStateStore.update((items) => {
    const duplicate = items.find(
      (item) => item.message === message && item.type === type && now - item.createdAt < 2e3
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
  const entry = {
    id,
    message,
    type,
    duration: options?.duration ?? (type === "error" ? 5e3 : type === "loading" ? 0 : 3e3),
    position: options?.position ?? DEFAULT_POSITION,
    icon: options?.icon,
    createdAt: now
  };
  toastStateStore.update((items) => [...items, entry]);
  return id;
}
function updateToast(toastId, patch) {
  toastStateStore.update(
    (items) => items.map((item) => item.id === toastId ? { ...item, ...patch } : item)
  );
}
const toastState = {
  subscribe: toastStateStore.subscribe
};
const toastStore = {
  success(message, options) {
    return createToast(message, "success", options);
  },
  error(message, options) {
    return createToast(message, "error", options);
  },
  info(message, options) {
    return createToast(message, "info", options);
  },
  loading(message, options) {
    return createToast(message, "loading", {
      ...options,
      duration: 0
    });
  },
  dismiss(toastId) {
    toastStateStore.update(
      (items) => toastId ? items.filter((item) => item.id !== toastId) : []
    );
  },
  promise(promise, messages) {
    const loadingId = this.loading(messages.loading);
    return promise.then((result) => {
      updateToast(loadingId, {
        message: messages.success,
        type: "success",
        duration: 3e3
      });
      return result;
    }).catch((error) => {
      updateToast(loadingId, {
        message: messages.error,
        type: "error",
        duration: 5e3
      });
      throw error;
    });
  },
  custom(message, options) {
    createToast(message, "custom", {
      duration: options?.duration ?? 3e3,
      position: options?.position ?? DEFAULT_POSITION,
      icon: options?.icon
    });
  }
};
export {
  toastStore as a,
  toastState as t
};
