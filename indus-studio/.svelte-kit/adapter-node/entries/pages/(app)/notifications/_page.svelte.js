import { b as attr, e as escape_html, d as ensure_array_like, h as derived } from "../../../../chunks/index2.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
import "../../../../chunks/confirm.js";
import "../../../../chunks/toast.js";
import { f as formatDateTime, b as formatNumber } from "../../../../chunks/format.js";
import { P as PageHeader } from "../../../../chunks/PageHeader.js";
import { S as SectionCard } from "../../../../chunks/SectionCard.js";
import { S as StatusBadge } from "../../../../chunks/StatusBadge.js";
import { T as Tabs } from "../../../../chunks/Tabs.js";
import { M as MetricChart } from "../../../../chunks/MetricChart.js";
import { S as SlideOver } from "../../../../chunks/SlideOver.js";
import { E as EmptyState } from "../../../../chunks/EmptyState.js";
import { S as StatCard } from "../../../../chunks/StatCard.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let tab = "send";
    let sendChannel = "push";
    let loading = false;
    let templates = [];
    let history = [];
    let stats = {};
    let historyDetailOpen = false;
    let pushForm = {
      user_id: "",
      tokens_text: "",
      title: "",
      body: "",
      data_text: '{\n  "screen": "home"\n}'
    };
    let historyFilters = {
      channel: "",
      status: "",
      user_id: "",
      date_from: "",
      date_to: ""
    };
    const filteredHistory = derived(() => {
      return history.filter((item) => {
        return true;
      });
    });
    const statsCards = derived(() => {
      const push = stats.push ?? { sent: 0, failed: 0 };
      const sms = stats.sms ?? { sent: 0, failed: 0 };
      const email = stats.email ?? { sent: 0, failed: 0 };
      const last24 = stats.last_24h ?? { sent: 0 };
      const totalSent = Number(stats.total_sent ?? 0);
      const failures = Number(push.failed ?? 0) + Number(sms.failed ?? 0) + Number(email.failed ?? 0);
      const totalAttempts = totalSent + failures;
      const failureRate = totalAttempts > 0 ? failures / totalAttempts * 100 : 0;
      return {
        totalSent,
        pushSent: Number(push.sent ?? 0),
        smsSent: Number(sms.sent ?? 0),
        emailSent: Number(email.sent ?? 0),
        last24Sent: Number(last24.sent ?? 0),
        failureRate
      };
    });
    const statsChartPoints = derived(() => [
      {
        label: "Push",
        value: Number(statsCards().pushSent || 0),
        tone: "blue"
      },
      {
        label: "SMS",
        value: Number(statsCards().smsSent || 0),
        tone: "green"
      },
      {
        label: "Email",
        value: Number(statsCards().emailSent || 0),
        tone: "orange"
      },
      {
        label: "24h",
        value: Number(statsCards().last24Sent || 0),
        tone: "red"
      }
    ]);
    const tabItems = [
      { key: "send", label: "Send" },
      { key: "templates", label: "Templates" },
      { key: "history", label: "History" },
      { key: "stats", label: "Stats" }
    ];
    function providerLabel(entry) {
      const msg = (entry.error_message || "").toLowerCase();
      if (msg.includes("fcm")) return "fcm";
      if (msg.includes("apns")) return "apns";
      if (msg.includes("2factor")) return "2factor";
      if (msg.includes("twilio")) return "twilio";
      if (msg.includes("sendgrid")) return "sendgrid";
      if (msg.includes("smtp")) return "smtp";
      return "provider";
    }
    $$renderer2.push(`<div class="space-y-6" data-testid="notifications-page">`);
    {
      let actions = function($$renderer3) {
        $$renderer3.push(`<button class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"${attr("disabled", loading, true)}>${escape_html("Refresh")}</button>`);
      };
      PageHeader($$renderer2, {
        title: "Notifications",
        description: "Send push/SMS/email, manage templates, and monitor delivery health.",
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
    if (tab === "send") {
      $$renderer2.push("<!--[0-->");
      SectionCard($$renderer2, {
        title: "Send Notification",
        description: "Choose channel and send immediately through configured providers.",
        children: ($$renderer3) => {
          $$renderer3.push(`<div class="space-y-4"><div class="grid gap-3 md:grid-cols-4"><label class="field md:col-span-1 svelte-xbnxce"><span class="svelte-xbnxce">Channel</span> `);
          $$renderer3.select(
            { value: sendChannel, class: "" },
            ($$renderer4) => {
              $$renderer4.option({ value: "push" }, ($$renderer5) => {
                $$renderer5.push(`Push`);
              });
              $$renderer4.option({ value: "sms" }, ($$renderer5) => {
                $$renderer5.push(`SMS`);
              });
              $$renderer4.option({ value: "email" }, ($$renderer5) => {
                $$renderer5.push(`Email`);
              });
            },
            "svelte-xbnxce"
          );
          $$renderer3.push(`</label></div> `);
          {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<div class="grid gap-3 md:grid-cols-2"><label class="field svelte-xbnxce"><span class="svelte-xbnxce">User ID (optional)</span> <input${attr("value", pushForm.user_id)} placeholder="user-uuid" class="svelte-xbnxce"/></label> <label class="field md:col-span-2 svelte-xbnxce"><span class="svelte-xbnxce">Device tokens (comma/newline separated)</span> <textarea rows="3" placeholder="fcm-token-1\\nfcm-token-2" class="svelte-xbnxce">`);
            const $$body = escape_html(pushForm.tokens_text);
            if ($$body) {
              $$renderer3.push(`${$$body}`);
            }
            $$renderer3.push(`</textarea></label> <label class="field svelte-xbnxce"><span class="svelte-xbnxce">Title</span> <input${attr("value", pushForm.title)} placeholder="Order Confirmed" class="svelte-xbnxce"/></label> <label class="field svelte-xbnxce"><span class="svelte-xbnxce">Body</span> <input${attr("value", pushForm.body)} placeholder="Your order #123 is confirmed." class="svelte-xbnxce"/></label> <label class="field md:col-span-2 svelte-xbnxce"><span class="svelte-xbnxce">Custom data (JSON)</span> <textarea rows="4" class="svelte-xbnxce">`);
            const $$body_1 = escape_html(pushForm.data_text);
            if ($$body_1) {
              $$renderer3.push(`${$$body_1}`);
            }
            $$renderer3.push(`</textarea></label></div>`);
          }
          $$renderer3.push(`<!--]--> `);
          {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]--> `);
          {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]--> <div class="flex justify-end"><button class="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700" data-testid="notifications-send-submit">Send</button></div></div>`);
        }
      });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (tab === "templates") {
      $$renderer2.push("<!--[0-->");
      SectionCard($$renderer2, {
        title: "Templates",
        description: "Create reusable notification templates with variable placeholders.",
        children: ($$renderer3) => {
          $$renderer3.push(`<div class="space-y-4"><div class="flex items-center justify-between"><p class="text-sm text-gray-500">${escape_html(templates.length)} templates</p> <button class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700" data-testid="notifications-new-template">New Template</button></div> <div class="overflow-x-auto"><table class="min-w-full text-sm"><thead><tr class="border-b border-gray-200 text-left text-gray-500"><th class="px-2 py-2">Name</th><th class="px-2 py-2">Channel</th><th class="px-2 py-2">Variables</th><th class="px-2 py-2">Updated</th><th class="px-2 py-2">Actions</th></tr></thead><tbody>`);
          if (templates.length === 0) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<tr><td class="px-2 py-4 text-gray-500" colspan="5">`);
            EmptyState($$renderer3, {
              title: "No templates found",
              message: "Create reusable notification templates for faster launches and safer repeat sends."
            });
            $$renderer3.push(`<!----></td></tr>`);
          } else {
            $$renderer3.push("<!--[-1-->");
            $$renderer3.push(`<!--[-->`);
            const each_array_2 = ensure_array_like(templates);
            for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
              let template = each_array_2[$$index_2];
              $$renderer3.push(`<tr class="border-b border-gray-100"${attr("data-testid", `notifications-template-${template.name}`)}><td class="px-2 py-2 font-medium">${escape_html(template.name)}</td><td class="px-2 py-2">`);
              StatusBadge($$renderer3, { status: template.channel });
              $$renderer3.push(`<!----></td><td class="px-2 py-2 text-xs text-gray-600">${escape_html((template.variables ?? []).join(", ") || "-")}</td><td class="px-2 py-2 text-gray-500">${escape_html(formatDateTime(template.updated_at || template.created_at))}</td><td class="px-2 py-2"><div class="flex gap-2"><button class="rounded border px-2 py-1 text-xs">Edit</button> <button class="rounded border px-2 py-1 text-xs">Preview</button> <button class="rounded border border-red-300 px-2 py-1 text-xs text-red-700">Delete</button></div></td></tr>`);
            }
            $$renderer3.push(`<!--]-->`);
          }
          $$renderer3.push(`<!--]--></tbody></table></div> `);
          {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]--></div>`);
        }
      });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (tab === "history") {
      $$renderer2.push("<!--[0-->");
      SectionCard($$renderer2, {
        title: "History",
        description: "Track notification deliveries and inspect failed requests.",
        children: ($$renderer3) => {
          $$renderer3.push(`<div class="space-y-4"><div class="grid gap-3 md:grid-cols-6"><label class="field svelte-xbnxce"><span class="svelte-xbnxce">Channel</span> `);
          $$renderer3.select(
            { value: historyFilters.channel, class: "" },
            ($$renderer4) => {
              $$renderer4.option({ value: "" }, ($$renderer5) => {
                $$renderer5.push(`All`);
              });
              $$renderer4.option({ value: "push" }, ($$renderer5) => {
                $$renderer5.push(`Push`);
              });
              $$renderer4.option({ value: "sms" }, ($$renderer5) => {
                $$renderer5.push(`SMS`);
              });
              $$renderer4.option({ value: "email" }, ($$renderer5) => {
                $$renderer5.push(`Email`);
              });
              $$renderer4.option({ value: "whatsapp" }, ($$renderer5) => {
                $$renderer5.push(`WhatsApp`);
              });
            },
            "svelte-xbnxce"
          );
          $$renderer3.push(`</label> <label class="field svelte-xbnxce"><span class="svelte-xbnxce">Status</span> `);
          $$renderer3.select(
            { value: historyFilters.status, class: "" },
            ($$renderer4) => {
              $$renderer4.option({ value: "" }, ($$renderer5) => {
                $$renderer5.push(`All`);
              });
              $$renderer4.option({ value: "sent" }, ($$renderer5) => {
                $$renderer5.push(`sent`);
              });
              $$renderer4.option({ value: "delivered" }, ($$renderer5) => {
                $$renderer5.push(`delivered`);
              });
              $$renderer4.option({ value: "failed" }, ($$renderer5) => {
                $$renderer5.push(`failed`);
              });
              $$renderer4.option({ value: "queued" }, ($$renderer5) => {
                $$renderer5.push(`queued`);
              });
            },
            "svelte-xbnxce"
          );
          $$renderer3.push(`</label> <label class="field svelte-xbnxce"><span class="svelte-xbnxce">User ID</span> <input${attr("value", historyFilters.user_id)} placeholder="user-uuid" class="svelte-xbnxce"/></label> <label class="field svelte-xbnxce"><span class="svelte-xbnxce">From</span> <input type="date"${attr("value", historyFilters.date_from)} class="svelte-xbnxce"/></label> <label class="field svelte-xbnxce"><span class="svelte-xbnxce">To</span> <input type="date"${attr("value", historyFilters.date_to)} class="svelte-xbnxce"/></label> <div class="flex items-end"><button class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">Apply</button></div></div> <div class="overflow-x-auto"><table class="min-w-full text-sm"><thead><tr class="border-b border-gray-200 text-left text-gray-500"><th class="px-2 py-2">Recipient</th><th class="px-2 py-2">Channel</th><th class="px-2 py-2">Status</th><th class="px-2 py-2">Sent At</th><th class="px-2 py-2">Provider</th><th class="px-2 py-2">Error</th></tr></thead><tbody>`);
          if (filteredHistory().length === 0) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<tr><td class="px-2 py-4 text-gray-500" colspan="6">`);
            EmptyState($$renderer3, {
              title: "No notifications found",
              message: "Try widening the filters or send a new notification to populate delivery history."
            });
            $$renderer3.push(`<!----></td></tr>`);
          } else {
            $$renderer3.push("<!--[-1-->");
            $$renderer3.push(`<!--[-->`);
            const each_array_3 = ensure_array_like(filteredHistory());
            for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
              let item = each_array_3[$$index_3];
              $$renderer3.push(`<tr class="cursor-pointer border-b border-gray-100 hover:bg-gray-50"${attr("data-testid", `notifications-history-${item.id}`)}><td class="px-2 py-2">${escape_html(item.recipient)}</td><td class="px-2 py-2">`);
              StatusBadge($$renderer3, { status: item.channel });
              $$renderer3.push(`<!----></td><td class="px-2 py-2">`);
              StatusBadge($$renderer3, { status: item.status });
              $$renderer3.push(`<!----></td><td class="px-2 py-2 text-gray-500">${escape_html(formatDateTime(item.sent_at))}</td><td class="px-2 py-2"><span class="rounded bg-gray-100 px-2 py-0.5 text-xs">${escape_html(providerLabel(item))}</span></td><td class="px-2 py-2 text-xs text-red-600">${escape_html(item.error_message || "-")}</td></tr>`);
            }
            $$renderer3.push(`<!--]-->`);
          }
          $$renderer3.push(`<!--]--></tbody></table></div></div>`);
        }
      });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (tab === "stats") {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="grid gap-4 md:grid-cols-5">`);
      StatCard($$renderer2, {
        label: "Total Sent",
        value: formatNumber(statsCards().totalSent),
        hint: "Across all channels"
      });
      $$renderer2.push(`<!----> `);
      StatCard($$renderer2, {
        label: "Push Sent",
        value: formatNumber(statsCards().pushSent),
        hint: "FCM + APNs"
      });
      $$renderer2.push(`<!----> `);
      StatCard($$renderer2, {
        label: "SMS Sent",
        value: formatNumber(statsCards().smsSent),
        hint: "India DLT-ready flow"
      });
      $$renderer2.push(`<!----> `);
      StatCard($$renderer2, {
        label: "Email Sent",
        value: formatNumber(statsCards().emailSent),
        hint: "Transactional email volume"
      });
      $$renderer2.push(`<!----> `);
      StatCard($$renderer2, {
        label: "Failure Rate",
        value: `${statsCards().failureRate.toFixed(1)}%`,
        hint: "Recent delivery quality",
        trend: statsCards().failureRate > 5 ? "watch" : "healthy",
        trendTone: statsCards().failureRate > 5 ? "warn" : "good"
      });
      $$renderer2.push(`<!----></div> `);
      SectionCard($$renderer2, {
        title: "Delivery Trend",
        description: "Snapshot of sent notifications by channel.",
        children: ($$renderer3) => {
          MetricChart($$renderer3, { points: statsChartPoints(), height: 220 });
        }
      });
      $$renderer2.push(`<!---->`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    SlideOver($$renderer2, {
      open: historyDetailOpen,
      title: "Notification Details",
      onclose: () => historyDetailOpen = false,
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
