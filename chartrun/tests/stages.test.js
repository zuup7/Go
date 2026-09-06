import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES, BOSS_STAGE, ROWS, CHUNK_W } from '../src/data/stages.js';
import { createWorld, T, tileKind } from '../src/core/world.js';
import { SOLID, ONEWAY, TILE } from '../src/core/physics.js';
import { ALBUM_BY_ID } from '../src/data/albums.js';

const ALL = [...STAGES, BOSS_STAGE];

test('스테이지는 4개 + 보스 무대', () => {
  assert.equal(STAGES.length, 4);
  assert.ok(BOSS_STAGE.rows.length > 0);
  assert.deepEqual(
    STAGES.map((s) => s.number),
    [1, 2, 3, 4],
  );
});

test('모든 줄의 길이가 같고 구간 단위로 떨어진다', () => {
  for (const stage of ALL) {
    assert.equal(stage.rows.length, ROWS, `${stage.id}: 줄 수`);
    const width = stage.rows[0].length;
    assert.equal(width % CHUNK_W, 0, `${stage.id}: 구간 배수가 아님 (${width})`);
    for (const row of stage.rows) assert.equal(row.length, width, `${stage.id}: 줄 길이가 다름`);
  }
});

test('스테이지마다 시작점과 골이 있다', () => {
  for (const stage of STAGES) {
    const world = createWorld(stage);
    assert.ok(world.goal, `${stage.id}: 골이 없다`);
    assert.ok(world.spawn.x > 0, `${stage.id}: 시작점이 없다`);
    // 하나뿐이면 죽었을 때 매번 처음으로 돌아가 버린다
    assert.ok(world.checkpoints.length >= 2, `${stage.id}: 체크포인트가 부족하다`);
    const middle = world.checkpoints.some((c) => c.x < world.goal.x * 0.6);
    assert.ok(middle, `${stage.id}: 중간 체크포인트가 없다`);
    assert.ok(world.goal.x > world.spawn.x, `${stage.id}: 골이 시작점보다 뒤에 있다`);
  }
});

test('타일맵에 쓴 앨범 글자가 전부 실제 앨범이다', () => {
  for (const stage of ALL) {
    const world = createWorld(stage);
    for (const spawn of world.albumSpawns) {
      assert.ok(ALBUM_BY_ID.has(spawn.id), `${stage.id}: 모르는 앨범 ${spawn.id}`);
    }
  }
});

test('스테이지마다 그 스테이지 앨범이 등장한다', () => {
  for (const stage of STAGES) {
    const world = createWorld(stage);
    assert.ok(world.albumSpawns.length >= 6, `${stage.id}: 적이 너무 적다`);
    const own = world.albumSpawns.filter((s) => ALBUM_BY_ID.get(s.id).stage === stage.number);
    assert.ok(own.length >= 4, `${stage.id}: 이 스테이지 전용 앨범이 부족하다`);
  }
});

test('앨범 17종이 게임 어딘가에는 모두 나온다', () => {
  const seen = new Set();
  for (const stage of STAGES) {
    for (const spawn of createWorld(stage).albumSpawns) seen.add(spawn.id);
  }
  for (const id of ALBUM_BY_ID.keys()) {
    assert.ok(seen.has(id), `${id} 이 어느 스테이지에도 안 나온다`);
  }
});

test('물체 글자는 격자에서 빠지고 지형만 남는다', () => {
  for (const stage of ALL) {
    const world = createWorld(stage);
    for (let ty = 0; ty < world.height; ty++) {
      for (let tx = 0; tx < world.width; tx++) {
        const ch = world.charAt(tx, ty);
        assert.ok(
          ![T.START, T.GOAL, T.FAKEGOAL, T.CHECK, T.COIN].includes(ch),
          `${stage.id}: (${tx},${ty}) 에 물체 글자 '${ch}' 가 남았다`,
        );
      }
    }
  }
});

test('타일 성질 분류', () => {
  assert.equal(tileKind(T.GROUND), SOLID);
  assert.equal(tileKind(T.ITEM), SOLID);
  assert.equal(tileKind(T.INVISIBLE), SOLID);
  assert.equal(tileKind(T.POPSPIKE), SOLID, '불쑥 가시는 평범한 땅인 척한다');
  assert.equal(tileKind(T.PLATFORM), ONEWAY);
  assert.equal(tileKind(T.FAKE), ONEWAY, '가짜 발판은 진짜와 똑같이 굴러야 속는다');
  assert.equal(tileKind(T.SPIKE), null, '가시는 막지 않고 찌른다');
  assert.equal(tileKind(T.EMPTY), null);
});

test('스테이지 좌우 바깥은 보이지 않는 벽', () => {
  const world = createWorld(STAGES[0]);
  assert.equal(world.tileAt(-1, 5), SOLID);
  assert.equal(world.tileAt(world.width, 5), SOLID);
  assert.equal(world.tileAt(5, -1), null);
});

test('부순 블록은 되돌릴 수 있다', () => {
  const world = createWorld(STAGES[0]);
  const target = { tx: 0, ty: world.height - 1 };
  const before = world.charAt(target.tx, target.ty);
  world.setChar(target.tx, target.ty, T.EMPTY);
  assert.equal(world.charAt(target.tx, target.ty), T.EMPTY);
  world.restoreChanged();
  assert.equal(world.charAt(target.tx, target.ty), before);
});

// 점프 한 번으로 넘을 수 있는 폭.
// jumpV 320 / gravity 1050 → 체공 0.61초, 최고 속도 112px/s → 약 68px.
// 몸통 10px 을 빼면 세 칸(58px)까지가 안전하고 네 칸(74px)은 넘을 수 없다.
const MAX_JUMP = 3;

test('바닥의 가시 구간은 점프로 넘을 수 있는 폭이다', () => {
  const floorRow = ROWS - 2;
  for (const stage of STAGES) {
    const row = stage.rows[floorRow];
    let run = 0;
    for (let x = 0; x <= row.length; x++) {
      run = row[x] === T.SPIKE ? run + 1 : 0;
      assert.ok(run <= MAX_JUMP, `${stage.id}: ${x}칸 근처 가시가 ${run}칸이라 넘을 수 없다`);
    }
  }
});

test('낙하 앨범은 구멍 위가 아니라 착지할 땅 위에 걸어둔다', () => {
  // 구멍 위에 매달아 두면 뛰어넘는 순간에만 떨어져서, 피할 방법 없이 밀어 떨어뜨리는 함정이 된다.
  for (const stage of STAGES) {
    const world = createWorld(stage);
    for (const spawn of world.albumSpawns) {
      if (ALBUM_BY_ID.get(spawn.id).behavior !== 'dropper') continue;
      let landing = false;
      for (let ty = spawn.ty + 1; ty < world.height; ty++) {
        if (tileKind(world.charAt(spawn.tx, ty)) !== null) {
          landing = true;
          break;
        }
      }
      assert.ok(landing, `${stage.id}: (${spawn.tx},${spawn.ty}) 낙하 앨범 아래가 허공이다`);
    }
  }
});

test('불쑥 가시는 딛고 설 바닥에만 심는다', () => {
  for (const stage of [...STAGES, BOSS_STAGE]) {
    const world = createWorld(stage);
    for (const spike of world.popSpikes) {
      const under = world.charAt(spike.tx, spike.ty + 1);
      assert.ok(
        tileKind(under) !== null || spike.ty + 1 >= world.height,
        `${stage.id}: (${spike.tx},${spike.ty}) 불쑥 가시가 공중에 떠 있다`,
      );
    }
  }
});

test('구멍은 한 번에 건너뛸 수 있거나, 위에 딛고 갈 발판이 있다', () => {
  const floorRow = ROWS - 2;
  const isOpen = (stage, x) =>
    tileKind(stage.rows[floorRow][x]) === null && tileKind(stage.rows[ROWS - 1][x]) === null;

  for (const stage of STAGES) {
    const width = stage.rows[0].length;
    let start = null;
    for (let x = 0; x <= width; x++) {
      const open = x < width && isOpen(stage, x);
      if (open && start === null) start = x;
      if (open || start === null) continue;

      const span = x - start;
      if (span > MAX_JUMP) {
        // 구멍 위 어딘가에 설 수 있는 칸이 있는지 본다
        let footholds = 0;
        for (let ty = 0; ty < floorRow; ty++) {
          for (let tx = start; tx < x; tx++) {
            if (tileKind(stage.rows[ty][tx]) !== null) footholds += 1;
          }
        }
        assert.ok(
          footholds > 0,
          `${stage.id}: ${start}~${x - 1}칸 구멍(${span}칸)이 너무 넓은데 딛을 곳이 없다`,
        );
      }
      start = null;
    }
  }
});

test('보스 무대는 넓고 평평하다', () => {
  const world = createWorld(BOSS_STAGE);
  assert.ok(world.pixelWidth >= TILE * 30, '보스 무대가 좁다');
  assert.equal(world.goal, null, '보스 무대에는 깃발이 없다');
  assert.ok(world.spawn.x > 0);
});
