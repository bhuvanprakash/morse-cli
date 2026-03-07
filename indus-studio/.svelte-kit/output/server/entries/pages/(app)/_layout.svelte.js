import "clsx";
import "@sveltejs/kit/internal";
import "../../../chunks/exports.js";
import "../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../chunks/root.js";
import "../../../chunks/state.svelte.js";
import "../../../chunks/auth.js";
import "../../../chunks/toast.js";
import { L as LoadingSkeleton } from "../../../chunks/LoadingSkeleton.js";
function _layout($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { children } = $$props;
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="mx-auto max-w-6xl p-8">`);
      LoadingSkeleton($$renderer2, { lines: 10 });
      $$renderer2.push(`<!----></div>`);
    }
    $$renderer2.push(`<!--]-->`);
  });
}
export {
  _layout as default
};
