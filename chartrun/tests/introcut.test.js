// 오프닝 컷신. 여기서 막히면 게임이 시작조차 안 되므로 제일 빡빡하게 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, updateGame, startRun, setDevMode } from '../src/core/game.js';
import { INTRO_CUT, INTRO_AT, introLength } from '../src/data/introCutscene.js';
import { emptySave, deserialize, serialize } from '../src/core/save.js';
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

/** 오프닝을 아직 안 본 새 판 */
function freshGame(over = {}) {
  const game = createGame({ seed: 4, save: { ...emptySave(), ...over } });
  const seen = [];
  game.onEvent = (name, data) => seen.push({ name, ...data });
  return { game, seen };
}

// ── 타임라인 데이터 ─────────────────────────────────────────
test('타임라인이 앞으로만 가고 end 로 끝난다', () => {
  for (let i = 1; i < INTRO_CUT.length; i++) {
    assert.ok(INTRO_CUT[i].at >= INTRO_CUT[i - 1].at, `${i}번째 단계가 뒤로 갔다`);
  }
  assert.equal(INTRO_CUT[INTRO_CUT.length - 1].kind, 'end');
  assert.ok(introLength() > 1, '너무 짧아 읽을 수가 없다');
});

test('대사가 없다', () => {
  assert.equal(INTRO_CUT.filter((s) => s.kind === 'line').length, 0);
});

test('그리는 쪽이 읽는 시각표가 타임라인과 같다', () => {
  for (const step of INTRO_CUT) assert.equal(INTRO_AT[step.kind], step.at, `${step.kind} 시각이 어긋났다`);
});

test('이야기 순서가 뜻대로 짜여 있다', () => {
  assert.deepEqual(
    INTRO_CUT.map((s) => s.kind),
    ['room', 'note', 'upload', 'chart', 'bottom', 'look', 'block', 'grab', 'run', 'end'],
  );
});

// ── 언제 뜨는가 ─────────────────────────────────────────────
test('처음 시작하면 오프닝이 뜨고, 끝나면 스테이지 1 이 시작된다', () => {
  const { game } = freshGame();
  game.dev = false;
  updateGame(game, idle({ confirmPressed: true }), DT);
  assert.equal(game.scene, 'intro', '타이틀에서 시작하면 오프닝이 떠야 한다');

  run(game, introLength() + 0.5);
  assert.equal(game.scene, 'stageIntro', '오프닝이 끝나면 스테이지 1 로 이어져야 한다');
  assert.equal(game.stageIndex, 0);
  assert.equal(game.partial, false);
});

test('한 번 본 뒤에는 예전처럼 곧장 시작한다', () => {
  const { game } = freshGame({ seenOpening: true });
  updateGame(game, idle({ confirmPressed: true }), DT);
  assert.equal(game.scene, 'stageIntro', '두 번째부터는 오프닝 없이 바로 시작해야 한다');
  assert.equal(game.stageIndex, 0);
});

test('개발자 모드로 골라 들어가면 오프닝이 안 뜬다', () => {
  for (const index of [1, 2, STAGES.length]) {
    const { game } = freshGame();
    startRun(game, index);
    assert.notEqual(game.scene, 'intro', `${index} 번 칸에서 오프닝이 떴다`);
  }
});

// ── 도는 동안 ───────────────────────────────────────────────
test('반드시 저절로 끝난다 — 안 끝나면 게임이 시작조차 안 된다', () => {
  const { game } = freshGame();
  startRun(game, 0);
  run(game, introLength() + 1);
  assert.notEqual(game.scene, 'intro');
});

test('오프닝 도중에는 시간이 안 흐른다 — 기록에 얹히면 안 된다', () => {
  const { game } = freshGame();
  startRun(game, 0);
  run(game, 2);
  assert.equal(game.elapsedMs, 0);
});

test('건너뛰기가 먹는다', () => {
  const { game } = freshGame();
  startRun(game, 0);
  run(game, 0.4, { confirmPressed: true });
  assert.equal(game.scene, 'intro', '시작하자마자 넘어가면 눌린 줄도 모른다');
  run(game, 0.4, { confirmPressed: true });
  // 누른 채로 있으면 스테이지 소개 카드까지 같이 넘어간다 — 오프닝을 벗어난 것이 핵심
  assert.ok(['stageIntro', 'play'].includes(game.scene), `오프닝에서 못 벗어났다 (${game.scene})`);
  assert.equal(game.stageIndex, 0);
});

test('단계마다 소리 신호가 순서대로 한 번씩 나온다', () => {
  const { game, seen } = freshGame();
  startRun(game, 0);
  run(game, introLength() + 0.2);
  const beats = seen.filter((e) => e.name === 'cutbeat' && e.cut === 'intro');
  assert.deepEqual(
    beats.map((b) => b.kind),
    INTRO_CUT.map((s) => s.kind),
  );
});

test('건너뛰면 남은 단계가 한꺼번에 쏟아지지 않는다', () => {
  const { game, seen } = freshGame();
  startRun(game, 0);
  run(game, 0.8, { confirmPressed: true });
  const beats = seen.filter((e) => e.name === 'cutbeat' && e.cut === 'intro');
  assert.ok(beats.length <= 2, `건너뛰었는데 ${beats.length}개가 울렸다`);
});

// ── 끝났다고 알리기 (저장이 여기 달려 있다) ─────────────────
test('끝까지 봐도 건너뛰어도 introdone 이 정확히 한 번 나온다', () => {
  for (const skip of [false, true]) {
    const { game, seen } = freshGame();
    startRun(game, 0);
    run(game, skip ? 1.2 : introLength() + 0.5, { confirmPressed: skip });
    const done = seen.filter((e) => e.name === 'introdone');
    assert.equal(done.length, 1, skip ? '건너뛰었을 때 안 나왔다' : '끝났을 때 안 나왔다');
  }
});

// ── 저장 ────────────────────────────────────────────────────
test('seenOpening 칸이 없는 옛 저장값이면 오프닝이 뜬다', () => {
  const old = JSON.stringify({
    version: 1,
    savedAt: 0,
    // 예전 저장값에는 seenIntro 가 무조건 true 로 들어가 있다 — 여기 걸리면 안 된다
    data: { bestRank: 12, chartOuts: 3, clearedStages: [0, 1], revealedTraps: [], seenIntro: true },
  });
  const save = deserialize(old);
  assert.equal(save.seenOpening, false);

  const game = createGame({ save });
  startRun(game, 0);
  assert.equal(game.scene, 'intro', '기존 플레이어도 새 오프닝은 한 번 봐야 한다');
});

test('본 상태가 저장을 거쳐 살아남는다', () => {
  const save = deserialize(serialize({ ...emptySave(), seenOpening: true }));
  assert.equal(save.seenOpening, true);
  const game = createGame({ save });
  startRun(game, 0);
  assert.equal(game.scene, 'stageIntro');
});
