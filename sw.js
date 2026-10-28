/* Network-first service worker: always tries for the latest version, falls back to cache offline. */
const CACHE = 'bbd-v34';
const CORE = [
  './', 'index.html', 'styles/main.css', 'manifest.webmanifest',
  'src/main.js', 'src/core/rng.js', 'src/core/store.js',
  'src/data/rules.js', 'src/data/blocks.js', 'src/data/shapes.js', 'src/data/heroes.js', 'src/data/enemies.js',
  'src/data/relics.js', 'src/data/potions.js', 'src/data/events.js',
  'src/engine/board.js', 'src/engine/stats.js', 'src/engine/combat.js', 'src/engine/run.js',
  'src/art/kit.js', 'src/art/index.js', 'src/art/heroes.js', 'src/art/monsters.js', 'src/art/items.js', 'src/art/icons.js',
  'src/audio/audio.js',
  'src/ui/app.js', 'src/ui/dom.js', 'src/ui/sheets.js', 'src/ui/screens.js', 'src/ui/combat.js',
  'fonts/lilita-one-latin-400-normal.woff2', 'fonts/fredoka-latin-500-normal.woff2',
  'fonts/fredoka-latin-600-normal.woff2', 'fonts/fredoka-latin-700-normal.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});
