import { d as ensure_array_like, b as attr, e as escape_html } from "./index2.js";
function Breadcrumbs($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { items = [] } = $$props;
    if (items.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<nav aria-label="Breadcrumb" class="flex flex-wrap items-center gap-2 text-xs text-surface-10"><!--[-->`);
      const each_array = ensure_array_like(items);
      for (let index = 0, $$length = each_array.length; index < $$length; index++) {
        let item = each_array[index];
        if (index > 0) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<span aria-hidden="true">/</span>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (item.href && index < items.length - 1) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<a${attr("href", item.href)} class="transition hover:text-surface-12">${escape_html(item.label)}</a>`);
        } else {
          $$renderer2.push("<!--[-1-->");
          $$renderer2.push(`<span class="text-surface-11">${escape_html(item.label)}</span>`);
        }
        $$renderer2.push(`<!--]-->`);
      }
      $$renderer2.push(`<!--]--></nav>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function PageHeader($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      title,
      description = "",
      actions,
      eyebrow = "",
      breadcrumbs = [],
      testId = ""
    } = $$props;
    $$renderer2.push(`<div class="mb-6 flex items-start justify-between gap-4"${attr("data-testid", testId || void 0)}><div class="space-y-2">`);
    if (breadcrumbs.length > 0) {
      $$renderer2.push("<!--[0-->");
      Breadcrumbs($$renderer2, { items: breadcrumbs });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (eyebrow) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="text-xs font-semibold uppercase tracking-[0.18em] text-surface-10">${escape_html(eyebrow)}</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <h1 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">${escape_html(title)}</h1> `);
    if (description) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">${escape_html(description)}</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> `);
    if (actions) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="flex items-center gap-2">`);
      actions($$renderer2);
      $$renderer2.push(`<!----></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
export {
  PageHeader as P
};
