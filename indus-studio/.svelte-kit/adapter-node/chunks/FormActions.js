import { b as attr, e as escape_html, k as slot } from "./index2.js";
function FormField($$renderer, $$props) {
  let {
    label,
    hint = "",
    required = false,
    inputId = "",
    error = "",
    children
  } = $$props;
  $$renderer.push(`<div class="space-y-1"><label class="block text-sm font-medium text-surface-11"${attr("for", inputId || void 0)}>${escape_html(label)}`);
  if (required) {
    $$renderer.push("<!--[0-->");
    $$renderer.push(`<span class="ml-1 text-red-600">*</span>`);
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--></label> `);
  if (children) {
    $$renderer.push("<!--[0-->");
    children($$renderer);
    $$renderer.push(`<!---->`);
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--> `);
  if (hint) {
    $$renderer.push("<!--[0-->");
    $$renderer.push(`<p class="text-xs text-surface-10">${escape_html(hint)}</p>`);
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--> `);
  if (error) {
    $$renderer.push("<!--[0-->");
    $$renderer.push(`<p class="text-xs text-red-300">${escape_html(error)}</p>`);
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--></div>`);
}
function FormActions($$renderer, $$props) {
  $$renderer.push(`<div class="mt-4 flex items-center justify-end gap-2"><!--[-->`);
  slot($$renderer, $$props, "default", {});
  $$renderer.push(`<!--]--></div>`);
}
export {
  FormField as F,
  FormActions as a
};
