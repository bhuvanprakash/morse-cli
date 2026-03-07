import { b as attr } from "./index2.js";
function SearchInput($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { value = "", placeholder = "Search...", oninput } = $$props;
    $$renderer2.push(`<input class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"${attr("placeholder", placeholder)}${attr("value", value)}/>`);
  });
}
export {
  SearchInput as S
};
