import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./i18n";
import "./index.css";

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
        // NOT reload the page. (Removed: the old SKIP_WAITING postMessage
        // and the controllerchange -> window.location.reload() listener,
        // which together were the source of the unwanted auto-refresh.)
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