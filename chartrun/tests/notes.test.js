// 음표 24개를 모으면 열리는 숨은 화면.
//
// 이 기능의 함정은 하나로 모인다: **죽으면 음표가 되살아난다** (reviveAtCheckpoint 가
// spawnEntities 를 다시 부른다). 그래서 개수를 세면 같은 음표를 두 번 센다 —
// 한 자리를 스무 번 오가면 24개가 채워지고, 아무것도 안 모은 사람에게 화면이 열린다.
// 그래서 개수가 아니라 **자리**를 남긴다. 아래 테스트의 절반이 그 이야기다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  updateGame,
  loadStage,
  selectItems,
  titleRows,
  runSummary,
  noteKey,
  notesFound,
  allNotes,
} from '../src/core/game.js';
import { STAGES, HARD_STAGES, NOTE_TOTAL } from '../src/data/stages.js';
import { emptySave, mergeRun, deserialize, serialize, SAVE_VERSION } from '../src/core/save.js';

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
  createGame({ seed: 7, save: { ...emptySave(), seenOpening: true, ...save } });

/** 판에 들어가 바로 움직일 수 있는 상태로 (stageIntro 를 넘긴다) */
function enter(game, index = 0) {
  loadStage(game, index);
  game.scene = 'play';
  game.sceneTime = 0;
  return game;
}

/** 음표 자리로 순간이동해 한 프레임. 주웠으면 true */
function grab(game, pickup) {
  game.player.x = pickup.x - 1;
  game.player.y = pickup.y - 1;
  game.player.vx = 0;
  game.player.vy = 0;
  step(game);
  return pickup.taken;
}

/** 죽고 되살아난다 — 여기서 음표가 도로 생긴다 */
function dieAndRevive(game) {
  game.scene = 'death';
  game.sceneTime = 0;
  step(game, idle(), 120); // DEATH_HOLD 1.5초보다 넉넉히
  assert.equal(game.scene, 'play', '되살아나 있어야 이 다음 이야기가 성립한다');
}

// ── 총 개수는 데이터에서 ────────────────────────────────────

test('음표 총 개수는 판 데이터에서 센다 — 손으로 적은 숫자가 아니다', () => {
  const counted = STAGES.reduce(
    (total, s) => total + s.rows.reduce((n, row) => n + (row.match(/\*/g)?.length ?? 0), 0),
    0,
  );
  assert.equal(NOTE_TOTAL, counted);
  assert.ok(NOTE_TOTAL > 0, '셀 음표가 있어야 한다');
});

test('하드 판에는 음표가 하나도 없다 — 그래서 이건 1회차 이야기다', () => {
  const hardNotes = HARD_STAGES.reduce(
    (total, s) => total + s.rows.reduce((n, row) => n + (row.match(/\*/g)?.length ?? 0), 0),
    0,
  );
  assert.equal(hardNotes, 0);
});

// ── 세는 법 ────────────────────────────────────────────────

test('음표를 주우면 개수가 아니라 자리가 남는다', () => {
  const game = enter(gameWith());
  const pickup = game.world.pickups[0];
  assert.ok(grab(game, pickup), '음표 자리에 서면 주워진다');

  assert.equal(notesFound(game), 1);
  assert.deepEqual(runSummary(game).foundNotes, [noteKey(game, pickup.tx, pickup.ty)]);
});

test('**죽어서 되살아난 같은 음표를 다시 주워도 안 늘어난다** (이 기능의 핵심)', () => {
  const game = enter(gameWith());
  const pickup = game.world.pickups[0];
  grab(game, pickup);
  assert.equal(notesFound(game), 1);
  const plays = game.plays;

  dieAndRevive(game);
  const again = game.world.pickups[0];
  assert.equal(again.taken, false, '음표는 되살아난다 — 이게 함정의 시작이다');

  assert.ok(grab(game, again), '다시 주울 수는 있다');
  assert.ok(game.plays > plays, '재생수는 는다 (점수니까)');
  assert.equal(notesFound(game), 1, '하지만 모은 음표는 그대로다');
});

test('같은 칸이라도 판이 다르면 다른 음표다', () => {
  const g1 = enter(gameWith(), 0);
  const g2 = enter(gameWith(), 1);
  assert.notEqual(noteKey(g1, 12, 9), noteKey(g2, 12, 9));
  // 하드에서만 이름을 붙이는 markKey 를 그대로 쓰면 여기서 둘이 같아진다
  assert.ok(noteKey(g1, 12, 9).startsWith(`${STAGES[0].id}:`));
});

test('여러 판에 걸쳐 모아도 쌓인다 — mergeRun 이 합집합으로 합친다', () => {
  const save = mergeRun(emptySave(), { foundNotes: ['stage1:5,9'] });
  assert.deepEqual(save.foundNotes, ['stage1:5,9']);

  // 같은 걸 또 내도 안 늘고, 새 자리는 는다
  const next = mergeRun(save, { foundNotes: ['stage1:5,9', 'stage2:8,9'] });
  assert.deepEqual(next.foundNotes, ['stage1:5,9', 'stage2:8,9']);
});

test('저장에 있던 음표를 안고 시작한다', () => {
  const game = gameWith({ foundNotes: ['stage1:5,9', 'stage3:2,4'] });
  assert.equal(notesFound(game), 2);
});

test('foundNotes 칸이 없는 옛 저장도 안 깨진다', () => {
  const old = { ...emptySave() };
  delete old.foundNotes;
  const loaded = deserialize(JSON.stringify({ version: SAVE_VERSION, data: old }));
  assert.deepEqual(loaded.foundNotes, []);

  const game = createGame({ seed: 7, save: loaded });
  assert.equal(notesFound(game), 0);
  assert.equal(allNotes(game), false);

  // 저장을 다시 굽고 읽어도 그대로다
  assert.deepEqual(deserialize(serialize(loaded)).foundNotes, []);
});

// ── 언제 열리나 ────────────────────────────────────────────

/** 음표를 다 모은 저장 (자리 이름은 아무거나 — 개수만 맞으면 된다) */
const everyNote = () => Array.from({ length: NOTE_TOTAL }, (_, i) => `stage1:${i},9`);

test('다 모으기 전에는 숨은 화면이 어디에도 없다', () => {
  const game = gameWith({ clearedOnce: true, foundNotes: everyNote().slice(0, NOTE_TOTAL - 1) });
  assert.equal(allNotes(game), false);
  assert.ok(!selectItems(game).some((s) => s.action === 'gallery'));
  assert.ok(!titleRows(game).some((r) => r.action === 'gallery'));
});

test('다 모으면 타이틀과 선택 목록에 숨은 화면이 뜬다', () => {
  const game = gameWith({ foundNotes: everyNote() });
  assert.equal(allNotes(game), true);
  assert.ok(selectItems(game).some((s) => s.action === 'gallery'));
  assert.ok(titleRows(game).some((r) => r.action === 'gallery'));
});

test('한 바퀴를 안 깨도 음표만 다 모으면 열린다 — 두 조건은 별개다', () => {
  const game = gameWith({ clearedOnce: false, foundNotes: everyNote() });
  assert.deepEqual(
    selectItems(game).map((s) => s.label),
    ['숨은 화면'],
    '깨야 열리는 칸들은 그대로 잠겨 있다',
  );
  // 타이틀에 바로 줄이 있어야 한다 — 없으면 「스테이지 선택」 안에 이것 하나만
  // 덩그러니 들어 있는 꼴이 된다
  assert.ok(titleRows(game).some((r) => r.action === 'gallery'));
});

test('이번 판에 주운 음표로 마지막 한 개가 채워져도 열린다', () => {
  const game = enter(gameWith({ foundNotes: everyNote().slice(0, NOTE_TOTAL - 1) }));
  assert.equal(allNotes(game), false);
  grab(game, game.world.pickups[0]);
  assert.equal(allNotes(game), true, '저장은 판이 끝나야 합쳐진다 — 그 전에도 세어야 한다');
});

// ── 숨은 화면 드나들기 ──────────────────────────────────────

test('타이틀에서 들어가면 타이틀로 돌아온다', () => {
  const game = gameWith({ foundNotes: everyNote() });
  const rows = titleRows(game);
  game.titleIndex = rows.findIndex((r) => r.action === 'gallery');
  step(game, idle({ confirmPressed: true }));
  assert.equal(game.scene, 'gallery');

  step(game, idle({ restartPressed: true }));
  assert.equal(game.scene, 'title');
});

test('선택 화면에서 들어가면 선택 화면으로 돌아온다', () => {
  const game = gameWith({ clearedOnce: true, foundNotes: everyNote() });
  game.scene = 'select';
  game.sceneTime = 0;
  game.selectIndex = selectItems(game).findIndex((s) => s.action === 'gallery');
  step(game, idle({ confirmPressed: true }));
  assert.equal(game.scene, 'gallery');

  step(game, idle({ restartPressed: true }));
  assert.equal(game.scene, 'select');
});

test('들어간 직후의 점프는 안 먹는다 — 고른 그 입력에 도로 닫히면 안 된다', () => {
  const game = gameWith({ foundNotes: everyNote() });
  const rows = titleRows(game);
  game.titleIndex = rows.findIndex((r) => r.action === 'gallery');
  // 고를 때 누른 점프가 다음 프레임까지 남아 있는 셈 친다
  step(game, idle({ confirmPressed: true }), 10);
  assert.equal(game.scene, 'gallery', '0.5초 전에는 안 닫힌다');

  step(game, idle(), 30);
  step(game, idle({ confirmPressed: true }));
  assert.equal(game.scene, 'title', '0.5초가 지나면 점프로도 나갈 수 있다');
});
