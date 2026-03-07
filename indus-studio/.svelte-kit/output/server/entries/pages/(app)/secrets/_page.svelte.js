import { b as attr, d as ensure_array_like, e as escape_html } from "../../../../chunks/index2.js";
import { s as studioApi } from "../../../../chunks/studio.js";
import { c as contextStore } from "../../../../chunks/context.js";
import "../../../../chunks/confirm.js";
import { a as toastStore } from "../../../../chunks/toast.js";
import { f as formatDateTime } from "../../../../chunks/format.js";
import { P as PageHeader } from "../../../../chunks/PageHeader.js";
import { S as SectionCard } from "../../../../chunks/SectionCard.js";
import { S as StatusBadge } from "../../../../chunks/StatusBadge.js";
import { S as SlideOver } from "../../../../chunks/SlideOver.js";
import { E as EmptyState } from "../../../../chunks/EmptyState.js";
import { E as ErrorState } from "../../../../chunks/ErrorState.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let loading = false;
    let error = "";
    let filters = { scope: "", project_id: "" };
    let secrets = [];
    let versionsOpen = false;
    let createForm = {
      name: "",
      scope: "project",
      organization_id: "",
      project_id: "",
      function_id: "",
      description: "",
      value: ""
    };
    const scopeOptions = ["platform", "organization", "project", "function"];
    async function loadSecrets() {
      loading = true;
      error = "";
      try {
        secrets = await studioApi.listSecrets({
          scope: filters.scope || void 0,
          project_id: filters.project_id || contextStore.activeProjectId || void 0
        }) ?? [];
      } catch (err) {
        error = err instanceof Error ? err.message : "Failed to load secrets";
        toastStore.error(error);
      } finally {
        loading = false;
      }
    }
    $$renderer2.push(`<div class="space-y-6" data-testid="secrets-page">`);
    {
      let actions = function($$renderer3) {
        $$renderer3.push(`<div class="flex gap-2"><a class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50" href="/audit?action=rotate_secret">Audit Logs</a> <button class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"${attr("disabled", loading, true)}>${escape_html(loading ? "Refreshing..." : "Refresh")}</button></div>`);
      };
      PageHeader($$renderer2, {
        title: "Secrets Manager",
        description: "Encrypted and versioned secrets with rotation and rollback controls.",
        actions
      });
    }
    $$renderer2.push(`<!----> `);
    if (error) {
      $$renderer2.push("<!--[0-->");
      ErrorState($$renderer2, { message: error, onRetry: loadSecrets });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    SectionCard($$renderer2, {
      title: "Create Secret",
      description: "Secrets are encrypted at rest. Raw values are returned only once on creation.",
      children: ($$renderer3) => {
        $$renderer3.push(`<div class="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Choose the narrowest scope possible. Project and function scopes are safer than platform-wide values for routine workloads.</div> <div class="grid gap-3 md:grid-cols-2"><label class="field svelte-1wioim3"><span class="svelte-1wioim3">Name</span> <input${attr("value", createForm.name)} placeholder="PAYMENT_GATEWAY_KEY" data-testid="secret-name-input" class="svelte-1wioim3"/></label> <label class="field svelte-1wioim3"><span class="svelte-1wioim3">Scope</span> `);
        $$renderer3.select(
          { value: createForm.scope, class: "" },
          ($$renderer4) => {
            $$renderer4.push(`<!--[-->`);
            const each_array = ensure_array_like(scopeOptions);
            for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
              let scope = each_array[$$index];
              $$renderer4.option({ value: scope }, ($$renderer5) => {
                $$renderer5.push(`${escape_html(scope)}`);
              });
            }
            $$renderer4.push(`<!--]-->`);
          },
          "svelte-1wioim3"
        );
        $$renderer3.push(`</label> <label class="field svelte-1wioim3"><span class="svelte-1wioim3">Organization ID (optional)</span> <input${attr("value", createForm.organization_id)} placeholder="org-uuid" class="svelte-1wioim3"/></label> <label class="field svelte-1wioim3"><span class="svelte-1wioim3">Project ID (optional)</span> <input${attr("value", createForm.project_id)} placeholder="project-uuid" class="svelte-1wioim3"/></label> <label class="field svelte-1wioim3"><span class="svelte-1wioim3">Function ID (optional)</span> <input${attr("value", createForm.function_id)} placeholder="function-uuid" class="svelte-1wioim3"/></label> <label class="field svelte-1wioim3"><span class="svelte-1wioim3">Description</span> <input${attr("value", createForm.description)} placeholder="Used for Razorpay production API" class="svelte-1wioim3"/></label> <label class="field md:col-span-2 svelte-1wioim3"><span class="svelte-1wioim3">Secret Value</span> <input type="password"${attr("value", createForm.value)} placeholder="paste secret value" data-testid="secret-value-input" class="svelte-1wioim3"/></label></div> <div class="mt-3 flex justify-end"><button class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700" data-testid="create-secret-submit">Create Secret</button></div>`);
      }
    });
    $$renderer2.push(`<!----> `);
    SectionCard($$renderer2, {
      title: "Secrets",
      description: "Filter by scope and inspect version metadata without exposing raw values.",
      children: ($$renderer3) => {
        $$renderer3.push(`<div class="space-y-3"><div class="grid gap-3 md:grid-cols-3"><label class="field svelte-1wioim3"><span class="svelte-1wioim3">Scope</span> `);
        $$renderer3.select(
          { value: filters.scope, onchange: loadSecrets, class: "" },
          ($$renderer4) => {
            $$renderer4.option({ value: "" }, ($$renderer5) => {
              $$renderer5.push(`All scopes`);
            });
            $$renderer4.push(`<!--[-->`);
            const each_array_1 = ensure_array_like(scopeOptions);
            for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
              let scope = each_array_1[$$index_1];
              $$renderer4.option({ value: scope }, ($$renderer5) => {
                $$renderer5.push(`${escape_html(scope)}`);
              });
            }
            $$renderer4.push(`<!--]-->`);
          },
          "svelte-1wioim3"
        );
        $$renderer3.push(`</label> <label class="field svelte-1wioim3"><span class="svelte-1wioim3">Project ID</span> <input${attr("value", filters.project_id)} placeholder="project-uuid" class="svelte-1wioim3"/></label></div> <div class="overflow-x-auto"><table class="min-w-full text-sm"><thead><tr class="border-b border-gray-200 text-left text-gray-500"><th class="px-2 py-2">Name</th><th class="px-2 py-2">Scope</th><th class="px-2 py-2">Active Version</th><th class="px-2 py-2">Updated</th><th class="px-2 py-2">Actions</th></tr></thead><tbody>`);
        if (loading) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<tr><td class="px-2 py-4 text-gray-500" colspan="5">Loading secrets...</td></tr>`);
        } else if (secrets.length === 0) {
          $$renderer3.push("<!--[1-->");
          $$renderer3.push(`<tr><td class="px-2 py-4 text-gray-500" colspan="5">`);
          EmptyState($$renderer3, {
            title: "No secrets found",
            message: "Create the first secret for this scope to enable secure runtime configuration."
          });
          $$renderer3.push(`<!----></td></tr>`);
        } else {
          $$renderer3.push("<!--[-1-->");
          $$renderer3.push(`<!--[-->`);
          const each_array_2 = ensure_array_like(secrets);
          for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
            let secret = each_array_2[$$index_2];
            $$renderer3.push(`<tr class="border-b border-gray-100"${attr("data-testid", `secret-row-${secret.name}`)}><td class="px-2 py-2 font-mono text-xs">${escape_html(secret.name)}</td><td class="px-2 py-2">`);
            StatusBadge($$renderer3, { status: secret.scope });
            $$renderer3.push(`<!----></td><td class="px-2 py-2">v${escape_html(secret.active_version)}</td><td class="px-2 py-2 text-gray-500">${escape_html(formatDateTime(secret.updated_at))}</td><td class="px-2 py-2"><div class="flex gap-2"><button class="rounded border px-2 py-1 text-xs">Copy Name</button> <button class="rounded border px-2 py-1 text-xs">Versions</button></div></td></tr>`);
          }
          $$renderer3.push(`<!--]-->`);
        }
        $$renderer3.push(`<!--]--></tbody></table></div></div>`);
      }
    });
    $$renderer2.push(`<!----></div> `);
    SlideOver($$renderer2, {
      open: versionsOpen,
      title: "Secret Versions",
      onclose: () => versionsOpen = false,
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
