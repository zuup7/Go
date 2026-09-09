import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, updateGame, loadStage, loadBoss, WALL_HEIGHT } from '../src/core/game.js';
import { createWorld, T, tileKind, ZONE_KINDS } from '../src/core/world.js';
import { SOLID, TILE } from '../src/core/physics.js';
import { TRAPS, TRAP_KINDS, ZONE_EFFECTS, trapKey } from '../src/data/traps.js';
import { STAGES } from '../src/data/stages.js';
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
  for (const stage of STAGES) {
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
  for (const stage of STAGES) {
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
