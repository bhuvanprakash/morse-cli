import { a as attr_class, e as escape_html, h as derived, d as ensure_array_like, c as attr_style, b as attr } from "../../../../chunks/index2.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
import { c as contextStore } from "../../../../chunks/context.js";
import { a as auth } from "../../../../chunks/auth.js";
import "../../../../chunks/toast.js";
import { P as PageHeader } from "../../../../chunks/PageHeader.js";
import { S as SectionCard } from "../../../../chunks/SectionCard.js";
import { S as StatCard } from "../../../../chunks/StatCard.js";
import { E as EmptyState } from "../../../../chunks/EmptyState.js";
import { F as FormField, a as FormActions } from "../../../../chunks/FormActions.js";
import { S as StatusBadge } from "../../../../chunks/StatusBadge.js";
import { M as MetricChart } from "../../../../chunks/MetricChart.js";
import { S as SlideOver } from "../../../../chunks/SlideOver.js";
import { a as formatINR, b as formatNumber, c as formatDate, f as formatDateTime } from "../../../../chunks/format.js";
import "../../../../chunks/confirm.js";
function PlanBadge($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { plan = "free" } = $$props;
    const normalized = derived(() => String(plan || "free").toLowerCase());
    $$renderer2.push(`<span${attr_class(`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${normalized().includes("enterprise") ? "bg-violet-500/15 text-violet-200" : normalized().includes("pro") ? "bg-orange-500/15 text-orange-200" : "bg-surface-3 text-surface-10"}`)}>${escape_html(normalized())}</span>`);
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let loading = false;
    let plans = [];
    let usageSummary = {};
    let usageDaily = [];
    let invoices = [];
    let activeSubscription = null;
    let showInvoiceDetail = false;
    let planChanging = "";
    let billingProfile = {
      business_name: "",
      gstin: "",
      billing_address: "",
      state_code: "",
      country_code: "IN"
    };
    const canManageBilling = derived(() => {
      const role = String(auth.user?.role ?? "").toLowerCase();
      return role === "admin" || role === "owner";
    });
    const selectedPlan = derived(() => {
      const key = String("") || (plans.find((plan) => plan.key === "free")?.key ?? "free");
      return plans.find((plan) => plan.key === key) ?? null;
    });
    const usageRows = derived(() => {
      const limits = selectedPlan()?.limits ?? {};
      const keys = /* @__PURE__ */ new Set([...Object.keys(usageSummary), ...Object.keys(limits)]);
      return Array.from(keys).sort().map((metric) => {
        const used = Number(usageSummary[metric] ?? 0);
        const limit = Number(limits[metric] ?? 0);
        const percentage = limit > 0 ? Math.min(100, Math.round(used / limit * 100)) : 0;
        return {
          metric,
          used,
          limit,
          percentage,
          over: limit > 0 && used > limit
        };
      });
    });
    const usageChart = derived(() => {
      const totals = /* @__PURE__ */ new Map();
      for (const row of usageDaily) {
        totals.set(row.period, (totals.get(row.period) ?? 0) + Number(row.quantity ?? 0));
      }
      return Array.from(totals.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-14).map(([period, value]) => ({ label: period.slice(5), value, tone: "orange" }));
    });
    const overageCount = derived(() => usageRows().filter((row) => row.over).length);
    $$renderer2.push(`<div class="space-y-6" data-testid="billing-page">`);
    {
      let actions = function($$renderer3) {
        $$renderer3.push(`<button class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"${attr("disabled", loading, true)} data-testid="billing-refresh">${escape_html("Refresh")}</button>`);
      };
      PageHeader($$renderer2, {
        title: "Billing",
        description: "Plan controls, usage metering, invoices, and GST billing profile for your active project.",
        actions
      });
    }
    $$renderer2.push(`<!----> `);
    if (!contextStore.activeProjectId) {
      $$renderer2.push("<!--[0-->");
      EmptyState($$renderer2, {
        title: "No active project",
        message: "Select a project from the top bar to load billing data."
      });
    } else {
      $$renderer2.push("<!--[-1-->");
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (!canManageBilling()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">You have read-only access to billing. Owner/admin role is required for plan and profile updates.</div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <div class="grid gap-4 md:grid-cols-4">`);
      {
        let after = function($$renderer3) {
          if (selectedPlan()) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<div class="mt-3">`);
            PlanBadge($$renderer3, { plan: selectedPlan().key });
            $$renderer3.push(`<!----></div>`);
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]-->`);
        };
        StatCard($$renderer2, {
          label: "Current Plan",
          value: selectedPlan()?.name || "Free",
          hint: contextStore.activeProject?.region || "ap-south-1",
          after
        });
      }
      $$renderer2.push(`<!----> `);
      StatCard($$renderer2, {
        label: "Monthly Estimate",
        value: formatINR(0),
        hint: "Includes GST"
      });
      $$renderer2.push(`<!----> `);
      StatCard($$renderer2, {
        label: "Usage Metrics",
        value: formatNumber(usageRows().length),
        hint: "Billable dimensions tracked"
      });
      $$renderer2.push(`<!----> `);
      StatCard($$renderer2, {
        label: "Overage Warnings",
        value: formatNumber(overageCount()),
        hint: overageCount() > 0 ? "Upgrade or optimize usage" : "Within limits",
        trend: overageCount() > 0 ? "action needed" : "healthy",
        trendTone: overageCount() > 0 ? "warn" : "good"
      });
      $$renderer2.push(`<!----></div> <div class="grid gap-6 lg:grid-cols-3">`);
      SectionCard($$renderer2, {
        title: "Usage Summary",
        description: "Current billing period usage against plan limits.",
        children: ($$renderer3) => {
          if (usageRows().length === 0) {
            $$renderer3.push("<!--[1-->");
            EmptyState($$renderer3, {
              title: "No usage yet",
              message: "Usage metrics will appear once your project starts receiving traffic."
            });
          } else {
            $$renderer3.push("<!--[-1-->");
            $$renderer3.push(`<div class="space-y-4"><!--[-->`);
            const each_array = ensure_array_like(usageRows());
            for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
              let row = each_array[$$index];
              $$renderer3.push(`<div class="space-y-1"><div class="flex items-center justify-between text-sm"><span class="font-medium text-gray-700">${escape_html(row.metric.replaceAll("_", " "))}</span> <span class="text-gray-500">${escape_html(formatNumber(row.used))} / ${escape_html(row.limit > 0 ? formatNumber(row.limit) : "unlimited")}</span></div> <div class="h-2 rounded-full bg-gray-100"><div${attr_class(
                `h-2 rounded-full ${row.over ? "bg-red-500" : row.percentage > 80 ? "bg-amber-500" : "bg-orange-500"}`,
                "svelte-hsol3p"
              )}${attr_style(`width:${Math.max(4, row.percentage)}%`)}></div></div> `);
              if (row.over) {
                $$renderer3.push("<!--[0-->");
                $$renderer3.push(`<p class="text-xs text-red-600">Overage active for this metric.</p>`);
              } else {
                $$renderer3.push("<!--[-1-->");
              }
              $$renderer3.push(`<!--]--></div>`);
            }
            $$renderer3.push(`<!--]--></div>`);
          }
          $$renderer3.push(`<!--]-->`);
        }
      });
      $$renderer2.push(`<!----> `);
      SectionCard($$renderer2, {
        title: "Usage Trend",
        description: "Last 14 days aggregate usage events.",
        children: ($$renderer3) => {
          if (usageChart().length === 0) {
            $$renderer3.push("<!--[1-->");
            EmptyState($$renderer3, {
              title: "No trend data",
              message: "Daily usage rollups have not been generated yet."
            });
          } else {
            $$renderer3.push("<!--[-1-->");
            MetricChart($$renderer3, { points: usageChart(), height: 180 });
          }
          $$renderer3.push(`<!--]-->`);
        }
      });
      $$renderer2.push(`<!----> `);
      SectionCard($$renderer2, {
        title: "Plan Catalog",
        description: "Upgrade or downgrade with immediate billing profile continuity.",
        children: ($$renderer3) => {
          if (plans.length === 0) {
            $$renderer3.push("<!--[1-->");
            EmptyState($$renderer3, {
              title: "No plans configured",
              message: "Billing plans were not returned by the billing service."
            });
          } else {
            $$renderer3.push("<!--[-1-->");
            $$renderer3.push(`<div class="space-y-3"><!--[-->`);
            const each_array_1 = ensure_array_like(plans);
            for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
              let plan = each_array_1[$$index_1];
              $$renderer3.push(`<div class="rounded-lg border border-gray-200 p-3"><div class="flex items-center justify-between gap-2"><div><p class="text-sm font-semibold text-gray-900">${escape_html(plan.name)}</p> <p class="text-xs text-gray-500">${escape_html(plan.key)}</p></div> `);
              StatusBadge($$renderer3, {
                status: activeSubscription?.plan_key === plan.key ? "active" : "available"
              });
              $$renderer3.push(`<!----></div> <p class="mt-2 text-lg font-semibold text-gray-900">${escape_html(formatINR(plan.monthly_inr))}<span class="text-xs font-normal text-gray-500">/ month</span></p> <div class="mt-3"><button class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"${attr("disabled", !canManageBilling() || planChanging === plan.key || activeSubscription?.plan_key === plan.key, true)}${attr("data-testid", `billing-plan-${plan.key}`)}>${escape_html(planChanging === plan.key ? "Applying..." : activeSubscription?.plan_key === plan.key ? "Current plan" : "Switch")}</button></div></div>`);
            }
            $$renderer3.push(`<!--]--></div>`);
          }
          $$renderer3.push(`<!--]-->`);
        }
      });
      $$renderer2.push(`<!----></div> <div class="grid gap-6 lg:grid-cols-2">`);
      SectionCard($$renderer2, {
        title: "Billing Profile",
        description: "GST-ready invoice identity fields for India payments.",
        children: ($$renderer3) => {
          $$renderer3.push(`<div class="space-y-3">`);
          {
            let children = function($$renderer4) {
              $$renderer4.push(`<input${attr("value", billingProfile.business_name)} class="input svelte-hsol3p" placeholder="Acme Private Limited" data-testid="billing-business-name"/>`);
            };
            FormField($$renderer3, { label: "Business Name", children });
          }
          $$renderer3.push(`<!----> `);
          {
            let children = function($$renderer4) {
              $$renderer4.push(`<input${attr("value", billingProfile.gstin)} class="input svelte-hsol3p" placeholder="27ABCDE1234F1Z5" data-testid="billing-gstin"/>`);
            };
            FormField($$renderer3, { label: "GSTIN", children });
          }
          $$renderer3.push(`<!----> `);
          {
            let children = function($$renderer4) {
              $$renderer4.push(`<input${attr("value", billingProfile.billing_address)} class="input svelte-hsol3p" placeholder="Mumbai, Maharashtra" data-testid="billing-address"/>`);
            };
            FormField($$renderer3, {
              label: "Billing Address",
              children
            });
          }
          $$renderer3.push(`<!----> <div class="grid gap-3 md:grid-cols-2">`);
          {
            let children = function($$renderer4) {
              $$renderer4.push(`<input${attr("value", billingProfile.state_code)} class="input svelte-hsol3p" placeholder="27" data-testid="billing-state-code"/>`);
            };
            FormField($$renderer3, { label: "State Code", children });
          }
          $$renderer3.push(`<!----> `);
          {
            let children = function($$renderer4) {
              $$renderer4.push(`<input${attr("value", billingProfile.country_code)} class="input svelte-hsol3p" placeholder="IN" data-testid="billing-country-code"/>`);
            };
            FormField($$renderer3, { label: "Country Code", children });
          }
          $$renderer3.push(`<!----></div></div> `);
          FormActions($$renderer3, {
            children: ($$renderer4) => {
              $$renderer4.push(`<button class="rounded-md border border-gray-300 px-3 py-2 text-sm">Reset</button> <button class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"${attr("disabled", !canManageBilling(), true)} data-testid="billing-save-profile">${escape_html("Save Profile")}</button>`);
            },
            $$slots: { default: true }
          });
          $$renderer3.push(`<!---->`);
        }
      });
      $$renderer2.push(`<!----> `);
      SectionCard($$renderer2, {
        title: "Invoice Preview",
        description: "Auto-calculated estimate for current period in INR.",
        children: ($$renderer3) => {
          {
            $$renderer3.push("<!--[1-->");
            EmptyState($$renderer3, {
              title: "No preview available",
              message: "Invoice preview endpoint returned no data."
            });
          }
          $$renderer3.push(`<!--]-->`);
        }
      });
      $$renderer2.push(`<!----></div> `);
      SectionCard($$renderer2, {
        title: "Invoices",
        description: "Recent invoices for the selected project with detail drill-down.",
        children: ($$renderer3) => {
          if (invoices.length === 0) {
            $$renderer3.push("<!--[1-->");
            EmptyState($$renderer3, {
              title: "No invoices yet",
              message: "Invoices will appear once billing cycles begin."
            });
          } else {
            $$renderer3.push("<!--[-1-->");
            $$renderer3.push(`<div class="overflow-x-auto"><table class="min-w-full text-sm"><thead><tr class="border-b border-gray-200 text-left text-gray-500"><th class="px-2 py-2">Invoice</th><th class="px-2 py-2">Period</th><th class="px-2 py-2">Total</th><th class="px-2 py-2">Status</th><th class="px-2 py-2">Created</th></tr></thead><tbody><!--[-->`);
            const each_array_3 = ensure_array_like(invoices);
            for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
              let invoice = each_array_3[$$index_3];
              $$renderer3.push(`<tr class="cursor-pointer border-b border-gray-100 hover:bg-gray-50"${attr("data-testid", `billing-invoice-${invoice.id}`)}><td class="px-2 py-2 font-mono text-xs">${escape_html(invoice.id)}</td><td class="px-2 py-2">${escape_html(formatDate(invoice.period_start))} → ${escape_html(formatDate(invoice.period_end))}</td><td class="px-2 py-2">${escape_html(formatINR(invoice.total_amount))}</td><td class="px-2 py-2">`);
              StatusBadge($$renderer3, { status: invoice.status });
              $$renderer3.push(`<!----></td><td class="px-2 py-2 text-gray-500">${escape_html(formatDateTime(invoice.created_at))}</td></tr>`);
            }
            $$renderer3.push(`<!--]--></tbody></table></div>`);
          }
          $$renderer3.push(`<!--]-->`);
        }
      });
      $$renderer2.push(`<!---->`);
    }
    $$renderer2.push(`<!--]--></div> `);
    {
      let children = function($$renderer3) {
        {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]-->`);
      };
      SlideOver($$renderer2, {
        open: showInvoiceDetail,
        title: "Invoice Details",
        onclose: () => showInvoiceDetail = false,
        children
      });
    }
    $$renderer2.push(`<!---->`);
  });
}
export {
  _page as default
};
