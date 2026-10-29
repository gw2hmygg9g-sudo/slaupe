// Bump VERSION whenever you change any game file, so players get the new version.
const VERSION = 'slope-original-v1';
const FILES = [
  './', './index.html', './manifest.webmanifest',
  './TemplateData/style.css', './TemplateData/UnityProgress.js', './TemplateData/unityloader41.js',
  './TemplateData/progressEmpty.Dark.png', './TemplateData/progressFull.Dark.png', './TemplateData/progressLogo.Dark.png',
  './Build/slope.json', './Build/slope_data.unityweb', './Build/slope_wasmcode.unityweb',
  './Build/slope_wasmframework.unityweb', './Build/slope_framework.unityweb', './Build/slope_memory.unityweb',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first so updates show up right away, cache when offline
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
