const scope = self.registration.scope;
const cachePrefix = 'aural-studio:' + scope + ':';
const cacheName = cachePrefix + 'v2';
const entry = new URL('index.html', scope).href;
const files = [
  'index.html', 'manifest.webmanifest',
  'css/style.css', 'css/session.css',
  'js/app.js', 'js/session.js', 'js/input.js', 'js/audio.js', 'js/music.js', 'js/art.js',
  'js/curriculum.js', 'js/advanced-listening.js',
  'assets/bodoni-moda-subset.woff2', 'assets/listening-studio.webp',
  'assets/icon-192.png', 'assets/icon-512.png', 'assets/icon-maskable-512.png', 'assets/apple-touch-icon.png'
].map(file => new URL(file, scope).href);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache =>
    cache.addAll(files.map(url => new Request(url, { cache: 'reload' })))
  ));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(cachePrefix) && name !== cacheName)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  url.search = '';
  const key = url.href === scope ? entry : url.href;
  if (!files.includes(key)) return;

  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(key, response.clone()).catch(() => {});
      return response;
    } catch {
      return await cache.match(key) || Response.error();
    }
  })());
});
