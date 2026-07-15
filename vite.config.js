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
      registerType: 'prompt',
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
        skipWaiting: true,
        clientsClaim: true,
        // Exclut les requêtes Firestore du cache SW
        navigateFallbackDenylist: [/^\/__(\/|$)/],
        // Ne pas intercepter les requêtes Firestore / APIs externes
        navigateFallback: '/index.html',
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
            // Cache tuiles cartes (satellite ESRI, plan OSM, cadastre)
            urlPattern: /^https:\/\/(.*\.arcgisonline\.com|.*\.tile\.openstreetmap\.org|data\.geopf\.fr)\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles-cache',
              expiration: { maxEntries: 1000, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Cache photos CRC (Firebase Storage)
            // L'URL contient un token par fichier : une fois en cache, la photo
            // reste accessible offline sur le chantier. Les photos sont immuables
            // (nouvelle photo = nouvelle URL), donc CacheFirst.
            urlPattern: /^https:\/\/(firebasestorage\.googleapis\.com|.*\.firebasestorage\.app)\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'crr-photos-cache',
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
          // Le helper de préchargement de Vite est utilisé par TOUS les imports
          // dynamiques. Sans règle explicite, Rollup le range dans vendor-pdf :
          // l'import statique de ce mini-helper force alors tout vendor-pdf
          // (jspdf + html2canvas, ~743 KB) dans le préchargement initial.
          // On l'ancre dans vendor-react, déjà toujours en chemin critique.
          if (id.includes('vite/preload-helper')) return 'vendor-react';
          if (id.includes('node_modules')) {
            if (id.includes('xlsx')) return 'vendor-xlsx';
            // DOMPurify isolé : importé statiquement par helpers.js (chemin eager),
            // il ne doit PAS embarquer jspdf/html2canvas dans le préchargement initial.
            if (id.includes('purify')) return 'vendor-sanitize';
            if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('canvg'))
              return 'vendor-pdf';
            // leaflet & quill isolés AVANT la règle react (sinon react-leaflet /
            // react-quill seraient captés par `react` et préchargés au démarrage).
            if (id.includes('leaflet')) return 'vendor-leaflet';
            if (id.includes('quill')) return 'vendor-quill';
            // Sentry chargé en dynamique (voir src/sentry.js) : chunk dédié AVANT
            // la règle react, sinon `@sentry/react` retomberait dans vendor-react
            // et serait re-préchargé au démarrage malgré l'import dynamique.
            if (id.includes('@sentry')) return 'vendor-sentry';
            // Icônes lucide : PAS de chunk manuel. Rollup les répartit par usage,
            // les icônes utilisées uniquement par des vues lazy sortent ainsi du
            // chemin critique (la règle react les capterait via « lucide-react »).
            if (id.includes('lucide-react')) return undefined;
            // Éditeur riche (tiptap + prosemirror) et import Word (mammoth) :
            // gros modules lazy-only, isolés pour ne pas gonfler le chunk partagé
            // des vues (chaque module ne télécharge que ce qu'il utilise).
            if (id.includes('@tiptap') || id.includes('prosemirror')) return 'vendor-editor';
            if (id.includes('mammoth')) return 'vendor-mammoth';
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
