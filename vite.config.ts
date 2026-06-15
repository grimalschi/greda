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
        // Для MVP кэшируем всё приложение и весь контент сразу (см. ТЗ §7).
        globPatterns: ['**/*.{js,css,html,svg,json,woff2,webmanifest,ico,png}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        // Чтобы PWA можно было проверить и в `vite dev`.
        enabled: false,
      },
    }),
  ],
})
