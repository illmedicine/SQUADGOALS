import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
// GitHub Pages serves the site under /<repo>/ — adjust if repo name changes.
var REPO = 'SQUADGOALS';
export default defineConfig(function (_a) {
    var command = _a.command;
    return ({
        base: command === 'build' ? "/".concat(REPO, "/") : '/',
        plugins: [
            react(),
            VitePWA({
                registerType: 'autoUpdate',
                // While auth is being stabilized, keep the SW from caching old builds.
                // Re-enable workbox precache later once everything is solid.
                injectRegister: false,
                selfDestroying: true,
                includeAssets: ['logo.png', 'favicon.png', 'icon-192.png', 'icon-512.png', 'favicon.svg'],
                manifest: {
                    name: 'Squad REN',
                    short_name: 'SquadREN',
                    description: 'Squad REN by illy robotic instruments — Friend Finder.',
                    theme_color: '#7c3aed',
                    background_color: '#0b0b14',
                    display: 'standalone',
                    orientation: 'portrait',
                    start_url: "/".concat(REPO, "/"),
                    scope: "/".concat(REPO, "/"),
                    icons: [
                        { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
                        { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
                        { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
                    ]
                }
            })
        ]
    });
});
