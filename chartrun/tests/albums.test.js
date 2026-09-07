import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALBUMS,
  ALBUM_BY_ID,
  BEHAVIORS,
  COVERS,
  albumIdFromChar,
  charForAlbum,
  albumsOfStage,
} from '../src/data/albums.js';
import { spawnAlbum, stompAlbum, updateAlbum, updateShot } from '../src/core/enemy.js';
import { createWorld } from '../src/core/world.js';
import { TILE } from '../src/core/physics.js';

test('앨범은 17종이고 id 가 겹치지 않는다', () => {
  assert.equal(ALBUMS.length, 17);
  assert.equal(new Set(ALBUMS.map((a) => a.id)).size, 17);
  assert.equal(ALBUM_BY_ID.size, 17);
});

test('모든 앨범이 정의된 행동과 커버를 쓴다', () => {
  for (const album of ALBUMS) {
    assert.ok(BEHAVIORS.includes(album.behavior), `${album.id}: 모르는 행동 ${album.behavior}`);
    assert.ok(COVERS.includes(album.cover), `${album.id}: 모르는 커버 ${album.cover}`);
    assert.equal(album.palette.length, 3, `${album.id}: 팔레트는 3색`);
    assert.ok(album.stage >= 1 && album.stage <= 4, `${album.id}: 스테이지 범위`);
    assert.ok(album.name && album.taunt, `${album.id}: 이름과 대사 필요`);
  }
});

test('행동 아키타입 9종이 전부 실제로 쓰인다', () => {
  const used = new Set(ALBUMS.map((a) => a.behavior));
  for (const behavior of BEHAVIORS) {
    assert.ok(used.has(behavior), `${behavior} 를 쓰는 앨범이 없다`);
  }
});

test('사진 교체 훅(art)은 기본이 비어 있다', () => {
  for (const album of ALBUMS) {
    assert.equal(album.art, null, `${album.id}: 아직 사진 없음이 기본`);
  }
});

test('스테이지마다 앨범이 배정돼 있다', () => {
  for (let stage = 1; stage <= 4; stage++) {
    assert.ok(albumsOfStage(stage).length >= 4, `스테이지 ${stage} 앨범이 너무 적다`);
  }
});

test('타일맵 글자 ↔ 앨범 id 변환이 서로 맞는다', () => {
  assert.equal(albumIdFromChar('a'), 'a01');
  assert.equal(albumIdFromChar('q'), 'a17');
  assert.equal(albumIdFromChar('z'), null);
  for (const album of ALBUMS) {
    assert.equal(albumIdFromChar(charForAlbum(album.id)), album.id);
  }
});

const flatWorld = () =>
  createWorld({
    id: 'test',
    number: 1,
    name: '테스트',
    icon: '🎤',
    subtitle: '',
    sky: ['#000', '#111'],
    ground: ['#222', '#333'],
    rows: ['                    ', '                    ', '####################', '####################'],
  });

test('밟으면 죽고, 체력 2 짜리는 한 번은 버틴다', () => {
  const ctx = { addAlbum: () => {} };
  const weak = spawnAlbum('a01', 0, 0);
  assert.equal(stompAlbum(weak, ctx), 'dead');
  assert.equal(weak.alive, false);

  const tough = spawnAlbum('a14', 0, 0);
  assert.equal(stompAlbum(tough, ctx), 'hurt');
  assert.equal(tough.alive, true);
  assert.equal(stompAlbum(tough, ctx), 'dead');
});

test('밟혀 죽은 앨범은 잠깐 찌그러졌다 사라진다', () => {
  const world = flatWorld();
  const album = spawnAlbum('a01', TILE * 3, TILE);
  stompAlbum(album, { addAlbum: () => {} });
  assert.ok(album.squash > 0, '밟은 직후에는 찌그러져 있다');
  const ctx = { world, player: { x: 0, y: 0, w: 10, h: 14 }, spawnShot: () => {}, addAlbum: () => {} };
  for (let i = 0; i < 60; i++) updateAlbum(album, ctx, 1 / 60);
  assert.equal(album.squash, 0, '시체가 화면에 남으면 안 된다');
});

test('가시 달린 앨범은 밟을 수 없다', () => {
  const shielded = spawnAlbum('a09', 0, 0);
  assert.equal(stompAlbum(shielded, { addAlbum: () => {} }), 'blocked');
  assert.equal(shielded.alive, true);
});

test('분열형은 밟으면 새끼 둘로 갈라진다', () => {
  const born = [];
  const splitter = spawnAlbum('a08', 32, 16);
  assert.equal(stompAlbum(splitter, { addAlbum: (a) => born.push(a) }), 'dead');
  assert.equal(born.length, 2);
  for (const child of born) {
    assert.ok(child.w < splitter.w, '새끼는 더 작다');
    assert.equal(child.splitsLeft, 0, '새끼는 더 갈라지지 않는다');
  }
});

test('순찰형은 낭떠러지에서 돌아선다', () => {
  const world = createWorld({
    id: 'ledge',
    number: 1,
    name: '',
    icon: '',
    subtitle: '',
    sky: ['#000', '#111'],
    ground: ['#222', '#333'],
    rows: ['        ', '        ', '####    ', '####    '],
  });
  const walker = spawnAlbum('a01', 3 * TILE - 14, TILE);
  walker.dir = 1;
  const ctx = { world, player: { x: 0, y: 0, w: 10, h: 14 }, spawnShot: () => {}, addAlbum: () => {} };
  for (let i = 0; i < 120; i++) updateAlbum(walker, ctx, 1 / 60);
  assert.equal(walker.alive, true, '떨어지지 않고 살아있다');
  assert.ok(walker.x < 4 * TILE, '벼랑 너머로 나가지 않았다');
});

test('돌진형은 곧장 달려들지 않고 준비 동작을 거친다', () => {
  const world = flatWorld();
  const charger = spawnAlbum('a05', TILE * 8, TILE);
  const player = { x: TILE * 10, y: TILE, w: 10, h: 14 };
  const ctx = { world, player, spawnShot: () => {}, addAlbum: () => {} };
  updateAlbum(charger, ctx, 1 / 60);
  assert.equal(charger.state, 'windup', '먼저 부르르 떤다');
  const startX = charger.x;
  for (let i = 0; i < 12; i++) updateAlbum(charger, ctx, 1 / 60);
  assert.ok(Math.abs(charger.x - startX) < 2, '준비 중에는 제자리');

  for (let i = 0; i < 60; i++) updateAlbum(charger, ctx, 1 / 60);
  assert.ok(charger.x > startX, '준비가 끝나면 플레이어 쪽으로 돌진한다');
});

test('앨범들은 배치된 자리를 지킨다 — 스테이지 끝까지 흘러가지 않는다', () => {
  const world = createWorld({
    id: 'flat',
    number: 1,
    name: '',
    icon: '',
    subtitle: '',
    sky: ['#000', '#111'],
    ground: ['#222', '#333'],
    // 벽 없이 길게 뻗은 평지 — 순찰 범위가 없으면 여기서 하염없이 흘러간다
    rows: [...Array(12).fill(' '.repeat(60)), '#'.repeat(60), '#'.repeat(60)],
  });
  const player = { x: TILE * 30, y: TILE * 11, w: 10, h: 14 };
  const ctx = { world, player, spawnShot: () => {}, addAlbum: () => {} };

  for (const id of ['a01', 'a03', 'a06', 'a09', 'a02']) {
    const album = spawnAlbum(id, TILE * 20, TILE * 11);
    const home = album.homeX;
    for (let i = 0; i < 60 * 30; i++) updateAlbum(album, ctx, 1 / 60);
    assert.ok(
      Math.abs(album.x - home) <= 130,
      `${id}(${album.behavior}) 가 자리에서 ${Math.round(album.x - home)}px 이나 벗어났다`,
    );
  }
});

test('사격형은 시간이 지나면 탄환을 만든다', () => {
  const world = flatWorld();
  const shots = [];
  const shooter = spawnAlbum('a04', TILE * 4, TILE);
  const ctx = {
    world,
    player: { x: TILE * 10, y: TILE, w: 10, h: 14 },
    spawnShot: (s) => shots.push(s),
    addAlbum: () => {},
  };
  for (let i = 0; i < 60 * 4; i++) updateAlbum(shooter, ctx, 1 / 60);
  assert.ok(shots.length >= 1, '탄환이 나왔다');
  assert.ok(shots[0].vx > 0, '플레이어 쪽으로 날아간다');
});

test('사격형도 쏘기 전에 반드시 예고한다', () => {
  // 예고 없이 날아오는 탄은 피할 방법이 없다. 돌진형·낙하형과 같은 규칙을 지킨다.
  const world = flatWorld();
  const shots = [];
  const shooter = spawnAlbum('a04', TILE * 4, TILE);
  const ctx = {
    world,
    player: { x: TILE * 10, y: TILE, w: 10, h: 14 },
    spawnShot: (s) => shots.push(s),
    addAlbum: () => {},
  };

  let warnFrames = 0;
  for (let i = 0; i < 60 * 4; i++) {
    updateAlbum(shooter, ctx, 1 / 60);
    if (shots.length) break;
    if (shooter.state === 'windup') warnFrames += 1;
  }
  assert.ok(shots.length >= 1, '탄환이 나오긴 해야 한다');
  assert.ok(warnFrames >= 18, `예고가 ${warnFrames}프레임뿐 — 눈으로 보고 반응할 수 없다`);
});

test('예고 중에는 사격형이 멈춰 선다', () => {
  const world = flatWorld();
  const shooter = spawnAlbum('a04', TILE * 4, TILE);
  const ctx = { world, player: { x: TILE * 10, y: TILE, w: 10, h: 14 }, spawnShot: () => {}, addAlbum: () => {} };
  while (shooter.state !== 'windup') updateAlbum(shooter, ctx, 1 / 60);
  const x0 = shooter.x;
  updateAlbum(shooter, ctx, 1 / 60);
  assert.equal(shooter.x, x0, '겨누는 동안에는 안 걷는다');
});

test('탄환은 벽에 닿으면 사라진다', () => {
  const world = flatWorld();
  const shot = { x: TILE * 2, y: TILE * 2 + 4, w: 6, h: 6, vx: 0, vy: 100, life: 5 };
  const alive = updateShot(shot, world, 0.2);
  assert.equal(alive, false);
});

test('낙하형은 머리 위에 올 때까지 기다린다', () => {
  const world = flatWorld();
  const dropper = spawnAlbum('a07', TILE * 5, TILE * 0);
  const far = { x: TILE * 15, y: TILE * 2 - 14, w: 10, h: 14 };
  const ctx = { world, player: far, spawnShot: () => {}, addAlbum: () => {} };
  for (let i = 0; i < 60; i++) updateAlbum(dropper, ctx, 1 / 60);
  assert.equal(dropper.state, 'idle', '멀리 있으면 안 떨어진다');

  ctx.player = { x: TILE * 5, y: TILE * 2 - 14, w: 10, h: 14 };
  updateAlbum(dropper, ctx, 1 / 60);
  assert.equal(dropper.state, 'warn', '곧장 떨어지지 않고 먼저 떤다');

  const y0 = dropper.y;
  for (let i = 0; i < 10; i++) updateAlbum(dropper, ctx, 1 / 60);
  assert.ok(Math.abs(dropper.y - y0) < 6, '예고 중에는 사실상 제자리');

  for (let i = 0; i < 30; i++) updateAlbum(dropper, ctx, 1 / 60);
  assert.ok(dropper.y > y0 + 8, '예고가 끝나면 떨어진다');
});
