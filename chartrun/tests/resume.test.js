// 이어하기 — 나갔다 들어와도 하던 판에서.
//
// 이 기능의 함정은 하나다: **스냅샷이 한 시점의 것이어야 한다.**
// 자리는 체크포인트에서 가져오고 숫자는 나가던 순간에서 가져오면, 체크포인트 뒤에
// 주운 음표를 돌아와서 또 줍는다 — 음표 이스터에그에서 물렸던 그 함정이다.
// 그래서 여기 테스트의 절반이 "두 번 안 센다" 이야기다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  updateGame,
  loadStage,
  loadBoss,
  startRun,
  titleRows,
  resumeState,
  resumeRun,
  resumeLabel,
} from '../src/core/game.js';
import { emptySave, mergeRun, deserialize, SAVE_VERSION } from '../src/core/save.js';
import { STAGES, HARD_STAGES } from '../src/data/stages.js';

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

const step = (game, input = idle(), frames = 1) => {
  for (let i = 0; i < frames; i++) updateGame(game, input, DT);
};

const gameWith = (save = {}) =>
  createGame({ seed: 4, save: { ...emptySave(), seenOpening: true, ...save } });

/** 판에 들어가 바로 움직일 수 있는 상태로 */
function enter(game, index = 0) {
  loadStage(game, index);
  game.scene = 'play';
  game.sceneTime = 0;
  return game;
}

/** 체크포인트를 밟는다. 밟은 자리를 돌려준다 */
function touchCheckpoint(game, nth = 0) {
  const cp = game.world.checkpoints[nth];
  assert.ok(cp, `체크포인트 ${nth} 번이 있어야 한다`);
  game.player.x = cp.x;
  game.player.y = cp.y - game.player.h;
  step(game);
  assert.ok(cp.taken, '체크포인트를 밟았어야 한다');
  return cp;
}

/** 음표 하나 줍기 */
function grabNote(game, n = 0) {
  const q = game.world.pickups[n];
  game.player.x = q.x - 1;
  game.player.y = q.y - 1;
  game.player.vx = 0;
  game.player.vy = 0;
  step(game);
  return q.taken;
}

// ── 찍기 ───────────────────────────────────────────────────

test('판 중이 아니면 찍을 게 없다', () => {
  const game = gameWith();
  assert.equal(game.scene, 'title');
  assert.equal(resumeState(game), null);
});

test('**stageIntro·stageClear 에서도 찍힌다** — 여기서 null 이 나가면 하던 판이 지워진다', () => {
  const game = gameWith();
  loadStage(game, 1);
  // loadStage 가 'stage' 를 알리는 그 순간의 장면이다 (scene = 'stageIntro')
  assert.equal(game.scene, 'stageIntro');
  assert.ok(resumeState(game), 'stage 를 알리는 시점에 null 이면 저장이 오히려 날아간다');

  game.scene = 'stageClear';
  assert.ok(resumeState(game), 'clear 를 알리는 시점도 마찬가지다');
});

test('체크포인트를 밟으면 그 자리와 그 시점 숫자가 함께 찍힌다', () => {
  const game = enter(gameWith(), 0);
  game.plays = 5;
  game.score = 700;
  game.chartOuts = 2;
  game.elapsedMs = 31000;

  const cp = touchCheckpoint(game);
  const snap = resumeState(game);

  assert.deepEqual(snap.checkpoint, { x: cp.x, y: cp.y });
  assert.equal(snap.stage, 0);
  assert.equal(snap.hard, false);
  assert.equal(snap.boss, false);
  assert.equal(snap.plays, 5);
  assert.equal(snap.score, 700);
  assert.equal(snap.chartOuts, 2);
  // 밟는 그 프레임에도 시계는 간다 — 찍힌 값은 **그 순간의** 값이어야 한다
  assert.equal(snap.elapsedMs, game.elapsedMs);
  assert.ok(snap.elapsedMs >= 31000);
});

// ── 되돌리기 ────────────────────────────────────────────────

test('이어하면 그 체크포인트에 서 있고 숫자가 그대로다', () => {
  const game = enter(gameWith(), 0);
  game.plays = 5;
  game.score = 700;
  game.chartOuts = 2;
  game.elapsedMs = 31000;
  game.defeated = 3;
  const cp = touchCheckpoint(game);
  const snap = resumeState(game);
  const clock = game.elapsedMs;

  // 게임을 껐다 켠 셈 친다
  const next = gameWith({ resume: snap });
  assert.equal(resumeRun(next, next.save.resume), true);

  assert.equal(next.stageIndex, 0);
  assert.deepEqual(next.checkpoint, { x: cp.x, y: cp.y });
  assert.equal(next.player.x, cp.x, '체크포인트 자리에 서 있어야 한다');
  assert.equal(next.plays, 5);
  assert.equal(next.score, 700);
  assert.equal(next.chartOuts, 2);
  assert.equal(next.elapsedMs, clock, '시계도 이어진다 — 껐다 켠다고 기록이 깎이면 안 된다');
  assert.equal(next.defeated, 3);
});

test('**체크포인트 뒤에 주운 음표를 이어한 뒤 또 주워도 두 번 안 센다**', () => {
  // 이 기능의 핵심 함정. 숫자를 나가던 순간에서 가져오면 여기서 깨진다.
  const game = enter(gameWith(), 0);
  touchCheckpoint(game);
  const atCheckpoint = resumeState(game);
  const playsAtCheckpoint = game.plays;

  // 체크포인트 뒤에 음표를 줍는다 — 이 숫자는 **스냅샷에 없다**
  assert.ok(grabNote(game, 0));
  assert.ok(game.plays > playsAtCheckpoint, '주웠으면 늘어야 한다');
  assert.equal(
    atCheckpoint.plays,
    playsAtCheckpoint,
    '스냅샷은 체크포인트 시점 그대로여야 한다 — 나중 것이 섞이면 안 된다',
  );

  // 껐다 켜고 이어한다
  const next = gameWith({ resume: atCheckpoint });
  resumeRun(next, next.save.resume);
  next.scene = 'play';
  assert.equal(next.plays, playsAtCheckpoint, '이어하면 체크포인트 시점으로 돌아온다');

  // 같은 음표를 다시 줍는다 — 그래야 총합이 맞다
  assert.ok(grabNote(next, 0), '음표는 되살아나 있다');
  assert.equal(next.plays, playsAtCheckpoint + 1, '한 번만 세야 한다');
});

test('하드모드면 하드 판 표로 돌아온다', () => {
  const game = gameWith();
  startRun(game, 0, { hard: true });
  game.scene = 'play';
  const snap = resumeState(game);
  assert.equal(snap.hard, true);

  const next = gameWith({ resume: snap });
  resumeRun(next, next.save.resume);
  assert.equal(next.hard, true);
  assert.equal(next.world.stage.id, HARD_STAGES[0].id, 'hard 를 loadStage 보다 먼저 세워야 한다');
});

test('보스전에서 나갔으면 보스전으로, 체력은 가득', () => {
  const game = gameWith();
  startRun(game);
  loadBoss(game);
  game.boss.hp = 3;
  game.plays = 9;
  const snap = resumeState(game);
  assert.equal(snap.boss, true);

  const next = gameWith({ resume: snap });
  resumeRun(next, next.save.resume);
  assert.equal(next.scene, 'boss');
  assert.equal(next.boss.hp, next.boss.maxHp, '보스전은 처음부터 — 체력이 가득이어야 한다');
  assert.equal(next.plays, 9, '숫자는 이어진다');
});

// ── 저장에 얹기 ─────────────────────────────────────────────

test('하던 판은 **키가 있을 때만** 바뀐다 — 음소거만 해도 지워지면 안 된다', () => {
  const snap = { stage: 2, hard: false, boss: false, checkpoint: { x: 10, y: 20 } };
  const save = mergeRun(emptySave(), { resume: snap });
  assert.deepEqual(save.resume, snap);

  // 소리만 바꾼 persist — resume 키가 없다
  const after = mergeRun(save, { chartOuts: 0 });
  assert.deepEqual(after.resume, snap, '안 건드린 건 그대로 남아야 한다');

  // 판이 끝났다 — 명시적인 null
  const done = mergeRun(save, { resume: null });
  assert.equal(done.resume, null, 'null 은 지우라는 뜻이다');
});

test('resume 칸이 없는 옛 저장도 안 깨진다', () => {
  const old = { ...emptySave() };
  delete old.resume;
  const loaded = deserialize(JSON.stringify({ version: SAVE_VERSION, data: old }));
  assert.equal(loaded.resume, null);

  const game = createGame({ seed: 4, save: loaded });
  assert.deepEqual(
    titleRows(game).map((r) => r.action),
    ['start'],
    '하던 판이 없으면 줄도 없다',
  );
});

// ── 타이틀 줄 ──────────────────────────────────────────────

test('하던 판이 있으면 타이틀 **맨 위**에 줄이 뜬다', () => {
  const plain = gameWith();
  assert.ok(!titleRows(plain).some((r) => r.action === 'resume'));

  const game = gameWith({ resume: { stage: 2, hard: false, boss: false } });
  const rows = titleRows(game);
  assert.equal(rows[0].action, 'resume', '나갔다 온 사람이 제일 먼저 찾는 줄이다');
  assert.ok(rows[0].label.includes('STAGE 3'), `어디까지 갔는지 적혀야 한다 (${rows[0].label})`);
});

test('줄에 적히는 판 번호는 **표에서** 꺼낸다', () => {
  assert.ok(resumeLabel({ stage: 0, hard: false }).includes(`STAGE ${STAGES[0].number}`));
  assert.ok(resumeLabel({ stage: 3, hard: false }).includes(`STAGE ${STAGES[3].number}`));
  assert.ok(resumeLabel({ stage: 1, hard: true }).includes('하드'));
  assert.equal(resumeLabel({ boss: true }), '이어하기 — 보스전');
  assert.equal(resumeLabel(null), '');
});

test('타이틀에서 이어하기를 고르면 그 판이 열린다', () => {
  const game = gameWith({ resume: { stage: 2, hard: false, boss: false, plays: 4 } });
  assert.equal(game.scene, 'title');
  game.titleIndex = 0;
  step(game, idle({ confirmPressed: true }));
  assert.equal(game.stageIndex, 2);
  assert.equal(game.plays, 4);
});

test('「처음부터」를 고르면 하던 판이 아니라 새 판이다', () => {
  const game = gameWith({ resume: { stage: 3, hard: false, boss: false, plays: 9 } });
  const rows = titleRows(game);
  game.titleIndex = rows.findIndex((r) => r.action === 'start');
  step(game, idle({ confirmPressed: true }));
  assert.equal(game.stageIndex, 0, '처음부터는 처음부터다');
  assert.equal(game.plays, 0);
});
