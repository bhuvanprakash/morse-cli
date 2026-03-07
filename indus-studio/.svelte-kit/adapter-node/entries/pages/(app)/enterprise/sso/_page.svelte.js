import { e as escape_html, d as ensure_array_like, b as attr } from "../../../../../chunks/index2.js";
import "@sveltejs/kit/internal";
import "../../../../../chunks/exports.js";
import "../../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../../chunks/root.js";
import "../../../../../chunks/state.svelte.js";
import { c as contextStore } from "../../../../../chunks/context.js";
import "../../../../../chunks/confirm.js";
import "../../../../../chunks/toast.js";
import { f as formatDateTime } from "../../../../../chunks/format.js";
import { p as prettyJson } from "../../../../../chunks/json.js";
import { P as PageHeader } from "../../../../../chunks/PageHeader.js";
import { S as SectionCard } from "../../../../../chunks/SectionCard.js";
import { S as StatusBadge } from "../../../../../chunks/StatusBadge.js";
import { T as Tabs } from "../../../../../chunks/Tabs.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let loading = false;
    let activeTab = "domains";
    let connections = [];
    let domainRecords = [];
    let events = [];
    ({
      config_text: prettyJson({ sso_url: "", entity_id: "", acs_url: "", certificate: "" })
    });
    const tabs = [
      { key: "domains", label: "Verified Domains" },
      { key: "connections", label: "Connections" },
      { key: "events", label: "SSO Events" }
    ];
    $$renderer2.push(`<div class="space-y-6" data-testid="enterprise-sso-page">`);
    {
      let actions = function($$renderer3) {
        $$renderer3.push(`<button class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"${attr("disabled", loading, true)} data-testid="enterprise-sso-refresh">${escape_html("Refresh")}</button>`);
      };
      PageHeader($$renderer2, {
        title: "Enterprise SSO & SCIM",
        description: "Configure domain verification, SAML/OIDC enterprise login, and SCIM provisioning.",
        actions
      });
    }
    $$renderer2.push(`<!----> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    Tabs($$renderer2, { tabs, active: activeTab, onChange: (key) => activeTab = key });
    $$renderer2.push(`<!----> `);
    if (activeTab === "domains") {
      $$renderer2.push("<!--[0-->");
      SectionCard($$renderer2, {
        title: "Verified Domains",
        description: "Map enterprise domains to organizations/projects before enabling SSO.",
        children: ($$renderer3) => {
          $$renderer3.push(`<div class="space-y-4"><div class="flex items-center justify-between"><p class="text-sm text-gray-500">${escape_html(domainRecords.length)} domain entries</p> <button class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700" data-testid="enterprise-domain-open">Add / Verify Domain</button></div> <div class="overflow-x-auto"><table class="min-w-full text-sm"><thead><tr class="border-b border-gray-200 text-left text-gray-500"><th class="px-2 py-2">Domain</th><th class="px-2 py-2">Status</th><th class="px-2 py-2">TXT Record</th><th class="px-2 py-2">Project</th></tr></thead><tbody>`);
          if (domainRecords.length === 0) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<tr><td class="px-2 py-4 text-gray-500" colspan="4">No domains configured yet.</td></tr>`);
          } else {
            $$renderer3.push("<!--[-1-->");
            $$renderer3.push(`<!--[-->`);
            const each_array = ensure_array_like(domainRecords);
            for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
              let domain = each_array[$$index];
              $$renderer3.push(`<tr class="border-b border-gray-100"><td class="px-2 py-2 font-mono">${escape_html(domain.domain)}</td><td class="px-2 py-2">`);
              StatusBadge($$renderer3, { status: domain.verified ? "verified" : "pending" });
              $$renderer3.push(`<!----></td><td class="px-2 py-2 font-mono text-xs">${escape_html(domain.txt_record || "-")}</td><td class="px-2 py-2 font-mono text-xs">${escape_html(domain.project_id || contextStore.activeProjectId || "-")}</td></tr>`);
            }
            $$renderer3.push(`<!--]-->`);
          }
          $$renderer3.push(`<!--]--></tbody></table></div></div>`);
        }
      });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (activeTab === "connections") {
      $$renderer2.push("<!--[0-->");
      SectionCard($$renderer2, {
        title: "Enterprise Connections",
        description: "Create and manage SAML/OIDC identity provider integrations.",
        children: ($$renderer3) => {
          $$renderer3.push(`<div class="space-y-4"><div class="flex items-center justify-between"><p class="text-sm text-gray-500">${escape_html(connections.length)} configured IdP connections</p> <button class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700" data-testid="enterprise-connection-open">New Connection</button></div> <div class="grid gap-3 md:grid-cols-2">`);
          if (connections.length === 0) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<div class="rounded-md border border-dashed border-gray-300 px-3 py-4 text-sm text-gray-500 md:col-span-2">No enterprise connections yet.</div>`);
          } else {
            $$renderer3.push("<!--[-1-->");
            $$renderer3.push(`<!--[-->`);
            const each_array_1 = ensure_array_like(connections);
            for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
              let conn = each_array_1[$$index_1];
              $$renderer3.push(`<div class="rounded-lg border border-gray-200 p-3"${attr("data-testid", `enterprise-connection-${conn.slug}`)}><div class="mb-2 flex items-center justify-between"><p class="font-semibold">${escape_html(conn.name)}</p> `);
              StatusBadge($$renderer3, { status: conn.provider_type });
              $$renderer3.push(`<!----></div> <p class="text-xs text-gray-500">${escape_html(conn.slug)} • ${escape_html(conn.domain)}</p> <p class="mt-1 text-xs text-gray-500">Provider: ${escape_html(conn.provider_name)}</p> <div class="mt-3 flex flex-wrap gap-2"><button class="rounded border px-2 py-1 text-xs">Open</button> <button class="rounded border px-2 py-1 text-xs">Edit</button> <button class="rounded border px-2 py-1 text-xs">${escape_html(conn.is_active ? "Disable" : "Enable")}</button> <button class="rounded border border-red-300 px-2 py-1 text-xs text-red-700">Delete</button></div></div>`);
            }
            $$renderer3.push(`<!--]-->`);
          }
          $$renderer3.push(`<!--]--></div></div>`);
        }
      });
      $$renderer2.push(`<!----> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]-->`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (activeTab === "events") {
      $$renderer2.push("<!--[0-->");
      SectionCard($$renderer2, {
        title: "Recent SSO Events",
        description: "Latest login outcomes across enterprise identity providers.",
        children: ($$renderer3) => {
          $$renderer3.push(`<div class="overflow-x-auto"><table class="min-w-full text-sm"><thead><tr class="border-b border-gray-200 text-left text-gray-500"><th class="px-2 py-2">When</th><th class="px-2 py-2">Provider</th><th class="px-2 py-2">Domain</th><th class="px-2 py-2">Email</th><th class="px-2 py-2">Status</th><th class="px-2 py-2">IP</th></tr></thead><tbody>`);
          if (events.length === 0) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<tr><td class="px-2 py-4 text-gray-500" colspan="6">No SSO events recorded yet.</td></tr>`);
          } else {
            $$renderer3.push("<!--[-1-->");
            $$renderer3.push(`<!--[-->`);
            const each_array_3 = ensure_array_like(events);
            for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
              let event = each_array_3[$$index_3];
              $$renderer3.push(`<tr class="border-b border-gray-100"><td class="px-2 py-2 text-gray-500">${escape_html(formatDateTime(event.created_at))}</td><td class="px-2 py-2">${escape_html(event.provider_type || event.provider || "-")}</td><td class="px-2 py-2">${escape_html(event.domain || "-")}</td><td class="px-2 py-2">${escape_html(event.user_email || event.email || "-")}</td><td class="px-2 py-2">`);
              StatusBadge($$renderer3, { status: event.status || "unknown" });
              $$renderer3.push(`<!----></td><td class="px-2 py-2">${escape_html(event.ip_address || "-")}</td></tr>`);
            }
            $$renderer3.push(`<!--]-->`);
          }
          $$renderer3.push(`<!--]--></tbody></table></div>`);
        }
      });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
export {
  _page as default
};
