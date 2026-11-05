// 백귀사 오프라인 저장(서비스 워커): 게임 파일은 네트워크 먼저, 끊기면 저장본.
// 캐시 이름의 판 번호는 build.py 가 맞춘다. 판이 바뀌면 옛 저장본을 지운다.
const CACHE = 'baekgwisa-__VER__';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('baekgwisa-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req, {cache: 'no-cache'}) // 브라우저 캐시(Pages 10분)도 건너뛰어 새 판이 바로 보이게
      .then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});
