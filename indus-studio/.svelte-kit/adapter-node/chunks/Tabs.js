import { d as ensure_array_like, a as attr_class, e as escape_html } from "./index2.js";
function Tabs($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { tabs = [], active = "", onChange } = $$props;
    $$renderer2.push(`<nav class="flex gap-4 border-b border-gray-200 dark:border-gray-800"><!--[-->`);
    const each_array = ensure_array_like(tabs);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let tab = each_array[$$index];
      $$renderer2.push(`<button${attr_class(`border-b-2 px-1 py-2 text-sm font-medium ${active === tab.key ? "border-orange-500 text-gray-900 dark:text-gray-100" : "border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"}`)}>${escape_html(tab.label)}</button>`);
    }
    $$renderer2.push(`<!--]--></nav>`);
  });
}
export {
  Tabs as T
};
