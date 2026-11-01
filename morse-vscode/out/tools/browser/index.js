"use strict";
/**
 * Browser Tool Module
 * Exports all browser-related functionality
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.quickFetchUrl = exports.fetchUrl = exports.createUrlFetcher = exports.UrlFetcher = exports.registerBrowserCommands = exports.createBrowserCommands = exports.BrowserCommands = exports.createBrowserPanel = exports.BrowserPanel = exports.createBrowserService = exports.BrowserService = void 0;
// Types
__exportStar(require("./types"), exports);
// Service
var service_1 = require("./service");
Object.defineProperty(exports, "BrowserService", { enumerable: true, get: function () { return service_1.BrowserService; } });
Object.defineProperty(exports, "createBrowserService", { enumerable: true, get: function () { return service_1.createBrowserService; } });
// Panel
var panel_1 = require("./panel");
Object.defineProperty(exports, "BrowserPanel", { enumerable: true, get: function () { return panel_1.BrowserPanel; } });
Object.defineProperty(exports, "createBrowserPanel", { enumerable: true, get: function () { return panel_1.createBrowserPanel; } });
// Commands
var commands_1 = require("./commands");
Object.defineProperty(exports, "BrowserCommands", { enumerable: true, get: function () { return commands_1.BrowserCommands; } });
Object.defineProperty(exports, "createBrowserCommands", { enumerable: true, get: function () { return commands_1.createBrowserCommands; } });
Object.defineProperty(exports, "registerBrowserCommands", { enumerable: true, get: function () { return commands_1.registerBrowserCommands; } });
// Fetcher
var fetcher_1 = require("./fetcher");
Object.defineProperty(exports, "UrlFetcher", { enumerable: true, get: function () { return fetcher_1.UrlFetcher; } });
Object.defineProperty(exports, "createUrlFetcher", { enumerable: true, get: function () { return fetcher_1.createUrlFetcher; } });
Object.defineProperty(exports, "fetchUrl", { enumerable: true, get: function () { return fetcher_1.fetchUrl; } });
Object.defineProperty(exports, "quickFetchUrl", { enumerable: true, get: function () { return fetcher_1.quickFetchUrl; } });
//# sourceMappingURL=index.js.map