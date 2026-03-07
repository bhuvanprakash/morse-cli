import { e as escape_html, b as attr, a as attr_class, j as bind_props, s as stringify, d as ensure_array_like } from "../../../../chunks/index2.js";
import { B as Button } from "../../../../chunks/Button.js";
import { a as toastStore } from "../../../../chunks/toast.js";
import { s as studioApi } from "../../../../chunks/studio.js";
import { P as PageHeader } from "../../../../chunks/PageHeader.js";
import { S as SectionCard } from "../../../../chunks/SectionCard.js";
import { E as EmptyState } from "../../../../chunks/EmptyState.js";
import { E as ErrorState } from "../../../../chunks/ErrorState.js";
import { S as StatusBadge } from "../../../../chunks/StatusBadge.js";
function CodeEditor($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      value = "",
      language = "sql",
      readonly = false,
      placeholder = "",
      onChange
    } = $$props;
    const languageLabels = {
      sql: "SQL",
      javascript: "JavaScript",
      typescript: "TypeScript",
      json: "JSON",
      yaml: "YAML"
    };
    $$renderer2.push(`<div class="border border-surface-6 rounded-lg overflow-hidden bg-surface-1"><div class="flex items-center justify-between px-4 py-2 bg-surface-2 border-b border-surface-6"><span class="text-xs font-medium text-surface-11 uppercase">${escape_html(languageLabels[language])}</span> <div class="flex items-center gap-2">`);
    if (!readonly) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<span class="text-xs text-surface-10">Tab: indent • Ctrl+Enter: run</span>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></div> <div class="relative"><textarea${attr("readonly", readonly, true)}${attr("placeholder", placeholder)}${attr_class(`w-full h-64 p-4 font-mono text-sm bg-surface-1 text-surface-12 resize-none focus:outline-none ${stringify(readonly ? "cursor-text" : "")}`)} spellcheck="false" autocomplete="off" autocapitalize="off">`);
    const $$body = escape_html(value);
    if ($$body) {
      $$renderer2.push(`${$$body}`);
    }
    $$renderer2.push(`</textarea></div></div>`);
    bind_props($$props, { value });
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let query = "SELECT id, email, created_at FROM users ORDER BY created_at DESC LIMIT 20;";
    let columns = [];
    let rows = [];
    let loading = false;
    let executionTime = 0;
    let error = null;
    let rowCount = 0;
    const sampleQueries = [
      "SELECT id, email, created_at FROM users ORDER BY created_at DESC LIMIT 20;",
      "SELECT COUNT(*) AS total_users FROM users;",
      "SELECT status, COUNT(*) AS count FROM notifications GROUP BY status ORDER BY count DESC;",
      "SELECT NOW() AT TIME ZONE 'Asia/Kolkata' AS ist_time;"
    ];
    function loadSampleQuery(q) {
      query = q;
    }
    async function executeQuery() {
      const sql = query.trim();
      if (!sql) {
        toastStore.error("Enter a SQL query");
        return;
      }
      loading = true;
      error = null;
      const startedAt = performance.now();
      try {
        const result = await studioApi.executeSQL(sql);
        columns = result.columns ?? [];
        rows = result.rows ?? [];
        rowCount = Number(result.count ?? rows.length);
        executionTime = Math.round(performance.now() - startedAt);
        toastStore.success(`Query executed in ${executionTime}ms`);
      } catch (e) {
        error = e instanceof Error ? e.message : "Query execution failed";
        columns = [];
        rows = [];
        rowCount = 0;
        toastStore.error(error);
      } finally {
        loading = false;
      }
    }
    function exportResults() {
      if (!rows.length || !columns.length) return;
      const csvRows = [
        columns.join(","),
        ...rows.map((r) => r.map((cell) => {
          const text = cell == null ? "" : String(cell);
          return `"${text.replaceAll('"', '""')}"`;
        }).join(","))
      ];
      const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `query_results_${Date.now()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    }
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      $$renderer3.push(`<div class="space-y-6">`);
      {
        let actions = function($$renderer4) {
          Button($$renderer4, {
            variant: "secondary",
            onclick: exportResults,
            disabled: rows.length === 0,
            children: ($$renderer5) => {
              $$renderer5.push(`<!---->Export CSV`);
            }
          });
          $$renderer4.push(`<!----> `);
          Button($$renderer4, {
            variant: "primary",
            loading,
            onclick: () => void executeQuery(),
            children: ($$renderer5) => {
              $$renderer5.push(`<!---->Run Query (Ctrl/Cmd+Enter)`);
            }
          });
          $$renderer4.push(`<!---->`);
        };
        PageHeader($$renderer3, {
          title: "SQL Editor",
          description: "Run administrative SQL queries with live execution and export support.",
          actions
        });
      }
      $$renderer3.push(`<!----> `);
      SectionCard($$renderer3, {
        title: "Query",
        description: "Use admin SQL endpoints for controlled execution.",
        children: ($$renderer4) => {
          $$renderer4.push(`<div class="space-y-4"><div class="flex flex-wrap items-center gap-2"><span class="text-xs text-surface-10">Samples:</span> <!--[-->`);
          const each_array = ensure_array_like(sampleQueries);
          for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
            let sample = each_array[$$index];
            Button($$renderer4, {
              variant: "ghost",
              size: "sm",
              onclick: () => loadSampleQuery(sample),
              children: ($$renderer5) => {
                $$renderer5.push(`<!---->${escape_html(sample.length > 52 ? `${sample.slice(0, 52)}...` : sample)}`);
              }
            });
          }
          $$renderer4.push(`<!--]--></div> `);
          CodeEditor($$renderer4, {
            language: "sql",
            get value() {
              return query;
            },
            set value($$value) {
              query = $$value;
              $$settled = false;
            }
          });
          $$renderer4.push(`<!----></div>`);
        }
      });
      $$renderer3.push(`<!----> `);
      SectionCard($$renderer3, {
        title: "Results",
        description: "Live result set from /meta/query",
        children: ($$renderer4) => {
          $$renderer4.push(`<div class="space-y-4">`);
          if (loading) {
            $$renderer4.push("<!--[0-->");
            $$renderer4.push(`<div class="rounded-lg border border-surface-6 p-6 text-sm text-surface-10">Running query...</div>`);
          } else if (error) {
            $$renderer4.push("<!--[1-->");
            ErrorState($$renderer4, {
              title: "Query failed",
              message: error,
              onRetry: () => void executeQuery()
            });
          } else if (rows.length === 0) {
            $$renderer4.push("<!--[2-->");
            EmptyState($$renderer4, {
              title: "No rows returned yet",
              message: "Run a query to inspect result rows and column metadata."
            });
          } else {
            $$renderer4.push("<!--[-1-->");
            $$renderer4.push(`<div class="flex items-center gap-2">`);
            StatusBadge($$renderer4, { status: "success" });
            $$renderer4.push(`<!----> <span class="text-sm text-surface-11">${escape_html(rowCount)} rows • ${escape_html(executionTime)}ms</span></div> <div class="overflow-x-auto rounded-xl border border-surface-6 bg-surface-2"><table class="min-w-full text-sm"><thead class="bg-surface-3 text-surface-11"><tr><!--[-->`);
            const each_array_1 = ensure_array_like(columns);
            for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
              let column = each_array_1[$$index_1];
              $$renderer4.push(`<th class="px-4 py-3 text-left">${escape_html(column)}</th>`);
            }
            $$renderer4.push(`<!--]--></tr></thead><tbody><!--[-->`);
            const each_array_2 = ensure_array_like(rows);
            for (let rowIndex = 0, $$length = each_array_2.length; rowIndex < $$length; rowIndex++) {
              let row = each_array_2[rowIndex];
              $$renderer4.push(`<tr class="border-t border-surface-6"><!--[-->`);
              const each_array_3 = ensure_array_like(row);
              for (let colIndex = 0, $$length2 = each_array_3.length; colIndex < $$length2; colIndex++) {
                let cell = each_array_3[colIndex];
                $$renderer4.push(`<td class="px-4 py-2 text-surface-12">${escape_html(cell == null ? "-" : String(cell))}</td>`);
              }
              $$renderer4.push(`<!--]--></tr>`);
            }
            $$renderer4.push(`<!--]--></tbody></table></div>`);
          }
          $$renderer4.push(`<!--]--></div>`);
        }
      });
      $$renderer3.push(`<!----></div>`);
    }
    do {
      $$settled = true;
      $$inner_renderer = $$renderer2.copy();
      $$render_inner($$inner_renderer);
    } while (!$$settled);
    $$renderer2.subsume($$inner_renderer);
  });
}
export {
  _page as default
};
