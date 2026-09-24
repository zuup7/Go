// 자동 생성 — build.mjs --pwa 가 굽는다. 고치지 말 것.
//
// 게임 화면(index.html)은 **네트워크 먼저**, 나머지(아이콘·manifest)는 캐시 먼저.
// 네트워크가 없으면 캐시로 연다 — 비행기 모드에서도 열린다.
// 캐시 이름의 해시는 빌드 내용에서 나온다 — 게임이 바뀌면 이름이 달라지고,
// 새 워커가 깔리면서 옛 캐시를 통째로 지운다.
const CACHE = 'chartrun-05fb8432461f';
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
  // 게임 화면은 네트워크 먼저. 예전엔 여기도 캐시부터라, 배포해도 폰은 옛 판을 계속
  // 보여줬다. no-cache 는 GitHub Pages 의 10분짜리 HTTP 캐시도 건너뛰고 서버에
  // 「바뀌었나」만 묻는다 (안 바뀌었으면 304 라 가볍다). 받은 건 캐시에 새로 넣어서,
  // 네트워크가 끊기면 **마지막으로 본 판**으로 연다.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request, { cache: 'no-cache' })
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put('./index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html').then((hit) => hit ?? caches.match('./'))),
    );
    return;
  }
  // 나머지는 캐시부터. 아이콘·manifest 는 판이 바뀔 때 캐시 이름째 갈린다
  e.respondWith(caches.match(e.request).then((hit) => hit ?? fetch(e.request)));
});
