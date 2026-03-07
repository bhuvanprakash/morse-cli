import { b as attr, e as escape_html, c as attr_style, h as derived } from "./index2.js";
import { p as prettyJson } from "./json.js";
import "./toast.js";
function CopyButton($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      label = "Copy",
      disabled = false,
      testId = ""
    } = $$props;
    $$renderer2.push(`<button type="button"${attr("data-testid", testId || void 0)}${attr("disabled", disabled, true)} class="rounded-md border border-surface-6 px-2 py-1 text-xs text-surface-11 transition hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50">${escape_html(label)}</button>`);
  });
}
function JsonViewer($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { value, maxHeight = "20rem" } = $$props;
    const text = derived(() => prettyJson(value));
    $$renderer2.push(`<div class="overflow-hidden rounded-xl border border-white/10 bg-slate-950/80 shadow-inner"><div class="flex items-center justify-between border-b border-white/10 bg-white/5 px-3 py-2"><div class="flex items-center gap-2"><span class="h-2 w-2 rounded-full bg-emerald-400/80"></span> <span class="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">JSON</span></div> `);
    CopyButton($$renderer2, { value: text(), testId: "json-viewer-copy" });
    $$renderer2.push(`<!----></div> <pre class="overflow-auto bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.08),transparent_38%)] p-3 text-xs leading-6 text-slate-200"${attr_style(`max-height:${maxHeight}`)}>${escape_html(text())}</pre></div>`);
  });
}
export {
  JsonViewer as J
};
