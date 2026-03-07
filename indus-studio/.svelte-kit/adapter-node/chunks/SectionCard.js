import { e as escape_html, a as attr_class, l as clsx } from "./index2.js";
function SectionCard($$renderer, $$props) {
  let {
    title = "",
    description = "",
    padded = true,
    eyebrow = "",
    children
  } = $$props;
  $$renderer.push(`<section class="rounded-2xl border border-surface-6 bg-surface-2 shadow-sm">`);
  if (title || description) {
    $$renderer.push("<!--[0-->");
    $$renderer.push(`<header class="border-b border-surface-6 px-5 py-4">`);
    if (eyebrow) {
      $$renderer.push("<!--[0-->");
      $$renderer.push(`<p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-surface-10">${escape_html(eyebrow)}</p>`);
    } else {
      $$renderer.push("<!--[-1-->");
    }
    $$renderer.push(`<!--]--> `);
    if (title) {
      $$renderer.push("<!--[0-->");
      $$renderer.push(`<h2 class="text-sm font-semibold text-surface-12">${escape_html(title)}</h2>`);
    } else {
      $$renderer.push("<!--[-1-->");
    }
    $$renderer.push(`<!--]--> `);
    if (description) {
      $$renderer.push("<!--[0-->");
      $$renderer.push(`<p class="mt-1 text-xs text-surface-10">${escape_html(description)}</p>`);
    } else {
      $$renderer.push("<!--[-1-->");
    }
    $$renderer.push(`<!--]--></header>`);
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--> <div${attr_class(clsx(padded ? "p-5" : ""))}>`);
  if (children) {
    $$renderer.push("<!--[0-->");
    children($$renderer);
    $$renderer.push(`<!---->`);
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--></div></section>`);
}
export {
  SectionCard as S
};
