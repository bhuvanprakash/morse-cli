import { d as ensure_array_like, e as escape_html, h as derived } from "../../../../chunks/index2.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "clsx";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
import { s as studioApi } from "../../../../chunks/studio.js";
import { a as toastStore } from "../../../../chunks/toast.js";
import { P as PageHeader } from "../../../../chunks/PageHeader.js";
import { S as SectionCard } from "../../../../chunks/SectionCard.js";
import { S as SearchInput } from "../../../../chunks/SearchInput.js";
import { E as EmptyState } from "../../../../chunks/EmptyState.js";
import { E as ErrorState } from "../../../../chunks/ErrorState.js";
import { L as LoadingSkeleton } from "../../../../chunks/LoadingSkeleton.js";
import { B as Button } from "../../../../chunks/Button.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let tables = [];
    let loading = true;
    let error = null;
    let query = "";
    const filteredTables = derived(() => {
      const q = query.trim().toLowerCase();
      if (!q) return tables;
      return tables.filter((table) => table.name.toLowerCase().includes(q));
    });
    async function loadTables() {
      loading = true;
      error = null;
      try {
        const list = await studioApi.listTables();
        tables = list.map((name) => ({ name, schema: "public" }));
      } catch (e) {
        error = e instanceof Error ? e.message : "Failed to load tables";
        toastStore.error(error);
      } finally {
        loading = false;
      }
    }
    $$renderer2.push(`<div class="space-y-6">`);
    {
      let actions = function($$renderer3) {
        Button($$renderer3, {
          variant: "secondary",
          size: "sm",
          onclick: () => void loadTables(),
          children: ($$renderer4) => {
            $$renderer4.push(`<!---->Refresh`);
          }
        });
      };
      PageHeader($$renderer2, {
        title: "Table Editor",
        description: "Browse project tables and open row-level editing views.",
        actions
      });
    }
    $$renderer2.push(`<!----> `);
    SectionCard($$renderer2, {
      title: "Tables",
      description: "Table inventory from live GraphQL schema introspection.",
      children: ($$renderer3) => {
        $$renderer3.push(`<div class="space-y-4">`);
        SearchInput($$renderer3, {
          value: query,
          placeholder: "Search tables...",
          oninput: (value) => query = value
        });
        $$renderer3.push(`<!----> `);
        if (loading) {
          $$renderer3.push("<!--[0-->");
          LoadingSkeleton($$renderer3, { lines: 8 });
        } else if (error) {
          $$renderer3.push("<!--[1-->");
          ErrorState($$renderer3, {
            title: "Could not load tables",
            message: error,
            onRetry: () => void loadTables()
          });
        } else if (filteredTables().length === 0) {
          $$renderer3.push("<!--[2-->");
          EmptyState($$renderer3, {
            title: "No tables found",
            message: "Create your first table from SQL editor or migrations to see it here."
          });
        } else {
          $$renderer3.push("<!--[-1-->");
          $$renderer3.push(`<div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"><!--[-->`);
          const each_array = ensure_array_like(filteredTables());
          for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
            let table = each_array[$$index];
            $$renderer3.push(`<button type="button" class="text-left rounded-xl border border-surface-6 bg-surface-2 p-5 transition hover:border-accent-8 hover:bg-surface-3"><div class="flex items-center justify-between"><div class="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent-3 text-accent-11">📋</div> <span class="text-xs text-surface-10">${escape_html(table.schema)}</span></div> <h3 class="mt-4 text-lg font-semibold text-surface-12">${escape_html(table.name)}</h3> <p class="mt-2 text-xs text-surface-10">Open table details</p></button>`);
          }
          $$renderer3.push(`<!--]--></div>`);
        }
        $$renderer3.push(`<!--]--></div>`);
      }
    });
    $$renderer2.push(`<!----></div>`);
  });
}
export {
  _page as default
};
