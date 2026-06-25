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
 */
if ('serviceWorker' in navigator) {
  const registerSW = () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered successfully with scope:', registration.scope);
        
        // Check for updates every 60 seconds
        setInterval(() => {
          registration.update();
        }, 60 * 1000);

        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker == null) return;
          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content available - auto-activate without user action
              installingWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          };
        };

        // When the new SW takes over, reload the page automatically
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!refreshing) {
            refreshing = true;
            window.location.reload();
          }
        });
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