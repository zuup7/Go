import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TILE,
  SOLID,
  ONEWAY,
  moveBody,
  groundedAt,
  newJumpAssist,
  updateJumpAssist,
  COYOTE_FRAMES,
} from '../src/core/physics.js';

/** 문자열 지도로 tileAt 만들기 ('#' 단단함, '=' 관통 발판) */
function mapOf(rows) {
  return (tx, ty) => {
    const ch = rows[ty]?.[tx];
    if (ch === '#') return SOLID;
    if (ch === '=') return ONEWAY;
    return null;
  };
}

const body = (x, y) => ({ x, y, w: 10, h: 14, vx: 0, vy: 0 });

test('땅에 떨어지면 딱 그 위에서 멈춘다', () => {
  const tileAt = mapOf(['   ', '   ', '###']);
  const b = body(TILE, 0);
  const res = moveBody(b, 0, 60, tileAt);
  assert.equal(res.hitGround, true);
  assert.equal(b.y + b.h, 2 * TILE);
  assert.equal(b.vy, 0);
});

test('옆으로 벽에 박으면 벽 앞에서 멈춘다', () => {
  const tileAt = mapOf(['  #', '  #', '###']);
  const b = body(TILE, TILE);
  b.vx = 200;
  const res = moveBody(b, 40, 0, tileAt);
  assert.equal(res.hitRight, true);
  assert.equal(b.x + b.w, 2 * TILE);
});

test('왼쪽 벽도 마찬가지', () => {
  const tileAt = mapOf(['#  ', '#  ', '###']);
  const b = body(TILE, TILE);
  const res = moveBody(b, -40, 0, tileAt);
  assert.equal(res.hitLeft, true);
  assert.equal(b.x, TILE);
});

test('머리로 천장을 치면 아래로 튕긴다', () => {
  const tileAt = mapOf(['###', '   ', '###']);
  const b = body(TILE, TILE + 6);
  const res = moveBody(b, 0, -20, tileAt);
  assert.equal(res.hitCeil, true);
  assert.equal(b.y, TILE);
  assert.deepEqual(res.ceilTile, { tx: 1, ty: 0 });
});

test('관통 발판은 위에서 내려올 때만 막는다', () => {
  const tileAt = mapOf(['   ', '===', '   ']);
  const falling = body(TILE, 0);
  moveBody(falling, 0, 10, tileAt);
  assert.equal(falling.y + falling.h, TILE, '위에서 내려오면 발판 위에 선다');

  const rising = body(TILE, TILE + 8);
  const res = moveBody(rising, 0, -20, tileAt);
  assert.equal(res.hitCeil, false, '아래에서 위로는 그냥 지나간다');
});

test('한 프레임에 많이 움직여도 벽을 뚫지 않는다', () => {
  const tileAt = mapOf(['     #', '     #', '######']);
  const b = body(0, TILE);
  const res = moveBody(b, 300, 0, tileAt);
  assert.equal(res.hitRight, true);
  assert.equal(b.x + b.w, 5 * TILE);
});

test('발밑 판정', () => {
  const tileAt = mapOf(['   ', '   ', '###']);
  const on = body(TILE, 2 * TILE - 14);
  assert.equal(groundedAt(on, tileAt), true);
  const air = body(TILE, 0);
  assert.equal(groundedAt(air, tileAt), false);
});

test('코요테 타임 — 발판을 떠난 직후에도 점프가 된다', () => {
  const assist = newJumpAssist();
  updateJumpAssist(assist, { onGround: true, jumpPressed: false });
  assert.equal(assist.coyote, COYOTE_FRAMES);
  // 공중에 뜬 뒤 두 프레임 지나서 눌러도 점프
  updateJumpAssist(assist, { onGround: false, jumpPressed: false });
  updateJumpAssist(assist, { onGround: false, jumpPressed: false });
  const jumped = updateJumpAssist(assist, { onGround: false, jumpPressed: true });
  assert.equal(jumped, true);
});

test('코요테 타임이 다 지나면 공중 점프는 안 된다', () => {
  const assist = newJumpAssist();
  updateJumpAssist(assist, { onGround: true, jumpPressed: false });
  for (let i = 0; i < COYOTE_FRAMES; i++) {
    updateJumpAssist(assist, { onGround: false, jumpPressed: false });
  }
  assert.equal(updateJumpAssist(assist, { onGround: false, jumpPressed: true }), false);
});

test('점프 버퍼 — 착지 직전에 누른 입력이 살아있다', () => {
  const assist = newJumpAssist();
  const early = updateJumpAssist(assist, { onGround: false, jumpPressed: true });
  assert.equal(early, false, '공중에서는 아직 안 뛴다');
  const jumped = updateJumpAssist(assist, { onGround: true, jumpPressed: false });
  assert.equal(jumped, true, '착지하는 순간 아까 누른 게 발동한다');
});

test('점프하면 버퍼와 코요테가 모두 소모된다', () => {
  const assist = newJumpAssist();
  updateJumpAssist(assist, { onGround: true, jumpPressed: true });
  assert.equal(assist.coyote, 0);
  assert.equal(assist.buffer, 0);
});
