// 타일맵을 실제로 굴러가는 월드로 바꾼다. 캔버스는 모른다.
import { TILE, SOLID, ONEWAY } from './physics.js';
import { albumIdFromChar } from '../data/albums.js';

export const T = {
  EMPTY: ' ',
  GROUND: '#',
  PLATFORM: '=',
  ITEM: '?',
  BAIT: 'X',
  FAKE: '%',
  REVERSE: '~',
  SPIKE: '^',
  POPSPIKE: 'v',
  INVISIBLE: 'I',
  USED: 'u', // 두들겨서 비어버린 블록
  CRUMBLE: ',', // 밟으면 잠시 뒤 무너지는 바닥
  WALL: '|', // 지나가면 솟아오르는 벽 (솟기 전에는 없는 셈)
  RISEN: 'W', // 솟아버린 벽
  COIN: '*',
  START: 'S',
  CHECK: 'C',
  GOAL: 'G',
  FAKEGOAL: 'F',
  // ── 하드모드 함정 ──────────────────────────────────────
  BLINK: ':', // 주기적으로 사라졌다 나타나는 발판
  FAKECHECK: ';', // 체크포인트인 척하지만 저장이 안 되고 사라진다
  ICE: '_', // 미끄러운 바닥. 멈추려 해도 밀린다
  SPRING: '!', // 밟으면 크게 튄다
  CEILSPIKE: 'T', // 천장에 붙어 있다 아래를 지나가면 내려온다
  ZONE_CHASE: '>', // 왼쪽에서 가시벽이 따라오는 구간
  NPC: 'N', // 한 바퀴를 돈 뒤에만 나타나는 사람. 말을 걸면 포탈이 열린다
  PORTAL: 'P', // 하드모드로 가는 문. NPC 에게 말을 걸기 전에는 닫혀 있다
  ZONE_REVERSE: 'R', // 좌우가 뒤바뀌는 역재생 구간
  ZONE_BLACKOUT: '@', // 화면이 깜깜해지는 정전 구간
};

const SOLID_CHARS = new Set([
  T.GROUND,
  T.ITEM,
  T.BAIT,
  T.REVERSE,
  T.INVISIBLE,
  T.POPSPIKE,
  T.USED,
  T.CRUMBLE,
  T.RISEN,
  T.ICE,
  T.SPRING,
  T.CEILSPIKE,
]);
// 깜빡이는 발판은 켜져 있을 때만 관통 발판이다. 꺼지면 game 이 글자를 지운다.
const ONEWAY_CHARS = new Set([T.PLATFORM, T.FAKE, T.BLINK]);

/** 존 트리거 글자 → 효과 이름 */
export const ZONE_KINDS = {
  [T.ZONE_REVERSE]: 'reversed',
  [T.ZONE_BLACKOUT]: 'blackout',
  [T.ZONE_CHASE]: 'chased',
};

export function tileKind(ch) {
  if (SOLID_CHARS.has(ch)) return SOLID;
  if (ONEWAY_CHARS.has(ch)) return ONEWAY;
  return null;
}

/** 격자 좌표 → 픽셀 좌표(칸의 왼쪽 위) */
export const tileToPixel = (tx, ty) => ({ x: tx * TILE, y: ty * TILE });

/**
 * 스테이지 정의로 월드를 만든다.
 * 앨범·재생수·깃발처럼 "물체"인 글자는 격자에서 빼내 목록으로 옮기고,
 * 벽·발판처럼 "지형"인 글자만 격자에 남긴다.
 */
export function createWorld(stage) {
  const grid = stage.rows.map((row) => row.split(''));
  const height = grid.length;
  const width = Math.max(...grid.map((r) => r.length));
  for (const row of grid) while (row.length < width) row.push(T.EMPTY);

  const world = {
    stage,
    grid,
    width,
    height,
    pixelWidth: width * TILE,
    pixelHeight: height * TILE,
    spawn: { x: TILE * 2, y: TILE * (height - 3) },
    goal: null,
    /** 2회차용. 한 바퀴를 돌기 전에는 game 쪽에서 없는 셈 친다 */
    npcs: [],
    portals: [],
    /** 하드모드 함정들 */
    blinkers: [],
    fakeChecks: [],
    ceilSpikes: [],
    fakeGoals: [],
    checkpoints: [],
    albumSpawns: [],
    pickups: [],
    popSpikes: [],
    risingWalls: [],
    zones: [],
    /** 부순/써버린 칸을 원래대로 되돌리기 위한 기록 */
    changed: new Map(),
  };

  for (let ty = 0; ty < height; ty++) {
    for (let tx = 0; tx < width; tx++) {
      const ch = grid[ty][tx];
      const { x, y } = tileToPixel(tx, ty);
      const albumId = albumIdFromChar(ch);
      if (albumId) {
        world.albumSpawns.push({ id: albumId, tx, ty, x, y });
        grid[ty][tx] = T.EMPTY;
        continue;
      }
      switch (ch) {
        case T.START:
          world.spawn = { x: x + 3, y: y + 2 };
          grid[ty][tx] = T.EMPTY;
          break;
        case T.CHECK:
          world.checkpoints.push({ tx, ty, x: x + 3, y: y + 2, taken: false });
          grid[ty][tx] = T.EMPTY;
          break;
        case T.BLINK:
          // 글자는 격자에 남겨둔다 — 켜져 있는 동안은 진짜 관통 발판이다
          world.blinkers.push({ tx, ty, x, y });
          break;
        case T.FAKECHECK:
          world.fakeChecks.push({ tx, ty, x: x + 3, y: y + 2, taken: false });
          grid[ty][tx] = T.EMPTY;
          break;
        case T.CEILSPIKE:
          world.ceilSpikes.push({ tx, ty, x, y, popped: false, t: 0 });
          break;
        case T.ZONE_CHASE:
          world.zones.push({ kind: ZONE_KINDS[ch], tx, ty, x, y, fired: false });
          grid[ty][tx] = T.EMPTY;
          break;
        case T.NPC:
          // 체크포인트와 같은 모양 — 안 막고, 가까이 가면 반응하는 표시일 뿐이다
          world.npcs.push({ tx, ty, x: x + 2, y: y + 2, talked: false });
          grid[ty][tx] = T.EMPTY;
          break;
        case T.PORTAL:
          world.portals.push({ tx, ty, x, y, w: TILE, h: TILE * 2, open: false });
          grid[ty][tx] = T.EMPTY;
          break;
        case T.GOAL:
          world.goal = { tx, ty, x, y, w: TILE, h: TILE };
          grid[ty][tx] = T.EMPTY;
          break;
        case T.FAKEGOAL:
          world.fakeGoals.push({ tx, ty, x, y, w: TILE, h: TILE, fleeing: false, offset: 0 });
          grid[ty][tx] = T.EMPTY;
          break;
        case T.COIN:
          world.pickups.push({ tx, ty, x: x + 4, y: y + 4, w: 8, h: 8, taken: false });
          grid[ty][tx] = T.EMPTY;
          break;
        case T.POPSPIKE:
          world.popSpikes.push({ tx, ty, x, y, popped: false, t: 0 });
          break;
        case T.WALL:
          // 솟기 전에는 아무것도 아니다. 지나가면 그 자리에 벽이 선다.
          world.risingWalls.push({ tx, ty, x, y, risen: false, t: 0 });
          grid[ty][tx] = T.EMPTY;
          break;
        case T.ZONE_REVERSE:
        case T.ZONE_BLACKOUT:
          world.zones.push({ kind: ZONE_KINDS[ch], tx, ty, x, y, fired: false });
          grid[ty][tx] = T.EMPTY;
          break;
        default:
          break;
      }
    }
  }

  world.charAt = (tx, ty) => {
    if (ty < 0 || ty >= height || tx < 0 || tx >= width) return T.EMPTY;
    return grid[ty][tx];
  };

  world.tileAt = (tx, ty) => {
    // 스테이지 좌우 바깥은 보이지 않는 벽 (뒤로 못 나가고 끝에서 안 떨어진다)
    if (tx < 0 || tx >= width) return SOLID;
    if (ty < 0 || ty >= height) return null;
    return tileKind(grid[ty][tx]);
  };

  /**
   * 되돌릴 필요 없이 **살아 움직이는** 칸 (깜빡이는 발판).
   * setChar 로 하면 changed 에 쌓여서, 죽고 되살아날 때 깜빡이던 어느 순간이
   * "원래 모습"으로 굳어버린다.
   */
  world.setLive = (tx, ty, ch) => {
    if (ty < 0 || ty >= height || tx < 0 || tx >= width) return;
    grid[ty][tx] = ch;
  };

  world.setChar = (tx, ty, ch) => {
    if (ty < 0 || ty >= height || tx < 0 || tx >= width) return;
    const key = `${tx},${ty}`;
    if (!world.changed.has(key)) world.changed.set(key, grid[ty][tx]);
    grid[ty][tx] = ch;
  };

  /** 죽어서 다시 시작할 때 부순 블록들을 되돌린다 */
  world.restoreChanged = () => {
    for (const [key, ch] of world.changed) {
      const [tx, ty] = key.split(',').map(Number);
      grid[ty][tx] = ch;
    }
    world.changed.clear();
    for (const p of world.popSpikes) {
      p.popped = false;
      p.t = 0;
    }
    for (const wall of world.risingWalls) {
      wall.risen = false;
      wall.t = 0;
    }
    for (const zone of world.zones) zone.fired = false;
    for (const c of world.ceilSpikes) {
      c.popped = false;
      c.t = 0;
    }
    for (const f of world.fakeChecks) f.taken = false;
    // 깜빡이는 발판은 되돌릴 것이 없다 — 저 혼자 계속 깜빡인다
    // NPC 는 되돌리지 않는다 — 한 번 말을 걸었으면 죽어도 다시 말 걸 필요가 없다
  };

  /** 픽셀 좌표가 어떤 글자 위에 있는지 */
  world.charAtPixel = (px, py) => world.charAt(Math.floor(px / TILE), Math.floor(py / TILE));

  return world;
}

/** body 가 닿아 있는 칸들의 글자를 모아준다 (가시·컨베이어 판정용) */
export function charsUnder(world, body) {
  const out = [];
  const tx0 = Math.floor(body.x / TILE);
  const tx1 = Math.floor((body.x + body.w - 0.001) / TILE);
  const ty0 = Math.floor(body.y / TILE);
  const ty1 = Math.floor((body.y + body.h - 0.001) / TILE);
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) out.push({ tx, ty, ch: world.charAt(tx, ty) });
  }
  return out;
}
