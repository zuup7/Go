// 조작감. 숫자를 만질 때 레벨이 조용히 못 깨는 판이 되지 않게 못 박아 둔다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { moveBody, TILE, SOLID } from '../src/core/physics.js';
import { createPlayer, updatePlayer, PLAYER } from '../src/core/player.js';

const DT = 1 / 60;

/** ty=12 줄만 바닥인 무한 평지 */
const flat = {
  pixelWidth: 100000,
  pixelHeight: 400,
  tileAt: (tx, ty) => (ty === 12 ? SOLID : null),
  charAt: () => ' ',
};

const keys = (over = {}) => ({ left: false, right: false, jump: false, jumpPressed: false, ...over });

/** 최고 속도까지 달린 뒤 최대 점프. 최고 높이와 수평 도달 거리를 잰다. */
function maxJump({ run = true } = {}) {
  const player = createPlayer({ x: 100, y: 12 * TILE - 14 });
  if (run) for (let i = 0; i < 90; i++) updatePlayer(player, keys({ right: true }), flat, DT);
  const y0 = player.y;
  const x0 = player.x;
  let apex = 0;
  let rise = 0;
  let fall = 0;
  let past = false;
  updatePlayer(player, keys({ right: run, jump: true, jumpPressed: true }), flat, DT);
  for (let i = 0; i < 300; i++) {
    updatePlayer(player, keys({ right: run, jump: true }), flat, DT);
    if (!past) {
      rise += 1;
      if (player.vy >= 0) past = true;
    } else {
      fall += 1;
    }
    apex = Math.max(apex, y0 - player.y);
    if (player.onGround && i > 4) break;
  }
  return { height: apex / TILE, width: (player.x - x0) / TILE, rise, fall };
}

// ── 레벨이 기대는 도달 거리 ─────────────────────────────────
// stages.test.js 는 구멍이 세 칸까지, 계단이 두 줄씩이라고 믿고 검사한다.
// 물리 수치를 만져서 이 아래로 내려가면 못 깨는 판이 생긴다.
test('달리며 뛰면 세 칸 구멍을 넘고 두 줄을 오른다', () => {
  const { height, width } = maxJump();
  assert.ok(width >= 4, `수평 도달이 ${width.toFixed(2)}칸 — 세 칸 구멍(+몸통)을 못 넘는다`);
  assert.ok(height >= 2.5, `점프 높이가 ${height.toFixed(2)}칸 — 두 줄 계단을 못 오른다`);
});

test('제자리에서도 두 줄은 오른다', () => {
  assert.ok(maxJump({ run: false }).height >= 2.5);
});

test('내려올 때가 올라갈 때보다 빠르다 — 붕 뜨지 않는다', () => {
  const { rise, fall } = maxJump();
  assert.ok(fall < rise, `상승 ${rise}f, 하강 ${fall}f — 하강이 더 느리면 둔하게 느껴진다`);
});

test('정점 근처에서는 중력이 약해진다', () => {
  assert.ok(PLAYER.apexGravity < 1, '정점 체공이 꺼져 있다');
  assert.ok(PLAYER.fallGravity > 1, '빠른 낙하가 꺼져 있다');
});

// ── 방향 전환 ───────────────────────────────────────────────
test('반대로 꺾으면 그냥 멈췄다 가는 것보다 빠르다', () => {
  const framesToTurn = (turnBoost) => {
    const saved = PLAYER.turnBoost;
    PLAYER.turnBoost = turnBoost;
    const player = createPlayer({ x: 400, y: 12 * TILE - 14 });
    for (let i = 0; i < 90; i++) updatePlayer(player, keys({ right: true }), flat, DT);
    let frames = 0;
    while (player.vx > -PLAYER.maxSpeed * 0.9 && frames < 200) {
      updatePlayer(player, keys({ left: true }), flat, DT);
      frames += 1;
    }
    PLAYER.turnBoost = saved;
    return frames;
  };
  assert.ok(framesToTurn(PLAYER.turnBoost) < framesToTurn(1), '방향 전환 가속이 먹지 않는다');
});

// ── 모서리 보정 ─────────────────────────────────────────────
// 블록 귀퉁이에 몇 픽셀 스쳤다고 점프가 죽으면, 플레이어 눈에는 그냥 억울하다.
/** (blockTx, 3) 한 칸만 천장인 세상 */
const oneBlock = (blockTx) => (tx, ty) => (ty === 3 && tx === blockTx ? SOLID : null);

test('머리 귀퉁이가 살짝 걸리면 옆으로 밀려 통과한다', () => {
  // 블록은 4번 칸(64~80). 몸통 10px 이 3px 만 물리게 x=77 에 둔다.
  const body = { x: 77, y: 4 * TILE + 2, w: 10, h: 14, vx: 0, vy: -200 };
  const res = moveBody(body, 0, -6, oneBlock(4), PLAYER.cornerNudge);
  assert.equal(res.hitCeil, false, '스친 것뿐인데 점프가 죽었다');
  assert.equal(res.cornered, true, '보정이 안 걸렸다');
  assert.ok(body.x >= 80, `옆으로 안 밀렸다 (x=${body.x})`);
  assert.ok(body.vy < 0, '올라가던 속도는 살아 있어야 한다');
});

test('반대쪽 귀퉁이도 똑같이 밀어준다', () => {
  // 블록은 4번 칸(64~80). 오른쪽 귀퉁이에 3px 만 물리게 x=57 에 둔다.
  const body = { x: 57, y: 4 * TILE + 2, w: 10, h: 14, vx: 0, vy: -200 };
  const res = moveBody(body, 0, -6, oneBlock(4), PLAYER.cornerNudge);
  assert.equal(res.cornered, true);
  assert.ok(body.x + body.w <= 64, `옆으로 안 밀렸다 (x=${body.x})`);
});

test('제대로 처박으면 보정 없이 머리를 찧는다', () => {
  // 몸통 절반이 넘게 블록 아래에 있으면 그냥 천장이다
  const body = { x: 72, y: 4 * TILE + 2, w: 10, h: 14, vx: 0, vy: -200 };
  const res = moveBody(body, 0, -6, oneBlock(4), PLAYER.cornerNudge);
  assert.equal(res.hitCeil, true, '이건 보정하면 벽을 뚫는 것과 같다');
  assert.equal(body.vy, 0);
});

test('천장이 두 칸 다 막혀 있으면 보정하지 않는다', () => {
  const solidRoof = (tx, ty) => (ty === 3 ? SOLID : null);
  const body = { x: 77, y: 4 * TILE + 2, w: 10, h: 14, vx: 0, vy: -200 };
  const res = moveBody(body, 0, -6, solidRoof, PLAYER.cornerNudge);
  assert.equal(res.hitCeil, true);
  assert.equal(res.cornered, false);
});

test('밀려날 자리 아래가 벽이면 보정하지 않는다', () => {
  // 4번 칸 천장 + 5번 칸이 통짜 벽. 오른쪽으로 밀면 벽 속에 처박힌다.
  const walled = (tx, ty) => ((ty === 3 && tx === 4) || tx === 5 ? SOLID : null);
  const body = { x: 77, y: 4 * TILE + 2, w: 10, h: 14, vx: 0, vy: -200 };
  const res = moveBody(body, 0, -6, walled, PLAYER.cornerNudge);
  assert.equal(res.cornered, false, '벽 속으로 밀어넣었다');
  assert.equal(res.hitCeil, true);
});

test('보정을 끄면(corner=0) 예전처럼 그대로 막힌다', () => {
  const body = { x: 77, y: 4 * TILE + 2, w: 10, h: 14, vx: 0, vy: -200 };
  const res = moveBody(body, 0, -6, oneBlock(4));
  assert.equal(res.hitCeil, true);
});
