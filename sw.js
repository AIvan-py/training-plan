// Офлайн-режим: в зале со слабой связью план открывается из кеша.
// Поменяли картинки или PDF в dl/ — поднимите версию, иначе телефоны покажут старые файлы.
// На этом же домене живут другие сайты со своими кешами — трогаем только кеши с префиксом plan-.
const PREFIX = 'plan-';
const CACHE = PREFIX + 'v2';
const CORE = [
  './',
  'dl/plan-5-dney.pdf',
  'dl/den-1.png',
  'dl/den-2.png',
  'dl/den-3.png',
  'dl/den-4.png',
  'dl/den-5.png',
  'dl/nedelya.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Страница: сначала сеть (чтобы правки плана доходили), но не дольше 3 секунд — потом кеш.
async function page(event) {
  const cache = await caches.open(CACHE);
  const net = fetch(event.request).then((res) => {
    if (res.ok) cache.put('./', res.clone());
    return res;
  });
  event.waitUntil(net.catch(() => {}));
  try {
    return await Promise.race([net, new Promise((_, reject) => setTimeout(reject, 3000))]);
  } catch (e) {
    return (await cache.match('./')) || net;
  }
}

// Файлы и шрифты: из кеша, при первом обращении — из сети с сохранением.
async function asset(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Манифест и иконки — только из сети: установщик ярлыка на Android сверяет их с тем, что лежит на сайте.
  if (url.pathname.endsWith('/manifest.webmanifest') || url.pathname.includes('/icons/')) return;
  if (request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(page(event));
  } else if (url.origin === self.location.origin
    || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(asset(request));
  }
});
