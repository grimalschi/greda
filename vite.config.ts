import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Проект разворачивается на GitHub Pages по адресу https://grimalschi.github.io/greda/
const BASE = '/greda/'

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-maskable.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Greda — чтение на испанском',
        short_name: 'Greda',
        description:
          'Адаптированные произведения на испанском с переводом предложений на русский. Работает офлайн.',
        lang: 'ru',
        theme_color: '#1f6feb',
        background_color: '#0d1117',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Прекэшируем ТОЛЬКО оболочку приложения. Контент (268 работ ≈ 16 МБ) не прекэшируем —
        // иначе первая загрузка тяжёлая, а обновления каталога «залипают» в старом кэше SW.
        globPatterns: ['**/*.{js,css,html,svg,woff2,webmanifest,ico,png}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Контент: онлайн — всегда свежий из сети; офлайн — из кэша (то, что уже открывали).
            urlPattern: /\/content\/.+\.json$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'greda-content',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 4000, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        // Чтобы PWA можно было проверить и в `vite dev`.
        enabled: false,
      },
    }),
  ],
})
