import { c as attr_style, d as ensure_array_like, a as attr_class, b as attr, e as escape_html, h as derived } from "./index2.js";
function MetricChart($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { points = [], height = 140 } = $$props;
    const maxValue = derived(() => Math.max(1, ...points.map((p) => p.value)));
    const toneClass = {
      orange: "bg-orange-500",
      blue: "bg-blue-500",
      green: "bg-green-500",
      red: "bg-red-500"
    };
    $$renderer2.push(`<div class="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"><div class="flex items-end gap-2"${attr_style(`height:${height}px`)}><!--[-->`);
    const each_array = ensure_array_like(points);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let point = each_array[$$index];
      $$renderer2.push(`<div class="flex min-w-0 flex-1 flex-col items-center gap-1"><div${attr_class(`w-full rounded-t ${toneClass[point.tone ?? "orange"]}`)}${attr_style(`height:${Math.max(6, point.value / maxValue() * (height - 30))}px`)}${attr("title", `${point.label}: ${point.value}`)}></div> <span class="truncate text-[10px] text-gray-500">${escape_html(point.label)}</span></div>`);
    }
    $$renderer2.push(`<!--]--></div></div>`);
  });
}
export {
  MetricChart as M
};
