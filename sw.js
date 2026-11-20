// Offline support: network first, falling back to the last copy this browser saw. Nothing is precached, so a visitor always gets fresh code and data when online.
const CACHE = 'marketprism-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || r.headers.has('range')) return;
  e.respondWith(fetch(r).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); } return res; })
    .catch(() => caches.match(r).then(m => m || (r.mode === 'navigate' ? caches.match(u.pathname) || caches.match('./') : undefined) || new Response('Offline and not cached yet.', { status: 503, headers: { 'Content-Type': 'text/plain' } }))));
});
