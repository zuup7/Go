import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  updateGame,
  loadStage,
  loadBoss,
  WALL_HEIGHT,
  BOMB_GAP,
} from '../src/core/game.js';
import { createWorld, T, tileKind, ZONE_KINDS } from '../src/core/world.js';
import { createPlayer, updatePlayer, PLAYER } from '../src/core/player.js';
import { SOLID, TILE } from '../src/core/physics.js';
import { TRAPS, TRAP_KINDS, ZONE_EFFECTS, trapKey } from '../src/data/traps.js';
import { STAGES, HARD_STAGES } from '../src/data/stages.js';
import { createBoss, createMic, throwMic, updateThrown, updateBoss, MIC_SIZE } from '../src/core/boss.js';
import { BOSS_MAX_HP } from '../src/data/bossData.js';
import { emptySave } from '../src/core/save.js';

const idle = {
  left: false,
  right: false,
  jump: false,
  jumpPressed: false,
  throwPressed: false,
  dashPressed: false,
  confirmPressed: false,
  restartPressed: false,
  pausePressed: false,
  mutePressed: false,
  anyPressed: false,
};
const step = (game, input = idle, frames = 1) => {
  for (let i = 0; i < frames; i++) updateGame(game, input, 1 / 60);
};

/** 스테이지에서 그 글자가 처음 나오는 칸 */
function findChar(world, ch) {
  for (let ty = 0; ty < world.height; ty++) {
    for (let tx = 0; tx < world.width; tx++) {
      if (world.charAt(tx, ty) === ch) return { tx, ty };
    }
  }
  return null;
}

const standOn = (game, tx, ty) => {
  game.player.x = tx * TILE + 3;
  game.player.y = ty * TILE - game.player.h;
  game.player.vy = 10;
};

// ── 타일과 글자 ─────────────────────────────────────────────
test('새 장치 글자가 기존 글자와 겹치지 않는다', () => {
  const chars = TRAP_KINDS.map((k) => TRAPS[k].char);
  assert.equal(new Set(chars).size, chars.length);
  // 앨범은 a~q 를 쓰니 그 범위를 침범하면 안 된다 (낙하 앨범 g 는 앨범 자체라 예외)
  for (const kind of TRAP_KINDS) {
    const ch = TRAPS[kind].char;
    if (kind === 'fallingAlbum') continue;
    assert.ok(ch < 'a' || ch > 'q', `${kind}: '${ch}' 는 앨범 글자 범위와 겹친다`);
  }
});

test('무너지는 바닥과 솟은 벽은 단단하고, 아직 안 솟은 벽은 아니다', () => {
  assert.equal(tileKind(T.CRUMBLE), SOLID, '평범한 땅인 척해야 속는다');
  assert.equal(tileKind(T.RISEN), SOLID);
  assert.equal(tileKind(T.WALL), null, '솟기 전에는 길을 막지 않는다');
  assert.equal(tileKind(T.ZONE_REVERSE), null);
  assert.equal(tileKind(T.ZONE_BLACKOUT), null);
});

test('존 글자는 격자에서 빠지고 목록으로 간다', () => {
  const world = createWorld({
    id: 'z',
    number: 1,
    name: '',
    icon: '',
    subtitle: '',
    sky: ['#000', '#111'],
    ground: ['#222', '#333'],
    rows: [
      ...Array(11).fill(' '.repeat(10)),
      ' R  @     ',
      '##########',
      '##########',
    ],
  });
  assert.equal(world.zones.length, 2);
  assert.deepEqual(world.zones.map((z) => z.kind).sort(), ['blackout', 'reversed']);
  assert.equal(world.charAt(1, 11), T.EMPTY, '트리거 글자는 지형에 안 남는다');
  // 글자 목록을 그대로 못 박지 않는다 — 구간 효과를 더할 때마다 깨지기만 한다.
  // 지켜야 하는 건 "모든 구간 글자에 효과가 짝지어져 있다" 는 규칙이다.
  for (const [ch, kind] of Object.entries(ZONE_KINDS)) {
    assert.ok(ch.length === 1, `구간 글자 '${ch}' 가 한 글자가 아니다`);
    assert.ok(ZONE_EFFECTS[kind], `구간 '${ch}' 의 효과 ${kind} 가 표에 없다`);
  }
});

// ── 무너지는 바닥 ───────────────────────────────────────────
test('무너지는 바닥은 잠시 뒤 꺼지고, 죽으면 되살아난다', () => {
  const game = createGame({ seed: 1 });
  loadStage(game, 0);
  game.scene = 'play';
  const spot = findChar(game.world, T.CRUMBLE);
  assert.ok(spot, '스테이지 1 에 무너지는 바닥이 있어야 한다');

  standOn(game, spot.tx, spot.ty);
  step(game, idle, 6);
  assert.equal(game.world.charAt(spot.tx, spot.ty), T.CRUMBLE, '바로 꺼지면 피할 방법이 없다');

  step(game, idle, 60);
  assert.equal(game.world.charAt(spot.tx, spot.ty), T.EMPTY, '결국 꺼진다');
  assert.equal(game.trapMemory.has(trapKey(spot.tx, spot.ty)), true, '다음부터는 금이 보인다');

  game.world.restoreChanged();
  assert.equal(game.world.charAt(spot.tx, spot.ty), T.CRUMBLE, '다시 시작하면 바닥이 돌아온다');
});

// ── 솟아오르는 벽 ───────────────────────────────────────────
test('벽은 다가가야 솟고, 넘을 수 있는 두 칸이다', () => {
  const game = createGame({ seed: 2 });
  loadStage(game, 1);
  game.scene = 'play';
  const wall = game.world.risingWalls[0];
  assert.ok(wall, '스테이지 2 에 솟아오르는 벽이 있어야 한다');
  assert.equal(game.world.tileAt(wall.tx, wall.ty), null, '솟기 전에는 길이 뚫려 있다');

  // 멀리 있으면 안 솟는다
  game.player.x = wall.x - 300;
  game.player.y = wall.y - game.player.h;
  step(game, idle, 10);
  assert.equal(wall.risen, false);

  game.player.x = wall.x - 20;
  step(game);
  assert.equal(wall.risen, true, '가까이 가면 솟는다');
  assert.equal(WALL_HEIGHT, 2, '세 칸이면 점프로 못 넘는다');
  for (let i = 0; i < WALL_HEIGHT; i++) {
    assert.equal(game.world.tileAt(wall.tx, wall.ty - i), SOLID, `${i}번째 칸이 안 섰다`);
  }
  // 벽 위가 막혀 있으면 넘을 수가 없다. 관통 발판은 위로 지나갈 수 있으니 괜찮다.
  assert.notEqual(
    game.world.tileAt(wall.tx, wall.ty - WALL_HEIGHT),
    SOLID,
    '벽 바로 위가 단단하면 넘어갈 길이 없다',
  );

  game.world.restoreChanged();
  assert.equal(wall.risen, false, '다시 시작하면 벽도 도로 들어간다');
});

// ── 역재생 · 정전 ───────────────────────────────────────────
test('역재생 구간에 들어가면 좌우가 바뀌고, 시간이 지나면 반드시 풀린다', () => {
  const game = createGame({ seed: 3 });
  loadStage(game, 3);
  game.scene = 'play';
  const zone = game.world.zones.find((z) => z.kind === 'reversed');
  assert.ok(zone, '스테이지 4 에 역재생 구간이 있어야 한다');

  game.player.x = zone.x;
  game.player.y = zone.y;
  step(game);
  assert.ok(game.effects.reversed > 0, '걸렸다');

  // 오른쪽을 눌렀는데 왼쪽으로 가야 한다
  const before = game.player.x;
  step(game, { ...idle, right: true }, 20);
  assert.ok(game.player.x < before, `오른쪽을 눌렀는데 ${game.player.x} 로 안 밀렸다`);

  step(game, idle, 60 * (ZONE_EFFECTS.reversed.seconds + 1));
  assert.equal(game.effects.reversed, 0, '영구히 걸리면 게임이 끝난다');
});

test('정전도 시간이 지나면 풀린다', () => {
  const game = createGame({ seed: 4 });
  loadStage(game, 2);
  game.scene = 'play';
  const zone = game.world.zones.find((z) => z.kind === 'blackout');
  assert.ok(zone, '스테이지 3 에 정전 구간이 있어야 한다');

  game.player.x = zone.x;
  game.player.y = zone.y;
  step(game);
  assert.ok(game.effects.blackout > 0);
  step(game, idle, 60 * (ZONE_EFFECTS.blackout.seconds + 1));
  assert.equal(game.effects.blackout, 0);
});

test('모든 구간 효과는 저절로 풀리는 시간이 정해져 있다', () => {
  for (const kind of Object.values(ZONE_KINDS)) {
    const spec = ZONE_EFFECTS[kind];
    assert.ok(spec, `${kind}: 효과 정의가 없다`);
    assert.ok(spec.seconds > 0 && spec.seconds < 10, `${kind}: 지속 시간이 이상하다`);
  }
});

test('모든 솟는 벽은 넘어갈 수 있게 놓여 있다', () => {
  // 벽은 두 칸이다. 바로 위가 단단하면 길이 영영 막힌다.
  // 하드 판도 같이 본다 — 예전에 여기가 STAGES 만 돌아서, 하드 4판의 벽 하나가
  // 구멍 위에 떠 있는 채로 그냥 지나갔다.
  for (const stage of [...STAGES, ...HARD_STAGES]) {
    const world = createWorld(stage);
    for (const wall of world.risingWalls) {
      assert.notEqual(
        world.tileAt(wall.tx, wall.ty - WALL_HEIGHT),
        SOLID,
        `${stage.id}: (${wall.tx},${wall.ty}) 벽 위가 막혀 있다`,
      );
      assert.equal(
        world.tileAt(wall.tx, wall.ty + 1),
        SOLID,
        `${stage.id}: (${wall.tx},${wall.ty}) 벽이 딛고 설 바닥 없이 공중에 있다`,
      );
    }
  }
});

test('구간 트리거는 지나갈 수 있는 자리에 있다', () => {
  for (const stage of [...STAGES, ...HARD_STAGES]) {
    const world = createWorld(stage);
    for (const zone of world.zones) {
      assert.equal(
        world.tileAt(zone.tx, zone.ty + 1),
        SOLID,
        `${stage.id}: (${zone.tx},${zone.ty}) 구간이 허공에 떠 있어 밟을 수가 없다`,
      );
    }
  }
});

test('새 장치가 실제로 스테이지에 깔려 있다', () => {
  const found = { crumble: 0, wall: 0, reversed: 0, blackout: 0 };
  for (const stage of STAGES) {
    const world = createWorld(stage);
    found.wall += world.risingWalls.length;
    for (const zone of world.zones) found[zone.kind] += 1;
    for (let ty = 0; ty < world.height; ty++) {
      for (let tx = 0; tx < world.width; tx++) {
        if (world.charAt(tx, ty) === T.CRUMBLE) found.crumble += 1;
      }
    }
  }
  for (const [name, count] of Object.entries(found)) {
    assert.ok(count > 0, `${name} 장치가 어느 스테이지에도 안 깔렸다`);
  }
});

// ── 보스전 마이크 ───────────────────────────────────────────
test('보스가 마이크를 주기적으로 떨군다', () => {
  const boss = createBoss(640);
  const dropped = [];
  const ctx = {
    player: { x: 100, y: 150, w: 10, h: 14 },
    arenaWidth: 640,
    spawnShot: () => {},
    addAlbum: () => {},
    dropMic: (mic) => dropped.push(mic),
  };
  for (let i = 0; i < 60 * 12; i++) updateBoss(boss, ctx, 1 / 60);
  assert.ok(dropped.length >= 2, `마이크가 ${dropped.length}개밖에 안 떨어졌다`);
  assert.equal(dropped[0].w, MIC_SIZE);
});

test('던진 마이크는 날아가다 수명이 다하면 사라진다', () => {
  const world = { pixelWidth: 640, pixelHeight: 224 };
  const mic = throwMic({ x: 100, y: 150, w: 10, dir: 1 });
  assert.ok(mic.vx > 0 && mic.vy < 0, '앞 위로 던진다');
  let frames = 0;
  while (updateThrown(mic, world, 1 / 60) && frames < 60 * 10) frames += 1;
  assert.ok(frames < 60 * 10, '언젠가는 사라져야 한다');
});

test('마이크는 주우면 한 발, 던지면 없어진다 (1회용)', () => {
  const game = createGame({ seed: 5 });
  loadBoss(game);
  game.scene = 'boss';
  assert.equal(game.player.ammo, 0);

  // 발밑에 마이크를 놔둔다
  game.mics.push(createMic(game.player.x, game.player.y));
  step(game);
  assert.equal(game.player.ammo, 1, '주웠다');
  assert.equal(game.mics.length, 0, '주운 마이크는 바닥에서 사라진다');

  step(game, { ...idle, throwPressed: true });
  assert.equal(game.player.ammo, 0, '한 번 쓰면 없어진다');
  assert.equal(game.thrown.length, 1, '날아가고 있다');

  // 빈손으로 또 누르면 아무 일도 없다
  step(game, { ...idle, throwPressed: true });
  assert.equal(game.thrown.length, 1, '없는 마이크를 던지면 안 된다');
});

test('던진 마이크가 보스에 맞으면 약점이 안 열려 있어도 한 대 들어간다', () => {
  const game = createGame({ seed: 6 });
  loadBoss(game);
  game.scene = 'boss';
  game.boss.vulnerable = false;
  const before = game.boss.hp;

  // 보스 위에 마이크를 얹어 명중시킨다
  const mic = throwMic(game.player);
  mic.x = game.boss.x + game.boss.w / 2;
  mic.y = game.boss.y + game.boss.h / 2;
  mic.vx = 0;
  mic.vy = 0;
  game.thrown.push(mic);
  step(game);

  assert.equal(game.boss.hp, before - 1, '멀리서도 한 대는 들어가야 아이템을 주우러 간다');
  assert.equal(game.thrown.length, 0, '맞은 마이크는 사라진다');
});

test('마이크 아홉 번이면 보스가 쓰러진다 — 3페이즈까지 실제로 지나간다', () => {
  const game = createGame({ seed: 7 });
  loadBoss(game);
  game.scene = 'boss';
  const seen = new Set([game.boss.phaseId]);
  for (let i = 0; i < BOSS_MAX_HP; i++) {
    const mic = throwMic(game.player);
    mic.x = game.boss.x + game.boss.w / 2;
    mic.y = game.boss.y + game.boss.h / 2;
    mic.vx = 0;
    mic.vy = 0;
    game.thrown.push(mic);
    step(game);
    seen.add(game.boss.phaseId);
    // 페이즈가 바뀌면 전환 컷신이 싸움을 멈춘다 — 여기선 대미지만 세므로 건너뛴다
    game.bossCut = null;
  }
  assert.deepEqual([...seen].sort(), [1, 2, 3]);
  assert.equal(game.boss.state, 'defeated');
});

// ── 대시는 보스전에서만 ─────────────────────────────────────
test('판에서는 대시가 안 나간다', () => {
  // 스테이지는 걷기와 점프만으로 넘도록 짜여 있다. 여기서 대시가 되면
  // 구멍이 구멍이 아니게 되고, 넘으라고 만든 자리를 그냥 지나쳐 버린다.
  const game = createGame({ seed: 7, save: { ...emptySave(), seenOpening: true } });
  loadStage(game, 0);
  step(game, idle, 200);
  assert.equal(game.scene, 'play');

  const before = game.player.x;
  step(game, { ...idle, dashPressed: true }, 8);
  assert.equal(game.player.dashTime, 0, '판에서 대시가 나갔다');
  assert.equal(game.player.dashCool, 0, '판에서 쿨이 돌기 시작했다');
  assert.ok(Math.abs(game.player.x - before) < 1, '가만히 있어야 하는데 움직였다');
});

test('보스전에서는 대시가 나간다', () => {
  const game = createGame({ seed: 7, save: { ...emptySave(), seenOpening: true } });
  loadBoss(game);
  // 등장 컷신을 넘긴다
  for (let i = 0; i < 900 && game.bossCut; i++) step(game, idle);
  assert.equal(game.bossCut, null, '컷신이 안 끝났다');

  step(game, { ...idle, dashPressed: true });
  assert.ok(game.player.dashTime > 0, '보스전인데 대시가 안 나간다');
  assert.ok(Math.abs(game.player.vx) > 124, '대시인데 달리기보다 안 빠르다');
});

// ── 튕기는 발판이 진짜로 튕기는가 ────────────────────────────
/** 스프링 한 칸을 놓고 공중에서 떨어뜨려, 튄 높이를 칸으로 잰다 */
function springHeight(holdJump) {
  const W = 24;
  const rows = [];
  for (let y = 0; y < 14; y++) rows.push(y >= 12 ? '#'.repeat(W) : ' '.repeat(W));
  rows[12] = '#'.repeat(8) + T.SPRING + '#'.repeat(W - 9);
  rows[11] = ' S' + ' '.repeat(W - 2);
  const world = createWorld({ id: 'spring-test', number: 1, rows });
  const player = createPlayer(world.spawn);
  // 공중에서 내려와야 발판이 반응한다 (올라가는 중에 또 밟히면 무한히 뜬다)
  player.x = 8 * TILE + 3;
  player.y = (12 - 5) * TILE;
  player.onGround = false;
  player.vy = 10;

  const floor = 11 * TILE;
  let top = Infinity;
  let sprung = false;
  for (let i = 0; i < 400; i++) {
    const events = updatePlayer(player, { ...idle, jump: holdJump }, world, 1 / 60);
    if (events.sprung) sprung = true;
    if (!sprung) continue;
    top = Math.min(top, player.y);
    if (player.onGround && top < floor - 8) break;
  }
  return sprung ? (floor - top) / TILE : null;
}

/** 아무것도 없는 바닥에서 점프를 끝까지 눌러 뛴 높이 */
function jumpHeight() {
  const W = 24;
  const rows = [];
  for (let y = 0; y < 14; y++) rows.push(y >= 12 ? '#'.repeat(W) : ' '.repeat(W));
  rows[11] = ' S' + ' '.repeat(W - 2);
  const world = createWorld({ id: 'jump-test', number: 1, rows });
  const player = createPlayer(world.spawn);
  const floor = player.y;
  let top = player.y;
  for (let i = 0; i < 200; i++) {
    updatePlayer(player, { ...idle, jump: true, jumpPressed: i === 2 }, world, 1 / 60);
    top = Math.min(top, player.y);
    if (i > 8 && player.onGround && top < floor - 4) break;
  }
  return (floor - top) / TILE;
}

test('튕기는 발판은 점프키를 쥐고 있든 말든 같은 높이로 튄다', () => {
  // 점프컷(키를 떼면 낮게 뜬다)은 **내가 누른 점프**에만 걸려야 한다.
  // 발판이 밀어 올린 속도까지 깎으면, 플레이어는 이유를 알 수 없는 방식으로
  // 낮게 뜬다 — 그냥 밟았을 때 0.4칸이면 발판이 있으나 마나다.
  const held = springHeight(true);
  const free = springHeight(false);
  assert.ok(held != null && free != null, '발판이 아예 안 튀었다');
  assert.ok(
    Math.abs(held - free) < 0.5,
    `점프키를 쥐면 ${held.toFixed(2)}칸, 놓으면 ${free.toFixed(2)}칸 — 발판이 키에 휘둘린다`,
  );
});

test('튕기는 발판은 보통 점프보다 확실히 높이 올려준다', () => {
  // 아니면 발판이 존재할 이유가 없다.
  const spring = springHeight(false);
  const jump = jumpHeight();
  assert.ok(
    spring > jump * 1.5,
    `발판 ${spring.toFixed(2)}칸 vs 보통 점프 ${jump.toFixed(2)}칸 — 발판을 밟을 이유가 없다`,
  );
});

test('튕기는 발판은 걸어 들어가도 튄다', () => {
  // 평지를 달리다 발판을 밟는 게 제일 흔한 경우다. 여기서 아무 일도 안 일어나면
  // 플레이어는 발판이 고장난 줄 알고 다시는 안 쓴다.
  const W = 24;
  const rows = [];
  for (let y = 0; y < 14; y++) rows.push(y >= 12 ? '#'.repeat(W) : ' '.repeat(W));
  rows[12] = '#'.repeat(10) + T.SPRING + '#'.repeat(W - 11);
  rows[11] = ' S' + ' '.repeat(W - 2);
  const world = createWorld({ id: 'walk-spring', number: 1, rows });
  const player = createPlayer(world.spawn);

  let sprung = false;
  for (let i = 0; i < 240 && !sprung; i++) {
    if (updatePlayer(player, { ...idle, right: true }, world, 1 / 60).sprung) sprung = true;
  }
  assert.ok(sprung, '발판 위를 걸어 지나갔는데 안 튀었다');
});

// ── 천장 가시가 창이 됐다 ────────────────────────────────────
test('천장 가시는 세 칸을 뻗는다 — 높이 달아도 바닥까지 닿는다', () => {
  // 칼날이 1칸이던 시절에는 바닥 딱 2칸 위에만 달 수 있었다. 그보다 높이 달면
  // 닿지도 발동하지도 않아서 그냥 그림이 됐다.
  const W = 24;
  const rows = [];
  for (let y = 0; y < 14; y++) rows.push(y >= 12 ? '#'.repeat(W) : ' '.repeat(W));
  // 바닥(12줄)에서 세 칸 위(9줄)에 매단다 — 옛 규칙으로는 절대 못 닿는 높이다
  rows[9] = ' '.repeat(10) + T.CEILSPIKE + ' '.repeat(W - 11);
  rows[11] = ' S' + ' '.repeat(W - 2);

  const game = createGame({ seed: 3 });
  game.world = createWorld({ id: 'blade', number: 1, rows });
  game.player = createPlayer(game.world.spawn);
  game.checkpoint = { ...game.world.spawn };
  game.scene = 'play';
  game.player.x = 10 * TILE - 30;

  let popped = false;
  for (let i = 0; i < 200 && !game.player.dead; i++) {
    step(game, { ...idle, right: true });
    if (game.world.ceilSpikes[0].popped) popped = true;
  }
  assert.ok(popped, '세 칸 위에 달았더니 발동조차 안 했다');
  assert.ok(game.player.dead, '칼날이 내려왔는데 바닥을 달리는 사람에게 안 닿았다');
});

test('튕기는 발판으로 솟으면 위에 매단 천장 가시에 꽂힌다', () => {
  // 지름길처럼 생긴 것이 함정인 자리. 이 조합이 이번 하드모드의 간판이다.
  const W = 24;
  const rows = [];
  for (let y = 0; y < 14; y++) rows.push(y >= 12 ? '#'.repeat(W) : ' '.repeat(W));
  rows[12] = '#'.repeat(10) + T.SPRING + '#'.repeat(W - 11);
  // 발판은 5.2칸 솟는다. 그 길목(7줄)에 창을 매단다.
  rows[7] = ' '.repeat(10) + T.CEILSPIKE + ' '.repeat(W - 11);
  rows[11] = ' S' + ' '.repeat(W - 2);

  const game = createGame({ seed: 3 });
  game.world = createWorld({ id: 'pad-spike', number: 1, rows });
  game.player = createPlayer(game.world.spawn);
  game.checkpoint = { ...game.world.spawn };
  game.scene = 'play';
  game.player.x = 10 * TILE - 40;

  for (let i = 0; i < 300 && !game.player.dead; i++) step(game, { ...idle, right: true });
  assert.ok(game.player.dead, '발판으로 솟았는데 위에 매단 창에 안 꽂혔다');
});

// ── 무너지는 바닥은 바로 꺼진다 ──────────────────────────────
/** 무너지는 바닥 한 줄을 놓고, 달려서 지나가거나 그 위에 서 있어 본다 */
function crumbleRun({ run }) {
  const W = 24;
  const rows = [];
  for (let y = 0; y < 14; y++) rows.push(y >= 12 ? '#'.repeat(W) : ' '.repeat(W));
  // 무너지는 바닥 세 칸, 그 밑은 완전히 비운다
  rows[12] = '#'.repeat(8) + T.CRUMBLE.repeat(3) + '#'.repeat(W - 11);
  rows[13] = '#'.repeat(8) + ' '.repeat(3) + '#'.repeat(W - 11);
  rows[11] = ' S' + ' '.repeat(W - 2);

  const game = createGame({ seed: 3 });
  game.world = createWorld({ id: 'crumble', number: 1, rows });
  game.player = createPlayer(game.world.spawn);
  game.checkpoint = { ...game.world.spawn };
  game.scene = 'play';
  if (run) {
    // 달려 들어갈 수 있게 조금 앞에서 최고 속도로 출발
    game.player.x = 8 * TILE - 40;
    game.player.vx = PLAYER.maxSpeed;
  } else {
    // 가만히 서 있는 쪽은 무너지는 바닥 **위에** 세워둔다
    game.player.x = 9 * TILE + 3;
    game.player.y = 11 * TILE - game.player.h;
  }

  // 바닥이 **사라진 순간**을 잰다. 죽을 때까지 세면 떨어지는 시간이 섞여 들어간다.
  // 시계는 발이 바닥에 **닿은 뒤부터** 돈다 — 안 그러면 처음 내려앉는 시간이 섞인다.
  let gone = null;
  let started = null;
  for (let i = 0; i < 240; i++) {
    step(game, { ...idle, right: run });
    if (started === null && game.crumbling.size > 0) started = i;
    if (gone === null && started !== null && game.world.charAt(9, 12) !== T.CRUMBLE) {
      gone = (i - started) / 60;
    }
    if (game.player.dead) return { fell: true, x: game.player.x, gone };
  }
  return { fell: false, x: game.player.x, gone };
}

test('무너지는 바닥은 달리면 건너지고, 서 있으면 빠진다', () => {
  const crossed = crumbleRun({ run: true });
  assert.equal(crossed.fell, false, '전속력으로 달렸는데도 빠졌다 — 건널 수 없는 바닥이다');
  assert.ok(crossed.x > 11 * TILE, `건넜다고 보기엔 x ${Math.round(crossed.x)} 에서 멈췄다`);

  const stood = crumbleRun({ run: false });
  assert.equal(stood.fell, true, '올라서서 가만히 있었는데 안 꺼졌다');
  // **바로** 꺼져야 한다. 0.45초였을 때는 밟고 서서 구경할 틈이 있었고,
  // 그래서는 "벽에 막혀 멈추는 순간 발밑이 사라진다"는 연쇄가 성립하지 않는다.
  assert.ok(
    stood.gone !== null && stood.gone < 0.3,
    `밟고 ${stood.gone}초 만에 꺼졌다 — 이건 함정이 아니라 예고다`,
  );
});

// ── 하늘에서 떨어지는 폭탄 ───────────────────────────────────
/** 폭탄 구간 하나를 밟고 서 있는 판 */
function bombWorld() {
  const W = 40;
  const rows = [];
  for (let y = 0; y < 14; y++) rows.push(y >= 12 ? '#'.repeat(W) : ' '.repeat(W));
  rows[11] = ' S' + ' '.repeat(3) + T.ZONE_BOMBS + ' '.repeat(W - 6);
  const game = createGame({ seed: 9 });
  game.world = createWorld({ id: 'bomb', number: 1, rows });
  game.player = createPlayer(game.world.spawn);
  game.checkpoint = { ...game.world.spawn };
  game.scene = 'play';
  return game;
}

test('폭탄 구간을 밟으면 하늘에서 떨어지기 시작한다', () => {
  const game = bombWorld();
  game.player.invuln = 999;
  for (let i = 0; i < 60; i++) step(game, { ...idle, right: true });
  assert.ok(game.effects.bombs > 0, '구간을 밟았는데 효과가 안 걸렸다');
  step(game, idle, 60);
  assert.ok(game.bombs.length > 0, '효과는 걸렸는데 폭탄이 안 떨어진다');
});

test('폭탄은 그림자가 먼저 뜨고 나중에 떨어진다', () => {
  // 예고 없이 하늘에서 죽으면 트롤이 아니라 그냥 불합리한 게임이다.
  const game = bombWorld();
  game.player.invuln = 999;
  for (let i = 0; i < 60; i++) step(game, { ...idle, right: true });
  step(game, idle, 40);
  const fresh = game.bombs.find((b) => b.warn > 0);
  assert.ok(fresh, '갓 생긴 폭탄에 예고 시간이 없다');
  // 예고 중에는 아직 안 내려온다
  const y0 = fresh.y;
  step(game, idle, 10);
  assert.equal(fresh.y, y0, '예고 중인데 벌써 떨어지고 있다');
});

test('같이 떨어지는 폭탄 사이에 설 자리가 남는다', () => {
  // 붙여서 떨어뜨리면 피할 데가 없어져 못 지나가는 구간이 된다.
  const game = bombWorld();
  game.player.invuln = 999;
  for (let i = 0; i < 60; i++) step(game, { ...idle, right: true });
  let worst = Infinity;
  // **달리는 동안**이 진짜 시험이다 — 기준이 밀리면서 겹치기 쉽다
  for (let i = 0; i < 400; i++) {
    step(game, { ...idle, right: i % 90 < 60 });
    const lanes = game.bombs.map((b) => b.tx).sort((a, b) => a - b);
    for (let k = 1; k < lanes.length; k++) {
      if (lanes[k] !== lanes[k - 1]) worst = Math.min(worst, lanes[k] - lanes[k - 1]);
    }
  }
  assert.ok(
    worst === Infinity || worst >= BOMB_GAP,
    `폭탄 둘이 ${worst}칸 붙어서 떨어졌다 — 사이에 설 자리가 없다`,
  );
});

test('폭탄 효과는 저절로 풀린다 — 영원히 떨어지지 않는다', () => {
  const game = bombWorld();
  game.player.invuln = 999;
  for (let i = 0; i < 60; i++) step(game, { ...idle, right: true });
  step(game, idle, 60 * 12);
  assert.equal(game.effects.bombs, 0, '폭탄 구간이 안 끝난다');
  assert.equal(game.bombs.length, 0, '구간이 끝났는데 폭탄이 남아 있다');
});
