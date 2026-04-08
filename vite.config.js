import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  test: {
    include: ['src/test/**/*.test.{js,jsx}'],
    exclude: ['node_modules', '.claude/worktrees/**'],
    coverage: {
      provider: 'v8',
      include: [
        'src/utils/helpers.js',
        'src/utils/normalizeProject.js',
        'src/utils/projectCalculations.js',
        'src/utils/devisMoeCalculations.js',
        'src/utils/crcArchive.js',
        'src/utils/exportHelpers.js',
        'src/utils/formatObsText.jsx',
        'src/utils/globalUI.js',
        'src/utils/pdf/pdfSharedHelpers.js',
        'src/data/**',
        'src/hooks/useDevisMoe.js',
        'src/hooks/useBranding.js',
      ],
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'logo-192.png', 'logo-512.png'],
      manifest: {
        name: 'EstimaVRD',
        short_name: 'EstimaVRD',
        description: 'Estimation et gestion des marchés publics VRD',
        theme_color: '#0a1929',
        background_color: '#f1f4f9',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          {
            src: 'logo-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'logo-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 Mo
        // Exclut les requêtes Firestore du cache SW
        navigateFallbackDenylist: [/^\/__(\/|$)/],
        runtimeCaching: [
          {
            // Cache les fonts Google
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Cache tuiles satellite ESRI (usage terrain)
            urlPattern: /^https:\/\/.*\.arcgisonline\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'esri-tiles-cache',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('xlsx')) return 'vendor-xlsx';
            if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('canvg') || id.includes('purify'))
              return 'vendor-pdf';
            if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler') || id.includes('prop-types') || id.includes('object-assign') || id.includes('loose-envify'))
              return 'vendor-react';
            if (id.includes('firebase'))
              return 'vendor-firebase';
          }
        },
      },
    },
  },
})
