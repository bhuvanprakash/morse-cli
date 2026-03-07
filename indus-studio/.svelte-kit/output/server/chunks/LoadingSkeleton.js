import { d as ensure_array_like, c as attr_style } from "./index2.js";
function LoadingSkeleton($$renderer, $$props) {
  let { lines = 4 } = $$props;
  $$renderer.push(`<div class="space-y-2"><!--[-->`);
  const each_array = ensure_array_like(Array(lines));
  for (let i = 0, $$length = each_array.length; i < $$length; i++) {
    each_array[i];
    $$renderer.push(`<div class="h-4 animate-pulse rounded bg-gray-200 dark:bg-gray-800"${attr_style(`width:${Math.max(50, 100 - i * 7)}%`)}></div>`);
  }
  $$renderer.push(`<!--]--></div>`);
}
export {
  LoadingSkeleton as L
};
