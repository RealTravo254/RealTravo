import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

/**
 * Service Worker Registration for PWA
 * This handles instant loading (precaching) and automatic updates.
 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered with scope:', registration.scope);

        // Check for updates to the Service Worker
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker == null) return;

          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // New content is available! 
                // We notify the user or auto-reload to apply the update immediately.
                console.log('New content available; please refresh.');
                
                // OPTIONAL: Auto-reload to apply updates immediately
                // window.location.reload(); 
              } else {
                // Content is cached for offline use for the first time
                console.log('Content is cached for offline use.');
              }
            }
          };
        };
      })
      .catch((error) => {
        console.error('Error during service worker registration:', error);
      });
  });
}

// Render the application
const container = document.getElementById("root");
if (!container) throw new Error("Failed to find the root element");

const root = createRoot(container);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);