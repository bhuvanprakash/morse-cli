import { b as attr, a as attr_class, s as stringify } from "./index2.js";
function Button($$renderer, $$props) {
  let {
    type = "button",
    variant = "primary",
    size = "md",
    disabled = false,
    loading = false,
    fullWidth = false,
    testId = "",
    children,
    onclick
  } = $$props;
  const variantClasses = {
    primary: "bg-accent-9 text-white hover:bg-accent-10 active:bg-accent-11",
    secondary: "bg-surface-3 text-surface-12 hover:bg-surface-4 active:bg-surface-5",
    danger: "bg-red-9 text-white hover:bg-red-10 active:bg-red-11",
    ghost: "bg-transparent text-surface-12 hover:bg-surface-3 active:bg-surface-4",
    link: "bg-transparent text-accent-9 hover:underline p-0 h-auto"
  };
  const sizeClasses = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-base"
  };
  $$renderer.push(`<button${attr("type", type)}${attr("data-testid", testId || void 0)}${attr_class(`inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-accent-7 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${stringify(variantClasses[variant])} ${stringify(sizeClasses[size])} ${stringify(fullWidth ? "w-full" : "")}`)}${attr("disabled", disabled || loading, true)}>`);
  if (loading) {
    $$renderer.push("<!--[0-->");
    $$renderer.push(`<svg class="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`);
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--> `);
  children?.($$renderer);
  $$renderer.push(`<!----></button>`);
}
export {
  Button as B
};
