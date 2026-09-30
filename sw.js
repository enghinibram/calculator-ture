const CACHE = 'ture-v49';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/calculator-salariu.html',
  '/article.css',
  '/game.js',
];
// Biblioteca Supabase (versiune fixă, aceeași ca în index.html), ca aplicația
// să pornească și fără rețea. Separat, ca o problemă a CDN-ului să nu blocheze instalarea.
const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.min.js';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS).then(() => c.add(SUPABASE_JS).catch(() => {})))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      // Un răspuns redirecționat din cache nu poate servi o navigare (ex. iframe) → îl refacem
      if (cached && cached.redirected) {
        return cached.blob().then(body => new Response(body, {
          status: cached.status, statusText: cached.statusText, headers: cached.headers,
        }));
      }
      return cached || fetch(e.request);
    })
  );
});

self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  const title = data.title || 'Calculatorture';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: data.url || '/',
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.openWindow(e.notification.data || '/')
  );
});
