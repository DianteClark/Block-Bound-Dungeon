/* Offline-first service worker. The app opens instantly from the cache. The browser checks this
 * file on every launch; each release bumps CACHE, which installs a complete fresh copy of every
 * file at once and takes over, so old and new files are never mixed. */
const CACHE = 'bbd-v36';
const CORE = [
  './', 'index.html', 'styles/main.css', 'manifest.webmanifest', 'src/art/heroes.js', 'src/art/icons.js',
  'src/art/index.js', 'src/art/items.js', 'src/art/kit.js', 'src/art/monsters.js', 'src/audio/audio.js',
  'src/core/rng.js', 'src/core/store.js', 'src/data/blocks.js', 'src/data/enemies.js', 'src/data/events.js',
  'src/data/heroes.js', 'src/data/potions.js', 'src/data/relics.js', 'src/data/rules.js',
  'src/data/shapes.js', 'src/engine/board.js', 'src/engine/combat.js', 'src/engine/run.js',
  'src/engine/stats.js', 'src/main.js', 'src/ui/app.js', 'src/ui/combat.js', 'src/ui/dom.js',
  'src/ui/screens.js', 'src/ui/sheets.js', 'fonts/lilita-one-latin-400-normal.woff2',
  'fonts/fredoka-latin-500-normal.woff2', 'fonts/fredoka-latin-600-normal.woff2',
  'fonts/fredoka-latin-700-normal.woff2', 'icons/icon-192.png', 'icons/icon-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      return cache.match('index.html');
    }
  }));
});
