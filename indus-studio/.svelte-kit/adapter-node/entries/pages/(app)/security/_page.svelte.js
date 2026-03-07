import { d as ensure_array_like, h as derived, b as attr, e as escape_html } from "../../../../chunks/index2.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
import { a as auth } from "../../../../chunks/auth.js";
import "../../../../chunks/toast.js";
import { P as PageHeader } from "../../../../chunks/PageHeader.js";
import { S as SectionCard } from "../../../../chunks/SectionCard.js";
import { S as StatCard } from "../../../../chunks/StatCard.js";
import { E as EmptyState } from "../../../../chunks/EmptyState.js";
import { S as StatusBadge } from "../../../../chunks/StatusBadge.js";
import { S as SlideOver } from "../../../../chunks/SlideOver.js";
import { b as formatNumber, f as formatDateTime } from "../../../../chunks/format.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let loading = false;
    let summary = {};
    let runs = [];
    let showDetails = false;
    let filters = { scan_type: "", status: "", tool: "", from: "", to: "", q: "" };
    const isAdminView = derived(() => {
      const role = String(auth.user?.role ?? "").toLowerCase();
      return role === "admin" || role === "owner";
    });
    const summaryCards = derived(() => {
      const keys = ["dependency", "container", "secret_scan", "sbom"];
      return keys.map((key) => {
        const data = summary?.[key] ?? {};
        return {
          key,
          status: String(data.status ?? "unknown"),
          issues: Number(data.issues ?? 0)
        };
      });
    });
    const filteredRuns = derived(() => {
      const query = filters.q.trim().toLowerCase();
      const fromTime = 0;
      const toTime = Number.MAX_SAFE_INTEGER;
      return runs.filter((run) => {
        const created = new Date(run.created_at).getTime();
        if (Number.isFinite(fromTime) && created < fromTime) return false;
        if (Number.isFinite(toTime) && created > toTime) return false;
        if (query) {
          const haystack = `${run.scan_type} ${run.tool_name} ${run.status} ${JSON.stringify(run.summary || {})}`.toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        return true;
      });
    });
    const availableTypes = derived(() => Array.from(new Set(runs.map((run) => run.scan_type))).sort());
    const availableTools = derived(() => Array.from(new Set(runs.map((run) => run.tool_name))).sort());
    const remediationTips = derived(() => {
      const tips = summary?.remediation_tips;
      return Array.isArray(tips) ? tips.map((tip) => String(tip)) : [];
    });
    const sbomLinks = derived(() => {
      const links = /* @__PURE__ */ new Map();
      for (const run of runs) {
        if (run.report_url && run.scan_type.toLowerCase().includes("sbom")) {
          links.set(run.tool_name || run.id, run.report_url);
        }
      }
      if (links.size === 0) {
        links.set("CycloneDX", "/artifacts/sbom/cyclonedx.json");
        links.set("Syft SPDX", "/artifacts/sbom/syft.spdx.json");
      }
      return Array.from(links.entries()).map(([label, href]) => ({ label, href }));
    });
    function statusTone(status) {
      const s = status.toLowerCase();
      if (s === "success" || s === "passed") return "ok";
      if (s === "warning" || s === "partial") return "warning";
      if (s === "failed" || s === "error") return "critical";
      return "unknown";
    }
    $$renderer2.push(`<div class="space-y-6" data-testid="security-page">`);
    {
      let actions = function($$renderer3) {
        $$renderer3.push(`<button class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"${attr("disabled", loading, true)} data-testid="security-refresh">${escape_html("Refresh")}</button>`);
      };
      PageHeader($$renderer2, {
        title: "Security Scanning",
        description: "Track dependency, container, secret, and SBOM scan posture with actionable findings.",
        actions
      });
    }
    $$renderer2.push(`<!----> `);
    if (!isAdminView()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Read-only security view. Admin/owner role is required for remediation actions in related systems.</div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="grid gap-4 md:grid-cols-4"><!--[-->`);
    const each_array = ensure_array_like(summaryCards());
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let card = each_array[$$index];
      StatCard($$renderer2, {
        label: card.key.replace("_", " "),
        value: formatNumber(card.issues),
        hint: "open issues",
        trend: card.status,
        trendTone: card.status === "failed" ? "bad" : card.status === "warning" ? "warn" : "good"
      });
    }
    $$renderer2.push(`<!--]--></div> <div class="grid gap-6 lg:grid-cols-3">`);
    SectionCard($$renderer2, {
      title: "Scan Runs",
      description: "Filter by tool, scan type, status, and date range.",
      children: ($$renderer3) => {
        $$renderer3.push(`<div class="grid gap-2 md:grid-cols-2 lg:grid-cols-3"><input class="input svelte-oqrtb2"${attr("value", filters.q)} placeholder="Search findings, tool, or status" data-testid="security-search"/> `);
        $$renderer3.select(
          {
            class: "input",
            value: filters.scan_type,
            "data-testid": "security-scan-type"
          },
          ($$renderer4) => {
            $$renderer4.option({ value: "" }, ($$renderer5) => {
              $$renderer5.push(`All scan types`);
            });
            $$renderer4.push(`<!--[-->`);
            const each_array_1 = ensure_array_like(availableTypes());
            for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
              let type = each_array_1[$$index_1];
              $$renderer4.option({ value: type }, ($$renderer5) => {
                $$renderer5.push(`${escape_html(type)}`);
              });
            }
            $$renderer4.push(`<!--]-->`);
          },
          "svelte-oqrtb2"
        );
        $$renderer3.push(` `);
        $$renderer3.select(
          {
            class: "input",
            value: filters.tool,
            "data-testid": "security-tool"
          },
          ($$renderer4) => {
            $$renderer4.option({ value: "" }, ($$renderer5) => {
              $$renderer5.push(`All tools`);
            });
            $$renderer4.push(`<!--[-->`);
            const each_array_2 = ensure_array_like(availableTools());
            for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
              let tool = each_array_2[$$index_2];
              $$renderer4.option({ value: tool }, ($$renderer5) => {
                $$renderer5.push(`${escape_html(tool)}`);
              });
            }
            $$renderer4.push(`<!--]-->`);
          },
          "svelte-oqrtb2"
        );
        $$renderer3.push(` `);
        $$renderer3.select(
          {
            class: "input",
            value: filters.status,
            "data-testid": "security-status"
          },
          ($$renderer4) => {
            $$renderer4.option({ value: "" }, ($$renderer5) => {
              $$renderer5.push(`All statuses`);
            });
            $$renderer4.option({ value: "success" }, ($$renderer5) => {
              $$renderer5.push(`success`);
            });
            $$renderer4.option({ value: "warning" }, ($$renderer5) => {
              $$renderer5.push(`warning`);
            });
            $$renderer4.option({ value: "failed" }, ($$renderer5) => {
              $$renderer5.push(`failed`);
            });
          },
          "svelte-oqrtb2"
        );
        $$renderer3.push(` <input class="input svelte-oqrtb2" type="date"${attr("value", filters.from)} data-testid="security-from"/> <input class="input svelte-oqrtb2" type="date"${attr("value", filters.to)} data-testid="security-to"/></div> <div class="mt-4 overflow-x-auto">`);
        if (filteredRuns().length === 0) {
          $$renderer3.push("<!--[1-->");
          EmptyState($$renderer3, {
            title: "No scan runs",
            message: "No scan entries match the selected filters."
          });
        } else {
          $$renderer3.push("<!--[-1-->");
          $$renderer3.push(`<table class="min-w-full text-sm"><thead><tr class="border-b border-gray-200 text-left text-gray-500"><th class="px-2 py-2">Type</th><th class="px-2 py-2">Tool</th><th class="px-2 py-2">Status</th><th class="px-2 py-2">Issues</th><th class="px-2 py-2">Created</th></tr></thead><tbody><!--[-->`);
          const each_array_3 = ensure_array_like(filteredRuns());
          for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
            let run = each_array_3[$$index_3];
            $$renderer3.push(`<tr class="cursor-pointer border-b border-gray-100 hover:bg-gray-50"${attr("data-testid", `security-run-${run.id}`)}><td class="px-2 py-2">${escape_html(run.scan_type)}</td><td class="px-2 py-2">${escape_html(run.tool_name)}</td><td class="px-2 py-2">`);
            StatusBadge($$renderer3, { status: statusTone(run.status) });
            $$renderer3.push(`<!----></td><td class="px-2 py-2">${escape_html(formatNumber(Number(run.summary?.issues ?? 0)))}</td><td class="px-2 py-2 text-gray-500">${escape_html(formatDateTime(run.created_at))}</td></tr>`);
          }
          $$renderer3.push(`<!--]--></tbody></table>`);
        }
        $$renderer3.push(`<!--]--></div>`);
      }
    });
    $$renderer2.push(`<!----> `);
    SectionCard($$renderer2, {
      title: "SBOM & Reports",
      description: "Download software bill of materials and scan reports.",
      children: ($$renderer3) => {
        $$renderer3.push(`<div class="space-y-3"><!--[-->`);
        const each_array_4 = ensure_array_like(sbomLinks());
        for (let $$index_4 = 0, $$length = each_array_4.length; $$index_4 < $$length; $$index_4++) {
          let link = each_array_4[$$index_4];
          $$renderer3.push(`<a${attr("href", link.href)} target="_blank" rel="noreferrer" class="block rounded-md border border-orange-300 px-3 py-2 text-sm text-orange-700 hover:bg-orange-50"${attr("data-testid", `security-report-${link.label.toLowerCase().replaceAll(" ", "-")}`)}>${escape_html(link.label)}</a>`);
        }
        $$renderer3.push(`<!--]--></div>`);
      }
    });
    $$renderer2.push(`<!----> `);
    SectionCard($$renderer2, {
      title: "Remediation Guidance",
      description: "Operational guidance generated from the latest scan posture.",
      children: ($$renderer3) => {
        if (remediationTips().length === 0) {
          $$renderer3.push("<!--[0-->");
          EmptyState($$renderer3, {
            title: "No tips available",
            message: "Summary payload has no remediation recommendations."
          });
        } else {
          $$renderer3.push("<!--[-1-->");
          $$renderer3.push(`<ul class="list-disc space-y-2 pl-5 text-sm text-gray-700"><!--[-->`);
          const each_array_5 = ensure_array_like(remediationTips());
          for (let $$index_5 = 0, $$length = each_array_5.length; $$index_5 < $$length; $$index_5++) {
            let tip = each_array_5[$$index_5];
            $$renderer3.push(`<li>${escape_html(tip)}</li>`);
          }
          $$renderer3.push(`<!--]--></ul>`);
        }
        $$renderer3.push(`<!--]-->`);
      }
    });
    $$renderer2.push(`<!----></div></div> `);
    {
      let children = function($$renderer3) {
        {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]-->`);
      };
      SlideOver($$renderer2, {
        open: showDetails,
        title: "Scan Run Details",
        onclose: () => showDetails = false,
        children
      });
    }
    $$renderer2.push(`<!---->`);
  });
}
export {
  _page as default
};
