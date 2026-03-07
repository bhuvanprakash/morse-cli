import { a as attr_class, s as stringify } from "./index2.js";
function Badge($$renderer, $$props) {
  let { variant = "default", size = "md", children } = $$props;
  const variantClasses = {
    default: "bg-surface-4 text-surface-12",
    primary: "bg-accent-9 text-white",
    success: "bg-green-9 text-white",
    warning: "bg-amber-9 text-white",
    danger: "bg-red-9 text-white",
    info: "bg-blue-9 text-white",
    green: "bg-green-9 text-white",
    red: "bg-red-9 text-white",
    yellow: "bg-amber-9 text-white",
    blue: "bg-blue-9 text-white",
    gray: "bg-surface-6 text-surface-12"
  };
  const sizeClasses = { sm: "px-2 py-0.5 text-xs", md: "px-2.5 py-1 text-sm" };
  $$renderer.push(`<span${attr_class(`inline-flex items-center rounded-full font-medium ${stringify(variantClasses[variant])} ${stringify(sizeClasses[size])}`)}>`);
  children?.($$renderer);
  $$renderer.push(`<!----></span>`);
}
export {
  Badge as B
};
