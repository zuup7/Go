// 주인공 — 차트 1위를 노리는 신인 가수.
import { moveBody, groundedAt, newJumpAssist, updateJumpAssist, TILE } from './physics.js';
import { approach, clamp } from './util.js';
import { charsUnder, T } from './world.js';

export const PLAYER = {
  w: 10,
  h: 14,
  maxSpeed: 124,
  accel: 880,
  airAccel: 620,
  friction: 1000,
  gravity: 1050,
  jumpV: 320,
  /** 점프 키를 일찍 떼면 높이가 이만큼으로 깎인다 */
  jumpCut: 0.42,
  /** 정점 근처(속도가 이 아래)에서는 중력을 덜 준다 — 뜬 채로 겨눌 틈이 생긴다 */
  apexBand: 60,
  apexGravity: 0.58,
  /** 내려올 때는 더 빨리 — 붕 뜨는 느낌이 사라지고 착지가 딱 떨어진다 */
  fallGravity: 1.45,
  /** 가던 방향과 반대를 누르면 더 빨리 꺾인다 */
  turnBoost: 2.1,
  /** 천장 모서리를 이만큼 이하로 스치면 옆으로 밀어 통과시킨다 */
  cornerNudge: 5,
  maxFall: 460,
  stompBounce: 210,
  /**
   * 밟는 순간 점프를 누르고 있으면 이만큼 더 튄다.
   * 밟기가 "닿으면 알아서 튀는 것"이 아니라 **노려서 쓰는 것**이 된다 —
   * 앨범을 밟아 높은 발판으로 올라가는 길이 여기서 나온다.
   */
  stompHold: 1.4,
  /** 착지·점프 찌그러짐이 풀리는 속도 (1초에 이만큼) */
  squashDecay: 6,
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
    /** 착지에서 납작해진 정도 0~1, 점프에서 길쭉해진 정도 0~1 (그리는 쪽만 쓴다) */
    squash: 0,
    stretch: 0,
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
  player.squash = 0;
  player.stretch = 0;
}

/**
 * 한 프레임 갱신. 반환값으로 이번 프레임에 벌어진 일을 알려준다.
 * input: { left, right, jump, jumpPressed }
 */
export function updatePlayer(player, input, world, dt) {
  const events = { jumped: false, landed: null, bonked: null, hazard: false, fell: false };
  if (player.dead) return events;

  player.animTime += dt;
  player.invuln = Math.max(0, player.invuln - dt);
  player.squash = Math.max(0, player.squash - dt * PLAYER.squashDecay);
  player.stretch = Math.max(0, player.stretch - dt * PLAYER.squashDecay);

  // 좌우 이동 — 공중에서는 살짝 둔하게, 반대로 꺾을 때는 더 빠르게
  const want = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const turning = want !== 0 && player.vx * want < 0;
  const accel = (player.onGround ? PLAYER.accel : PLAYER.airAccel) * (turning ? PLAYER.turnBoost : 1);
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
    player.stretch = 1;
    events.jumped = true;
  }
  // 키를 일찍 떼면 낮게 뜬다 (누른 시간만큼 높이 뛴다)
  const cut = -PLAYER.jumpV * PLAYER.jumpCut;
  if (!input.jump && player.vy < cut) player.vy = cut;

  // 중력은 구간마다 다르다. 올라갈 때는 그대로, 정점에서는 가볍게, 내려올 때는 무겁게.
  // 같은 높이를 뛰면서도 체공이 짧아져서 "붕 뜬다"는 느낌이 사라진다.
  let gravity = PLAYER.gravity;
  if (player.vy > 0) gravity *= PLAYER.fallGravity;
  if (!player.onGround && Math.abs(player.vy) < PLAYER.apexBand) gravity *= PLAYER.apexGravity;
  player.vy = Math.min(player.vy + gravity * dt, PLAYER.maxFall);

  // 착지를 잡으려면 부딪히기 **전** 속도를 들고 있어야 한다 — moveBody 가 vy 를 0 으로 만든다
  const wasAir = !player.onGround;
  const falling = player.vy;
  const res = moveBody(player, player.vx * dt, player.vy * dt, world.tileAt, PLAYER.cornerNudge);
  player.onGround = res.hitGround || groundedAt(player, world.tileAt);

  if (wasAir && player.onGround && falling > 0) {
    // 세게 떨어질수록 납작해진다. 게임 쪽은 이걸 보고 먼지를 피운다.
    const impact = clamp(falling / PLAYER.maxFall, 0, 1);
    player.squash = Math.max(player.squash, impact);
    events.landed = { impact, vy: falling };
  }

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

/**
 * 적을 밟았을 때의 통통 튀기.
 *
 * held 는 그 순간 점프를 누르고 있었는가. 누르고 있으면 더 높이 튄다 —
 * 밟기가 그냥 일어나는 일이 아니라 **노려서 쓰는 이동 수단**이 된다.
 */
export function bounce(player, strong = false, held = false) {
  player.vy = -PLAYER.stompBounce * (strong ? 1.25 : 1) * (held ? PLAYER.stompHold : 1);
  player.assist.coyote = 0;
  player.stretch = 1;
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
