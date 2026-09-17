// APK 로 싸서 남에게 줄 때만 드러나는 규칙들.
// 브라우저 쪽(뒤로가기·Wake Lock)은 여기서 못 돌리지만, **그것들이 기대는 core 규칙**은
// 여기서 못 박는다 — ui/app.js 는 이 규칙 위에 얹혀 있을 뿐이다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, loadStage, updateGame, pausable } from '../src/core/game.js';
import { emptySave, deserialize, serialize, loadSave, writeSave, clearSave, SAVE_VERSION } from '../src/core/save.js';

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

/** ui/app.js 의 pressPause() 와 **같은 모양**의 한 프레임 (dt 0) */
const backButton = (game) => updateGame(game, idle({ pausePressed: true }), 0);

function playing(seed = 4) {
  const game = createGame({ seed, save: { ...emptySave(), seenOpening: true } });
  loadStage(game, 0);
  for (let i = 0; i < 200; i++) updateGame(game, idle(), DT);
  assert.equal(game.scene, 'play');
  return game;
}

test('조작 안내 칸이 없는 옛 저장도 안 깨진다 — 안내가 한 번 더 뜰 뿐이다', () => {
  // seenHelp 가 생기기 전에 저장된 판. emptySave() 위에 덮어쓰므로 빈 칸은 기본값으로 열린다.
  const old = JSON.stringify({
    version: SAVE_VERSION,
    savedAt: 0,
    data: { bestRank: 12, seenOpening: true, clearedOnce: true },
  });
  const save = deserialize(old);
  assert.equal(save.seenHelp, false);
  assert.equal(save.bestRank, 12);
  assert.equal(save.clearedOnce, true);
});

test('한 번 봤다고 남기면 그대로 돌아온다', () => {
  const save = deserialize(serialize({ ...emptySave(), seenHelp: true }));
  assert.equal(save.seenHelp, true);
});

test('저장이 막혔다는 표시는 판을 시작할 때 꺼져 있다', () => {
  // 켜는 건 ui/app.js 가 writeSave 의 false 를 받았을 때뿐이다
  assert.equal(createGame({ seed: 1 }).saveBroken, false);
});

test('뒤로가기로 멈출 수 있는 장면은 판이 도는 중뿐이다', () => {
  const game = createGame({ seed: 2 });
  assert.equal(game.scene, 'title');
  assert.equal(pausable(game), false);

  const live = playing();
  assert.equal(pausable(live), true);
});

test('뒤로가기 한 프레임은 판을 멈춘다 — 시간도 안 흐른다', () => {
  const game = playing();
  const wasX = game.player.x;
  const wasMs = game.elapsedMs;

  backButton(game);
  assert.equal(game.paused, true);
  // 멈춘 뒤로는 오른쪽을 눌러도 안 움직이고 시계도 안 간다
  for (let i = 0; i < 60; i++) updateGame(game, idle({ right: true }), DT);
  assert.equal(game.player.x, wasX);
  assert.equal(game.elapsedMs, wasMs);
});

test('타이틀에서 뒤로가기는 아무 것도 안 한다 — 그래서 앱이 닫힌다', () => {
  // ui/app.js 는 이 경우 히스토리 칸을 다시 안 심는다. core 가 조용히 넘어가 줘야
  // "뒤로가기를 눌렀는데 아무 일도 안 일어나고 앱도 안 닫히는" 상태가 안 생긴다.
  const game = createGame({ seed: 3 });
  backButton(game);
  assert.equal(game.paused, false);
  assert.equal(game.scene, 'title');
});

test('멈춘 판은 뒤로가기를 한 번 더 받아도 풀리지 않는다', () => {
  // 풀어 버리면 "나가려고 눌렀는데 게임이 이어지는" 꼴이 된다.
  // ui/app.js 가 멈춘 상태에서는 pressPause 를 다시 부르지 않는 것이 이 규칙을 지킨다.
  const game = playing();
  backButton(game);
  assert.equal(game.paused, true);
  // (직접 한 번 더 부르면 토글이라 풀린다 — 그래서 ui 가 안 부른다)
  backButton(game);
  assert.equal(game.paused, false);
});

test('localStorage 를 읽기만 해도 던지는 기기에서 게임이 안 죽는다', () => {
  // 쿠키·사이트 데이터가 막힌 WebView 가 이렇게 군다. 기록이 안 남는 건 참을 수 있지만
  // 진입점이 통째로 죽으면 검은 화면만 남는다.
  const had = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('Access is denied for this document.');
    },
  });
  try {
    assert.deepEqual(loadSave(), emptySave());
    assert.equal(writeSave(emptySave()), false);
    clearSave(); // 던지면 안 된다
  } finally {
    if (had) Object.defineProperty(globalThis, 'localStorage', had);
    else delete globalThis.localStorage;
  }
});
