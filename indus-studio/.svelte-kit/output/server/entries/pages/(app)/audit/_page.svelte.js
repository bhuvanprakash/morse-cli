import { b as attr, d as ensure_array_like, e as escape_html, h as derived } from "../../../../chunks/index2.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
import { f as formatDateTime } from "../../../../chunks/format.js";
import "../../../../chunks/toast.js";
import { P as PageHeader } from "../../../../chunks/PageHeader.js";
import { S as SectionCard } from "../../../../chunks/SectionCard.js";
import { S as StatCard } from "../../../../chunks/StatCard.js";
import { S as StatusBadge } from "../../../../chunks/StatusBadge.js";
import { S as SlideOver } from "../../../../chunks/SlideOver.js";
import { E as EmptyState } from "../../../../chunks/EmptyState.js";
function createPagination(initial) {
  return {
    page: initial?.page,
    pageSize: initial?.pageSize,
    total: initial?.total
  };
}
function totalPages(state) {
  return Math.max(1, Math.ceil(state.total / state.pageSize));
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let loading = false;
    let events = [];
    let summary = {};
    let detailOpen = false;
    let filters = {
      project_id: "",
      actor: "",
      action: "",
      resource_type: "",
      severity: "",
      from: "",
      to: ""
    };
    let pagination = createPagination({ page: 1, pageSize: 50, total: 0 });
    const hasPrev = derived(() => pagination.page > 1);
    const hasNext = derived(() => events.length >= pagination.pageSize);
    const pages = derived(() => totalPages(pagination));
    $$renderer2.push(`<div class="space-y-6" data-testid="audit-page">`);
    {
      let actions = function($$renderer3) {
        $$renderer3.push(`<div class="flex gap-2"><button class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50" data-testid="audit-export-json">Export JSON</button> <button class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50" data-testid="audit-export-csv">Export CSV</button> <button class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"${attr("disabled", loading, true)} data-testid="audit-refresh">${escape_html("Refresh")}</button></div>`);
      };
      PageHeader($$renderer2, {
        title: "Audit Logs",
        description: "Immutable, filterable activity trail across auth, config, security, and operational actions.",
        actions
      });
    }
    $$renderer2.push(`<!----> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="grid gap-4 md:grid-cols-4">`);
    StatCard($$renderer2, {
      label: "Total Events",
      value: String(summary.total_events ?? 0),
      hint: "Current audit retention window"
    });
    $$renderer2.push(`<!----> `);
    StatCard($$renderer2, {
      label: "Last 24h",
      value: String(summary.last_24h ?? 0),
      hint: "Recent operator and system actions"
    });
    $$renderer2.push(`<!----> `);
    StatCard($$renderer2, {
      label: "Errors",
      value: String(summary.errors ?? 0),
      hint: "Events with error severity",
      trend: summary.errors ? "attention" : "quiet",
      trendTone: summary.errors ? "warn" : "good"
    });
    $$renderer2.push(`<!----> `);
    StatCard($$renderer2, {
      label: "Critical",
      value: String(summary.critical ?? 0),
      hint: "Security and production-impacting events",
      trend: summary.critical ? "urgent" : "healthy",
      trendTone: summary.critical ? "bad" : "good"
    });
    $$renderer2.push(`<!----></div> `);
    SectionCard($$renderer2, {
      title: "Filters",
      description: "Narrow events by project, actor, action, severity, and timeframe.",
      children: ($$renderer3) => {
        $$renderer3.push(`<div class="space-y-3"><div class="grid gap-3 md:grid-cols-7"><label class="field svelte-j3rly1"><span class="svelte-j3rly1">Project</span> <input${attr("value", filters.project_id)} placeholder="project-id" data-testid="audit-project-filter" class="svelte-j3rly1"/></label> <label class="field svelte-j3rly1"><span class="svelte-j3rly1">Actor</span> <input${attr("value", filters.actor)} placeholder="email / user id" data-testid="audit-actor-filter" class="svelte-j3rly1"/></label> <label class="field svelte-j3rly1"><span class="svelte-j3rly1">Action</span> <input${attr("value", filters.action)} placeholder="create_project" data-testid="audit-action-filter" class="svelte-j3rly1"/></label> <label class="field svelte-j3rly1"><span class="svelte-j3rly1">Resource Type</span> <input${attr("value", filters.resource_type)} placeholder="feature_flag" data-testid="audit-resource-filter" class="svelte-j3rly1"/></label> <label class="field svelte-j3rly1"><span class="svelte-j3rly1">Severity</span> `);
        $$renderer3.select(
          {
            value: filters.severity,
            "data-testid": "audit-severity-filter",
            class: ""
          },
          ($$renderer4) => {
            $$renderer4.option({ value: "" }, ($$renderer5) => {
              $$renderer5.push(`All`);
            });
            $$renderer4.option({ value: "info" }, ($$renderer5) => {
              $$renderer5.push(`info`);
            });
            $$renderer4.option({ value: "warn" }, ($$renderer5) => {
              $$renderer5.push(`warn`);
            });
            $$renderer4.option({ value: "error" }, ($$renderer5) => {
              $$renderer5.push(`error`);
            });
            $$renderer4.option({ value: "critical" }, ($$renderer5) => {
              $$renderer5.push(`critical`);
            });
          },
          "svelte-j3rly1"
        );
        $$renderer3.push(`</label> <label class="field svelte-j3rly1"><span class="svelte-j3rly1">From</span> <input type="date"${attr("value", filters.from)} data-testid="audit-from-filter" class="svelte-j3rly1"/></label> <label class="field svelte-j3rly1"><span class="svelte-j3rly1">To</span> <input type="date"${attr("value", filters.to)} data-testid="audit-to-filter" class="svelte-j3rly1"/></label></div> <div class="flex flex-wrap items-center gap-2"><button class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700" data-testid="audit-apply-filters">Apply Filters</button> <button class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">Auth Events</button> <button class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">Billing Changes</button> <button class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">Security Actions</button></div></div>`);
      }
    });
    $$renderer2.push(`<!----> `);
    SectionCard($$renderer2, {
      title: "Events",
      description: "Click any row to inspect full metadata and context.",
      children: ($$renderer3) => {
        $$renderer3.push(`<div class="space-y-3"><div class="overflow-x-auto"><table class="min-w-full text-sm"><thead><tr class="border-b border-gray-200 text-left text-gray-500"><th class="px-2 py-2">Time</th><th class="px-2 py-2">Severity</th><th class="px-2 py-2">Action</th><th class="px-2 py-2">Resource</th><th class="px-2 py-2">Actor</th></tr></thead><tbody>`);
        if (events.length === 0) {
          $$renderer3.push("<!--[1-->");
          $$renderer3.push(`<tr><td class="px-2 py-4 text-gray-500" colspan="5">`);
          EmptyState($$renderer3, {
            title: "No matching events",
            message: "Try widening the time range or clearing one of the filters."
          });
          $$renderer3.push(`<!----></td></tr>`);
        } else {
          $$renderer3.push("<!--[-1-->");
          $$renderer3.push(`<!--[-->`);
          const each_array = ensure_array_like(events);
          for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
            let event = each_array[$$index];
            $$renderer3.push(`<tr class="cursor-pointer border-b border-gray-100 hover:bg-gray-50"${attr("data-testid", `audit-event-${event.id}`)}><td class="px-2 py-2 text-gray-500">${escape_html(formatDateTime(event.created_at))}</td><td class="px-2 py-2">`);
            StatusBadge($$renderer3, { status: String(event.severity ?? "info") });
            $$renderer3.push(`<!----></td><td class="px-2 py-2 font-medium">${escape_html(event.action)}</td><td class="px-2 py-2">${escape_html(event.resource_type)}</td><td class="px-2 py-2">${escape_html(event.actor_email || event.actor_user_id || "-")}</td></tr>`);
          }
          $$renderer3.push(`<!--]-->`);
        }
        $$renderer3.push(`<!--]--></tbody></table></div> <div class="flex items-center justify-between"><p class="text-xs text-gray-500">Page ${escape_html(pagination.page)} of ${escape_html(pages())}</p> <div class="flex gap-2"><button class="rounded border px-3 py-1 text-xs"${attr("disabled", !hasPrev(), true)} data-testid="audit-prev-page">Previous</button> <button class="rounded border px-3 py-1 text-xs"${attr("disabled", !hasNext(), true)} data-testid="audit-next-page">Next</button></div></div></div>`);
      }
    });
    $$renderer2.push(`<!----></div> `);
    SlideOver($$renderer2, {
      open: detailOpen,
      title: "Audit Event Details",
      onclose: () => detailOpen = false,
      children: ($$renderer3) => {
        {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]-->`);
      }
    });
    $$renderer2.push(`<!---->`);
  });
}
export {
  _page as default
};
