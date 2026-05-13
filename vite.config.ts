import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the site under /<repo>/ — adjust if repo name changes.
const REPO = 'SQUADGOALS';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? `/${REPO}/` : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'icon-192.svg', 'icon-512.svg', 'favicon.svg'],
      manifest: {
        name: 'Squad REN',
        short_name: 'SquadREN',
        description: 'Squad REN by illy robotic instruments — Friend Finder.',
        theme_color: '#7c3aed',
        background_color: '#0b0b14',
        display: 'standalone',
        orientation: 'portrait',
        start_url: `/${REPO}/`,
        scope: `/${REPO}/`,
        icons: [
          { src: 'logo.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'logo.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' }
        ]
      }
    })
  ]
}));
