import react from '@vitejs/plugin-react';
import type { Connect, Plugin } from 'vite';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { GET as ttsHandler } from './api/tts.ts';

/** Serves /api/tts locally (dev + preview); on Vercel the api/ folder is a function. */
function ttsApi(): Plugin {
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    if (!req.url?.startsWith('/api/tts')) return next();
    void ttsHandler(new Request(new URL(req.url, 'http://localhost')))
      .then(async (r) => {
        res.statusCode = r.status;
        r.headers.forEach((v, k) => res.setHeader(k, v));
        res.end(Buffer.from(await r.arrayBuffer()));
      })
      .catch(next);
  };
  return {
    name: 'tts-api',
    configureServer: (server) => void server.middlewares.use(middleware),
    configurePreviewServer: (server) => void server.middlewares.use(middleware),
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Server-only secret: load it into process.env for the middleware. Never expose it as VITE_*.
  const env = loadEnv(mode, process.cwd(), '');
  for (const key of ['ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID']) {
    if (env[key] && !process.env[key]) process.env[key] = env[key];
  }
  return {
    plugins: [
      react(),
      ttsApi(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['icon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'Panda World Spelling',
          short_name: 'Panda Spelling',
          description: 'A spelling game where every correct word earns a panda.',
          display: 'standalone',
          orientation: 'any',
          background_color: '#fdf6ec',
          theme_color: '#cfeee3',
          start_url: '/',
          scope: '/',
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2,json,webmanifest}'],
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
          // Keep spoken words for offline play once they've been heard.
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname === '/api/tts',
              handler: 'CacheFirst',
              options: {
                cacheName: 'tts-audio',
                expiration: { maxEntries: 4000 },
                cacheableResponse: { statuses: [200] },
                rangeRequests: true,
              },
            },
          ],
        },
      }),
    ],
  };
});
