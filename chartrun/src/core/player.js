// 주인공 — 차트 1위를 노리는 신인 가수.
import { moveBody, groundedAt, newJumpAssist, updateJumpAssist, TILE } from './physics.js';
import { approach, clamp } from './util.js';
import { charsUnder, T } from './world.js';

export const PLAYER = {
  w: 10,
  h: 14,
  maxSpeed: 112,
  accel: 700,
  airAccel: 520,
  friction: 900,
  gravity: 1050,
  jumpV: 320,
  /** 점프 키를 일찍 떼면 높이가 이만큼으로 깎인다 */
  jumpCut: 0.42,
  maxFall: 420,
  stompBounce: 210,
  /** 피격 후 무적 시간(초) */
  invulnTime: 1.2,
  /** 역주행 바닥이 밀어내는 속도 */
  conveyor: 46,
};

export function createPlayer(spawn) {
  return {
    x: spawn.x,
    y: spawn.y,
    w: PLAYER.w,
    h: PLAYER.h,
    vx: 0,
    vy: 0,
    dir: 1,
    onGround: false,
    dead: false,
    cleared: false,
    invuln: 0,
    animTime: 0,
    jumpHeld: false,
    assist: newJumpAssist(),
    /** 파워업: 'none' | 'mic' (한 대 버팀) */
    power: 'none',
    /** 보스전에서 주운 던질 마이크 (0 또는 1). 쓰면 없어진다 */
    ammo: 0,
  };
}

export function respawnPlayer(player, spawn) {
  player.x = spawn.x;
  player.y = spawn.y;
  player.vx = 0;
  player.vy = 0;
  player.dir = 1;
  player.dead = false;
  player.cleared = false;
  player.invuln = 0.8;
  player.onGround = false;
  player.assist = newJumpAssist();
  player.power = 'none';
  player.ammo = 0;
}

/**
 * 한 프레임 갱신. 반환값으로 이번 프레임에 벌어진 일을 알려준다.
 * input: { left, right, jump, jumpPressed }
 */
export function updatePlayer(player, input, world, dt) {
  const events = { jumped: false, bonked: null, hazard: false, fell: false };
  if (player.dead) return events;

  player.animTime += dt;
  player.invuln = Math.max(0, player.invuln - dt);

  // 좌우 이동 — 공중에서는 살짝 둔하게
  const accel = player.onGround ? PLAYER.accel : PLAYER.airAccel;
  const want = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (want !== 0) {
    player.vx = approach(player.vx, want * PLAYER.maxSpeed, accel * dt);
    player.dir = want;
  } else if (player.onGround) {
    player.vx = approach(player.vx, 0, PLAYER.friction * dt);
  }

  // 점프 — 코요테 타임 + 점프 버퍼로 마리오처럼 관대하게
  if (updateJumpAssist(player.assist, { onGround: player.onGround, jumpPressed: input.jumpPressed })) {
    player.vy = -PLAYER.jumpV;
    player.onGround = false;
    events.jumped = true;
  }
  // 키를 일찍 떼면 낮게 뜬다 (누른 시간만큼 높이 뛴다)
  const cut = -PLAYER.jumpV * PLAYER.jumpCut;
  if (!input.jump && player.vy < cut) player.vy = cut;

  player.vy = Math.min(player.vy + PLAYER.gravity * dt, PLAYER.maxFall);

  const res = moveBody(player, player.vx * dt, player.vy * dt, world.tileAt);
  player.onGround = res.hitGround || groundedAt(player, world.tileAt);

  // 머리로 블록 치기
  if (res.hitCeil && res.ceilTile) {
    const ch = world.charAt(res.ceilTile.tx, res.ceilTile.ty);
    if (ch === T.ITEM || ch === T.BAIT || ch === T.INVISIBLE) {
      events.bonked = { ...res.ceilTile, ch };
    }
  }

  // 역주행 바닥
  if (player.onGround) {
    const feetTy = Math.floor((player.y + player.h + 1) / TILE);
    const tx0 = Math.floor(player.x / TILE);
    const tx1 = Math.floor((player.x + player.w - 0.001) / TILE);
    for (let tx = tx0; tx <= tx1; tx++) {
      if (world.charAt(tx, feetTy) === T.REVERSE) {
        player.x -= PLAYER.conveyor * dt;
        break;
      }
    }
  }

  // 가시에 닿았나
  for (const { ch } of charsUnder(world, player)) {
    if (ch === T.SPIKE) {
      events.hazard = true;
      break;
    }
  }

  // 화면 아래로 떨어졌나
  if (player.y > world.pixelHeight + 24) events.fell = true;

  player.x = clamp(player.x, 0, world.pixelWidth - player.w);
  return events;
}

/** 적을 밟았을 때의 통통 튀기 */
export function bounce(player, strong = false) {
  player.vy = -PLAYER.stompBounce * (strong ? 1.25 : 1);
  player.assist.coyote = 0;
}

/** 맞았다. 파워업이 있으면 그걸 잃고 버틴다. 죽었으면 true */
export function damagePlayer(player) {
  if (player.invuln > 0 || player.dead) return false;
  if (player.power !== 'none') {
    player.power = 'none';
    player.invuln = PLAYER.invulnTime;
    return false;
  }
  player.dead = true;
  player.vy = -180;
  return true;
}
