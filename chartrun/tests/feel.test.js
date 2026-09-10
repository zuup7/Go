// 조작감. 숫자를 만질 때 레벨이 조용히 못 깨는 판이 되지 않게 못 박아 둔다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { moveBody, TILE, SOLID, COYOTE_FRAMES, BUFFER_FRAMES } from '../src/core/physics.js';
import { createPlayer, updatePlayer, respawnPlayer, bounce, PLAYER } from '../src/core/player.js';

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

// ── 밟기 ────────────────────────────────────────────────────
test('밟을 때 점프를 누르고 있으면 더 높이 튄다', () => {
  // 밟기가 "닿으면 알아서 튀는 것"이 아니라 노려서 쓰는 이동 수단이 되는 지점이다
  const tap = createPlayer({ x: 0, y: 0 });
  const hold = createPlayer({ x: 0, y: 0 });
  bounce(tap, false, false);
  bounce(hold, false, true);
  assert.ok(hold.vy < tap.vy, `누르고 있어도 같게 튄다 (${hold.vy} vs ${tap.vy})`);
  assert.ok(PLAYER.stompHold > 1);
});

test('세게 밟았을 때도 누르고 있으면 더 높다', () => {
  const weak = createPlayer({ x: 0, y: 0 });
  const strong = createPlayer({ x: 0, y: 0 });
  bounce(weak, true, false);
  bounce(strong, true, true);
  assert.ok(strong.vy < weak.vy);
});

// ── 착지 ────────────────────────────────────────────────────
test('착지하면 알려주고, 세게 떨어질수록 세기가 크다', () => {
  /** height 칸 높이에서 떨어뜨려 착지 순간의 impact 를 잰다 */
  const dropFrom = (height) => {
    const player = createPlayer({ x: 100, y: 12 * TILE - 14 - height * TILE });
    for (let i = 0; i < 300; i++) {
      const e = updatePlayer(player, keys(), flat, DT);
      if (e.landed) return e.landed;
    }
    return null;
  };
  const soft = dropFrom(1);
  const hard = dropFrom(9);
  assert.ok(soft, '착지를 안 알려준다 — 먼지도 찌그러짐도 못 붙인다');
  assert.ok(hard.impact > soft.impact, `가볍게(${soft.impact}) 와 세게(${hard.impact}) 가 같다`);
  assert.ok(hard.impact <= 1 && soft.impact >= 0, '세기는 0~1 이어야 한다');
});

test('땅에 서 있는 동안에는 착지를 계속 알리지 않는다', () => {
  const player = createPlayer({ x: 100, y: 12 * TILE - 14 });
  let count = 0;
  for (let i = 0; i < 60; i++) if (updatePlayer(player, keys({ right: true }), flat, DT).landed) count += 1;
  assert.ok(count <= 1, `걷기만 했는데 착지가 ${count}번 — 먼지가 계속 피어오른다`);
});

test('찌그러짐은 저절로 풀린다', () => {
  // 안 풀리면 납작해진 채로 남는다
  const player = createPlayer({ x: 100, y: 12 * TILE - 14 - 6 * TILE });
  for (let i = 0; i < 300; i++) {
    const e = updatePlayer(player, keys(), flat, DT);
    if (e.landed) break;
  }
  assert.ok(player.squash > 0, '착지했는데 안 납작해졌다');
  for (let i = 0; i < 120; i++) updatePlayer(player, keys(), flat, DT);
  assert.equal(player.squash, 0, '찌그러진 채로 남았다');
});

test('점프하면 길쭉해졌다가 풀린다', () => {
  const player = createPlayer({ x: 100, y: 12 * TILE - 14 });
  updatePlayer(player, keys(), flat, DT);
  updatePlayer(player, keys({ jump: true, jumpPressed: true }), flat, DT);
  assert.ok(player.stretch > 0);
  for (let i = 0; i < 120; i++) updatePlayer(player, keys({ jump: true }), flat, DT);
  assert.equal(player.stretch, 0);
});

// ── 관대함 ──────────────────────────────────────────────────
test('코요테 타임과 점프 버퍼가 넉넉하다', () => {
  // 프레임 단위라 값이 작으면 폰에서 특히 억울하다 (터치는 키보드보다 늦게 들어온다)
  assert.ok(COYOTE_FRAMES >= 8, `코요테가 ${COYOTE_FRAMES}프레임 — 발판을 떠난 직후가 너무 빡빡하다`);
  assert.ok(BUFFER_FRAMES >= 10, `버퍼가 ${BUFFER_FRAMES}프레임 — 착지 직전 입력이 자꾸 씹힌다`);
});

// ── 대시 ────────────────────────────────────────────────────
// 3페이즈 레이저를 넘어가라고 넣은 것이다. 여기 수치가 흔들리면 그 판이 흔들린다.

test('대시하면 한 프레임 만에 최고 속도를 넘는다', () => {
  const player = createPlayer({ x: 40, y: 100 });
  for (let i = 0; i < 20; i++) updatePlayer(player, keys(), flat, DT);

  const events = updatePlayer(player, keys({ dashPressed: true }), flat, DT);
  assert.ok(events.dashed, '대시했다고 알리지 않았다 — 소리가 안 난다');
  assert.ok(
    Math.abs(player.vx) > PLAYER.maxSpeed,
    `대시가 달리기보다 안 빠르다 (${player.vx})`,
  );
});

test('대시가 끝나면 원래 속도로 돌아온다', () => {
  const player = createPlayer({ x: 40, y: 100 });
  updatePlayer(player, keys({ dashPressed: true }), flat, DT);
  for (let i = 0; i < 40; i++) updatePlayer(player, keys(), flat, DT);
  assert.equal(player.dashTime, 0);
  assert.ok(Math.abs(player.vx) <= PLAYER.maxSpeed, '대시 속도가 안 풀린다');
});

test('쿨이 도는 동안에는 다시 안 나간다', () => {
  // 계속 누르고 있으면 무한 대시가 되어 레벨이 통째로 무너진다
  const player = createPlayer({ x: 40, y: 100 });
  let count = 0;
  for (let i = 0; i < 30; i++) {
    if (updatePlayer(player, keys({ dashPressed: true }), flat, DT).dashed) count++;
  }
  assert.equal(count, 1, '누르고 있는 내내 대시가 나갔다');

  // 쿨이 다 돌면 다시 된다
  for (let i = 0; i < 60; i++) updatePlayer(player, keys(), flat, DT);
  assert.ok(updatePlayer(player, keys({ dashPressed: true }), flat, DT).dashed, '쿨이 안 풀린다');
});

test('공중 대시가 낙하를 멈추지 않는다', () => {
  // 멈추면 부양기가 되고, 세 칸 구멍이 구멍이 아니게 된다
  const player = createPlayer({ x: 40, y: 40 });
  for (let i = 0; i < 6; i++) updatePlayer(player, keys(), flat, DT);
  const before = player.vy;
  assert.ok(before > 0, '아직 안 떨어지고 있다');
  updatePlayer(player, keys({ dashPressed: true }), flat, DT);
  assert.ok(player.vy > before, `대시하니까 낙하가 멎었다 (${before} → ${player.vy})`);
});

test('죽고 살아나면 대시가 돌아와 있다', () => {
  const player = createPlayer({ x: 40, y: 100 });
  updatePlayer(player, keys({ dashPressed: true }), flat, DT);
  assert.ok(player.dashCool > 0);
  respawnPlayer(player, { x: 40, y: 100 });
  assert.equal(player.dashCool, 0, '죽은 자리의 쿨을 안고 되살아난다');
  assert.equal(player.dashTime, 0);
});

test('대시 거리가 짧다 — 두 칸 남짓', () => {
  // 멀리 가면 순간이동처럼 보여서 어디에 설지를 못 겨눈다.
  // 그리고 세 칸(48px)을 넘기면 레벨이 기대는 구멍을 그냥 지나쳐 버린다.
  const reach = PLAYER.dashSpeed * PLAYER.dashTime;
  assert.ok(reach > 24, `${Math.round(reach)}px 면 레이저 발자국(14px)도 못 벗어난다`);
  assert.ok(reach < TILE * 3, `${Math.round(reach)}px 는 너무 멀다 — 세 칸을 넘으면 안 된다`);
});

test('같은 프레임에 누른 방향으로 대시한다', () => {
  // 폰에서는 ◀ 와 💨 가 한 프레임에 같이 들어오는 게 보통이다.
  // 이걸 놓치면 피하려던 **반대쪽**으로 대시해서 레이저 안으로 들어간다.
  const player = createPlayer({ x: 400, y: 100 });
  for (let i = 0; i < 120 && !player.onGround; i++) updatePlayer(player, keys(), flat, DT);
  assert.equal(player.dir, 1, '처음엔 오른쪽을 본다');

  updatePlayer(player, keys({ left: true, dashPressed: true }), flat, DT);
  assert.equal(player.dir, -1, '왼쪽을 눌렀는데 오른쪽으로 대시했다');
  assert.ok(player.vx < -PLAYER.maxSpeed, `왼쪽으로 안 간다 (${player.vx.toFixed(0)})`);
});

test('방향을 안 누르면 보던 쪽으로 대시한다', () => {
  const player = createPlayer({ x: 400, y: 100 });
  for (let i = 0; i < 120 && !player.onGround; i++) updatePlayer(player, keys(), flat, DT);
  for (let i = 0; i < 20; i++) updatePlayer(player, keys({ left: true }), flat, DT);
  assert.equal(player.dir, -1);
  updatePlayer(player, keys({ dashPressed: true }), flat, DT);
  assert.ok(player.vx < 0, '보던 쪽으로 안 간다');
});
