import { e as escape_html } from "./index2.js";
import "clsx";
function EmptyState($$renderer, $$props) {
  let { title, message, actions, icon = "✦" } = $$props;
  $$renderer.push(`<div class="rounded-2xl border border-dashed border-surface-6 bg-surface-2 px-6 py-10 text-center"><div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-orange-500/10 text-lg text-orange-200">${escape_html(icon)}</div> <h3 class="text-base font-semibold text-surface-12">${escape_html(title)}</h3> <p class="mt-1 text-sm text-surface-10">${escape_html(message)}</p> `);
  if (actions) {
    $$renderer.push("<!--[0-->");
    $$renderer.push(`<div class="mt-4 flex justify-center gap-2">`);
    actions($$renderer);
    $$renderer.push(`<!----></div>`);
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--></div>`);
}
export {
  EmptyState as E
};
