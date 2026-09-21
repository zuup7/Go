// 자동 생성 — build.mjs --pwa 가 굽는다. 고치지 말 것.
//
// 한 번 받아두면 그 뒤로는 네트워크를 안 탄다 (비행기 모드에서도 열린다).
// 캐시 이름의 해시는 빌드 내용에서 나온다 — 게임이 바뀌면 이름이 달라지고,
// 새 워커가 깔리면서 옛 캐시를 통째로 지운다.
const CACHE = 'chartrun-8a4ba5238233';
const FILES = ["./","./index.html","./manifest.webmanifest","./icon-192.png","./icon-512.png","./icon-maskable.png"];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // 캐시부터. 없으면 네트워크로 — 어차피 게임은 파일 하나라 캐시에 다 있다.
  e.respondWith(caches.match(e.request).then((hit) => hit ?? fetch(e.request)));
});
