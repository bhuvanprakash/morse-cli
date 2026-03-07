import { a as attr_class, e as escape_html, h as derived } from "./index2.js";
function Badge($$renderer, $$props) {
  let { tone = "default", text = "", children } = $$props;
  const cls = {
    default: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    success: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    danger: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    info: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
  };
  $$renderer.push(`<span${attr_class(`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls[tone]}`)}>`);
  if (children) {
    $$renderer.push("<!--[0-->");
    children($$renderer);
    $$renderer.push(`<!---->`);
  } else {
    $$renderer.push("<!--[-1-->");
    $$renderer.push(`${escape_html(text)}`);
  }
  $$renderer.push(`<!--]--></span>`);
}
function StatusBadge($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { status } = $$props;
    const tone = derived(() => {
      const normalized = status.toLowerCase();
      if (normalized.includes("fail") || normalized.includes("error") || normalized.includes("dead") || normalized.includes("critical") || normalized.includes("revoked") || normalized.includes("disabled") || normalized.includes("inactive")) {
        return "danger";
      }
      if (normalized.includes("warn") || normalized.includes("pending") || normalized.includes("queued") || normalized.includes("running") || normalized.includes("partial")) {
        return "warning";
      }
      if (normalized.includes("success") || normalized.includes("ok") || normalized.includes("active") || normalized.includes("available") || normalized.includes("verified") || normalized.includes("delivered") || normalized.includes("resolved") || normalized.includes("healthy")) {
        return "success";
      }
      return "default";
    });
    Badge($$renderer2, { tone: tone(), text: status });
  });
}
export {
  StatusBadge as S
};
