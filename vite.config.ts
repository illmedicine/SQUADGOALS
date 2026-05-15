import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Apex domain (squad-ren.com) serves the app from root. The legacy
// /SQUADGOALS/ GitHub Pages path is no longer used once the CNAME flips DNS.
export default defineConfig(() => ({
  base: '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // While auth is being stabilized, keep the SW from caching old builds.
      // Re-enable workbox precache later once everything is solid.
      injectRegister: false,
      selfDestroying: true,
      includeAssets: ['logo.png', 'favicon.png', 'icon-192.png', 'icon-512.png', 'favicon.svg', 'CNAME'],
      manifest: {
        name: 'Squad REN',
        short_name: 'SquadREN',
        description: 'Squad REN by illy robotic instruments — Friend Finder.',
        theme_color: '#7c3aed',
        background_color: '#0b0b14',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ]
}));
