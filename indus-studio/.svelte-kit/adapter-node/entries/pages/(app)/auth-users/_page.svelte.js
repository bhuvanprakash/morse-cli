import { h as derived, d as ensure_array_like, e as escape_html } from "../../../../chunks/index2.js";
import { s as studioApi } from "../../../../chunks/studio.js";
import { a as auth } from "../../../../chunks/auth.js";
import { a as toastStore } from "../../../../chunks/toast.js";
import { a as confirmDialog } from "../../../../chunks/confirm.js";
import { P as PageHeader } from "../../../../chunks/PageHeader.js";
import { S as SectionCard } from "../../../../chunks/SectionCard.js";
import { S as SearchInput } from "../../../../chunks/SearchInput.js";
import { E as EmptyState } from "../../../../chunks/EmptyState.js";
import { E as ErrorState } from "../../../../chunks/ErrorState.js";
import { L as LoadingSkeleton } from "../../../../chunks/LoadingSkeleton.js";
import { S as StatusBadge } from "../../../../chunks/StatusBadge.js";
import { S as SlideOver } from "../../../../chunks/SlideOver.js";
import { J as JsonViewer } from "../../../../chunks/JsonViewer.js";
import { B as Button } from "../../../../chunks/Button.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let users = [];
    let loading = true;
    let error = null;
    let searchQuery = "";
    let currentPage = 1;
    let pageSize = 20;
    let hasNext = false;
    let total = 0;
    let selectedUser = null;
    let detailOpen = false;
    let searchDebounce = null;
    const canManageUsers = derived(() => {
      const role = String(auth.user?.role ?? "").toLowerCase();
      return role === "admin" || role === "owner";
    });
    function formatDate(value) {
      if (!value) return "Never";
      const dt = new Date(value);
      if (Number.isNaN(dt.getTime())) return String(value);
      return dt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    }
    function queueSearch(value) {
      searchQuery = value;
      currentPage = 1;
      if (searchDebounce) clearTimeout(searchDebounce);
      searchDebounce = setTimeout(
        () => {
          void loadUsers();
        },
        250
      );
    }
    async function loadUsers() {
      loading = true;
      error = null;
      try {
        const payload = await studioApi.listAuthUsers({
          offset: (currentPage - 1) * pageSize,
          limit: pageSize,
          q: searchQuery.trim() || void 0
        });
        const list = payload.users ?? [];
        const offset = Number(payload.offset ?? 0);
        const limit = Number(payload.limit ?? pageSize);
        users = list;
        pageSize = limit > 0 ? limit : pageSize;
        total = list.length < limit ? offset + list.length : offset + list.length + 1;
        hasNext = list.length === limit;
      } catch (e) {
        error = e instanceof Error ? e.message : "Failed to load users";
        toastStore.error(error);
      } finally {
        loading = false;
      }
    }
    async function toggleBan(user) {
      if (!canManageUsers()) {
        toastStore.error("Only admin/owner can manage users");
        return;
      }
      const action = String(user.status).toLowerCase() === "banned" ? "unban" : "ban";
      const ok = await confirmDialog.open({
        title: `${action === "ban" ? "Ban" : "Unban"} user`,
        message: `Are you sure you want to ${action} ${user.email ?? user.id}?`,
        confirmText: action === "ban" ? "Ban user" : "Unban user",
        variant: action === "ban" ? "danger" : "default"
      });
      if (!ok) return;
      try {
        if (action === "ban") {
          await studioApi.banAuthUser(user.id);
          toastStore.success("User banned");
        } else {
          await studioApi.unbanAuthUser(user.id);
          toastStore.success("User unbanned");
        }
        await loadUsers();
      } catch (e) {
        toastStore.error(e instanceof Error ? e.message : `Failed to ${action} user`);
      }
    }
    async function removeUser(user) {
      if (!canManageUsers()) {
        toastStore.error("Only admin/owner can delete users");
        return;
      }
      const ok = await confirmDialog.open({
        title: "Delete user",
        message: `Delete ${user.email ?? user.id}? This action cannot be undone.`,
        confirmText: "Delete user",
        variant: "danger"
      });
      if (!ok) return;
      try {
        await studioApi.deleteAuthUser(user.id);
        toastStore.success("User deleted");
        await loadUsers();
      } catch (e) {
        toastStore.error(e instanceof Error ? e.message : "Failed to delete user");
      }
    }
    function openDetails(user) {
      selectedUser = user;
      detailOpen = true;
    }
    $$renderer2.push(`<div class="space-y-6">`);
    PageHeader($$renderer2, {
      title: "Auth Users",
      description: "Manage authenticated users, status, and account lifecycle."
    });
    $$renderer2.push(`<!----> `);
    SectionCard($$renderer2, {
      title: "Users",
      description: "Search, review activity, and apply administrative actions.",
      children: ($$renderer3) => {
        $$renderer3.push(`<div class="space-y-4"><div class="flex flex-col gap-3 md:flex-row md:items-center"><div class="min-w-0 flex-1">`);
        SearchInput($$renderer3, {
          value: searchQuery,
          placeholder: "Search by email, phone, user id...",
          oninput: queueSearch
        });
        $$renderer3.push(`<!----></div> <div class="flex items-center gap-2">`);
        Button($$renderer3, {
          variant: "secondary",
          size: "sm",
          onclick: () => void loadUsers(),
          children: ($$renderer4) => {
            $$renderer4.push(`<!---->Refresh`);
          }
        });
        $$renderer3.push(`<!----></div></div> `);
        if (!canManageUsers()) {
          $$renderer3.push("<!--[0-->");
          $$renderer3.push(`<div class="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Read-only mode: only admin/owner can ban/unban or delete users.</div>`);
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]--> `);
        if (loading) {
          $$renderer3.push("<!--[0-->");
          LoadingSkeleton($$renderer3, { lines: 10 });
        } else if (error) {
          $$renderer3.push("<!--[1-->");
          ErrorState($$renderer3, {
            title: "Could not load users",
            message: error,
            onRetry: () => void loadUsers()
          });
        } else if (users.length === 0) {
          $$renderer3.push("<!--[2-->");
          EmptyState($$renderer3, {
            title: "No users found",
            message: "No users match your filters yet."
          });
        } else {
          $$renderer3.push("<!--[-1-->");
          $$renderer3.push(`<div class="overflow-x-auto rounded-xl border border-surface-6 bg-surface-2"><table class="min-w-full text-sm"><thead class="bg-surface-3 text-surface-11"><tr><th class="px-4 py-3 text-left">User</th><th class="px-4 py-3 text-left">Created</th><th class="px-4 py-3 text-left">Last Sign In</th><th class="px-4 py-3 text-left">Status</th><th class="px-4 py-3 text-left">Role</th><th class="px-4 py-3 text-right">Actions</th></tr></thead><tbody><!--[-->`);
          const each_array = ensure_array_like(users);
          for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
            let user = each_array[$$index];
            $$renderer3.push(`<tr class="border-t border-surface-6 hover:bg-surface-3/50"><td class="px-4 py-3"><div class="font-medium text-surface-12">${escape_html(user.email || user.phone || user.id)}</div> <div class="text-xs text-surface-10">${escape_html(user.id)}</div></td><td class="px-4 py-3 text-surface-11">${escape_html(formatDate(user.created_at))}</td><td class="px-4 py-3 text-surface-11">${escape_html(formatDate(user.last_sign_in_at))}</td><td class="px-4 py-3">`);
            StatusBadge($$renderer3, { status: String(user.status ?? "active") });
            $$renderer3.push(`<!----></td><td class="px-4 py-3 text-surface-11">${escape_html(String(user.role ?? "user"))}</td><td class="px-4 py-3"><div class="flex justify-end gap-2">`);
            Button($$renderer3, {
              size: "sm",
              variant: "ghost",
              onclick: () => openDetails(user),
              children: ($$renderer4) => {
                $$renderer4.push(`<!---->Details`);
              }
            });
            $$renderer3.push(`<!----> `);
            Button($$renderer3, {
              size: "sm",
              variant: String(user.status).toLowerCase() === "banned" ? "secondary" : "danger",
              disabled: !canManageUsers(),
              onclick: () => void toggleBan(user),
              children: ($$renderer4) => {
                $$renderer4.push(`<!---->${escape_html(String(user.status).toLowerCase() === "banned" ? "Unban" : "Ban")}`);
              }
            });
            $$renderer3.push(`<!----> `);
            Button($$renderer3, {
              size: "sm",
              variant: "danger",
              disabled: !canManageUsers(),
              onclick: () => void removeUser(user),
              children: ($$renderer4) => {
                $$renderer4.push(`<!---->Delete`);
              }
            });
            $$renderer3.push(`<!----></div></td></tr>`);
          }
          $$renderer3.push(`<!--]--></tbody></table></div> <div class="flex items-center justify-between"><p class="text-xs text-surface-10">Page ${escape_html(currentPage)} · Showing up to ${escape_html(pageSize)} users · Approx total ${escape_html(total)}</p> <div class="flex items-center gap-2">`);
          Button($$renderer3, {
            variant: "secondary",
            size: "sm",
            disabled: currentPage <= 1 || loading,
            onclick: () => {
              currentPage -= 1;
              void loadUsers();
            },
            children: ($$renderer4) => {
              $$renderer4.push(`<!---->Previous`);
            }
          });
          $$renderer3.push(`<!----> `);
          Button($$renderer3, {
            variant: "secondary",
            size: "sm",
            disabled: !hasNext || loading,
            onclick: () => {
              currentPage += 1;
              void loadUsers();
            },
            children: ($$renderer4) => {
              $$renderer4.push(`<!---->Next`);
            }
          });
          $$renderer3.push(`<!----></div></div>`);
        }
        $$renderer3.push(`<!--]--></div>`);
      }
    });
    $$renderer2.push(`<!----> `);
    SlideOver($$renderer2, {
      open: detailOpen,
      onclose: () => {
        detailOpen = false;
      },
      title: selectedUser?.email || selectedUser?.id || "User details",
      children: ($$renderer3) => {
        if (selectedUser) {
          $$renderer3.push("<!--[0-->");
          JsonViewer($$renderer3, { value: selectedUser, maxHeight: "32rem" });
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]-->`);
      }
    });
    $$renderer2.push(`<!----></div>`);
  });
}
export {
  _page as default
};
