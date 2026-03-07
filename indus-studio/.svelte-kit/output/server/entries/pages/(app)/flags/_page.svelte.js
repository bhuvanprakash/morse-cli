import { e as escape_html, d as ensure_array_like, b as attr } from "../../../../chunks/index2.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
import { c as contextStore } from "../../../../chunks/context.js";
import "../../../../chunks/confirm.js";
import "../../../../chunks/toast.js";
import { s as safeJsonParse } from "../../../../chunks/json.js";
import { P as PageHeader } from "../../../../chunks/PageHeader.js";
import { S as SectionCard } from "../../../../chunks/SectionCard.js";
import { T as Tabs } from "../../../../chunks/Tabs.js";
import { S as StatusBadge } from "../../../../chunks/StatusBadge.js";
import { E as EmptyState } from "../../../../chunks/EmptyState.js";
import { J as JsonViewer } from "../../../../chunks/JsonViewer.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let tab = "flags";
    let loading = false;
    let environment = contextStore.environment || "production";
    let flags = [];
    let remoteConfigs = [];
    let evaluateInput = '{\n  "user_id": "test-user",\n  "user_properties": {\n    "city": "Mumbai"\n  }\n}';
    let evaluateOutput = "";
    const tabs = [
      { key: "flags", label: "Feature Flags" },
      { key: "remote", label: "Remote Config" }
    ];
    $$renderer2.push(`<div class="space-y-6" data-testid="flags-page">`);
    {
      let actions = function($$renderer3) {
        $$renderer3.push(`<div class="flex items-center gap-2">`);
        $$renderer3.select(
          {
            class: "rounded-md border border-gray-300 px-3 py-2 text-sm",
            value: environment
          },
          ($$renderer4) => {
            $$renderer4.option({ value: "development" }, ($$renderer5) => {
              $$renderer5.push(`development`);
            });
            $$renderer4.option({ value: "staging" }, ($$renderer5) => {
              $$renderer5.push(`staging`);
            });
            $$renderer4.option({ value: "production" }, ($$renderer5) => {
              $$renderer5.push(`production`);
            });
          },
          "svelte-1yjq02l"
        );
        $$renderer3.push(` <button class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"${attr("disabled", loading, true)}>${escape_html("Refresh")}</button></div>`);
      };
      PageHeader($$renderer2, {
        title: "Feature Flags & Remote Config",
        description: "Control progressive rollouts and environment-level runtime config.",
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
    if (tab === "flags") {
      $$renderer2.push("<!--[0-->");
      SectionCard($$renderer2, {
        title: "Feature Flags",
        description: "Create, edit, and evaluate rollout rules for the selected environment.",
        children: ($$renderer3) => {
          $$renderer3.push(`<div class="space-y-4"><div class="flex items-center justify-between"><p class="text-sm text-gray-500">${escape_html(flags.length)} flags in ${escape_html(environment)}</p> <button class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700" data-testid="flags-new-flag">New Flag</button></div> <div class="overflow-x-auto"><table class="min-w-full text-sm"><thead><tr class="border-b border-gray-200 text-left text-gray-500"><th class="px-2 py-2">Key</th><th class="px-2 py-2">Type</th><th class="px-2 py-2">Default</th><th class="px-2 py-2">Rules</th><th class="px-2 py-2">Active</th><th class="px-2 py-2">Actions</th></tr></thead><tbody>`);
          if (flags.length === 0) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<tr><td class="px-2 py-4 text-gray-500" colspan="6">`);
            EmptyState($$renderer3, {
              title: "No flags found",
              message: "Create a flag to start progressive rollout control for this environment."
            });
            $$renderer3.push(`<!----></td></tr>`);
          } else {
            $$renderer3.push("<!--[-1-->");
            $$renderer3.push(`<!--[-->`);
            const each_array = ensure_array_like(flags);
            for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
              let flag = each_array[$$index];
              $$renderer3.push(`<tr class="border-b border-gray-100"${attr("data-testid", `flag-row-${flag.key}`)}><td class="px-2 py-2 font-medium">${escape_html(flag.key)}</td><td class="px-2 py-2">${escape_html(flag.value_type)}</td><td class="px-2 py-2">${escape_html(String(flag.default_value))}</td><td class="px-2 py-2">${escape_html(Array.isArray(flag.targeting_rules) ? flag.targeting_rules.length : 0)}</td><td class="px-2 py-2">`);
              StatusBadge($$renderer3, { status: flag.is_active ? "active" : "inactive" });
              $$renderer3.push(`<!----></td><td class="px-2 py-2"><div class="flex gap-2"><button class="rounded border px-2 py-1 text-xs">Edit</button> <button class="rounded border px-2 py-1 text-xs">${escape_html(flag.is_active ? "Disable" : "Enable")}</button> <button class="rounded border border-red-300 px-2 py-1 text-xs text-red-700">Delete</button></div></td></tr>`);
            }
            $$renderer3.push(`<!--]-->`);
          }
          $$renderer3.push(`<!--]--></tbody></table></div> <div class="rounded-md border border-gray-200 bg-gray-50 p-3"><div class="mb-2 flex items-center justify-between"><h3 class="text-sm font-semibold">Evaluation Preview</h3> <button class="rounded border px-2 py-1 text-xs" data-testid="flags-evaluate-preview">Evaluate</button></div> <textarea class="w-full svelte-1yjq02l" rows="6">`);
          const $$body = escape_html(evaluateInput);
          if ($$body) {
            $$renderer3.push(`${$$body}`);
          }
          $$renderer3.push(`</textarea> <div class="mt-2">`);
          JsonViewer($$renderer3, {
            value: safeJsonParse(evaluateOutput, "Run evaluation to preview resolved flag values."),
            maxHeight: "14rem"
          });
          $$renderer3.push(`<!----></div></div></div>`);
        }
      });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (tab === "remote") {
      $$renderer2.push("<!--[0-->");
      SectionCard($$renderer2, {
        title: "Remote Config",
        description: "Manage runtime config and secret-backed values per environment.",
        children: ($$renderer3) => {
          $$renderer3.push(`<div class="space-y-4"><div class="flex items-center justify-between"><p class="text-sm text-gray-500">${escape_html(remoteConfigs.length)} keys in ${escape_html(environment)}</p> <div class="flex gap-2"><button class="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">Export .env</button> <button class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700">Add Config</button></div></div> <div class="overflow-x-auto"><table class="min-w-full text-sm"><thead><tr class="border-b border-gray-200 text-left text-gray-500"><th class="px-2 py-2">Key</th><th class="px-2 py-2">Value</th><th class="px-2 py-2">Type</th><th class="px-2 py-2">Secret</th><th class="px-2 py-2">Actions</th></tr></thead><tbody>`);
          if (remoteConfigs.length === 0) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<tr><td class="px-2 py-4 text-gray-500" colspan="5">`);
            EmptyState($$renderer3, {
              title: "No remote config entries",
              message: "Create environment config values to control runtime behavior without redeploying."
            });
            $$renderer3.push(`<!----></td></tr>`);
          } else {
            $$renderer3.push("<!--[-1-->");
            $$renderer3.push(`<!--[-->`);
            const each_array_1 = ensure_array_like(remoteConfigs);
            for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
              let entry = each_array_1[$$index_1];
              $$renderer3.push(`<tr class="border-b border-gray-100"><td class="px-2 py-2 font-medium">${escape_html(entry.key)}</td><td class="px-2 py-2 font-mono text-xs">${escape_html(entry.value)}</td><td class="px-2 py-2">${escape_html(entry.value_type)}</td><td class="px-2 py-2">`);
              StatusBadge($$renderer3, { status: entry.is_secret ? "secret" : "public" });
              $$renderer3.push(`<!----></td><td class="px-2 py-2"><div class="flex gap-2"><button class="rounded border px-2 py-1 text-xs">Copy</button> <button class="rounded border px-2 py-1 text-xs">Edit</button> <button class="rounded border border-red-300 px-2 py-1 text-xs text-red-700">Delete</button></div></td></tr>`);
            }
            $$renderer3.push(`<!--]-->`);
          }
          $$renderer3.push(`<!--]--></tbody></table></div></div>`);
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
