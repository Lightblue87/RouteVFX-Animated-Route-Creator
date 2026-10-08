// Service Worker: Offline-App-Shell. Cacht nur eigene, gleich-originige Assets (keine Drittanbieter-Kacheln,
// keine Nutzermedien). Netzwerk zuerst für HTML (Updates), Cache zuerst für versionierte Assets.
const CACHE = 'arc-shell-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './geodata/countries.json', './geodata/lakes.json', './geodata/places.json', './geodata/airports.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  // Alte Shell-Caches entfernen – betrifft NICHT IndexedDB (Nutzerprojekte bleiben erhalten).
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('arc-shell-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put('./index.html', copy)); return r; }).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => {
      if (r.ok && (url.pathname.includes('/assets/') || url.pathname.includes('/geodata/'))) {
        const copy = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return r;
    })),
  );
});
