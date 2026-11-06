import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Кроссовые журналы',
        short_name: 'Кроссы',
        display: 'standalone',
        theme_color: '#1e40af',
        background_color: '#ffffff',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /\/api\/collections\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pocketbase-api',
              networkTimeoutSeconds: 10,
            },
          },
        ],
      },
    }),
  ],
})