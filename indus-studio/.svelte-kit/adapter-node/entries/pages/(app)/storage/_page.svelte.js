import { d as ensure_array_like, a as attr_class, e as escape_html, b as attr } from "../../../../chunks/index2.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
import "../../../../chunks/toast.js";
import "../../../../chunks/confirm.js";
import { P as PageHeader } from "../../../../chunks/PageHeader.js";
import { S as SectionCard } from "../../../../chunks/SectionCard.js";
import { E as EmptyState } from "../../../../chunks/EmptyState.js";
import { S as StatusBadge } from "../../../../chunks/StatusBadge.js";
import { d as formatBytes } from "../../../../chunks/format.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let loadingBuckets = false;
    let buckets = [];
    let selectedBucket = null;
    $$renderer2.push(`<div class="space-y-6">`);
    {
      let actions = function($$renderer3) {
        $$renderer3.push(`<button class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">New Bucket</button> <button class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"${attr("disabled", loadingBuckets, true)}>${escape_html("Refresh")}</button>`);
      };
      PageHeader($$renderer2, {
        title: "Storage",
        description: "Manage buckets, upload/download files, and control bucket visibility.",
        actions
      });
    }
    $$renderer2.push(`<!----> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="grid gap-6 lg:grid-cols-3">`);
    SectionCard($$renderer2, {
      title: "Buckets",
      description: "Choose a bucket to browse objects.",
      children: ($$renderer3) => {
        if (buckets.length === 0) {
          $$renderer3.push("<!--[1-->");
          EmptyState($$renderer3, {
            title: "No buckets",
            message: "Create your first bucket to upload objects."
          });
        } else {
          $$renderer3.push("<!--[-1-->");
          $$renderer3.push(`<div class="space-y-2"><!--[-->`);
          const each_array = ensure_array_like(buckets);
          for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
            let bucket = each_array[$$index];
            $$renderer3.push(`<button${attr_class(
              `w-full rounded-lg border px-3 py-2 text-left ${selectedBucket?.id === bucket.id ? "border-orange-400 bg-orange-50" : "border-gray-200 hover:border-orange-300 hover:bg-orange-50"}`,
              "svelte-1p9i587"
            )}><div class="flex items-center justify-between"><div><p class="font-medium text-gray-900">${escape_html(bucket.name)}</p> <p class="text-xs text-gray-500">limit: ${escape_html(formatBytes(bucket.file_size_limit || 0))}</p></div> `);
            StatusBadge($$renderer3, { status: bucket.public ? "public" : "private" });
            $$renderer3.push(`<!----></div></button>`);
          }
          $$renderer3.push(`<!--]--></div>`);
        }
        $$renderer3.push(`<!--]-->`);
      }
    });
    $$renderer2.push(`<!----> <div class="lg:col-span-2 space-y-6">`);
    SectionCard($$renderer2, {
      title: "Object Browser",
      description: "Select a bucket to browse objects.",
      children: ($$renderer3) => {
        {
          $$renderer3.push("<!--[0-->");
          EmptyState($$renderer3, {
            title: "No bucket selected",
            message: "Pick a bucket from the left panel."
          });
        }
        $$renderer3.push(`<!--]-->`);
      }
    });
    $$renderer2.push(`<!----> `);
    SectionCard($$renderer2, {
      title: "Upload Object",
      description: "Upload files into the selected bucket with optional custom path.",
      children: ($$renderer3) => {
        {
          $$renderer3.push("<!--[0-->");
          EmptyState($$renderer3, {
            title: "Select a bucket first",
            message: "Upload is available once a bucket is selected."
          });
        }
        $$renderer3.push(`<!--]-->`);
      }
    });
    $$renderer2.push(`<!----></div></div></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
export {
  _page as default
};
