import { b as attr, e as escape_html } from "../../../../chunks/index2.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
import { c as contextStore } from "../../../../chunks/context.js";
import "../../../../chunks/toast.js";
import { P as PageHeader } from "../../../../chunks/PageHeader.js";
import { L as LoadingSkeleton } from "../../../../chunks/LoadingSkeleton.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let loading = true;
    $$renderer2.push(`<div class="space-y-6" data-testid="dashboard-page">`);
    {
      let actions = function($$renderer3) {
        $$renderer3.push(`<div class="flex flex-wrap gap-2"><button class="secondary svelte-1tyszyy"${attr("disabled", loading, true)} data-testid="dashboard-refresh">${escape_html("Refreshing...")}</button> <button class="secondary svelte-1tyszyy">Open Status</button> <button class="primary svelte-1tyszyy">Run Query</button></div>`);
      };
      PageHeader($$renderer2, {
        title: "Dashboard",
        description: `Premium control-plane overview for ${contextStore.activeProject?.name || "your project"} in ${contextStore.environment}.`,
        eyebrow: "Overview",
        testId: "dashboard-header",
        actions
      });
    }
    $$renderer2.push(`<!----> `);
    {
      $$renderer2.push("<!--[0-->");
      LoadingSkeleton($$renderer2, { lines: 12 });
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
export {
  _page as default
};
