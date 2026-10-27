// ニチジョウ・ファイターズ Service Worker(オフラインで遊べるようにキャッシュ)
// VERSION は tools/bump-sw.js がファイル内容から自動で書き換えます(内容が変わると新しい版になる)
const VERSION = 'nf-6d02fdcb82d1';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))));
  // 新しい版はすぐには切り替えず待機 → 次に起動した時(または画面を離れた時)に有効化
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('nf-') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    let hit = await c.match(req, { ignoreSearch: true });
    if (!hit && req.mode === 'navigate') hit = await c.match('./index.html') || await c.match('./');
    if (hit) return hit;
    try { return await fetch(req); } catch (err) { return Response.error(); }
  })());
});
