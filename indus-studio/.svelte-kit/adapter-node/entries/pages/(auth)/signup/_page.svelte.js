import "clsx";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
import "../../../../chunks/auth.js";
import { B as Button } from "../../../../chunks/Button.js";
import { I as Input } from "../../../../chunks/Input.js";
import "../../../../chunks/toast.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let email = "";
    let password = "";
    let confirmPassword = "";
    let loading = false;
    let passwordError = "";
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      $$renderer3.push(`<div class="min-h-screen bg-surface-1 flex items-center justify-center p-4"><div class="w-full max-w-md space-y-8"><div class="text-center"><h1 class="text-3xl font-bold text-surface-12">Create Account</h1> <p class="mt-2 text-surface-10">Sign up for IndusBase</p></div> <form class="space-y-6 bg-surface-2 p-8 rounded-xl border border-surface-6">`);
      Input($$renderer3, {
        label: "Email",
        type: "email",
        placeholder: "you@example.com",
        required: true,
        get value() {
          return email;
        },
        set value($$value) {
          email = $$value;
          $$settled = false;
        }
      });
      $$renderer3.push(`<!----> `);
      Input($$renderer3, {
        label: "Password",
        type: "password",
        placeholder: "••••••••",
        required: true,
        get value() {
          return password;
        },
        set value($$value) {
          password = $$value;
          $$settled = false;
        }
      });
      $$renderer3.push(`<!----> `);
      Input($$renderer3, {
        label: "Confirm Password",
        type: "password",
        placeholder: "••••••••",
        error: passwordError,
        required: true,
        get value() {
          return confirmPassword;
        },
        set value($$value) {
          confirmPassword = $$value;
          $$settled = false;
        }
      });
      $$renderer3.push(`<!----> `);
      Button($$renderer3, {
        type: "submit",
        variant: "primary",
        fullWidth: true,
        loading,
        children: ($$renderer4) => {
          $$renderer4.push(`<!---->Create Account`);
        }
      });
      $$renderer3.push(`<!----></form> <p class="text-center text-sm text-surface-10">Already have an account? <a href="/login" class="text-accent-9 hover:underline">Sign in</a></p></div></div>`);
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
