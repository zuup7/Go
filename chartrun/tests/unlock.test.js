// 일반모드를 깨면 — 통계 다음에 「HARD MODE」 컷신이 뜨고, 그 문 옆으로 간다.
//
// **깰 때마다** 뜬다. 처음 한 번만이 아니다 (그렇게 만들었다가 「처음 한 번만 말고」
// 라는 말을 들었다). 하드모드를 깼을 때만 뺀다 — 거기서 「하드모드 열림」은 틀린 말이다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  loadBoss,
  updateGame,
  previewCut,
  cutPreviews,
  inCutscene,
  SKIP_AFTER,
  ENDING_LOCK,
} from '../src/core/game.js';
import { emptySave } from '../src/core/save.js';
import { bossCutLength } from '../src/data/bossCutscenes.js';
import { CREDITS_LENGTH } from '../src/data/credits.js';
import { UNLOCK_CUT, UNLOCK_TITLE, unlockLength } from '../src/data/unlockCut.js';
import { GLYPHS } from '../src/render/bigtext.js';

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
const run = (game, seconds, over) => {
  for (let i = 0; i < Math.round(seconds / DT); i++) updateGame(game, idle(over), DT);
};
const press = (game) => updateGame(game, idle({ confirmPressed: true }), DT);

/** 엔딩 컷신 → 크레딧 → 통계 화면까지 와서 선다 */
function atStats({ hard = false, save = {} } = {}) {
  const game = createGame({ seed: 5, save: { ...emptySave(), seenOpening: true, ...save } });
  game.hard = hard;
  loadBoss(game);
  const id = hard ? 'hardEnd' : 'ending';
  game.bossCut = { id, t: 0, length: bossCutLength(id) };
  run(game, bossCutLength(id) + 0.1);
  assert.equal(game.scene, 'credits', '엔딩 컷신 뒤에 크레딧이 안 왔다 — 테스트 전제가 깨졌다');
  run(game, CREDITS_LENGTH + 0.1);
  assert.equal(game.scene, 'ending', '크레딧 뒤에 통계가 안 왔다 — 테스트 전제가 깨졌다');
  run(game, ENDING_LOCK + 0.1);
  return game;
}

// ── 언제 뜨나 ───────────────────────────────────────────────

test('일반모드를 깨면 통계 다음에 문이 열리는 컷신이 뜨고, 끝나면 그 문 옆으로 간다', () => {
  const game = atStats({ save: { clearedOnce: true } });
  press(game);
  assert.equal(game.scene, 'unlock', '통계를 닫았는데 컷신이 안 떴다');
  run(game, unlockLength() + 0.1);
  assert.equal(game.stageIndex, 0, '컷신이 끝났는데 스테이지 1 이 아니다');
  assert.equal(game.hubVisit, true, '문 옆에 둘러보러 온 게 아니다');
  assert.equal(game.hard, false);
});

test('**깰 때마다** 뜬다 — 처음 한 번만이 아니다', () => {
  // 이미 몇 번 깬 사람. 저장에 clearedOnce·clears 가 다 있어도 또 떠야 한다
  const game = atStats({ save: { clearedOnce: true, clears: 5 } });
  assert.equal(game.ending.unlocked, true);
  press(game);
  assert.equal(game.scene, 'unlock', '두 번째 깼더니 안 뜬다');
});

test('처음 깬 사람에게도 뜬다', () => {
  const game = atStats();
  press(game);
  assert.equal(game.scene, 'unlock');
});

test('하드모드를 깼을 때는 안 뜬다 — 하드를 깼는데 「하드모드 열림」은 틀린 말이다', () => {
  const game = atStats({ hard: true, save: { clearedOnce: true } });
  assert.equal(game.ending.unlocked, false);
  press(game);
  assert.notEqual(game.scene, 'unlock');
});

// ── 컷신 규칙 ───────────────────────────────────────────────

test('통계를 닫은 그 키로는 안 날아간다 · 잠깐 뒤엔 건너뛸 수 있다', () => {
  const game = atStats();
  press(game);
  run(game, SKIP_AFTER * 0.5, { confirmPressed: true });
  assert.equal(game.scene, 'unlock', '뜨자마자 날아갔다');
  run(game, SKIP_AFTER, { confirmPressed: true });
  assert.notEqual(game.scene, 'unlock', '건너뛰기가 안 먹는다');
  assert.equal(game.stageIndex, 0);
});

test('컷신이다 — HUD 를 치우고 폰에 「건너뛰기」를 띄운다', () => {
  const game = atStats();
  press(game);
  assert.equal(inCutscene(game), true);
});

test('컷신 보기에서 틀 수 있고, 끝나면 목록으로 돌아간다', () => {
  const game = createGame({ seed: 4, save: { ...emptySave(), seenOpening: true, dev: true } });
  const at = cutPreviews().findIndex((p) => p.unlock);
  assert.ok(at >= 0, '컷신 보기에 없다');
  assert.ok(previewCut(game, at));
  assert.equal(game.scene, 'unlock');
  run(game, unlockLength() + 0.1);
  assert.equal(game.scene, 'cutList', '컷신만 봤는데 판으로 갔다');
});

// ── 타임라인 · 글자 ─────────────────────────────────────────

test('타임라인이 앞으로만 가고 end 로 끝난다', () => {
  for (let i = 1; i < UNLOCK_CUT.length; i++) {
    assert.ok(UNLOCK_CUT[i].at > UNLOCK_CUT[i - 1].at, `${UNLOCK_CUT[i].kind} 가 뒤로 갔다`);
  }
  assert.equal(UNLOCK_CUT.at(-1).kind, 'end');
});

test(`제목 「${UNLOCK_TITLE}」 의 글자가 글리프에 다 있다`, () => {
  // 없으면 빈 칸으로 흘러 「HA D  ODE」 가 된다
  const missing = [...UNLOCK_TITLE].filter((c) => c !== ' ' && !GLYPHS[c]);
  assert.deepEqual(missing, [], `${missing.join(',')} 가 빠졌다`);
});
