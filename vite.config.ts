import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import project from './package.json' with { type: 'json' };
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const require = createRequire(import.meta.url);

function fontLicenses(): Plugin {
  return {
    name: 'nowwork-font-licenses',
    apply: 'build',
    generateBundle() {
      const source = Object.keys(project.dependencies).filter((name) => /^@fontsource(?:-variable)?\//.test(name))
        .map((name) => name + '\n\n' + readFileSync(require.resolve(name + '/LICENSE'), 'utf8').trim())
        .join('\n\n' + '-'.repeat(72) + '\n\n');
      this.emitFile({ type: 'asset', fileName: 'font-licenses.txt', source });
    },
  };
}

function offlineWorkspace(): Plugin {
  return {
    name: 'nowwork-offline',
    apply: 'build',
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const index = bundle['index.html'];
        if (!index || index.type !== 'asset') this.error('The offline workspace requires index.html.');
        const html = String(index.source);
        const files = Object.keys(bundle).filter((file) => /\.(js|css|woff2|webp|png)$/.test(file)).sort();
        // Vite fingerprints every compiled resource. A new build gets a separate cache.
        const revision = files.join('|') + html;
        let hash = 2166136261;
        for (const character of revision) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
        this.emitFile({ type: 'asset', fileName: 'offline.js', source: `
const scope = new URL(self.registration.scope);
const prefix = 'nowwork-' + scope.pathname + '-';
const version = prefix + ${JSON.stringify((hash >>> 0).toString(36))};
const appShell = new URL('index.html', scope).href;
const urls = ${JSON.stringify(files)}.map(file => new URL(file, scope).href);
const assets = new Set(urls);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(version);
    await cache.addAll(urls.map(url => new Request(url, { cache: 'reload' })));
    await cache.put(appShell, new Response(${JSON.stringify(html)}, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(prefix) && key !== version).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(async () => (await (await caches.open(version)).match(appShell)) || Response.error()));
  } else if (assets.has(url.href)) {
    // Precached build assets have one representation even when the host varies its CORS headers.
    event.respondWith((async () => (await (await caches.open(version)).match(url.href, { ignoreVary: true })) || fetch(event.request))());
  }
});
` });
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), fontLicenses(), offlineWorkspace()],
  // Hash routes keep navigation at the site root, so assets can follow the deployed directory.
  base: './',
  build: {
    outDir: 'dist',
    rolldownOptions: {
      output: {
        codeSplitting: { groups: [{ name: 'editor-engine', test: /node_modules[\\/](?:@tiptap[\\/]|prosemirror-)/ }] },
      },
    },
  },
});
