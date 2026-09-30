import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./i18n";
import "./index.css";

/**
 * Stale-deploy recovery
 * ---------------------
 * After a new deploy, an old cached index.html / service worker can point at
 * chunk files (e.g. CategoryDetail-xxxx.js) that no longer exist. The server
 * then answers with HTML, the browser refuses to run it as JavaScript, and the
 * page goes blank.
 *
 * This only runs when a chunk has ALREADY failed to load (the page is broken
 * anyway), so it does not bring back the unwanted auto-refresh during normal
 * use. It clears any old caches and reloads ONCE. The sessionStorage flag
 * prevents any reload loop.
 *
 * NOTE: this no longer unregisters the service worker — vite-plugin-pwa's
 * own registration (injected into index.html, registerType: 'autoUpdate')
 * owns that lifecycle now. Unregistering it here would fight with it.
 */
const RELOAD_FLAG = "chunk-recovery-reloaded";

const recoverFromStaleChunk = async () => {
  if (sessionStorage.getItem(RELOAD_FLAG)) return; // already tried once, don't loop
  sessionStorage.setItem(RELOAD_FLAG, "1");
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch (err) {
    console.error("Stale chunk cleanup failed:", err);
  }
  window.location.reload();
};

// Fired by Vite when a dynamic import's preload fails.
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  recoverFromStaleChunk();
});

// Fallback for lazy() imports that fail outside Vite's preload helper.
const isChunkError = (msg: unknown) =>
  typeof msg === "string" &&
  (msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Importing a module script failed") ||
    msg.includes("error loading dynamically imported module"));

window.addEventListener("unhandledrejection", (e) => {
  if (isChunkError(e.reason?.message)) recoverFromStaleChunk();
});
window.addEventListener("error", (e) => {
  if (isChunkError(e.message)) recoverFromStaleChunk();
});

// Once the app has been up for a while, allow future deploys to recover again.
window.addEventListener("load", () => {
  setTimeout(() => sessionStorage.removeItem(RELOAD_FLAG), 10000);
});

// Render the application.
const container = document.getElementById("root");
if (!container) throw new Error("Failed to find the root element");

const root = createRoot(container);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

/**
 * Service worker registration is handled entirely by vite-plugin-pwa
 * (registerType: 'autoUpdate', injectRegister: 'inline' in vite.config.ts).
 * It injects its own registration script into index.html at build time and,
 * with skipWaiting + clientsClaim both on, a new service worker activates
 * itself as soon as it finishes installing in the background — no manual
 * registration, update polling, or prompt UI needed here. A plain page
 * refresh after that picks up the new version.
 *
 * Do not add a second `navigator.serviceWorker.register(...)` call here —
 * registering the same scope twice from two different places is exactly
 * what caused deploys to get stuck requiring a full cache/app clear before.
 */