import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Caches the built app shell so it also opens with no network at all.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'Fin Track',
        short_name: 'Fin Track',
        description: 'Local-first personal finance tracker',
        theme_color: '#0f766e',
        background_color: '#f6f6f4',
        display: 'standalone',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
      workbox: { maximumFileSizeToCacheInBytes: 4 * 1024 * 1024 },
    }),
  ],
});
