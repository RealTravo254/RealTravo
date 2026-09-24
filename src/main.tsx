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
 * use. It clears the service worker + caches and reloads ONCE. The
 * sessionStorage flag prevents any reload loop.
 */
const RELOAD_FLAG = "chunk-recovery-reloaded";

const recoverFromStaleChunk = async () => {
  if (sessionStorage.getItem(RELOAD_FLAG)) return; // already tried once, don't loop
  sessionStorage.setItem(RELOAD_FLAG, "1");
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
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

// Render the application FIRST
const container = document.getElementById("root");
if (!container) throw new Error("Failed to find the root element");

const root = createRoot(container);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

/**
 * Service Worker Registration - deferred until after first render
 * This prevents SW registration from blocking the initial paint.
 *
 * NOTE: This intentionally does NOT auto-activate new versions or
 * auto-reload the page. A new service worker is downloaded and installed
 * in the background, but it sits in the "waiting" state (standard browser
 * behavior) until the user naturally closes/reopens all tabs or manually
 * refreshes — at which point the new version takes over with no disruption
 * to whatever the user is doing right now.
 */
if ('serviceWorker' in navigator) {
  const registerSW = () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered successfully with scope:', registration.scope);

        // Still check for updates periodically — this only downloads/installs
        // a new worker in the background. It does NOT activate it and does
        // NOT reload the page.
        setInterval(() => {
          registration.update();
        }, 60 * 1000);
      })
      .catch((error) => {
        console.error('Error during service worker registration:', error);
      });
  };

  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(registerSW);
  } else {
    setTimeout(registerSW, 3000);
  }
}