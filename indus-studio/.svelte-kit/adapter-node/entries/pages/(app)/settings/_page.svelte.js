import { b as attr, e as escape_html } from "../../../../chunks/index2.js";
import { a as apiClient } from "../../../../chunks/client2.js";
import "../../../../chunks/auth.js";
import "../../../../chunks/confirm.js";
import "../../../../chunks/toast.js";
import { P as PageHeader } from "../../../../chunks/PageHeader.js";
import { L as LoadingSkeleton } from "../../../../chunks/LoadingSkeleton.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let loading = true;
    apiClient.getBaseUrl();
    apiClient.getBaseUrl();
    $$renderer2.push(`<div class="space-y-6" data-testid="settings-page">`);
    {
      let actions = function($$renderer3) {
        $$renderer3.push(`<div class="flex gap-2"><button class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"${attr("disabled", loading, true)}>${escape_html("Refreshing...")}</button></div>`);
      };
      PageHeader($$renderer2, {
        title: "Project Settings",
        description: "Inspect active project metadata, workspace API configuration, keys, and service health.",
        actions
      });
    }
    $$renderer2.push(`<!----> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
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
