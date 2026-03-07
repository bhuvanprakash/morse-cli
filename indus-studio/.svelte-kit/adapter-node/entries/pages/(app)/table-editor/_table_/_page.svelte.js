import { g as getContext, h as derived, f as store_get, d as ensure_array_like, e as escape_html, u as unsubscribe_stores } from "../../../../../chunks/index2.js";
import "clsx";
import "@sveltejs/kit/internal";
import "../../../../../chunks/exports.js";
import "../../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../../chunks/root.js";
import "../../../../../chunks/state.svelte.js";
import { g as goto } from "../../../../../chunks/client.js";
import { s as studioApi } from "../../../../../chunks/studio.js";
import { a as toastStore } from "../../../../../chunks/toast.js";
import { P as PageHeader } from "../../../../../chunks/PageHeader.js";
import { S as SectionCard } from "../../../../../chunks/SectionCard.js";
import { S as SearchInput } from "../../../../../chunks/SearchInput.js";
import { E as EmptyState } from "../../../../../chunks/EmptyState.js";
import { E as ErrorState } from "../../../../../chunks/ErrorState.js";
import { L as LoadingSkeleton } from "../../../../../chunks/LoadingSkeleton.js";
import { S as SlideOver } from "../../../../../chunks/SlideOver.js";
import { B as Button } from "../../../../../chunks/Button.js";
const getStores = () => {
  const stores$1 = getContext("__svelte__");
  return {
    /** @type {typeof page} */
    page: {
      subscribe: stores$1.page.subscribe
    },
    /** @type {typeof navigating} */
    navigating: {
      subscribe: stores$1.navigating.subscribe
    },
    /** @type {typeof updated} */
    updated: stores$1.updated
  };
};
const page = {
  subscribe(fn) {
    const store = getStores().page;
    return store.subscribe(fn);
  }
};
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    const tableName = derived(() => store_get($$store_subs ??= {}, "$page", page).params.table);
    let rows = [];
    let columns = [];
    let loading = true;
    let error = null;
    let query = "";
    let pageNo = 1;
    let limit = 50;
    let totalPages = 1;
    let totalRows = 0;
    let hasNext = false;
    let hasPrev = false;
    let detailOpen = false;
    const filteredRows = derived(() => {
      const q = query.trim().toLowerCase();
      if (!q) return rows;
      return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(q));
    });
    async function loadRows() {
      loading = true;
      error = null;
      try {
        const payload = await studioApi.listTableRows(tableName(), pageNo, limit);
        rows = payload.data ?? [];
        columns = rows.length ? Object.keys(rows[0]) : [];
        totalRows = Number(payload.meta?.total ?? rows.length);
        totalPages = Number(payload.meta?.total_pages ?? 1);
        hasNext = Boolean(payload.meta?.has_next);
        hasPrev = Boolean(payload.meta?.has_prev);
      } catch (e) {
        error = e instanceof Error ? e.message : "Failed to load rows";
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
          onclick: () => goto(),
          children: ($$renderer4) => {
            $$renderer4.push(`<!---->Back`);
          }
        });
        $$renderer3.push(`<!----> `);
        Button($$renderer3, {
          variant: "secondary",
          size: "sm",
          onclick: () => void loadRows(),
          children: ($$renderer4) => {
            $$renderer4.push(`<!---->Refresh`);
          }
        });
        $$renderer3.push(`<!---->`);
      };
      PageHeader($$renderer2, {
        title: tableName(),
        description: "Live table rows via REST API",
        actions
      });
    }
    $$renderer2.push(`<!----> `);
    SectionCard($$renderer2, {
      title: "Rows",
      description: `Page ${pageNo} of ${totalPages} • ${totalRows} total rows`,
      children: ($$renderer3) => {
        $$renderer3.push(`<div class="space-y-4">`);
        SearchInput($$renderer3, {
          value: query,
          placeholder: "Search within loaded rows...",
          oninput: (value) => query = value
        });
        $$renderer3.push(`<!----> `);
        if (loading) {
          $$renderer3.push("<!--[0-->");
          LoadingSkeleton($$renderer3, { lines: 10 });
        } else if (error) {
          $$renderer3.push("<!--[1-->");
          ErrorState($$renderer3, {
            title: "Could not load rows",
            message: error,
            onRetry: () => void loadRows()
          });
        } else if (rows.length === 0) {
          $$renderer3.push("<!--[2-->");
          EmptyState($$renderer3, {
            title: "No rows yet",
            message: "This table exists but currently has no records."
          });
        } else {
          $$renderer3.push("<!--[-1-->");
          $$renderer3.push(`<div class="overflow-x-auto rounded-xl border border-surface-6 bg-surface-2"><table class="min-w-full text-sm"><thead class="bg-surface-3 text-surface-11"><tr><!--[-->`);
          const each_array = ensure_array_like(columns);
          for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
            let column = each_array[$$index];
            $$renderer3.push(`<th class="px-4 py-3 text-left">${escape_html(column)}</th>`);
          }
          $$renderer3.push(`<!--]--></tr></thead><tbody><!--[-->`);
          const each_array_1 = ensure_array_like(filteredRows());
          for (let idx = 0, $$length = each_array_1.length; idx < $$length; idx++) {
            let row = each_array_1[idx];
            $$renderer3.push(`<tr class="border-t border-surface-6 hover:bg-surface-3/50 cursor-pointer"><!--[-->`);
            const each_array_2 = ensure_array_like(columns);
            for (let $$index_1 = 0, $$length2 = each_array_2.length; $$index_1 < $$length2; $$index_1++) {
              let column = each_array_2[$$index_1];
              $$renderer3.push(`<td class="max-w-[22rem] truncate px-4 py-2 text-surface-12">`);
              if (row[column] == null) {
                $$renderer3.push("<!--[0-->");
                $$renderer3.push(`-`);
              } else if (typeof row[column] === "object") {
                $$renderer3.push("<!--[1-->");
                $$renderer3.push(`${escape_html(JSON.stringify(row[column]))}`);
              } else {
                $$renderer3.push("<!--[-1-->");
                $$renderer3.push(`${escape_html(String(row[column]))}`);
              }
              $$renderer3.push(`<!--]--></td>`);
            }
            $$renderer3.push(`<!--]--></tr>`);
          }
          $$renderer3.push(`<!--]--></tbody></table></div> <div class="flex items-center justify-between"><p class="text-xs text-surface-10">Showing ${escape_html(filteredRows().length)} rows on this page</p> <div class="flex items-center gap-2">`);
          Button($$renderer3, {
            size: "sm",
            variant: "secondary",
            disabled: !hasPrev || loading,
            onclick: () => {
              pageNo -= 1;
              void loadRows();
            },
            children: ($$renderer4) => {
              $$renderer4.push(`<!---->Previous`);
            }
          });
          $$renderer3.push(`<!----> `);
          Button($$renderer3, {
            size: "sm",
            variant: "secondary",
            disabled: !hasNext || loading,
            onclick: () => {
              pageNo += 1;
              void loadRows();
            },
            children: ($$renderer4) => {
              $$renderer4.push(`<!---->Next`);
            }
          });
          $$renderer3.push(`<!----></div></div>`);
        }
        $$renderer3.push(`<!--]--></div>`);
      }
    });
    $$renderer2.push(`<!----> `);
    SlideOver($$renderer2, {
      open: detailOpen,
      onclose: () => {
        detailOpen = false;
      },
      title: "Row details",
      children: ($$renderer3) => {
        {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]-->`);
      }
    });
    $$renderer2.push(`<!----></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
