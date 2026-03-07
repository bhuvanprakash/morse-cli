import "clsx";
import { a as attr_class, b as attr, e as escape_html, c as attr_style, s as stringify, d as ensure_array_like, f as store_get, u as unsubscribe_stores } from "../../chunks/index2.js";
import { t as toastState } from "../../chunks/toast.js";
import { c as confirmState } from "../../chunks/confirm.js";
import "../../chunks/auth.js";
function Toast($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { message, type = "info", duration = 3e3, icon } = $$props;
    let progress = 100;
    const typeClasses = {
      success: "bg-green-9 text-white border-green-8",
      error: "bg-red-9 text-white border-red-8",
      loading: "bg-blue-9 text-white border-blue-8",
      info: "bg-surface-4 text-surface-12 border-surface-6",
      custom: "bg-accent-9 text-white border-accent-8"
    };
    const icons = {
      success: "✓",
      error: "✕",
      loading: "◌",
      info: "ℹ",
      custom: "•"
    };
    $$renderer2.push(`<div${attr_class(`relative flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${stringify(typeClasses[type])} min-w-[300px] max-w-[400px]`)} role="status"${attr("aria-live", type === "error" ? "assertive" : "polite")}><span class="text-lg font-bold">${escape_html(icon ?? icons[type])}</span> <p class="flex-1 text-sm">${escape_html(message)}</p> <button type="button" class="text-current opacity-60 hover:opacity-100 transition-opacity">✕</button> `);
    if (type !== "loading" && duration > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="absolute bottom-0 left-0 h-0.5 bg-white/50 transition-all duration-100"${attr_style(`width: ${stringify(progress)}%`)}></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function ToastViewport($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    const positionClasses = {
      "top-left": "top-4 left-4 items-start",
      "top-center": "top-4 left-1/2 -translate-x-1/2 items-center",
      "top-right": "top-4 right-4 items-end",
      "bottom-left": "bottom-4 left-4 items-start",
      "bottom-center": "bottom-4 left-1/2 -translate-x-1/2 items-center",
      "bottom-right": "bottom-4 right-4 items-end"
    };
    const positions = Object.keys(positionClasses);
    $$renderer2.push(`<!--[-->`);
    const each_array = ensure_array_like(positions);
    for (let $$index_1 = 0, $$length = each_array.length; $$index_1 < $$length; $$index_1++) {
      let position = each_array[$$index_1];
      const items = store_get($$store_subs ??= {}, "$toastState", toastState).filter((toast) => toast.position === position);
      if (items.length > 0) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div${attr_class(`fixed z-[100] flex w-full max-w-md flex-col gap-3 pointer-events-none ${stringify(positionClasses[position])}`)}><!--[-->`);
        const each_array_1 = ensure_array_like(items);
        for (let $$index = 0, $$length2 = each_array_1.length; $$index < $$length2; $$index++) {
          let toast = each_array_1[$$index];
          $$renderer2.push(`<div class="pointer-events-auto">`);
          Toast($$renderer2, {
            id: toast.id,
            message: toast.message,
            type: toast.type,
            duration: toast.duration,
            icon: toast.icon
          });
          $$renderer2.push(`<!----></div>`);
        }
        $$renderer2.push(`<!--]--></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]-->`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function ConfirmDialog($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    if (store_get($$store_subs ??= {}, "$confirmState", confirmState).open) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true"><div class="w-full max-w-md rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-800 dark:bg-gray-950"><h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">${escape_html(store_get($$store_subs ??= {}, "$confirmState", confirmState).title)}</h3> <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">${escape_html(store_get($$store_subs ??= {}, "$confirmState", confirmState).message)}</p> <div class="mt-4 flex justify-end gap-2"><button class="rounded-md border border-gray-300 px-3 py-2 text-sm">${escape_html(store_get($$store_subs ??= {}, "$confirmState", confirmState).cancelText)}</button> <button${attr_class(`rounded-md px-3 py-2 text-sm text-white ${store_get($$store_subs ??= {}, "$confirmState", confirmState).variant === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-orange-600 hover:bg-orange-700"}`)}>${escape_html(store_get($$store_subs ??= {}, "$confirmState", confirmState).confirmText)}</button></div></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function _layout($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { children } = $$props;
    ToastViewport($$renderer2);
    $$renderer2.push(`<!----> `);
    ConfirmDialog($$renderer2);
    $$renderer2.push(`<!----> `);
    children?.($$renderer2);
    $$renderer2.push(`<!---->`);
  });
}
export {
  _layout as default
};
