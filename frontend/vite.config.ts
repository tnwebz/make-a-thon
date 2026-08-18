import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc' // 👈 Restored your original SWC plugin
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiUrl = env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1';
  
  // Escape regex characters in apiUrl for urlPattern matching
  const escapedApiUrl = apiUrl.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: 'auto',
        devOptions: {
          enabled: true // 👈 Allows testing PWA features on localhost!
        },
        includeAssets: ['favicon.png', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
        manifest: {
          id: '/', // Unique ID of the application
          name: 'SkillForge Offline Learning',
          short_name: 'SkillForge',
          description: 'Digital Learning Platform for Rural School Students',
          theme_color: '#ffffff',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '/',
          icons: [
            // Separate purposes for each icon size to avoid the 'any maskable' warning
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ],
          screenshots: [
            // Desktop screenshot for Rich PWA Install UI on desktop
            {
              src: 'desktop-screenshot.png',
              sizes: '1280x720',
              type: 'image/png',
              form_factor: 'wide',
              label: 'SkillForge Desktop Dashboard'
            },
            // Mobile screenshot for Rich PWA Install UI on mobile
            {
              src: 'mobile-screenshot.png',
              sizes: '750x1334',
              type: 'image/png',
              form_factor: 'narrow',
              label: 'SkillForge Mobile View'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
          navigateFallback: '/index.html',
          runtimeCaching: [
            {
              // 1. Auth & Execution routes - strictly NetworkOnly (Never Cache)
              urlPattern: new RegExp(`^${escapedApiUrl}/(login|users|user/change-password|user/zoom-credentials|admin-login|execute)`, 'i'),
              handler: 'NetworkOnly',
            },
            {
              // 2. Dynamic CRM / Dashboard / Learning content - NetworkFirst
              urlPattern: new RegExp(`^${escapedApiUrl}/(courses|my-courses|progress|meetings|code-tests|assignments|admin|instructor)`, 'i'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'dynamic-api-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 7, // Keep cached for 7 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              // 3. Static/Resource Assets (like generated PDFs, uploads, or static files) - StaleWhileRevalidate
              urlPattern: new RegExp(`^${escapedApiUrl}/(generate-pdf|uploads|static)/.*`, 'i'),
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'static-resource-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // Keep cached for 30 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
      }),
    ],
    server: {
      host: '0.0.0.0', // ✅ Binds to all network interfaces for LAN connectivity
      port: 5173, // ✅ Keeps the port fixed
      hmr: {
        overlay: false, // ✅ Fixes the WebSocket disconnect error
      },
    },
  }
})