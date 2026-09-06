// 앨범 적. 17종이지만 행동은 9가지 아키타입을 수치로 나눠 쓴다.
import { moveBody, groundedAt, TILE, SOLID } from './physics.js';
import { ALBUM_BY_ID } from '../data/albums.js';
import { approach } from './util.js';

const GRAVITY = 900;
const MAX_FALL = 380;

export function spawnAlbum(id, x, y, overrides = {}) {
  const def = ALBUM_BY_ID.get(id);
  if (!def) throw new Error(`모르는 앨범: ${id}`);
  const size = overrides.size ?? def.size;
  return {
    def,
    id,
    behavior: def.behavior,
    x,
    y: y + (TILE - size),
    w: size,
    h: size,
    vx: 0,
    vy: 0,
    dir: -1,
    /** 배치된 자리. 여기서 너무 멀어지지 않게 순찰한다 */
    homeX: x,
    hp: def.hp,
    alive: true,
    onGround: false,
    timer: 0,
    spin: 0,
    state: 'idle',
    baseY: y + (TILE - size),
    squash: 0,
    splitsLeft: def.splitInto ?? 0,
    stompable: def.stompable,
    ...overrides,
  };
}

const faceToward = (e, player) => {
  e.dir = player.x + player.w / 2 < e.x + e.w / 2 ? -1 : 1;
};

/** 진행 방향 발밑이 낭떠러지인가 */
function edgeAhead(e, world) {
  const probeX = e.dir > 0 ? e.x + e.w + 1 : e.x - 1;
  const tx = Math.floor(probeX / TILE);
  const ty = Math.floor((e.y + e.h + 1) / TILE);
  return world.tileAt(tx, ty) === null;
}

function walkStep(e, world, dt, speed, keepOnLedge) {
  e.vx = e.dir * speed;
  e.vy = Math.min(e.vy + GRAVITY * dt, MAX_FALL);
  const res = moveBody(e, e.vx * dt, e.vy * dt, world.tileAt);
  e.onGround = res.hitGround || groundedAt(e, world.tileAt);
  if (res.hitLeft || res.hitRight) e.dir *= -1;
  else if (keepOnLedge && e.onGround && edgeAhead(e, world)) e.dir *= -1;
}

const BEHAVIORS = {
  walker(e, ctx, dt) {
    walkStep(e, ctx.world, dt, e.def.speed, true);
  },

  spinner(e, ctx, dt) {
    e.spin += dt * 14;
    // 낭떠러지를 무시하고 그대로 달린다
    walkStep(e, ctx.world, dt, e.def.speed, false);
  },

  hopper(e, ctx, dt) {
    e.vy = Math.min(e.vy + GRAVITY * dt, MAX_FALL);
    if (e.onGround) {
      e.vx = approach(e.vx, 0, 400 * dt);
      e.timer += dt;
      if (e.timer >= (e.def.hopEvery ?? 1.4)) {
        e.timer = 0;
        faceToward(e, ctx.player);
        e.vy = -(e.def.jumpPower ?? 190);
        e.vx = e.dir * e.def.speed * 2.2;
      }
    }
    const res = moveBody(e, e.vx * dt, e.vy * dt, ctx.world.tileAt);
    e.onGround = res.hitGround || groundedAt(e, ctx.world.tileAt);
    if (res.hitLeft || res.hitRight) e.dir *= -1;
  },

  flyer(e, ctx, dt) {
    e.timer += dt;
    const period = e.def.period ?? 2.4;
    const amp = e.def.amplitude ?? 24;
    e.x += e.dir * e.def.speed * dt;
    e.y = e.baseY + Math.sin((e.timer / period) * Math.PI * 2) * amp;
    // 벽을 만나면 돌아선다
    const probeX = e.dir > 0 ? e.x + e.w : e.x;
    if (ctx.world.tileAt(Math.floor(probeX / TILE), Math.floor((e.y + e.h / 2) / TILE)) === SOLID) {
      e.dir *= -1;
      e.x += e.dir * 2;
    }
  },

  charger(e, ctx, dt) {
    const { player, world } = ctx;
    const dx = player.x - e.x;
    const sameHeight = Math.abs(player.y - e.y) < 22;
    if (e.state === 'windup') {
      // 돌진 전에 잠깐 부르르 떤다 — 예고 없이 달려들면 피할 방법이 없다
      e.timer -= dt;
      walkStep(e, world, dt, 0, true);
      if (e.timer <= 0) {
        e.state = 'charge';
        e.timer = 1.1;
      }
    } else if (e.state === 'charge') {
      e.timer -= dt;
      walkStep(e, world, dt, e.def.chargeSpeed ?? 130, false);
      if (e.timer <= 0) {
        e.state = 'cool';
        e.timer = 0.8;
      }
    } else if (e.state === 'cool') {
      e.timer -= dt;
      walkStep(e, world, dt, 0, true);
      if (e.timer <= 0) e.state = 'idle';
    } else {
      walkStep(e, world, dt, e.def.speed, true);
      if (sameHeight && Math.abs(dx) < (e.def.chargeRange ?? 110)) {
        faceToward(e, player);
        e.state = 'windup';
        e.timer = e.def.windup ?? 0.42;
      }
    }
  },

  shooter(e, ctx, dt) {
    walkStep(e, ctx.world, dt, e.def.speed, true);
    e.timer += dt;
    if (e.timer >= (e.def.fireEvery ?? 2)) {
      e.timer = 0;
      faceToward(e, ctx.player);
      const speed = e.def.shotSpeed ?? 80;
      const spread = e.def.shotSpread ?? 1;
      for (let i = 0; i < spread; i++) {
        const lift = spread === 1 ? 0 : (i - (spread - 1) / 2) * 42;
        ctx.spawnShot({
          x: e.x + e.w / 2 - 3,
          y: e.y + e.h / 2 - 3,
          w: 6,
          h: 6,
          vx: e.dir * speed,
          vy: lift,
          life: 3,
        });
      }
    }
  },

  dropper(e, ctx, dt) {
    const { player, world } = ctx;
    if (e.state === 'idle') {
      // 천장에 붙어 흔들리며 기다린다
      e.timer += dt;
      e.y = e.baseY + Math.sin(e.timer * 3) * 1.5;
      const overlapping = Math.abs(player.x + player.w / 2 - (e.x + e.w / 2)) < (e.def.dropRange ?? 28);
      if (overlapping && player.y > e.y) {
        e.state = 'warn';
        e.timer = e.def.dropWarn ?? 0.3;
      }
    } else if (e.state === 'warn') {
      // 떨어지기 직전에 부르르 떤다 — 이게 없으면 지나가는 중에 무조건 맞는다
      e.timer -= dt;
      e.y = e.baseY + Math.sin(e.timer * 60) * 2;
      if (e.timer <= 0) e.state = 'fall';
    } else {
      e.vy = Math.min(e.vy + GRAVITY * 1.35 * dt, MAX_FALL);
      const res = moveBody(e, e.vx * dt, e.vy * dt, world.tileAt);
      e.onGround = res.hitGround || groundedAt(e, world.tileAt);
      if (e.onGround && e.state === 'fall') {
        e.state = 'landed';
        e.squash = 0.25;
        e.baseY = e.y;
        faceToward(e, player);
      }
      if (e.state === 'landed') walkStep(e, world, dt, e.def.speed || 20, true);
    }
  },

  shielder(e, ctx, dt) {
    // 위에 가시가 박혀 있어 밟으면 내가 죽는다
    walkStep(e, ctx.world, dt, e.def.speed, true);
  },

  splitter(e, ctx, dt) {
    walkStep(e, ctx.world, dt, e.def.speed, true);
  },
};

/**
 * 배치된 자리에서 얼마나 벗어날 수 있는지.
 * 이게 없으면 벽을 만날 때까지 하염없이 흘러가서 레벨 디자인이 무너진다.
 * 돌진형·낙하형은 애초에 자리를 뜨는 게 역할이라 빠져 있다.
 */
const PATROL_RANGE = {
  walker: 56,
  shielder: 56,
  splitter: 56,
  shooter: 40,
  flyer: 60,
  hopper: 72,
  spinner: 120,
};

function keepNearHome(e) {
  const range = e.def.patrolRange ?? PATROL_RANGE[e.behavior];
  if (!range) return;
  if (e.x < e.homeX - range) {
    e.x = e.homeX - range;
    e.dir = 1;
    e.vx = Math.abs(e.vx);
  } else if (e.x > e.homeX + range) {
    e.x = e.homeX + range;
    e.dir = -1;
    e.vx = -Math.abs(e.vx);
  }
}

export function updateAlbum(e, ctx, dt) {
  // 찌그러짐은 죽은 뒤에도 마저 풀려야 한다 — 안 그러면 시체가 화면에 남는다
  e.squash = Math.max(0, e.squash - dt);
  if (!e.alive) return;
  const fn = BEHAVIORS[e.behavior] ?? BEHAVIORS.walker;
  fn(e, ctx, dt);
  keepNearHome(e);
  // 구멍에 빠지면 조용히 퇴장
  if (e.y > ctx.world.pixelHeight + 40) e.alive = false;
}

/**
 * 밟혔다. 죽었으면 'dead', 아직 버티면 'hurt', 밟으면 안 되는 놈이면 'blocked'.
 * 분열형은 새끼 둘을 ctx.addAlbum 으로 낳는다.
 */
export function stompAlbum(e, ctx) {
  if (!e.stompable) return 'blocked';
  e.hp -= 1;
  e.squash = 0.3;
  if (e.hp > 0) return 'hurt';
  e.alive = false;
  if (e.splitsLeft > 0) {
    const size = Math.max(14, Math.round(e.w * 0.6));
    for (let i = 0; i < 2; i++) {
      const child = spawnAlbum(e.id, e.x + (i === 0 ? -6 : e.w), e.y, {
        size,
        splitsLeft: 0,
        hp: 1,
      });
      child.y = e.y + (e.h - size);
      child.baseY = child.y;
      child.dir = i === 0 ? -1 : 1;
      child.vy = -140;
      child.isChild = true;
      ctx.addAlbum(child);
    }
  }
  return 'dead';
}

/** 음표 탄환 갱신. 벽에 닿거나 수명이 다하면 사라진다. */
export function updateShot(shot, world, dt) {
  shot.life -= dt;
  shot.x += shot.vx * dt;
  shot.y += shot.vy * dt;
  shot.wobble = (shot.wobble ?? 0) + dt * 10;
  if (shot.life <= 0) return false;
  const tx = Math.floor((shot.x + shot.w / 2) / TILE);
  const ty = Math.floor((shot.y + shot.h / 2) / TILE);
  if (world.tileAt(tx, ty) === SOLID) return false;
  return shot.x > -20 && shot.x < world.pixelWidth + 20;
}
