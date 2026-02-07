import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
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
  // Use requestIdleCallback or setTimeout to defer registration
  const registerSW = () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered with scope:', registration.scope);
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker == null) return;
          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('New content available; please refresh.');
            }
          };
        };
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
