import { h as derived, b as attr, d as ensure_array_like, e as escape_html } from "../../../../chunks/index2.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
import "../../../../chunks/confirm.js";
import "../../../../chunks/toast.js";
import { a as auth } from "../../../../chunks/auth.js";
import { c as formatDate } from "../../../../chunks/format.js";
import { P as PageHeader } from "../../../../chunks/PageHeader.js";
import { S as SectionCard } from "../../../../chunks/SectionCard.js";
import { S as StatusBadge } from "../../../../chunks/StatusBadge.js";
import { a as getDocsUrl } from "../../../../chunks/urls.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let loading = false;
    let settings = {
      public_status_text: "All systems operational",
      security_contact_email: "security@indusbase.com",
      faq: []
    };
    let subprocessors = [];
    let milestones = [];
    let publicIncidents = [];
    let subForm = {
      name: "",
      purpose: "",
      region: "ap-south-1",
      website: "",
      data_types: "logs,metrics"
    };
    let milestoneForm = { framework: "", target_date: "", status: "planned", notes: "" };
    let incidentForm = {
      title: "",
      summary: "",
      severity: "info",
      impact: "",
      postmortem_url: ""
    };
    const canManage = derived(() => {
      const role = String(auth.user?.role ?? "").toLowerCase();
      return role === "admin" || role === "owner";
    });
    $$renderer2.push(`<div class="space-y-6">`);
    {
      let actions = function($$renderer3) {
        $$renderer3.push(`<div class="flex gap-2"><a class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50" href="/audit?action=update_trust_center" target="_self">Audit Links</a> <a class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"${attr("href", getDocsUrl("/trust-center"))} target="_blank" rel="noreferrer">Preview Public Page</a> <button class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"${attr("disabled", loading, true)}>${escape_html("Refresh")}</button></div>`);
      };
      PageHeader($$renderer2, {
        title: "Trust Center",
        description: "Manage public security posture, compliance roadmap, subprocessors, and incident transparency.",
        actions
      });
    }
    $$renderer2.push(`<!----> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (!canManage()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Read-only mode enabled. Admin/owner role required for edits and publishing actions.</div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    SectionCard($$renderer2, {
      title: "Public Settings",
      description: "Control top-level trust center text and security contact information.",
      children: ($$renderer3) => {
        $$renderer3.push(`<div class="space-y-3"><label class="field svelte-1ucivw0"><span class="svelte-1ucivw0">Public Status Text</span> <input${attr("value", settings.public_status_text)} class="svelte-1ucivw0"/></label> <label class="field svelte-1ucivw0"><span class="svelte-1ucivw0">Security Contact Email</span> <input${attr("value", settings.security_contact_email)} class="svelte-1ucivw0"/></label> <div class="rounded border border-gray-200 p-3"><div class="mb-2 flex items-center justify-between"><p class="text-sm font-semibold">Security FAQ</p> <button class="rounded border px-2 py-1 text-xs">Add FAQ</button></div> <div class="space-y-2">`);
        if (settings.faq.length === 0) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<p class="text-xs text-gray-500">No FAQ entries added yet.</p>`);
        } else {
          $$renderer3.push("<!--[-1-->");
          $$renderer3.push(`<!--[-->`);
          const each_array = ensure_array_like(settings.faq);
          for (let idx = 0, $$length = each_array.length; idx < $$length; idx++) {
            each_array[idx];
            $$renderer3.push(`<div class="grid gap-2 md:grid-cols-[1fr,2fr,auto]"><input${attr("value", settings.faq[idx].q)} placeholder="Question" class="svelte-1ucivw0"/> <input${attr("value", settings.faq[idx].a)} placeholder="Answer" class="svelte-1ucivw0"/> <button class="rounded border border-red-300 px-2 py-1 text-xs text-red-700">Remove</button></div>`);
          }
          $$renderer3.push(`<!--]-->`);
        }
        $$renderer3.push(`<!--]--></div></div> <div class="flex justify-end"><button class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700">Save / Publish</button></div></div>`);
      }
    });
    $$renderer2.push(`<!----> `);
    SectionCard($$renderer2, {
      title: "Subprocessors",
      description: "Maintain vendor transparency for customer due diligence.",
      children: ($$renderer3) => {
        $$renderer3.push(`<div class="space-y-3"><div class="grid gap-2 md:grid-cols-5"><input${attr("value", subForm.name)} placeholder="Name" class="svelte-1ucivw0"/> <input${attr("value", subForm.purpose)} placeholder="Purpose" class="svelte-1ucivw0"/> <input${attr("value", subForm.region)} placeholder="Region (ap-south-1)" class="svelte-1ucivw0"/> <input${attr("value", subForm.website)} placeholder="Website" class="svelte-1ucivw0"/> <input${attr("value", subForm.data_types)} placeholder="Data types (comma separated)" class="svelte-1ucivw0"/></div> <div class="flex justify-end"><button class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700">Add Subprocessor</button></div> <div class="overflow-x-auto"><table class="min-w-full text-sm"><thead><tr class="border-b border-gray-200 text-left text-gray-500"><th class="px-2 py-2">Name</th><th class="px-2 py-2">Purpose</th><th class="px-2 py-2">Region</th><th class="px-2 py-2">Data Types</th><th class="px-2 py-2">Status</th><th class="px-2 py-2">Actions</th></tr></thead><tbody>`);
        if (subprocessors.length === 0) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<tr><td class="px-2 py-4 text-gray-500" colspan="6">No subprocessors configured.</td></tr>`);
        } else {
          $$renderer3.push("<!--[-1-->");
          $$renderer3.push(`<!--[-->`);
          const each_array_1 = ensure_array_like(subprocessors);
          for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
            let sub = each_array_1[$$index_1];
            $$renderer3.push(`<tr class="border-b border-gray-100"><td class="px-2 py-2">${escape_html(sub.name)}</td><td class="px-2 py-2">${escape_html(sub.purpose)}</td><td class="px-2 py-2">${escape_html(sub.region)}</td><td class="px-2 py-2 text-xs">${escape_html(Array.isArray(sub.data_types) ? sub.data_types.join(", ") : "-")}</td><td class="px-2 py-2">`);
            StatusBadge($$renderer3, { status: sub.is_active ? "active" : "inactive" });
            $$renderer3.push(`<!----></td><td class="px-2 py-2"><button class="rounded border border-red-300 px-2 py-1 text-xs text-red-700">Delete</button></td></tr>`);
          }
          $$renderer3.push(`<!--]-->`);
        }
        $$renderer3.push(`<!--]--></tbody></table></div></div>`);
      }
    });
    $$renderer2.push(`<!----> `);
    SectionCard($$renderer2, {
      title: "Compliance Milestones",
      description: "Track roadmap commitments like SOC2 and ISO27001.",
      children: ($$renderer3) => {
        $$renderer3.push(`<div class="space-y-3"><div class="grid gap-2 md:grid-cols-4"><input${attr("value", milestoneForm.framework)} placeholder="Framework (SOC 2 Type II)" class="svelte-1ucivw0"/> <input type="date"${attr("value", milestoneForm.target_date)} class="svelte-1ucivw0"/> <input${attr("value", milestoneForm.status)} placeholder="Status (planned/in_progress/done)" class="svelte-1ucivw0"/> <input${attr("value", milestoneForm.notes)} placeholder="Notes" class="svelte-1ucivw0"/></div> <div class="flex justify-end"><button class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700">Add Milestone</button></div> <div class="overflow-x-auto"><table class="min-w-full text-sm"><thead><tr class="border-b border-gray-200 text-left text-gray-500"><th class="px-2 py-2">Framework</th><th class="px-2 py-2">Target Date</th><th class="px-2 py-2">Status</th><th class="px-2 py-2">Notes</th><th class="px-2 py-2">Actions</th></tr></thead><tbody>`);
        if (milestones.length === 0) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<tr><td class="px-2 py-4 text-gray-500" colspan="5">No milestones yet.</td></tr>`);
        } else {
          $$renderer3.push("<!--[-1-->");
          $$renderer3.push(`<!--[-->`);
          const each_array_2 = ensure_array_like(milestones);
          for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
            let row = each_array_2[$$index_2];
            $$renderer3.push(`<tr class="border-b border-gray-100"><td class="px-2 py-2">${escape_html(row.framework)}</td><td class="px-2 py-2">${escape_html(formatDate(row.target_date))}</td><td class="px-2 py-2">`);
            StatusBadge($$renderer3, { status: row.status || "planned" });
            $$renderer3.push(`<!----></td><td class="px-2 py-2 text-xs">${escape_html(row.notes || "-")}</td><td class="px-2 py-2"><button class="rounded border border-red-300 px-2 py-1 text-xs text-red-700">Delete</button></td></tr>`);
          }
          $$renderer3.push(`<!--]-->`);
        }
        $$renderer3.push(`<!--]--></tbody></table></div></div>`);
      }
    });
    $$renderer2.push(`<!----> `);
    SectionCard($$renderer2, {
      title: "Public Incident Postmortems",
      description: "Publish customer-facing incident summaries and postmortem links.",
      children: ($$renderer3) => {
        $$renderer3.push(`<div class="space-y-3"><div class="grid gap-2 md:grid-cols-5"><input${attr("value", incidentForm.title)} placeholder="Incident title" class="svelte-1ucivw0"/> <input${attr("value", incidentForm.summary)} placeholder="Summary" class="svelte-1ucivw0"/> <input${attr("value", incidentForm.severity)} placeholder="Severity" class="svelte-1ucivw0"/> <input${attr("value", incidentForm.impact)} placeholder="Impact" class="svelte-1ucivw0"/> <input${attr("value", incidentForm.postmortem_url)} placeholder="Postmortem URL" class="svelte-1ucivw0"/></div> <div class="flex justify-end"><button class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700">Add Public Incident</button></div> <div class="overflow-x-auto"><table class="min-w-full text-sm"><thead><tr class="border-b border-gray-200 text-left text-gray-500"><th class="px-2 py-2">Title</th><th class="px-2 py-2">Severity</th><th class="px-2 py-2">Status</th><th class="px-2 py-2">Postmortem</th><th class="px-2 py-2">Actions</th></tr></thead><tbody>`);
        if (publicIncidents.length === 0) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<tr><td class="px-2 py-4 text-gray-500" colspan="5">No public incidents published.</td></tr>`);
        } else {
          $$renderer3.push("<!--[-1-->");
          $$renderer3.push(`<!--[-->`);
          const each_array_3 = ensure_array_like(publicIncidents);
          for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
            let row = each_array_3[$$index_3];
            $$renderer3.push(`<tr class="border-b border-gray-100"><td class="px-2 py-2">${escape_html(row.title)}</td><td class="px-2 py-2">`);
            StatusBadge($$renderer3, { status: row.severity || "info" });
            $$renderer3.push(`<!----></td><td class="px-2 py-2">`);
            StatusBadge($$renderer3, { status: row.status || "investigating" });
            $$renderer3.push(`<!----></td><td class="px-2 py-2 text-xs"><a${attr("href", row.postmortem_url)} target="_blank" rel="noreferrer" class="text-orange-600 hover:underline">${escape_html(row.postmortem_url || "-")}</a></td><td class="px-2 py-2"><button class="rounded border border-red-300 px-2 py-1 text-xs text-red-700">Delete</button></td></tr>`);
          }
          $$renderer3.push(`<!--]-->`);
        }
        $$renderer3.push(`<!--]--></tbody></table></div></div>`);
      }
    });
    $$renderer2.push(`<!----></div>`);
  });
}
export {
  _page as default
};
