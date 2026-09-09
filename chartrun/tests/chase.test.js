// 추격 판 (하드 3·4). 여기가 틀어지면 **못 깨는 판**이 되는데,
// 화면만 봐서는 "어렵네" 와 구분이 안 간다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  loadStage,
  updateGame,
  startRun,
  isChase,
  CHASE_SPEED,
  SURGE_SPEED,
  CHASE_LEAD,
} from '../src/core/game.js';
import { HARD_STAGES } from '../src/data/stages.js';
import { PLAYER } from '../src/core/player.js';
import { emptySave } from '../src/core/save.js';
import { createWorld, T } from '../src/core/world.js';
import { caughtLength } from '../src/data/caughtCut.js';
import { SOLID } from '../src/core/physics.js';

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
const step = (game, input = idle(), n = 1) => {
  for (let i = 0; i < n; i++) updateGame(game, input, DT);
};

/** 추격자를 바로 뒤에 붙인다. 앨범 같은 딴 것이 끼어들지 않게 치우고 시작한다 */
function aboutToCatch(game) {
  game.albums.length = 0;
  game.shots.length = 0;
  game.player.invuln = 0;
  game.chaser = { x: game.player.x - 6 };
  return game;
}

/** 하드 index 판에서 굴러가는 상태로 */
function inHard(index) {
  const game = createGame({ seed: 11, save: { ...emptySave(), seenOpening: true } });
  startRun(game, index, { hard: true });
  step(game, idle(), 200);
  assert.equal(game.scene, 'play', '판이 안 돌아간다');
  return game;
}

// ── 공정함 — 이게 제일 중요하다 ─────────────────────────────
test('쫓아오는 속도가 달리기보다 느리다 — 빨라져도 그렇다', () => {
  // 여기를 넘기는 순간 "어려운 판"이 아니라 달리기 속도를 시험하는 판이 되고,
  // 그건 실력이 아니라 그냥 못 깨는 판이다.
  assert.ok(CHASE_SPEED < PLAYER.maxSpeed, `${CHASE_SPEED} 가 ${PLAYER.maxSpeed} 보다 빠르다`);
  assert.ok(SURGE_SPEED < PLAYER.maxSpeed, `빨라진 ${SURGE_SPEED} 가 달리기보다 빠르다`);
  assert.ok(SURGE_SPEED > CHASE_SPEED, '빨라지는 구간인데 안 빨라진다');
});

test('계속 달리기만 하면 안 잡히고, 판을 끝까지 간다', () => {
  // 이 판의 약속이다 — 잡히는 건 벽에 막혀 멈췄을 때지, 달리기가 느려서가 아니다.
  // 지금 재는 건 **추격**이라 앨범한테 죽는 건 빼둔다. 안 그러면 적한테 죽은 것을
  // "안 잡혔다"로 읽어서 아무것도 확인 못 한다.
  const game = inHard(2);
  const goal = game.world.goal.x;
  let far = game.player.x;
  let hold = 0;

  for (let i = 0; i < 60 * 30; i++) {
    game.player.invuln = 99;
    // 점프를 **붙잡고** 있어야 한다. 놓으면 jumpCut 이 높이를 42% 로 깎아서
    // 두 칸짜리 벽을 못 넘는다 — 사람은 당연히 누르고 있다.
    const blocked = Math.abs(game.player.vx) < 24 && game.player.onGround;
    if (blocked) hold = 12;
    const jump = hold > 0;
    if (hold > 0) hold -= 1;
    updateGame(game, idle({ right: true, jump, jumpPressed: blocked }), DT);
    if (game.scene === 'play') far = Math.max(far, game.player.x);
    if (game.caught) break;
    // 골에 닿으면 판이 넘어간다 — 거기까지 갔으면 된 것이다
    if (game.scene !== 'play' && game.scene !== 'death') break;
  }

  assert.equal(game.caught, null, `달리기만 했는데 잡혔다 (x ${Math.round(far)} / ${goal})`);
  assert.ok(far > goal - 40, `골(${goal})까지 못 갔다 — ${Math.round(far)} 에서 멈췄다`);
});

// ── 추격이 붙는가 ───────────────────────────────────────────
test('추격 판은 시작하자마자 붙는다', () => {
  for (const index of [2, 3]) {
    const game = inHard(index);
    assert.equal(isChase(game), true, `하드 ${index + 1}판이 추격 판이 아니다`);
    step(game, idle(), 2);
    assert.ok(game.chaser, `하드 ${index + 1}판: 구간을 안 밟았는데 아무도 안 쫓아온다`);
  }
});

test('함정 판(1·2)에는 아무도 안 쫓아온다', () => {
  for (const index of [0, 1]) {
    const game = inHard(index);
    assert.equal(isChase(game), false);
    step(game, idle(), 60);
    assert.equal(game.chaser, null, `하드 ${index + 1}판인데 쫓아온다`);
  }
});

test('보통 판에는 추격이 없다', () => {
  const game = createGame({ seed: 12, save: { ...emptySave(), seenOpening: true } });
  loadStage(game, 0);
  step(game, idle(), 200);
  assert.equal(isChase(game), false);
  step(game, idle(), 60);
  assert.equal(game.chaser, null);
});

// ── 잡히면 ──────────────────────────────────────────────────
test('가만히 서 있으면 잡히고, 컷신이 돈다', () => {
  const game = aboutToCatch(inHard(2));
  step(game, idle(), 10);
  assert.ok(game.caught, '따라잡혔는데 아무 일도 없다');
  assert.ok(game.caught.length > 0);
});

test('잡힌 동안에는 나도 쫓아오는 것도 안 움직인다', () => {
  const game = aboutToCatch(inHard(2));
  step(game, idle(), 10);
  assert.ok(game.caught, '안 잡혔다');

  const px = game.player.x;
  const cx = game.chaser.x;
  step(game, idle({ right: true, jump: true }), 20);
  assert.equal(game.player.x, px, '잡혔는데 움직였다');
  assert.equal(game.chaser.x, cx, '잡혔는데 쫓아오는 것이 계속 왔다');
});

test('컷신이 끝나면 죽음을 거쳐 체크포인트로 간다', () => {
  // 새 길을 만들지 않는다 — "죽으면 체크포인트" 라는 이미 배운 규칙이 그대로 통해야 한다
  const game = aboutToCatch(inHard(2));
  const outs = game.chartOuts;
  step(game, idle(), 10);
  assert.ok(game.caught, '안 잡혔다');

  step(game, idle(), Math.ceil(caughtLength() * 60) + 5);
  assert.equal(game.caught, null, '컷신이 안 끝난다');
  assert.equal(game.scene, 'death', '잡혔는데 죽음으로 안 갔다');
  assert.equal(game.chartOuts, outs + 1, '차트아웃이 안 올랐다');

  step(game, idle(), 200);
  assert.equal(game.scene, 'play', '체크포인트에서 안 살아났다');
  assert.equal(game.player.dead, false);
});

test('되살아나면 쫓아오는 것이 내 뒤로 물러나 있다', () => {
  // 안 하면 눈뜨자마자 다시 잡혀서 빠져나올 수가 없다 — 판이 잠긴다
  const game = aboutToCatch(inHard(2));
  step(game, idle(), 10);
  assert.ok(game.caught, '안 잡혔다');
  step(game, idle(), Math.ceil(caughtLength() * 60) + 5);
  // 되살아난 **그 순간**을 잰다. 한참 굴린 뒤에 재면 그 사이 좁혀진 것을 재게 된다.
  for (let i = 0; i < 400 && game.scene !== 'play'; i++) step(game, idle(), 1);
  assert.equal(game.scene, 'play', '체크포인트에서 안 살아났다');

  const gap = game.player.x - game.chaser.x;
  assert.equal(Math.round(gap), CHASE_LEAD, `되살아났는데 ${Math.round(gap)}px 밖에 안 벌어졌다`);

  // 그리고 바로 또 안 잡힌다
  step(game, idle({ right: true }), 60);
  assert.equal(game.caught, null, '살아나자마자 또 잡혔다');
});

// ── 추격 판의 문법 ──────────────────────────────────────────
test('추격 판에는 기다려야 하는 장치가 없다', () => {
  // 서서 기다려야 하는데 뒤에서 로봇이 온다 — 기다릴 수 없는 판에 기다리는 장치를
  // 두면 그냥 못 깨는 자리가 된다.
  for (const stage of HARD_STAGES.filter((s) => s.chase)) {
    const w = createWorld(stage);
    assert.equal(w.blinkers.length, 0, `${stage.id}: 깜빡이는 발판이 있다`);
    assert.equal(w.fakeChecks.length, 0, `${stage.id}: 가짜 체크포인트가 있다`);
  }
});

test('추격 판에는 체크포인트가 넷 이상이다', () => {
  // 잡히면 체크포인트로 가는데 그게 멀면 한 번 잡힐 때마다 판을 통째로 다시 뛴다
  for (const stage of HARD_STAGES.filter((s) => s.chase)) {
    const w = createWorld(stage);
    assert.ok(w.checkpoints.length >= 4, `${stage.id}: 체크포인트가 ${w.checkpoints.length}개뿐`);
  }
});

test('추격 판의 솟는 벽은 달리면서 넘을 수 있다', () => {
  // 넘을 수 없는 벽이 서면 잡히는 것 말고 할 수 있는 게 없다
  for (const stage of HARD_STAGES.filter((s) => s.chase)) {
    const w = createWorld(stage);
    assert.ok(w.risingWalls.length > 0, `${stage.id}: 추격 판인데 벽이 하나도 없다`);
    for (const wall of w.risingWalls) {
      assert.equal(w.tileAt(wall.tx, wall.ty + 1), SOLID, `${stage.id}: 벽이 공중에 떴다`);
      assert.notEqual(w.tileAt(wall.tx, wall.ty - 2), SOLID, `${stage.id}: 벽 위가 막혔다`);
    }
  }
});

test('추격 판은 둘이고, 함정 판도 둘이다', () => {
  const chase = HARD_STAGES.filter((s) => s.chase);
  assert.equal(chase.length, 2, '추격 판이 둘이 아니다');
  assert.deepEqual(chase.map((s) => s.id), ['hard3', 'hard4'], '3·4판이어야 한다');
});
