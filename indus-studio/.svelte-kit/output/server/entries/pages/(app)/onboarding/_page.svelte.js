import { d as ensure_array_like, a as attr_class, e as escape_html, b as attr, s as stringify } from "../../../../chunks/index2.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
import "../../../../chunks/auth.js";
import "../../../../chunks/toast.js";
import "../../../../chunks/confirm.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let step = 1;
    const TOTAL_STEPS = 5;
    let loading = false;
    $$renderer2.push(`<div class="wizard-wrap svelte-uazrsb" data-testid="onboarding-page"><div class="wizard-card svelte-uazrsb"><div class="progress svelte-uazrsb"><!--[-->`);
    const each_array = ensure_array_like(Array(TOTAL_STEPS));
    for (let i = 0, $$length = each_array.length; i < $$length; i++) {
      each_array[i];
      $$renderer2.push(`<div${attr_class(`bar ${stringify(i < step ? "active" : "")}`, "svelte-uazrsb")}></div>`);
    }
    $$renderer2.push(`<!--]--> <span>${escape_html(step)}/5</span></div> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<section class="step svelte-uazrsb"><h1 class="svelte-uazrsb">Welcome to IndusBase</h1> <p class="svelte-uazrsb">India-first Postgres-native BaaS for production apps. Default region: <code>ap-south-1</code> • Timezone: IST.</p> <pre class="svelte-uazrsb">indus-gate  :8000  API Gateway
indus-auth  :8001  Auth + WhatsApp OTP + Enterprise SSO
indus-query :8002  REST + GraphQL
indus-live  :8004  Realtime
indus-store :8005  Object Storage
indus-ai    :8007  Vector Search
indus-queue :8008  Jobs + Webhooks + Cron
indus-notify:8009  Push + SMS + Email
indus-config:8010  Feature Flags + Remote Config</pre> <div class="actions svelte-uazrsb"><button class="primary svelte-uazrsb"${attr("disabled", loading, true)} data-testid="onboarding-start">Start Onboarding</button> <button class="secondary svelte-uazrsb">Skip for now</button></div></section>`);
    }
    $$renderer2.push(`<!--]--> `);
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
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></div>`);
  });
}
export {
  _page as default
};
