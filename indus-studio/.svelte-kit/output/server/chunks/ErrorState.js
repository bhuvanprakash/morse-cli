import { e as escape_html } from "./index2.js";
import "clsx";
function ErrorState($$renderer, $$props) {
  let {
    title = "Something went wrong",
    message,
    details = "",
    onRetry
  } = $$props;
  $$renderer.push(`<div class="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-200"><h3 class="font-semibold">${escape_html(title)}</h3> <p class="mt-1 text-sm">${escape_html(message)}</p> `);
  if (details) {
    $$renderer.push("<!--[0-->");
    $$renderer.push(`<button class="mt-2 text-xs underline">${escape_html("Show")} details</button> `);
    {
      $$renderer.push("<!--[-1-->");
    }
    $$renderer.push(`<!--]-->`);
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--> <div class="mt-3">`);
  if (onRetry) {
    $$renderer.push("<!--[0-->");
    $$renderer.push(`<button class="rounded-md border border-red-400/40 bg-transparent px-3 py-1 text-sm hover:bg-red-500/10">Retry</button>`);
  } else {
    $$renderer.push("<!--[-1-->");
  }
  $$renderer.push(`<!--]--></div></div>`);
}
export {
  ErrorState as E
};
