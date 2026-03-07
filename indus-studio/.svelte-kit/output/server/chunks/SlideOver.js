import { e as escape_html } from "./index2.js";
import "clsx";
function SlideOver($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { open = false, title = "", onclose, children } = $$props;
    if (open) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="fixed inset-0 z-40" role="dialog" aria-modal="true" tabindex="-1"><button type="button" class="absolute inset-0 h-full w-full border-0 bg-black/40 p-0" aria-label="Close panel"></button> <aside class="absolute right-0 top-0 h-full w-full max-w-2xl overflow-auto border-l border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(15,23,42,0.94))] text-slate-100 shadow-2xl backdrop-blur"><header class="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-slate-950/90 px-5 py-4 backdrop-blur"><div><p class="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-orange-300/80">Details</p> <h3 class="mt-1 text-sm font-semibold text-white">${escape_html(title)}</h3></div> <button class="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/10">Close</button></header> <div class="p-5">`);
      if (children) {
        $$renderer2.push("<!--[0-->");
        children($$renderer2);
        $$renderer2.push(`<!---->`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div></aside></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
export {
  SlideOver as S
};
