import { d as ensure_array_like, e as escape_html, b as attr, a as attr_class, h as derived } from "../../../../chunks/index2.js";
import { s as studioApi } from "../../../../chunks/studio.js";
import "../../../../chunks/confirm.js";
import "../../../../chunks/toast.js";
import { f as formatDateTime } from "../../../../chunks/format.js";
import { P as PageHeader } from "../../../../chunks/PageHeader.js";
import { S as SectionCard } from "../../../../chunks/SectionCard.js";
import { E as EmptyState } from "../../../../chunks/EmptyState.js";
import { S as StatusBadge } from "../../../../chunks/StatusBadge.js";
import { T as Tabs } from "../../../../chunks/Tabs.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let tab = "jobs";
    let loading = false;
    let queues = [];
    let selectedQueue = "default";
    let statusFilter = "";
    let jobs = [];
    let webhooks = [];
    let schedules = [];
    let selectedJob = null;
    const statusCounts = derived(() => {
      const counters = /* @__PURE__ */ new Map();
      for (const job of jobs) {
        counters.set(job.status, (counters.get(job.status) ?? 0) + 1);
      }
      return Array.from(counters.entries()).map(([status, count]) => ({ status, count }));
    });
    const queueTabs = [
      { key: "jobs", label: "Jobs" },
      { key: "webhooks", label: "Webhooks" },
      { key: "cron", label: "Cron" }
    ];
    async function loadJobs() {
      const payload = await studioApi.listJobs({
        queue_name: selectedQueue,
        status: void 0,
        limit: 200,
        offset: 0
      });
      jobs = payload ?? [];
    }
    $$renderer2.push(`<div class="space-y-6" data-testid="queue-page">`);
    {
      let actions = function($$renderer3) {
        $$renderer3.push(`<div class="header-actions svelte-gf2op5">`);
        $$renderer3.select(
          {
            value: selectedQueue,
            onchange: () => {
              loadJobs();
            },
            "data-testid": "queue-selector",
            class: ""
          },
          ($$renderer4) => {
            $$renderer4.push(`<!--[-->`);
            const each_array = ensure_array_like(queues);
            for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
              let queue = each_array[$$index];
              $$renderer4.option({ value: queue.name }, ($$renderer5) => {
                $$renderer5.push(`${escape_html(queue.name)}`);
              });
            }
            $$renderer4.push(`<!--]-->`);
          },
          "svelte-gf2op5"
        );
        $$renderer3.push(` <button class="secondary svelte-gf2op5"${attr("disabled", loading, true)} data-testid="queue-refresh">${escape_html("Refresh")}</button> `);
        if (tab === "jobs") {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<button class="primary svelte-gf2op5" data-testid="queue-enqueue-open">Enqueue Job</button>`);
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--></div>`);
      };
      PageHeader($$renderer2, {
        title: "Queue & Automation",
        description: "Operate background jobs, webhook deliveries, and cron schedules from a single live queue console.",
        eyebrow: "Operations",
        testId: "queue-header",
        actions
      });
    }
    $$renderer2.push(`<!----> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    Tabs($$renderer2, { tabs: queueTabs, active: tab, onChange: (key) => tab = key });
    $$renderer2.push(`<!----> `);
    if (tab === "jobs") {
      $$renderer2.push("<!--[0-->");
      SectionCard($$renderer2, {
        title: "Jobs",
        description: "Inspect queued work, retry pressure, and payload details for the selected queue.",
        children: ($$renderer3) => {
          $$renderer3.push(`<div class="space-y-4"><div class="status-grid svelte-gf2op5">`);
          if (statusCounts().length === 0) {
            $$renderer3.push("<!--[0-->");
            EmptyState($$renderer3, {
              title: "No job status data",
              message: "Jobs will appear here once the selected queue begins receiving work."
            });
          } else {
            $$renderer3.push("<!--[-1-->");
            $$renderer3.push(`<!--[-->`);
            const each_array_1 = ensure_array_like(statusCounts());
            for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
              let item = each_array_1[$$index_1];
              $$renderer3.push(`<div class="status-card svelte-gf2op5"><span class="svelte-gf2op5">${escape_html(item.status)}</span> <strong>${escape_html(item.count)}</strong></div>`);
            }
            $$renderer3.push(`<!--]-->`);
          }
          $$renderer3.push(`<!--]--></div> <div class="row two svelte-gf2op5"><div><label for="job-status-filter" class="svelte-gf2op5">Status filter</label> `);
          $$renderer3.select(
            {
              id: "job-status-filter",
              value: statusFilter,
              onchange: loadJobs,
              class: ""
            },
            ($$renderer4) => {
              $$renderer4.option({ value: "" }, ($$renderer5) => {
                $$renderer5.push(`All statuses`);
              });
              $$renderer4.option({ value: "pending" }, ($$renderer5) => {
                $$renderer5.push(`pending`);
              });
              $$renderer4.option({ value: "running" }, ($$renderer5) => {
                $$renderer5.push(`running`);
              });
              $$renderer4.option({ value: "completed" }, ($$renderer5) => {
                $$renderer5.push(`completed`);
              });
              $$renderer4.option({ value: "failed" }, ($$renderer5) => {
                $$renderer5.push(`failed`);
              });
              $$renderer4.option({ value: "dead_letter" }, ($$renderer5) => {
                $$renderer5.push(`dead_letter`);
              });
            },
            "svelte-gf2op5"
          );
          $$renderer3.push(`</div></div> <div class="layout svelte-gf2op5"><div class="table-wrap svelte-gf2op5"><table class="svelte-gf2op5"><thead><tr class="svelte-gf2op5"><th class="svelte-gf2op5">ID</th><th class="svelte-gf2op5">Queue</th><th class="svelte-gf2op5">Status</th><th class="svelte-gf2op5">Attempts</th><th class="svelte-gf2op5">Created</th></tr></thead><tbody>`);
          if (jobs.length === 0) {
            $$renderer3.push("<!--[1-->");
            $$renderer3.push(`<tr class="svelte-gf2op5"><td colspan="5" class="empty svelte-gf2op5">No jobs found.</td></tr>`);
          } else {
            $$renderer3.push("<!--[-1-->");
            $$renderer3.push(`<!--[-->`);
            const each_array_2 = ensure_array_like(jobs);
            for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
              let job = each_array_2[$$index_2];
              $$renderer3.push(`<tr${attr("data-testid", `queue-job-${job.id}`)}${attr_class("svelte-gf2op5", void 0, { "selected": selectedJob?.id === job.id })}><td class="mono svelte-gf2op5">${escape_html(job.id)}</td><td class="svelte-gf2op5">${escape_html(job.queue_name)}</td><td class="svelte-gf2op5">`);
              StatusBadge($$renderer3, { status: job.status });
              $$renderer3.push(`<!----></td><td class="svelte-gf2op5">${escape_html(job.attempt_count)}/${escape_html(job.max_retries)}</td><td class="svelte-gf2op5">${escape_html(formatDateTime(job.created_at))}</td></tr>`);
            }
            $$renderer3.push(`<!--]-->`);
          }
          $$renderer3.push(`<!--]--></tbody></table></div> <aside class="drawer svelte-gf2op5"><h3 class="svelte-gf2op5">Job Details</h3> `);
          {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<p class="empty svelte-gf2op5">Select a job row to inspect payload and retries.</p>`);
          }
          $$renderer3.push(`<!--]--></aside></div></div>`);
        }
      });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (tab === "webhooks") {
      $$renderer2.push("<!--[0-->");
      SectionCard($$renderer2, {
        title: "Webhook Endpoints",
        description: "Operate outgoing delivery hooks, test them, and inspect their live configuration.",
        children: ($$renderer3) => {
          $$renderer3.push(`<div class="space-y-4"><div class="section-head svelte-gf2op5"><h2 class="svelte-gf2op5">Webhook Endpoints</h2> <button class="primary svelte-gf2op5" data-testid="queue-new-webhook">New Webhook</button></div> `);
          if (webhooks.length === 0) {
            $$renderer3.push("<!--[1-->");
            $$renderer3.push(`<div class="empty svelte-gf2op5">No webhooks configured.</div>`);
          } else {
            $$renderer3.push("<!--[-1-->");
            $$renderer3.push(`<div class="cards svelte-gf2op5"><!--[-->`);
            const each_array_3 = ensure_array_like(webhooks);
            for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
              let webhook = each_array_3[$$index_3];
              $$renderer3.push(`<div class="card svelte-gf2op5"><div class="row"><strong>${escape_html(webhook.name)}</strong> `);
              StatusBadge($$renderer3, { status: webhook.enabled ? "enabled" : "disabled" });
              $$renderer3.push(`<!----></div> <small>${escape_html(webhook.event)}</small> <p class="mono svelte-gf2op5">${escape_html(webhook.url)}</p> <div class="header-actions svelte-gf2op5"><button class="secondary svelte-gf2op5">${escape_html(webhook.enabled ? "Disable" : "Enable")}</button> <button class="secondary svelte-gf2op5">Test</button> <button class="secondary svelte-gf2op5">Edit</button> <button class="danger svelte-gf2op5">Delete</button></div></div>`);
            }
            $$renderer3.push(`<!--]--></div>`);
          }
          $$renderer3.push(`<!--]--></div>`);
        }
      });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (tab === "cron") {
      $$renderer2.push("<!--[0-->");
      SectionCard($$renderer2, {
        title: "Cron Schedules",
        description: "Manage time-based automation, trigger runs immediately, and watch next-run timing.",
        children: ($$renderer3) => {
          $$renderer3.push(`<div class="space-y-4"><div class="section-head svelte-gf2op5"><h2 class="svelte-gf2op5">Cron Schedules</h2> <button class="primary svelte-gf2op5" data-testid="queue-new-cron">New Schedule</button></div> `);
          if (schedules.length === 0) {
            $$renderer3.push("<!--[1-->");
            $$renderer3.push(`<div class="empty svelte-gf2op5">No cron schedules configured.</div>`);
          } else {
            $$renderer3.push("<!--[-1-->");
            $$renderer3.push(`<div class="table-wrap svelte-gf2op5"><table class="svelte-gf2op5"><thead><tr class="svelte-gf2op5"><th class="svelte-gf2op5">Name</th><th class="svelte-gf2op5">Expression</th><th class="svelte-gf2op5">Timezone</th><th class="svelte-gf2op5">Next Run</th><th class="svelte-gf2op5">Status</th><th class="svelte-gf2op5">Actions</th></tr></thead><tbody><!--[-->`);
            const each_array_4 = ensure_array_like(schedules);
            for (let $$index_4 = 0, $$length = each_array_4.length; $$index_4 < $$length; $$index_4++) {
              let schedule = each_array_4[$$index_4];
              $$renderer3.push(`<tr class="svelte-gf2op5"><td class="svelte-gf2op5">${escape_html(schedule.name)}</td><td class="mono svelte-gf2op5">${escape_html(schedule.cron_expression)}</td><td class="svelte-gf2op5">${escape_html(schedule.timezone)}</td><td class="svelte-gf2op5">${escape_html(formatDateTime(schedule.next_run_at))}</td><td class="svelte-gf2op5">`);
              StatusBadge($$renderer3, { status: schedule.enabled ? "enabled" : "disabled" });
              $$renderer3.push(`<!----></td><td class="svelte-gf2op5"><div class="header-actions svelte-gf2op5"><button class="secondary svelte-gf2op5">Run Now</button> <button class="secondary svelte-gf2op5">${escape_html(schedule.enabled ? "Disable" : "Enable")}</button> <button class="secondary svelte-gf2op5">Edit</button> <button class="danger svelte-gf2op5">Delete</button></div></td></tr>`);
            }
            $$renderer3.push(`<!--]--></tbody></table></div>`);
          }
          $$renderer3.push(`<!--]--></div>`);
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
