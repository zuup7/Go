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
import { SOLID, TILE } from '../src/core/physics.js';

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

/**
 * 오른쪽으로 달리면서 **한 칸 앞을 보고** 뛰는 봇. 사람이 하는 만큼만 한다.
 *
 * 예전 봇은 막혔을 때만 뛰어서, 판에 구멍을 파는 순간 그냥 빠져 죽었다.
 * 그 봇으로는 "달리면 도망칠 수 있다"를 잰 게 아니라 "평지인가"를 잰 것이다.
 */
function runBot(game, frames = 60 * 40) {
  const goal = game.world.goal.x;
  let far = game.player.x;
  let hold = 0;
  let gapAtEnd = null;

  for (let i = 0; i < frames; i++) {
    game.player.invuln = 99; // 지금 재는 건 추격이다 — 앨범한테 죽는 건 빼둔다
    const p = game.player;
    const ahead = p.x + p.w + 10;
    const footTy = Math.floor((p.y + p.h + 2) / TILE);
    // 앞이 낭떠러지인가 (발밑 높이에 딛을 것이 없다)
    const gap = p.onGround && game.world.tileAt(Math.floor(ahead / TILE), footTy) !== SOLID;
    // 앞이 막혔나 (벽에 붙어 속도가 죽었다)
    const blocked = p.onGround && Math.abs(p.vx) < 24;
    // 점프는 **붙잡고** 있어야 한다. 놓으면 jumpCut 이 높이를 42%로 깎는다.
    if ((gap || blocked) && hold === 0) hold = 12;
    const jump = hold > 0;
    const pressed = hold === 12;
    if (hold > 0) hold -= 1;

    // 좌우가 뒤집힌 구간에서는 **반대를 누른다.** 사람도 한 번 겪으면 그렇게 한다 —
    // 봇이 그걸 모르면 반전 구간을 "못 지나가는 자리" 로 잘못 재게 된다.
    const go = game.effects.reversed > 0 ? { left: true } : { right: true };
    updateGame(game, idle({ ...go, jump, jumpPressed: pressed }), DT);
    if (game.scene === 'play') {
      far = Math.max(far, game.player.x);
      if (game.chaser) gapAtEnd = game.player.x - game.chaser.x;
    }
    if (game.caught) break;
    if (game.scene !== 'play' && game.scene !== 'death') break; // 골에 닿아 판이 넘어갔다
  }
  return { far, goal, gapAtEnd };
}

test('잘 달리고 잘 뛰면 골까지 간다', () => {
  // 이 판의 약속이다 — 잡히는 건 실수했을 때지, 달리기가 느려서가 아니다.
  for (const index of [2, 3]) {
    const game = inHard(index);
    const { far, goal } = runBot(game);
    assert.equal(game.caught, null, `하드 ${index + 1}판: 잘 달렸는데 잡혔다 (x ${Math.round(far)} / ${goal})`);
    assert.ok(far > goal - 40, `하드 ${index + 1}판: 골(${goal})까지 못 갔다 — ${Math.round(far)} 에서 멈췄다`);
  }
});

test('완주해도 여유가 넉넉하지는 않다 — 뒤가 보이는 거리다', () => {
  // 완벽하게 달린 사람이 한 화면 넘게 벌리고 끝나면 추격이 있으나 마나다.
  // 반대로 코앞까지 붙으면 실수 한 번에 못 깨는 판이 된다. 이 사이를 지킨다.
  for (const index of [2, 3]) {
    const game = inHard(index);
    const { gapAtEnd } = runBot(game);
    assert.ok(gapAtEnd != null, `하드 ${index + 1}판: 쫓아오는 것이 없다`);
    assert.ok(
      gapAtEnd > 60 && gapAtEnd < 420,
      `하드 ${index + 1}판: 완주 시 간격이 ${Math.round(gapAtEnd)}px — 60~420px 사이여야 한다`,
    );
  }
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

test('추격 판에는 체크포인트가 딱 하나, 그것도 한가운데다', () => {
  // 스피드런은 되돌아가는 벌이 세야 긴장이 산다. 다섯 개나 두면 잡혀도
  // 바로 앞에서 다시 시작해서 쫓기는 느낌이 안 난다.
  // 그래도 아예 없애지는 않는다 — 판 끝에서 죽고 처음부터는 너무 가혹하다.
  for (const stage of HARD_STAGES.filter((s) => s.chase)) {
    const w = createWorld(stage);
    assert.equal(w.checkpoints.length, 1, `${stage.id}: 체크포인트가 ${w.checkpoints.length}개다`);
    const at = w.checkpoints[0].x / w.goal.x;
    assert.ok(at > 0.3 && at < 0.65, `${stage.id}: 체크포인트가 판의 ${Math.round(at * 100)}% 지점이다`);
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
