import { a as apiClient } from "./client2.js";
function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}
function getApiBaseUrl() {
  return trimTrailingSlash(apiClient.getBaseUrl());
}
function getDocsBaseUrl() {
  {
    return "http://localhost:4321";
  }
}
function getDocsUrl(path = "") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getDocsBaseUrl()}${path ? normalizedPath : ""}`;
}
function getRealtimeWebSocketUrl() {
  return getApiBaseUrl().replace(/^http/i, "ws") + "/realtime/v1/websocket";
}
export {
  getDocsUrl as a,
  getRealtimeWebSocketUrl as g
};
