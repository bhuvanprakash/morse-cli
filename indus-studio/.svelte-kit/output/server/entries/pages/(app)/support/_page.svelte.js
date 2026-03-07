import { h as derived, b as attr, d as ensure_array_like, a as attr_class, e as escape_html } from "../../../../chunks/index2.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
import { a as auth } from "../../../../chunks/auth.js";
import "../../../../chunks/toast.js";
import "../../../../chunks/confirm.js";
import { P as PageHeader } from "../../../../chunks/PageHeader.js";
import { S as SectionCard } from "../../../../chunks/SectionCard.js";
import { E as EmptyState } from "../../../../chunks/EmptyState.js";
import { E as ErrorState } from "../../../../chunks/ErrorState.js";
import { F as FormField, a as FormActions } from "../../../../chunks/FormActions.js";
import { S as StatusBadge } from "../../../../chunks/StatusBadge.js";
import { f as formatDateTime } from "../../../../chunks/format.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let loading = false;
    let userQuery = "";
    let projectQuery = "";
    let users = [];
    let projects = [];
    let notes = [];
    let selectedUser = null;
    let selectedProject = null;
    let noteSeverity = "medium";
    let noteText = "";
    let impersonationReason = "";
    let impersonationDuration = 15;
    const isAdmin = derived(() => {
      const role = String(auth.user?.role ?? "").toLowerCase();
      return role === "admin" || role === "owner";
    });
    $$renderer2.push(`<div class="space-y-6" data-testid="support-page">`);
    {
      let actions = function($$renderer3) {
        $$renderer3.push(`<button class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">Clear Selection</button> <button class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"${attr("disabled", true, true)}>Export Packet</button>`);
      };
      PageHeader($$renderer2, {
        title: "Support Console",
        description: "Enterprise operator tooling for user/project diagnostics, notes, and controlled impersonation requests.",
        actions
      });
    }
    $$renderer2.push(`<!----> `);
    if (!isAdmin()) {
      $$renderer2.push("<!--[0-->");
      ErrorState($$renderer2, {
        title: "Unauthorized",
        message: "Only admin/owner users can access support tooling."
      });
    } else {
      $$renderer2.push("<!--[-1-->");
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <div class="grid gap-6 lg:grid-cols-2">`);
      SectionCard($$renderer2, {
        title: "Search Users",
        description: "Search by email, phone, or user UUID.",
        children: ($$renderer3) => {
          $$renderer3.push(`<input class="input svelte-1lnbxlt"${attr("value", userQuery)} placeholder="email / phone / user_id" data-testid="support-user-search"/> <div class="mt-3 max-h-72 space-y-2 overflow-auto">`);
          if (users.length === 0) {
            $$renderer3.push("<!--[1-->");
            EmptyState($$renderer3, { title: "No users", message: "Start typing to search users." });
          } else {
            $$renderer3.push("<!--[-1-->");
            $$renderer3.push(`<!--[-->`);
            const each_array = ensure_array_like(users);
            for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
              let user = each_array[$$index];
              $$renderer3.push(`<button${attr_class(`w-full rounded-lg border px-3 py-2 text-left hover:border-orange-300 hover:bg-orange-50 ${selectedUser?.id === user.id ? "border-orange-400 bg-orange-50" : "border-gray-200"}`, "svelte-1lnbxlt")}><div class="flex items-center justify-between gap-2"><div><p class="text-sm font-medium text-gray-900">${escape_html(user.email || user.phone || user.id)}</p> <p class="text-xs text-gray-500">${escape_html(user.id)}</p></div> `);
              StatusBadge($$renderer3, { status: user.status || "active" });
              $$renderer3.push(`<!----></div></button>`);
            }
            $$renderer3.push(`<!--]-->`);
          }
          $$renderer3.push(`<!--]--></div>`);
        }
      });
      $$renderer2.push(`<!----> `);
      SectionCard($$renderer2, {
        title: "Search Projects",
        description: "Search by slug, name, or project UUID.",
        children: ($$renderer3) => {
          $$renderer3.push(`<input class="input svelte-1lnbxlt"${attr("value", projectQuery)} placeholder="slug / project_id" data-testid="support-project-search"/> <div class="mt-3 max-h-72 space-y-2 overflow-auto">`);
          if (projects.length === 0) {
            $$renderer3.push("<!--[1-->");
            EmptyState($$renderer3, {
              title: "No projects",
              message: "Start typing to search projects."
            });
          } else {
            $$renderer3.push("<!--[-1-->");
            $$renderer3.push(`<!--[-->`);
            const each_array_1 = ensure_array_like(projects);
            for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
              let project = each_array_1[$$index_1];
              $$renderer3.push(`<button${attr_class(`w-full rounded-lg border px-3 py-2 text-left hover:border-orange-300 hover:bg-orange-50 ${selectedProject?.id === project.id ? "border-orange-400 bg-orange-50" : "border-gray-200"}`, "svelte-1lnbxlt")}><div class="flex items-center justify-between gap-2"><div><p class="text-sm font-medium text-gray-900">${escape_html(project.name)} (${escape_html(project.slug)})</p> <p class="text-xs text-gray-500">${escape_html(project.id)}</p></div> `);
              StatusBadge($$renderer3, { status: project.status || "active" });
              $$renderer3.push(`<!----></div></button>`);
            }
            $$renderer3.push(`<!--]-->`);
          }
          $$renderer3.push(`<!--]--></div>`);
        }
      });
      $$renderer2.push(`<!----></div> <div class="grid gap-6 lg:grid-cols-3">`);
      SectionCard($$renderer2, {
        title: "Context Snapshot",
        description: "Live support context from auth, queue, notify, and platform datasets.",
        children: ($$renderer3) => {
          {
            $$renderer3.push("<!--[1-->");
            EmptyState($$renderer3, {
              title: "No context loaded",
              message: "Select a user or project to inspect support context."
            });
          }
          $$renderer3.push(`<!--]-->`);
        }
      });
      $$renderer2.push(`<!----> `);
      SectionCard($$renderer2, {
        title: "Support Notes",
        description: "Create and review operator notes with severity tagging.",
        children: ($$renderer3) => {
          $$renderer3.push(`<div class="space-y-2">`);
          {
            let children = function($$renderer4) {
              $$renderer4.select(
                { class: "input", value: noteSeverity },
                ($$renderer5) => {
                  $$renderer5.option({ value: "low" }, ($$renderer6) => {
                    $$renderer6.push(`low`);
                  });
                  $$renderer5.option({ value: "medium" }, ($$renderer6) => {
                    $$renderer6.push(`medium`);
                  });
                  $$renderer5.option({ value: "high" }, ($$renderer6) => {
                    $$renderer6.push(`high`);
                  });
                  $$renderer5.option({ value: "critical" }, ($$renderer6) => {
                    $$renderer6.push(`critical`);
                  });
                },
                "svelte-1lnbxlt"
              );
            };
            FormField($$renderer3, { label: "Severity", children });
          }
          $$renderer3.push(`<!----> `);
          {
            let children = function($$renderer4) {
              $$renderer4.push(`<textarea class="input svelte-1lnbxlt" rows="5" placeholder="Describe observed issue, actions taken, and next steps.">`);
              const $$body = escape_html(noteText);
              if ($$body) {
                $$renderer4.push(`${$$body}`);
              }
              $$renderer4.push(`</textarea>`);
            };
            FormField($$renderer3, {
              label: "Note",
              required: true,
              children
            });
          }
          $$renderer3.push(`<!----> `);
          FormActions($$renderer3, {
            children: ($$renderer4) => {
              $$renderer4.push(`<button class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700"${attr("disabled", loading, true)}>Create Note</button>`);
            },
            $$slots: { default: true }
          });
          $$renderer3.push(`<!----></div> <div class="mt-4 max-h-64 space-y-2 overflow-auto">`);
          if (notes.length === 0) {
            $$renderer3.push("<!--[0-->");
            EmptyState($$renderer3, {
              title: "No notes",
              message: "Create the first support note for this context."
            });
          } else {
            $$renderer3.push("<!--[-1-->");
            $$renderer3.push(`<!--[-->`);
            const each_array_2 = ensure_array_like(notes);
            for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
              let note = each_array_2[$$index_2];
              $$renderer3.push(`<div class="rounded-md border border-gray-200 p-3"><div class="flex items-center justify-between">`);
              StatusBadge($$renderer3, { status: note.severity });
              $$renderer3.push(`<!----> <span class="text-xs text-gray-500">${escape_html(formatDateTime(note.created_at))}</span></div> <p class="mt-2 text-sm text-gray-800">${escape_html(note.note)}</p> <p class="mt-1 text-xs text-gray-500">${escape_html(note.actor_email || "unknown actor")}</p></div>`);
            }
            $$renderer3.push(`<!--]-->`);
          }
          $$renderer3.push(`<!--]--></div>`);
        }
      });
      $$renderer2.push(`<!----> `);
      SectionCard($$renderer2, {
        title: "Impersonation Request",
        description: "Create a short-lived approval token. This does not auto-login the target user.",
        children: ($$renderer3) => {
          $$renderer3.push(`<div class="space-y-2">`);
          {
            let children = function($$renderer4) {
              $$renderer4.push(`<div class="flex items-center gap-2"><input class="input svelte-1lnbxlt"${attr("value", "")} readonly="" placeholder="Select a user first"/> `);
              {
                $$renderer4.push("<!--[-1-->");
              }
              $$renderer4.push(`<!--]--></div>`);
            };
            FormField($$renderer3, {
              label: "Target User ID",
              children
            });
          }
          $$renderer3.push(`<!----> `);
          {
            let children = function($$renderer4) {
              $$renderer4.push(`<input class="input svelte-1lnbxlt" type="number" min="5" max="60"${attr("value", impersonationDuration)}/>`);
            };
            FormField($$renderer3, {
              label: "Duration (minutes)",
              children
            });
          }
          $$renderer3.push(`<!----> `);
          {
            let children = function($$renderer4) {
              $$renderer4.push(`<textarea class="input svelte-1lnbxlt" rows="4" placeholder="Why is impersonation approval required?">`);
              const $$body_1 = escape_html(impersonationReason);
              if ($$body_1) {
                $$renderer4.push(`${$$body_1}`);
              }
              $$renderer4.push(`</textarea>`);
            };
            FormField($$renderer3, {
              label: "Reason",
              required: true,
              children
            });
          }
          $$renderer3.push(`<!----> `);
          FormActions($$renderer3, {
            children: ($$renderer4) => {
              $$renderer4.push(`<button class="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"${attr("disabled", true, true)}>Create Approval Request</button>`);
            },
            $$slots: { default: true }
          });
          $$renderer3.push(`<!----></div>`);
        }
      });
      $$renderer2.push(`<!----></div>`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
export {
  _page as default
};
