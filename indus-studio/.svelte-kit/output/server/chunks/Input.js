import { b as attr, e as escape_html, a as attr_class, j as bind_props, h as derived, s as stringify } from "./index2.js";
function Input($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      type = "text",
      label,
      placeholder,
      value = "",
      error,
      disabled = false,
      required = false,
      readonly = false,
      id,
      class: className = "",
      oninput,
      onchange,
      onblur
    } = $$props;
    const generatedId = `input-${Math.random().toString(36).slice(2, 11)}`;
    const inputId = derived(() => id ?? generatedId);
    $$renderer2.push(`<div class="w-full">`);
    if (label) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<label${attr("for", inputId())} class="block text-sm font-medium text-surface-12 mb-1">${escape_html(label)} `);
      if (required) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="text-red-9">*</span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></label>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <input${attr("id", inputId())}${attr("type", type)}${attr("placeholder", placeholder)}${attr("disabled", disabled, true)}${attr("required", required, true)}${attr("readonly", readonly, true)}${attr("value", value)}${attr_class(`w-full px-3 py-2 bg-surface-2 border border-surface-6 rounded-md text-surface-12 placeholder:text-surface-10 focus:outline-none focus:ring-2 focus:ring-accent-7 focus:border-accent-8 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${stringify(error ? "border-red-9 focus:ring-red-7 focus:border-red-8" : "")} ${stringify(className)}`)}/> `);
    if (error) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="mt-1 text-sm text-red-9">${escape_html(error)}</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
    bind_props($$props, { value });
  });
}
export {
  Input as I
};
