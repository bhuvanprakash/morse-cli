import { e as escape_html, b as attr, d as ensure_array_like, h as derived } from "../../../../chunks/index2.js";
import { s as studioApi } from "../../../../chunks/studio.js";
import "../../../../chunks/confirm.js";
import { a as toastStore } from "../../../../chunks/toast.js";
import { f as formatDateTime } from "../../../../chunks/format.js";
import { P as PageHeader } from "../../../../chunks/PageHeader.js";
import { S as SectionCard } from "../../../../chunks/SectionCard.js";
import { E as EmptyState } from "../../../../chunks/EmptyState.js";
import { J as JsonViewer } from "../../../../chunks/JsonViewer.js";
import { S as StatusBadge } from "../../../../chunks/StatusBadge.js";
import { T as Tabs } from "../../../../chunks/Tabs.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let tab = "search";
    let collections = [];
    let selectedCollection = "";
    let loadingCollections = false;
    let loadingDocuments = false;
    let documents = [];
    let results = [];
    let searchForm = { query: "", limit: 10, min_similarity: 0.5, filter: "{}" };
    const resultCount = derived(() => results.length);
    const tabItems = [
      { key: "search", label: "Semantic Search" },
      { key: "documents", label: "Documents" }
    ];
    async function loadDocuments(collectionName = selectedCollection) {
      if (!collectionName) return;
      loadingDocuments = true;
      try {
        const payload = await studioApi.listDocuments(collectionName, 100, 0);
        documents = payload.documents ?? [];
      } catch (err) {
        documents = [];
        toastStore.error(err instanceof Error ? err.message : "Failed to load documents");
      } finally {
        loadingDocuments = false;
      }
    }
    $$renderer2.push(`<div class="space-y-6" data-testid="ai-page">`);
    {
      let actions = function($$renderer3) {
        $$renderer3.push(`<div class="header-actions svelte-puq4qy">`);
        $$renderer3.select(
          {
            value: selectedCollection,
            onchange: () => loadDocuments(selectedCollection),
            "data-testid": "ai-collection-select",
            class: ""
          },
          ($$renderer4) => {
            $$renderer4.option({ value: "" }, ($$renderer5) => {
              $$renderer5.push(`Select collection`);
            });
            $$renderer4.push(`<!--[-->`);
            const each_array = ensure_array_like(collections);
            for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
              let collection = each_array[$$index];
              $$renderer4.option({ value: collection.name }, ($$renderer5) => {
                $$renderer5.push(`${escape_html(collection.name)}`);
              });
            }
            $$renderer4.push(`<!--]-->`);
          },
          "svelte-puq4qy"
        );
        $$renderer3.push(` <button class="secondary svelte-puq4qy"${attr("disabled", loadingCollections, true)} data-testid="ai-refresh">${escape_html("Refresh")}</button> <button class="primary svelte-puq4qy" data-testid="ai-new-collection">New Collection</button></div>`);
      };
      PageHeader($$renderer2, {
        title: "AI Vector Search",
        description: "Create collections, upsert documents, and run semantic search using live embeddings.",
        eyebrow: "AI",
        actions
      });
    }
    $$renderer2.push(`<!----> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    Tabs($$renderer2, { tabs: tabItems, active: tab, onChange: (key) => tab = key });
    $$renderer2.push(`<!----> `);
    if (tab === "search") {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">`);
      SectionCard($$renderer2, {
        title: "Search Query",
        description: "Tune semantic search limits and metadata filters for the selected collection.",
        children: ($$renderer3) => {
          $$renderer3.push(`<h2>Search Query</h2> <label for="search-query" class="svelte-puq4qy">Query</label> <textarea id="search-query" rows="4" placeholder="e.g. India BaaS backend platform" data-testid="ai-search-query" class="svelte-puq4qy">`);
          const $$body = escape_html(searchForm.query);
          if ($$body) {
            $$renderer3.push(`${$$body}`);
          }
          $$renderer3.push(`</textarea> <div class="row two svelte-puq4qy"><div><label for="search-limit" class="svelte-puq4qy">Limit</label> <input id="search-limit" type="number" min="1" max="100"${attr("value", searchForm.limit)} class="svelte-puq4qy"/></div> <div><label for="search-similarity" class="svelte-puq4qy">Min Similarity</label> <input id="search-similarity" type="number" min="0" max="1" step="0.05"${attr("value", searchForm.min_similarity)} class="svelte-puq4qy"/></div></div> <label for="search-filter" class="svelte-puq4qy">Metadata Filter (JSON)</label> <textarea id="search-filter" rows="3" class="svelte-puq4qy">`);
          const $$body_1 = escape_html(searchForm.filter);
          if ($$body_1) {
            $$renderer3.push(`${$$body_1}`);
          }
          $$renderer3.push(`</textarea> <button class="primary svelte-puq4qy"${attr("disabled", !selectedCollection, true)} data-testid="ai-run-search">${escape_html("Search")}</button>`);
        }
      });
      $$renderer2.push(`<!----> `);
      SectionCard($$renderer2, {
        title: "Results",
        description: "Similarity-ranked document matches with metadata and content previews.",
        children: ($$renderer3) => {
          $$renderer3.push(`<div class="section-head svelte-puq4qy"><h2 class="svelte-puq4qy">Results</h2> <small>${escape_html(resultCount())} result(s)</small></div> `);
          if (results.length === 0) {
            $$renderer3.push("<!--[1-->");
            EmptyState($$renderer3, {
              title: "No results yet",
              message: "Run a search query against a selected collection to inspect semantic matches."
            });
          } else {
            $$renderer3.push("<!--[-1-->");
            $$renderer3.push(`<div class="results svelte-puq4qy"><!--[-->`);
            const each_array_1 = ensure_array_like(results);
            for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
              let result = each_array_1[$$index_1];
              $$renderer3.push(`<div class="result svelte-puq4qy"${attr("data-testid", `ai-result-${result.id}`)}><div class="result-head svelte-puq4qy"><span class="mono svelte-puq4qy">${escape_html(result.id)}</span> `);
              StatusBadge($$renderer3, { status: `${Math.round(result.similarity * 100)}%` });
              $$renderer3.push(`<!----></div> <p class="svelte-puq4qy">${escape_html(result.content)}</p> `);
              JsonViewer($$renderer3, { value: result.metadata || {}, maxHeight: "10rem" });
              $$renderer3.push(`<!----></div>`);
            }
            $$renderer3.push(`<!--]--></div>`);
          }
          $$renderer3.push(`<!--]-->`);
        }
      });
      $$renderer2.push(`<!----></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (tab === "documents") {
      $$renderer2.push("<!--[0-->");
      SectionCard($$renderer2, {
        title: `Documents in ${"—"}`,
        description: "Upload, upsert, and remove documents from the active AI collection.",
        children: ($$renderer3) => {
          $$renderer3.push(`<div class="space-y-4"><div class="section-head svelte-puq4qy"><h2 class="svelte-puq4qy">Documents in ${escape_html("—")}</h2> <div class="header-actions svelte-puq4qy"><button class="secondary svelte-puq4qy"${attr("disabled", loadingDocuments || !selectedCollection, true)}>${escape_html(loadingDocuments ? "Refreshing..." : "Refresh")}</button> <button class="primary svelte-puq4qy"${attr("disabled", !selectedCollection, true)} data-testid="ai-open-upsert">Upload / Upsert</button></div></div> `);
          if (loadingDocuments) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<div class="empty svelte-puq4qy">Loading documents...</div>`);
          } else {
            $$renderer3.push("<!--[1-->");
            EmptyState($$renderer3, {
              title: "No collection selected",
              message: "Create or choose a collection first to manage source documents."
            });
          }
          $$renderer3.push(`<!--]--></div>`);
        }
      });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    SectionCard($$renderer2, {
      title: "Collections",
      description: "Browse vector collections, jump into documents, and remove stale datasets safely.",
      children: ($$renderer3) => {
        $$renderer3.push(`<div class="section-head svelte-puq4qy"><h2 class="svelte-puq4qy">Collections</h2></div> `);
        if (collections.length === 0) {
          $$renderer3.push("<!--[1-->");
          EmptyState($$renderer3, {
            title: "No collections yet",
            message: "Create a collection to start ingesting content and running semantic search."
          });
        } else {
          $$renderer3.push("<!--[-1-->");
          $$renderer3.push(`<div class="collections svelte-puq4qy"><!--[-->`);
          const each_array_3 = ensure_array_like(collections);
          for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
            let collection = each_array_3[$$index_3];
            $$renderer3.push(`<div class="collection-card svelte-puq4qy"${attr("data-testid", `ai-collection-${collection.name}`)}><div><strong>${escape_html(collection.name)}</strong> <p class="svelte-puq4qy">${escape_html(collection.description || "No description")}</p> <small class="svelte-puq4qy">Created ${escape_html(formatDateTime(collection.created_at))}</small></div> <div class="header-actions svelte-puq4qy"><button class="secondary svelte-puq4qy">Open</button> <button class="danger svelte-puq4qy">Delete</button></div></div>`);
          }
          $$renderer3.push(`<!--]--></div>`);
        }
        $$renderer3.push(`<!--]-->`);
      }
    });
    $$renderer2.push(`<!----></div> `);
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
