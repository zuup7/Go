// 개발자 모드와 스테이지 선택.
// 제일 중요한 건 "평소 진행이 그대로인가" 와 "골라 들어간 판이 기록을 더럽히지 않는가" 다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  updateGame,
  startRun,
  setDevMode,
  runSummary,
  SELECT_CUTS,
  cutSlotOf,
  SELECT_DEV_OFF,
  SELECT_SLOTS,
  titleRows,
} from '../src/core/game.js';
import { DEV_CODE, pushDigit, codeMatches, KEYPAD, pushTap, tapOpens, TAP_OPEN, TAP_WINDOW } from '../src/core/devmode.js';
import { readFileSync } from 'node:fs';
import { emptySave, mergeRun, deserialize, serialize } from '../src/core/save.js';
import { STAGES } from '../src/data/stages.js';

const DT = 1 / 60;

const idle = (over = {}) => ({
  left: false,
  right: false,
  jump: false,
  jumpPressed: false,
  leftPressed: false,
  rightPressed: false,
  throwPressed: false,
  dashPressed: false,
  confirmPressed: false,
  restartPressed: false,
  pausePressed: false,
  mutePressed: false,
  anyPressed: false,
  ...over,
});

/** 한 프레임 */
const tap = (game, over) => updateGame(game, idle(over), DT);

/** 오프닝을 이미 본 판 — 여기 테스트들은 오프닝이 아니라 개발자 모드를 본다 */
const played = (seed = 1) => createGame({ seed, save: { ...emptySave(), seenOpening: true } });

/** 여러 자리를 차례로 넣는다 */
const type = (digits) => [...String(digits)].reduce((buf, d) => pushDigit(buf, d), '');

// ── 비밀번호 ────────────────────────────────────────────────
test('마지막 네 자리만 남는다', () => {
  assert.equal(type('1'), '1');
  assert.equal(type('12'), '12');
  assert.equal(type('1234'), '1234');
  // 한 자 더 넣으면 앞이 밀린다
  assert.equal(type('12345'), '2345');
});

test('앞에서 헛손질해도 뒤 네 자리가 맞으면 열린다', () => {
  assert.ok(codeMatches(type('991234')));
  assert.ok(codeMatches(type(DEV_CODE)));
});

test('틀린 번호로는 안 열린다', () => {
  for (const wrong of ['1235', '4321', '0000', '', '123']) {
    assert.equal(codeMatches(type(wrong)), false, `${wrong} 로 열렸다`);
  }
});

test('숫자판에 0~9 와 지우기·닫기가 다 있다', () => {
  for (let d = 0; d <= 9; d++) assert.ok(KEYPAD.includes(String(d)), `${d} 이 없다`);
  assert.ok(KEYPAD.includes('back'));
  assert.ok(KEYPAD.includes('close'));
});

// ── 평소 진행은 그대로 ──────────────────────────────────────
test('개발자 모드를 안 켰으면 타이틀에서 바로 시작한다 — 예전과 같다', () => {
  const game = played();
  assert.equal(game.dev, false);
  tap(game, { confirmPressed: true });
  assert.equal(game.scene, 'stageIntro', '바로 1스테이지로 가야 한다');
  assert.equal(game.stageIndex, 0);
  assert.equal(game.partial, false);
});

test('개발자 모드가 꺼져 있으면 타이틀에 「스테이지 선택」이 없다', () => {
  // **자리 번호로 보지 않는다.** 예전엔 titleIndex 가 0 인지 봤는데, 타이틀에
  // 줄을 하나 더하자(꾸미기) 번호가 밀려서 엉뚱하게 깨졌다. 줄 이름으로 찾는다.
  const game = played();
  const actions = titleRows(game).map((r) => r.action);
  assert.ok(!actions.includes('select'), `깨지도 않았는데 ${actions.join(',')} 가 보인다`);
});

// ── 켠 뒤 ───────────────────────────────────────────────────
test('켜면 타이틀에서 스테이지 선택으로 갈 수 있다', () => {
  const game = played();
  setDevMode(game, true);
  const at = titleRows(game).findIndex((r) => r.action === 'select');
  assert.ok(at >= 0, '켰는데 「스테이지 선택」 줄이 없다');
  game.titleIndex = at;
  tap(game, { confirmPressed: true });
  assert.equal(game.scene, 'select');
});

test('선택 화면에서 뒤로 나올 수 있다', () => {
  const game = played();
  setDevMode(game, true);
  game.scene = 'select';
  tap(game, { restartPressed: true });
  assert.equal(game.scene, 'title');
});

test('선택 화면 마지막 칸은 개발자 모드 끄기다', () => {
  const game = played();
  setDevMode(game, true);
  game.scene = 'select';
  game.selectIndex = SELECT_DEV_OFF;
  tap(game, { confirmPressed: true });
  assert.equal(game.dev, false);
  assert.equal(game.scene, 'title');
});

test('컷신 목록에서 오프닝을 다시 틀 수 있다', () => {
  // 오프닝은 한 번 보면 저절로는 안 뜬다 — 여기가 유일하게 다시 보는 길이다.
  // 예전에는 선택 목록에 제 칸이 있었는데 컷신 보기 안으로 들어갔다.
  const game = played();
  setDevMode(game, true);
  game.scene = 'select';
  game.selectIndex = SELECT_CUTS;
  tap(game, { confirmPressed: true });
  assert.equal(game.scene, 'cutList', '컷신 목록으로 안 들어간다');

  game.cutIndex = cutSlotOf('intro');
  assert.ok(game.cutIndex >= 0, '목록에 오프닝이 없다');
  tap(game, { confirmPressed: true });
  assert.equal(game.scene, 'intro');
  assert.equal(game.cutsceneTime, 0, '처음부터 다시 틀어야 한다');
});

test('칸 고르기가 양끝에서 돌아간다', () => {
  const game = played();
  setDevMode(game, true);
  game.scene = 'select';
  tap(game, { leftPressed: true });
  assert.equal(game.selectIndex, SELECT_SLOTS - 1, '왼쪽 끝에서 오른쪽 끝으로 돌아야 한다');
  tap(game, { rightPressed: true });
  assert.equal(game.selectIndex, 0);
});

// ── 골라 들어가기 ───────────────────────────────────────────
test('고른 스테이지에서 시작하고 순위도 거기서 시작한다', () => {
  const game = played();
  startRun(game, 2);
  assert.equal(game.stageIndex, 2);
  assert.equal(game.scene, 'stageIntro');
  assert.equal(game.rank, 20, '3스테이지는 #20 부터다');
  assert.equal(game.partial, true);
});

test('마지막 칸 다음은 보스전이다', () => {
  const game = played();
  startRun(game, STAGES.length);
  assert.equal(game.scene, 'boss');
  assert.ok(game.boss, '보스가 있어야 한다');
  assert.equal(game.partial, true);
});

test('처음부터 시작한 판은 partial 이 아니다', () => {
  const game = played();
  startRun(game, 2);
  startRun(game); // 다시 처음부터
  assert.equal(game.partial, false);
  assert.equal(game.stageIndex, 0);
});

// ── 기록 보호 (제일 중요) ───────────────────────────────────
test('골라 들어간 판은 최고 기록·최고 순위를 갱신하지 않는다', () => {
  const before = { ...emptySave(), bestRank: 40, bestTimeMs: 90_000 };
  const after = mergeRun(before, { rank: 1, timeMs: 1000, chartOuts: 2, partial: true });

  assert.equal(after.bestRank, 40, '보스만 골라 이기고 1위 기록이 되면 안 된다');
  assert.equal(after.bestTimeMs, 90_000, '한 스테이지만 뛰고 최고 기록이 되면 안 된다');
  assert.equal(after.chartOuts, 2, '죽은 횟수는 그대로 쌓아도 된다');
});

test('처음부터 달린 판은 기록을 갱신한다', () => {
  const before = { ...emptySave(), bestRank: 40, bestTimeMs: 90_000 };
  const after = mergeRun(before, { rank: 1, timeMs: 1000, chartOuts: 0, partial: false });
  assert.equal(after.bestRank, 1);
  assert.equal(after.bestTimeMs, 1000);
});

test('요약에 partial 이 실려 나간다', () => {
  const game = played();
  startRun(game, 3);
  assert.equal(runSummary(game).partial, true);
});

// ── 저장 ────────────────────────────────────────────────────
test('dev 칸이 없는 옛 저장값을 읽어도 안 깨진다', () => {
  const old = JSON.stringify({
    version: 1,
    savedAt: 0,
    data: { bestRank: 12, chartOuts: 3, clearedStages: [0], revealedTraps: [] },
  });
  const save = deserialize(old);
  assert.equal(save.dev, false, '없으면 꺼진 것으로 봐야 한다');
  assert.equal(save.bestRank, 12, '나머지는 그대로 살아 있어야 한다');
});

test('켠 상태가 저장을 거쳐 살아남는다', () => {
  const save = deserialize(serialize({ ...emptySave(), dev: true }));
  assert.equal(save.dev, true);
  const game = createGame({ save });
  assert.equal(game.dev, true, '새로고침해도 켜져 있어야 한다');
});

// ── 숫자판을 여는 길 ────────────────────────────────────────
//
// 배포되는 빌드에는 DEV 버튼이 **없다** (--pwa 가 KIOSK 를 켜서 display:none).
// 그래서 폰에서는 들어갈 길이 통째로 없었다. 제목을 두드려 연다.

test('제목을 빠르게 다섯 번 두드리면 열린다', () => {
  let taps = [];
  for (let i = 0; i < TAP_OPEN; i++) taps = pushTap(taps, i * 0.3);
  assert.ok(tapOpens(taps), `${taps.length}번밖에 안 남았다`);
});

test('느리게 치면 안 열린다 — 지나가다 눌린 게 쌓이면 안 된다', () => {
  // 제목은 화면 한가운데 있다. 천천히 눌린 게 계속 쌓이면 남이 우연히 연다.
  //
  // **간격을 TAP_WINDOW 로 계산하지 않는다.** 처음엔 창의 0.8배로 잡았더니
  // 창을 100초로 늘려도 테스트가 같이 늘어나 그대로 통과했다 — 아무것도
  // 안 지키는 테스트였다. 1초에 한 번은 「빠르게 두드림」이 아니다, 절대값으로 쓴다.
  let taps = [];
  for (let i = 0; i < TAP_OPEN + 3; i++) taps = pushTap(taps, i * 1.0);
  assert.equal(tapOpens(taps), false, `1초 간격인데 ${taps.length}번이 남아 열린다`);
});

test('두드림 창이 지나치게 길지 않다', () => {
  // 위 테스트를 통과시키는 값의 상한. 둘이 같이 있어야 창이 슬금슬금 안 는다
  assert.ok(TAP_WINDOW < TAP_OPEN - 1, `창이 ${TAP_WINDOW}초면 1초 간격으로도 열린다`);
});

test('한 번 모자라면 안 열린다', () => {
  let taps = [];
  for (let i = 0; i < TAP_OPEN - 1; i++) taps = pushTap(taps, i * 0.2);
  assert.equal(tapOpens(taps), false);
});

test('열고 나면 다시 처음부터 — 한 번 더 두드려야 또 열린다', () => {
  let taps = [];
  for (let i = 0; i < TAP_OPEN; i++) taps = pushTap(taps, i * 0.2);
  assert.ok(tapOpens(taps));
  taps = [];
  assert.equal(tapOpens(pushTap(taps, 1.1)), false, '비운 뒤에 한 번으로 또 열린다');
});

// ── 배포되는 파일을 직접 본다 ───────────────────────────────
//
// 이 한 쌍이 핵심이다. 전에 dist/play.html 을 재고 「버튼 잘 보인다」고 했는데
// 사람이 여는 건 docs/index.html 이었다 — 거기엔 버튼이 아예 없었다.
// **숨기기와 들어갈 길은 같이 있어야 한다.** 한쪽만 있으면 문 없는 방이 된다.

test('배포 빌드는 DEV 버튼을 숨기고, 대신 제목으로 들어간다', () => {
  const doc = readFileSync(new URL('../../docs/index.html', import.meta.url), 'utf8');
  assert.match(doc, /\.dev-open\s*\{\s*display:\s*none/, '숨기기로 한 걸 안 숨긴다');
  assert.match(doc, /data-key="logo"/, '숨겼는데 들어갈 길이 없다 — 문 없는 방이다');
});
