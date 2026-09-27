// 배포하면 폰에서 **바로** 새 판이 뜨는가.
//
// 예전엔 서비스 워커가 게임 화면까지 캐시부터 꺼냈고, 새 판은 「다음에 열 때」
// 보이게 돼 있었다. 그런데 홈 화면 앱은 다시 열어도 새로 여는 게 아니라 멈춰둔 걸
// 이어서 보여준다 — 그 「다음」이 한참 안 와서 배포해도 「전부 그대로」였다.
//
// **배포되는 파일(docs/)을 직접 읽는다.** dist 를 보고 「됐다」 했다가 틀린 적이 있다.
// 실제로 v1 → v2 로 갈아끼워 저절로 바뀌는지는 브라우저로 따로 확인했다 —
// 여기서는 그 동작을 만드는 줄들이 빠지지 않았는지를 지킨다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(`../../docs/${name}`, import.meta.url), 'utf8');
const sw = read('sw.js');
const html = read('index.html');

/** fetch 처리 본문만 */
const fetchHandler = sw.slice(sw.indexOf("addEventListener('fetch'"));

/**
 * 워커를 등록하는 **그 스크립트만**. index.html 전체를 보면 안 된다 — 게임 코드에도
 * visibilitychange 와 .update() 가 따로 있어서, 정규식이 둘을 이어 붙여 **옛 판에서도
 * 통과했다** (대조해보고 알았다). 아무것도 안 지키는 테스트였다.
 */
const regScript = (() => {
  const blocks = [...html.matchAll(/<script>([^]*?)<\/script>/g)].map((m) => m[1]);
  return blocks.find((b) => b.includes('serviceWorker')) ?? '';
})();

test('워커를 등록하는 스크립트가 있다', () => {
  assert.ok(regScript, 'index.html 에 서비스 워커 등록이 없다');
});

test('게임 화면은 네트워크 먼저 — 캐시부터 꺼내면 배포해도 옛 판이 뜬다', () => {
  assert.match(fetchHandler, /request\.mode === 'navigate'/, '게임 화면을 따로 다루지 않는다');
  const nav = fetchHandler.slice(fetchHandler.indexOf("'navigate'"));
  const netAt = nav.indexOf('fetch(e.request');
  const cacheAt = nav.indexOf('caches.match');
  assert.ok(netAt >= 0, '게임 화면을 네트워크로 안 받는다');
  assert.ok(netAt < cacheAt, '게임 화면을 캐시부터 꺼낸다');
});

test('HTTP 캐시도 건너뛴다 — 안 그러면 GitHub Pages 의 10분 동안은 옛 판이다', () => {
  assert.match(fetchHandler, /cache:\s*'no-cache'/);
});

test('네트워크가 없으면 캐시로 연다 — 비행기 모드에서도 열려야 한다', () => {
  const nav = fetchHandler.slice(fetchHandler.indexOf("'navigate'"));
  assert.match(nav, /\.catch\([^]*caches\.match/, '끊기면 아무것도 안 뜬다');
  // 받은 새 판을 캐시에 넣어둬야 오프라인에서 **마지막으로 본 판**이 뜬다
  assert.match(nav, /\.put\(/, '받은 판을 캐시에 안 넣는다 — 오프라인이면 첫 설치 때 판이 뜬다');
});

test('새 판이 깔리면 그 자리에서 한 번 새로고침한다', () => {
  assert.match(regScript, /addEventListener\('controllerchange'[^]*location\.reload\(\)/);
});

test('처음 깔 때는 새로고침하지 않는다 — 첫 방문에 괜히 깜빡인다', () => {
  // 처음 깔릴 때도 controllerchange 가 난다 (clients.claim). 원래 워커가 있었는지 봐야 한다
  const handler = regScript.slice(regScript.indexOf("addEventListener('controllerchange'"));
  const guardAt = handler.search(/if \(!had\)/);
  const reloadAt = handler.indexOf('location.reload()');
  assert.ok(guardAt >= 0 && guardAt < reloadAt, '처음 깔린 것과 새 판을 안 가른다');
  assert.match(regScript, /let had = !!sw\.controller/);
});

test('앱이 다시 앞으로 올 때마다 새 판을 확인한다 — 홈 화면 앱은 이어서 열리기만 한다', () => {
  assert.match(regScript, /addEventListener\('visibilitychange'[^]*\.update\(\)/);
});
