/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'lokal'

// App wird von Vercel aus dem main-Branch unter der Domain-Wurzel ausgeliefert
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(`${pkg.version} (${commit})`),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      manifest: {
        name: 'Schatzsuche',
        short_name: 'Schatzsuche',
        description: 'Schatzsuchen im echten Gelände – Rätsel lösen, Stationen finden, Schatz heben.',
        lang: 'de',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#b45309',
        background_color: '#1c1917',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // Bereits angesehene Kartenkacheln für schlechten Empfang vorhalten
            urlPattern: /^https:\/\/tile\.openstreetmap\.org\//,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 400, maxAgeSeconds: 7 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
