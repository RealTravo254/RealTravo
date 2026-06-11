import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: false, // 👈 1. Added this to completely disable code-change auto-refreshes
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        // FIXED: Added the explicit ": string" type declaration to the id parameter here
        manualChunks(id: string) {
          // Let mapbox-gl be code-split naturally via dynamic imports
          if (id.includes('mapbox-gl')) {
            return 'mapbox';
          }
          // Core vendor chunk - smaller subset
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'react-vendor';
          }
          // Router chunk
          if (id.includes('react-router')) {
            return 'router';
          }
          // UI components chunk
          if (id.includes('@radix-ui')) {
            return 'ui';
          }
          // Supabase chunk - defer auth loading
          if (id.includes('@supabase')) {
            return 'supabase';
          }
          // PDF generation chunk - only loaded when downloading
          if (id.includes('jspdf') || id.includes('qrcode')) {
            return 'pdf';
          }
          // Calendar/date picker chunk
          if (id.includes('react-day-picker') || id.includes('date-fns')) {
            return 'calendar';
          }
          // Paystack chunk - only loaded on payment pages
          if (id.includes('@paystack')) {
            return 'paystack';
          }
        },
      },
    },
  },
  plugins: [
    react(),
    // 👈 2. Lovable tagger completely removed from here
    VitePWA({
      registerType: 'prompt', // 👈 3. Changed from 'autoUpdate' to 'prompt' so it stops refreshing on background updates
      injectRegister: 'inline',
      includeAssets: ['favicon.ico', 'robots.txt'],
      manifest: {
        name: 'Trip Trac Go',
        short_name: 'TripTrac',
        description: 'Discover and book amazing trips, events, hotels and adventures',
        theme_color: '#008080',
        background_color: '#008080',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        start_url: '/',
        scope: '/',
        orientation: 'portrait-primary',
        prefer_related_applications: false,
        icons: [
          {
            src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" fill="%23008080"/><text x="96" y="130" font-size="120" text-anchor="middle" fill="white" font-family="system-ui, sans-serif" font-weight="bold">T</text></svg>',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          },
          {
            src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="%23008080"/><text x="256" y="350" font-size="320" text-anchor="middle" fill="white" font-family="system-ui, sans-serif" font-weight="bold">T</text></svg>',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/supabase/, /^\/~oauth/],
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/lmkxpzemfvmffxppxzky\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              networkTimeoutSeconds: 10,
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/lmkxpzemfvmffxppxzky\.supabase\.co\/storage\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-storage-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'unsplash-images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\.(png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets'
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          }
        ]
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ['react', 'react-dom', '@tanstack/react-query'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime', '@tanstack/react-query'],
    exclude: [],
    force: true,
    esbuildOptions: {
      jsx: 'automatic',
    },
  },
}));