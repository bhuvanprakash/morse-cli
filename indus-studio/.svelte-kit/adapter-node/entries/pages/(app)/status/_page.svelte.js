import { e as escape_html, h as derived, d as ensure_array_like, b as attr } from "../../../../chunks/index2.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
import "../../../../chunks/confirm.js";
import "../../../../chunks/toast.js";
import { f as formatDateTime } from "../../../../chunks/format.js";
import { P as PageHeader } from "../../../../chunks/PageHeader.js";
import { S as SectionCard } from "../../../../chunks/SectionCard.js";
import { S as StatusBadge } from "../../../../chunks/StatusBadge.js";
import { T as Tabs } from "../../../../chunks/Tabs.js";
import { a as getDocsUrl } from "../../../../chunks/urls.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let loading = false;
    let tab = "overview";
    let components = [];
    let incidents = [];
    let maintenance = [];
    let subscriberEmail = "";
    let subscriberCount = 0;
    let newIncident = {
      title: "",
      summary: "",
      severity: "minor",
      impact: "low",
      status: "investigating"
    };
    let incidentTimeline = {};
    let newMaintenance = { title: "", description: "", starts_at: "", ends_at: "" };
    const tabs = [
      { key: "overview", label: "Overview" },
      { key: "incidents", label: "Incidents" },
      { key: "maintenance", label: "Maintenance" }
    ];
    const activeIncidents = derived(() => incidents.filter((row) => String(row.status || "").toLowerCase() !== "resolved"));
    const componentHealth = derived(() => {
      const degraded = components.filter((row) => String(row.status || "").toLowerCase() !== "operational").length;
      return { total: components.length, degraded };
    });
    $$renderer2.push(`<div class="space-y-6" data-testid="status-page">`);
    {
      let actions = function($$renderer3) {
        $$renderer3.push(`<div class="flex gap-2"><a class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"${attr("href", getDocsUrl("/status"))} target="_blank" rel="noreferrer">Public Status Page</a> <button class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"${attr("disabled", loading, true)}>${escape_html("Refresh")}</button></div>`);
      };
      PageHeader($$renderer2, {
        title: "Status & Incident Ops",
        description: "Operate component health, incident timelines, maintenance windows, and public updates.",
        actions
      });
    }
    $$renderer2.push(`<!----> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    Tabs($$renderer2, { tabs, active: tab, onChange: (key) => tab = key });
    $$renderer2.push(`<!----> `);
    if (tab === "overview") {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="grid gap-4 md:grid-cols-4"><div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><p class="text-xs uppercase text-gray-500">Components</p> <p class="mt-2 text-2xl font-semibold text-gray-900">${escape_html(componentHealth().total)}</p></div> <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><p class="text-xs uppercase text-gray-500">Degraded</p> <p class="mt-2 text-2xl font-semibold text-gray-900">${escape_html(componentHealth().degraded)}</p></div> <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><p class="text-xs uppercase text-gray-500">Active Incidents</p> <p class="mt-2 text-2xl font-semibold text-gray-900">${escape_html(activeIncidents().length)}</p></div> <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><p class="text-xs uppercase text-gray-500">Subscribers</p> <p class="mt-2 text-2xl font-semibold text-gray-900">${escape_html(subscriberCount)}</p></div></div> `);
      SectionCard($$renderer2, {
        title: "Component Health Grid",
        description: "Current service availability for public status.",
        children: ($$renderer3) => {
          $$renderer3.push(`<div class="grid gap-3 md:grid-cols-3">`);
          if (components.length === 0) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<p class="text-sm text-gray-500">No component health records available.</p>`);
          } else {
            $$renderer3.push("<!--[-1-->");
            $$renderer3.push(`<!--[-->`);
            const each_array = ensure_array_like(components);
            for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
              let component = each_array[$$index];
              $$renderer3.push(`<div class="rounded-md border border-gray-200 p-3"><p class="text-sm font-semibold">${escape_html(component.name || component.slug)}</p> <div class="mt-2">`);
              StatusBadge($$renderer3, { status: component.status || "unknown" });
              $$renderer3.push(`<!----></div></div>`);
            }
            $$renderer3.push(`<!--]-->`);
          }
          $$renderer3.push(`<!--]--></div>`);
        }
      });
      $$renderer2.push(`<!---->`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (tab === "incidents") {
      $$renderer2.push("<!--[0-->");
      SectionCard($$renderer2, {
        title: "Create Incident",
        description: "Declare incidents with severity and impact for public communication.",
        children: ($$renderer3) => {
          $$renderer3.push(`<div class="grid gap-3 md:grid-cols-2"><input${attr("value", newIncident.title)} placeholder="Incident title" data-testid="incident-title-input" class="svelte-16779cy"/> `);
          $$renderer3.select(
            { value: newIncident.severity, class: "" },
            ($$renderer4) => {
              $$renderer4.option({ value: "minor" }, ($$renderer5) => {
                $$renderer5.push(`minor`);
              });
              $$renderer4.option({ value: "major" }, ($$renderer5) => {
                $$renderer5.push(`major`);
              });
              $$renderer4.option({ value: "critical" }, ($$renderer5) => {
                $$renderer5.push(`critical`);
              });
            },
            "svelte-16779cy"
          );
          $$renderer3.push(` <textarea class="md:col-span-2 svelte-16779cy" rows="3" placeholder="Summary">`);
          const $$body = escape_html(newIncident.summary);
          if ($$body) {
            $$renderer3.push(`${$$body}`);
          }
          $$renderer3.push(`</textarea> `);
          $$renderer3.select(
            { value: newIncident.impact, class: "" },
            ($$renderer4) => {
              $$renderer4.option({ value: "low" }, ($$renderer5) => {
                $$renderer5.push(`low impact`);
              });
              $$renderer4.option({ value: "medium" }, ($$renderer5) => {
                $$renderer5.push(`medium impact`);
              });
              $$renderer4.option({ value: "high" }, ($$renderer5) => {
                $$renderer5.push(`high impact`);
              });
            },
            "svelte-16779cy"
          );
          $$renderer3.push(` `);
          $$renderer3.select(
            { value: newIncident.status, class: "" },
            ($$renderer4) => {
              $$renderer4.option({ value: "investigating" }, ($$renderer5) => {
                $$renderer5.push(`investigating`);
              });
              $$renderer4.option({ value: "identified" }, ($$renderer5) => {
                $$renderer5.push(`identified`);
              });
              $$renderer4.option({ value: "monitoring" }, ($$renderer5) => {
                $$renderer5.push(`monitoring`);
              });
            },
            "svelte-16779cy"
          );
          $$renderer3.push(`</div> <div class="mt-3 flex justify-end"><button class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700" data-testid="create-incident-submit">Create Incident</button></div>`);
        }
      });
      $$renderer2.push(`<!----> `);
      SectionCard($$renderer2, {
        title: "Incident Timeline",
        description: "Append updates and resolve incidents with clear customer-visible messaging.",
        children: ($$renderer3) => {
          $$renderer3.push(`<div class="space-y-3">`);
          if (incidents.length === 0) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<p class="text-sm text-gray-500">No incidents yet.</p>`);
          } else {
            $$renderer3.push("<!--[-1-->");
            $$renderer3.push(`<!--[-->`);
            const each_array_1 = ensure_array_like(incidents);
            for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
              let incident = each_array_1[$$index_1];
              $$renderer3.push(`<div class="rounded-md border border-gray-200 p-3"><div class="flex flex-wrap items-center justify-between gap-2"><div><p class="font-semibold">${escape_html(incident.title)}</p> <p class="text-xs text-gray-500">${escape_html(formatDateTime(incident.started_at || incident.created_at))}</p></div> <div class="flex items-center gap-2">`);
              StatusBadge($$renderer3, { status: incident.severity || "minor" });
              $$renderer3.push(`<!----> `);
              StatusBadge($$renderer3, { status: incident.status || "investigating" });
              $$renderer3.push(`<!----></div></div> <p class="mt-2 text-sm text-gray-700">${escape_html(incident.summary)}</p> <div class="mt-3 grid gap-2 md:grid-cols-[1fr,auto,auto]"><input${attr("value", incidentTimeline[String(incident.id)])} placeholder="Add timeline update..." class="svelte-16779cy"/> <button class="rounded border px-3 py-2 text-xs">Add Update</button> `);
              if (String(incident.status || "").toLowerCase() !== "resolved") {
                $$renderer3.push("<!--[0-->");
                $$renderer3.push(`<button class="rounded border border-red-300 px-3 py-2 text-xs text-red-700">Resolve</button>`);
              } else {
                $$renderer3.push("<!--[-1-->");
              }
              $$renderer3.push(`<!--]--></div></div>`);
            }
            $$renderer3.push(`<!--]-->`);
          }
          $$renderer3.push(`<!--]--></div>`);
        }
      });
      $$renderer2.push(`<!---->`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (tab === "maintenance") {
      $$renderer2.push("<!--[0-->");
      SectionCard($$renderer2, {
        title: "Schedule Maintenance",
        description: "Plan maintenance windows in IST and notify subscribers.",
        children: ($$renderer3) => {
          $$renderer3.push(`<div class="grid gap-3 md:grid-cols-2"><input${attr("value", newMaintenance.title)} placeholder="Maintenance title" class="svelte-16779cy"/> <textarea rows="2" placeholder="Description" class="svelte-16779cy">`);
          const $$body_1 = escape_html(newMaintenance.description);
          if ($$body_1) {
            $$renderer3.push(`${$$body_1}`);
          }
          $$renderer3.push(`</textarea> <label class="field svelte-16779cy"><span class="svelte-16779cy">Starts At (Asia/Kolkata)</span> <input type="datetime-local"${attr("value", newMaintenance.starts_at)} class="svelte-16779cy"/></label> <label class="field svelte-16779cy"><span class="svelte-16779cy">Ends At (Asia/Kolkata)</span> <input type="datetime-local"${attr("value", newMaintenance.ends_at)} class="svelte-16779cy"/></label></div> <div class="mt-3 flex justify-end"><button class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700">Schedule</button></div>`);
        }
      });
      $$renderer2.push(`<!----> `);
      SectionCard($$renderer2, {
        title: "Maintenance Windows",
        description: "Upcoming and recent maintenance entries.",
        children: ($$renderer3) => {
          $$renderer3.push(`<div class="space-y-2">`);
          if (maintenance.length === 0) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<p class="text-sm text-gray-500">No maintenance windows scheduled.</p>`);
          } else {
            $$renderer3.push("<!--[-1-->");
            $$renderer3.push(`<!--[-->`);
            const each_array_2 = ensure_array_like(maintenance);
            for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
              let row = each_array_2[$$index_2];
              $$renderer3.push(`<div class="rounded-md border border-gray-200 p-3"><div class="flex flex-wrap items-center justify-between gap-2"><p class="font-semibold">${escape_html(row.title)}</p> `);
              StatusBadge($$renderer3, { status: row.status || "scheduled" });
              $$renderer3.push(`<!----></div> <p class="mt-1 text-sm text-gray-700">${escape_html(row.description || "-")}</p> <p class="mt-1 text-xs text-gray-500">${escape_html(formatDateTime(row.starts_at))} → ${escape_html(formatDateTime(row.ends_at))}</p></div>`);
            }
            $$renderer3.push(`<!--]-->`);
          }
          $$renderer3.push(`<!--]--></div>`);
        }
      });
      $$renderer2.push(`<!----> `);
      SectionCard($$renderer2, {
        title: "Subscribers",
        description: "Email subscribers receive incident and maintenance updates.",
        children: ($$renderer3) => {
          $$renderer3.push(`<div class="flex gap-2"><input class="w-full svelte-16779cy"${attr("value", subscriberEmail)} placeholder="ops@example.com"/> <button class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700">Add Subscriber</button></div>`);
        }
      });
      $$renderer2.push(`<!---->`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
export {
  _page as default
};
