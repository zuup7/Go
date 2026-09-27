// 그림 프레임 고르기. 그리는 코드지만 **캔버스를 안 쓰는 순수한 규칙**이라 여기서 잰다.
//
// 여기가 틀어지면 눈에는 바로 보이는데(발이 미끄러지거나, 대시인데 서 있거나)
// 어떤 테스트도 안 깨져서 한참을 모르고 지나간다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYER_SPRITES, playerFrame } from '../src/render/sprites.js';
import { createPlayer, updatePlayer, respawnPlayer, PLAYER } from '../src/core/player.js';
import { SOLID, TILE } from '../src/core/physics.js';

const DT = 1 / 60;
const flat = {
  pixelWidth: 100000,
  pixelHeight: 400,
  tileAt: (tx, ty) => (ty === 12 ? SOLID : null),
  charAt: () => ' ',
};
const keys = (over = {}) => ({ left: false, right: false, jump: false, jumpPressed: false, ...over });

/** 그 프레임의 이름 */
const nameOf = (frame) => Object.keys(PLAYER_SPRITES).find((k) => PLAYER_SPRITES[k] === frame);
const frameOf = (over) =>
  nameOf(playerFrame({ onGround: true, vx: 0, vy: 0, dashTime: 0, stride: 0, animTime: 0, ...over }));

test('프레임은 모두 같은 크기다', () => {
  // 크기가 다르면 프레임이 넘어갈 때 몸이 튄다
  const sizes = new Set(Object.values(PLAYER_SPRITES).map((s) => `${s.w}x${s.h}`));
  assert.equal(sizes.size, 1, `크기가 섞여 있다: ${[...sizes].join(', ')}`);
  assert.equal([...sizes][0], '12x16');
});

test('모든 줄이 12칸이다', () => {
  // 한 줄이라도 짧으면 그 줄만 잘려서 몸에 구멍이 난다
  for (const [name, spr] of Object.entries(PLAYER_SPRITES)) {
    for (const row of spr.rows) {
      assert.equal(row.length, 12, `${name}: '${row}' 가 ${row.length}칸이다`);
    }
  }
});

test('상태마다 다른 그림이 나온다', () => {
  assert.equal(frameOf({}), 'stand');
  assert.equal(frameOf({ dashTime: 0.1, vx: 260 }), 'dash', '대시 중인데 대시 그림이 아니다');
  assert.equal(frameOf({ onGround: false, vy: -200 }), 'jump');
  assert.equal(frameOf({ onGround: false, vy: 200 }), 'fall', '떨어지는데 뜨는 그림이다');
});

test('대시 그림이 다른 무엇보다 먼저다', () => {
  // 공중 대시에서 낙하 그림이 이기면 대시가 화면에 안 보인다
  assert.equal(frameOf({ dashTime: 0.1, onGround: false, vy: 300, vx: 260 }), 'dash');
});

test('발은 시간이 아니라 **달린 거리**로 돈다', () => {
  // 시간으로 돌리면 느리게 걸을 때 발이 땅을 미끄러진다.
  // 같은 거리면 빠르든 느리든 같은 프레임이어야 한다.
  for (const stride of [0, 9, 18, 27]) {
    assert.equal(
      frameOf({ vx: 30, stride }),
      frameOf({ vx: 124, stride }),
      `${stride}px 에서 속도에 따라 발이 달라진다`,
    );
  }
});

test('달리기는 네 프레임을 돌고 제자리로 온다', () => {
  const seen = [0, 9, 18, 27].map((stride) => frameOf({ vx: 100, stride }));
  assert.equal(new Set(seen).size, 4, `네 프레임이 아니다: ${seen.join(', ')}`);
  assert.equal(frameOf({ vx: 100, stride: 36 }), seen[0], '한 바퀴 돌면 제자리');
});

test('달린 만큼만 stride 가 쌓인다', () => {
  const player = createPlayer({ x: 40, y: 100 });
  // 확실히 땅에 닿을 때까지 — 공중 이동은 stride 에 안 쌓이므로 뜬 채로 재면 안 맞는다
  for (let i = 0; i < 120 && !player.onGround; i++) updatePlayer(player, keys(), flat, DT);
  assert.equal(player.onGround, true, '착지를 못 했다');
  const x0 = player.x;
  const s0 = player.stride;
  for (let i = 0; i < 60; i++) updatePlayer(player, keys({ right: true }), flat, DT);
  const ran = player.x - x0;
  assert.ok(ran > 30, '안 달렸다');
  assert.ok(
    Math.abs(player.stride - s0 - ran) < 2,
    `달린 거리(${ran.toFixed(1)})와 stride(${(player.stride - s0).toFixed(1)})가 다르다`,
  );
});

test('공중에서는 발이 안 돈다', () => {
  // 허공에서 발이 돌면 뛰는 게 아니라 헤엄치는 것처럼 보인다
  const player = createPlayer({ x: 40, y: 40 });
  player.vx = PLAYER.maxSpeed;
  const before = player.stride;
  for (let i = 0; i < 5; i++) updatePlayer(player, keys({ right: true }), flat, DT);
  assert.equal(player.onGround, false, '벌써 착지했다');
  assert.equal(player.stride, before, '공중인데 발이 돌았다');
});

test('죽고 살아나면 발이 처음부터 돈다', () => {
  const player = createPlayer({ x: 40, y: 100 });
  for (let i = 0; i < 60; i++) updatePlayer(player, keys({ right: true }), flat, DT);
  assert.ok(player.stride > 0);
  respawnPlayer(player, { x: 40, y: 100 });
  assert.equal(player.stride, 0);
});

test('걸음 한 칸이 다리 길이보다 짧다', () => {
  // 한 걸음에 몸통보다 멀리 가면 프레임이 뚝뚝 끊겨 보인다
  const player = createPlayer({ x: 0, y: 0 });
  const perStep = 9; // sprites.js 의 STRIDE
  assert.ok(perStep < player.w * 2, '걸음이 너무 크다');
  assert.ok(TILE / perStep > 1, '한 칸 안에 걸음이 한 번은 들어가야 한다');
});
