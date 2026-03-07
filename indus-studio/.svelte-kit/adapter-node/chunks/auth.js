import { b as browser } from "./false.js";
import "clsx";
import { d as derived, w as writable } from "./index.js";
import "@sveltejs/kit/internal";
import "./exports.js";
import "./utils.js";
import "@sveltejs/kit/internal/server";
import "./root.js";
import "./state.svelte.js";
import { a as apiClient, b as authApi } from "./client2.js";
class AuthStore {
  // State
  user = $state(null);
  accessToken = $state(null);
  refreshToken = $state(null);
  loading = $state(false);
  error = $state(null);
  // Derived state
  isAuthenticated = $derived(!!this.accessToken && !!this.user);
  constructor() {
  }
  setSession(user, accessToken, refreshToken) {
    this.user = user;
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.error = null;
    apiClient.setTokens(accessToken, refreshToken);
  }
  loadFromStorage() {
    return;
  }
  async signOut() {
    try {
      await authApi.logout();
    } catch (e) {
    } finally {
      this.clearSession();
    }
  }
  clearSession() {
    this.user = null;
    this.accessToken = null;
    this.refreshToken = null;
    this.error = null;
    apiClient.clearTokens();
  }
  async login(email, password) {
    this.loading = true;
    this.error = null;
    try {
      const response = await authApi.login({ email, password });
      this.setSession(response.user, response.access_token, response.refresh_token);
      return true;
    } catch (err) {
      const error = err;
      this.error = error.message || "Login failed";
      return false;
    } finally {
      this.loading = false;
    }
  }
  async signup(email, password, metadata) {
    this.loading = true;
    this.error = null;
    try {
      const response = await authApi.signup({ email, password, metadata });
      this.setSession(response.user, response.access_token, response.refresh_token);
      return true;
    } catch (err) {
      const error = err;
      this.error = error.message || "Signup failed";
      return false;
    } finally {
      this.loading = false;
    }
  }
  async fetchUser() {
    if (!this.isAuthenticated) return;
    try {
      const user = await authApi.getUser();
      this.user = user;
      if (browser) ;
    } catch (err) {
      console.error("Failed to fetch user:", err);
    }
  }
  googleLogin(redirectTo = "/") {
    authApi.googleLogin(redirectTo);
  }
}
const auth = new AuthStore();
function createAuthWritable() {
  const { subscribe, set } = writable(auth);
  $effect(() => {
    set(auth);
  });
  return { subscribe };
}
const authStore = createAuthWritable();
derived(authStore, ($auth) => $auth.isAuthenticated);
derived(authStore, ($auth) => $auth.user);
export {
  auth as a
};
