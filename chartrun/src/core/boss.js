// 보스전. 체력에 따라 세 페이즈를 지나며, 페이즈는 절대 되돌아가지 않는다.
import { phasesFor, maxHpFor, phaseFor } from '../data/bossData.js';
import { spawnAlbum } from './enemy.js';
import { clamp } from './util.js';

export const BOSS_W = 56;
export const BOSS_H = 56;

/** 레이저 기둥의 폭 */
export const LASER_W = 14;

/**
 * floorY 는 레이저가 닿을 바닥 높이다. 기본값을 두는 이유는
 * tests/boss.test.js 가 createBoss(640) 로 부르기 때문이다.
 */
export function createBoss(arenaWidth, floorY = 192, hard = false) {
  const phases = phasesFor(hard);
  const maxHp = maxHpFor(hard);
  return {
    x: arenaWidth / 2 - BOSS_W / 2,
    y: 40,
    w: BOSS_W,
    h: BOSS_H,
    homeY: 40,
    hp: maxHp,
    maxHp,
    /**
     * 이 보스가 볼 페이즈 표. 보스에 담아두고 **여기서만** 읽는다 —
     * PHASES 를 직접 보는 곳이 흩어져 있으면 하나만 빠져도 하드에서 3페이즈에 멈춘다.
     */
    phases,
    hard,
    phaseId: 1,
    /** 'attack' | 'open' | 'recover' | 'defeated' */
    state: 'attack',
    timer: 0,
    spin: 0,
    bob: 0,
    hurtFlash: 0,
    vulnerable: false,
    drift: 1,
    quarters: [],
    minionTimer: 0,
    micTimer: 0,
    announce: null,
    defeatedAt: 0,
    floorY,
    /** 레이저 기둥의 가운데 x. 'aim' / 'laser' 동안에만 뜻이 있다 */
    beamX: 0,
    /** 쌍둥이 레이저의 둘째 기둥 (하드 4페이즈에만 뜻이 있다) */
    beamX2: 0,
    beamDir: 1,
    laserTimer: 0,
  };
}

/**
 * 지금 훑고 있는 레이저 칸. 아무것도 안 쏘고 있으면 null.
 *
 * **판정(core/game.js)과 그림(render/scene.js)이 둘 다 이 하나를 본다.**
 * 사각형을 양쪽에 따로 적으면 언젠가 어긋나서, 보이는 자리와 죽는 자리가 달라진다.
 */
export function laserBeam(boss) {
  if (!boss || (boss.state !== 'aim' && boss.state !== 'laser')) return null;
  // 가슴 코어에서 나간다 — 약점으로 열리는 그 자리다. 같은 구멍이 쏘고, 같은 구멍이 열린다.
  const top = boss.y + boss.h * 0.35;
  return {
    x: boss.beamX - LASER_W / 2,
    y: top,
    w: LASER_W,
    h: Math.max(0, boss.floorY - top),
    /** 예고선은 안 아프다. 예고에 맞아 죽으면 그건 예고가 아니다. */
    live: boss.state === 'laser',
  };
}

/**
 * 지금 훑고 있는 기둥 **전부**. 보통은 하나, 하드 4페이즈는 둘이다.
 *
 * 판정도 그림도 이 하나를 본다. 둘째 기둥을 그리는 쪽에서만 따로 계산하면
 * 보이는 자리와 죽는 자리가 어긋난다.
 */
export function laserBeams(boss) {
  const first = laserBeam(boss);
  if (!first) return [];
  if (!bossPhase(boss).twinLaser) return [first];
  return [first, { ...first, x: boss.beamX2 - LASER_W / 2 }];
}

/** 던져서 맞히는 마이크. 보스가 주기적으로 흘린다. */
export const MIC_SIZE = 10;

export function createMic(x, y) {
  return { x, y, w: MIC_SIZE, h: MIC_SIZE, vy: 30, bob: 0, landed: false, life: 14 };
}

/** 손에 든 마이크를 던진다. 바라보는 쪽 위로 포물선을 그린다. */
export function throwMic(player) {
  return {
    x: player.x + (player.dir > 0 ? player.w : -MIC_SIZE),
    y: player.y - 2,
    w: MIC_SIZE,
    h: MIC_SIZE,
    vx: player.dir * 190,
    vy: -210,
    spin: 0,
    life: 3,
  };
}

/** 날아가는 마이크 한 프레임. 살아있으면 true */
export function updateThrown(mic, world, dt) {
  mic.life -= dt;
  mic.spin += dt * 16;
  mic.vy += 520 * dt;
  mic.x += mic.vx * dt;
  mic.y += mic.vy * dt;
  if (mic.life <= 0) return false;
  if (mic.y > world.pixelHeight + 20) return false;
  return mic.x > -30 && mic.x < world.pixelWidth + 30;
}

export const bossPhase = (boss) => {
  const table = boss?.phases ?? phasesFor(false);
  return table.find((p) => p.id === boss.phaseId) ?? table[0];
};

/** 체력이 깎이면 페이즈를 다시 본다. 뒤로는 가지 않는다. */
export function syncPhase(boss) {
  const next = phaseFor(boss.hp, boss.maxHp, boss.phases ?? phasesFor(false));
  if (next.id > boss.phaseId) {
    boss.phaseId = next.id;
    boss.announce = next.id;
    boss.quarters = [];
    boss.state = 'recover';
    boss.timer = 1.2;
    return next.id;
  }
  return null;
}

function makeQuarters(boss, phase, arenaWidth) {
  boss.quarters = Array.from({ length: phase.quarters }, (_, i) => ({
    index: i,
    x: i % 2 === 0 ? -40 : arenaWidth + 40,
    y: 96 + (i >> 1) * 34,
    w: 22,
    h: 22,
    vx: (i % 2 === 0 ? 1 : -1) * phase.quarterSpeed,
    spin: 0,
    delay: i * 0.45,
  }));
}

/**
 * 보스 한 프레임.
 * ctx: { player, arenaWidth, spawnShot, addAlbum, dt }
 */
export function updateBoss(boss, ctx, dt) {
  if (boss.state === 'defeated') {
    boss.defeatedAt += dt;
    boss.y += 22 * dt;
    boss.spin += dt * 2;
    return;
  }

  const phase = bossPhase(boss);

  // 마이크를 흘린다 — 주워서 던지면 멀리서도 한 대 먹일 수 있다
  boss.micTimer += dt;
  if (boss.micTimer >= phase.micEvery) {
    boss.micTimer = 0;
    ctx.dropMic?.(createMic(boss.x + boss.w / 2 - MIC_SIZE / 2, boss.y + boss.h));
  }

  boss.spin += dt * (1.2 + boss.phaseId * 0.5);
  boss.bob += dt;
  boss.hurtFlash = Math.max(0, boss.hurtFlash - dt);
  boss.timer -= dt;

  // 좌우로 천천히 배회. 다만 레이저를 겨누거나 쏘는 동안에는 제자리에 선다 —
  // 큰 걸 쓰기로 마음먹은 놈이 멈추는 것 자체가 예고다.
  const charging = boss.state === 'aim' || boss.state === 'laser';
  const speed = charging ? 0 : 26 + boss.phaseId * 12;
  boss.x += boss.drift * speed * dt;
  if (boss.x < 24) {
    boss.x = 24;
    boss.drift = 1;
  }
  if (boss.x > ctx.arenaWidth - BOSS_W - 24) {
    boss.x = ctx.arenaWidth - BOSS_W - 24;
    boss.drift = -1;
  }

  switch (boss.state) {
    case 'attack': {
      boss.vulnerable = false;
      boss.y += (boss.homeY + Math.sin(boss.bob * 2) * 6 - boss.y) * Math.min(1, dt * 4);
      boss.fireTimer = (boss.fireTimer ?? 0) + dt;
      if (boss.fireTimer >= phase.fireEvery) {
        boss.fireTimer = 0;
        fireRing(boss, phase, ctx);
      }
      if (phase.quarters && boss.quarters.length === 0) makeQuarters(boss, phase, ctx.arenaWidth);
      if (phase.minionEvery > 0) {
        boss.minionTimer += dt;
        if (boss.minionTimer >= phase.minionEvery) {
          boss.minionTimer = 0;
          const id = phase.minions[Math.floor(Math.random() * phase.minions.length)];
          const album = spawnAlbum(id, boss.x + BOSS_W / 2 - 8, boss.y + BOSS_H);
          album.vy = 40;
          ctx.addAlbum(album);
        }
      }
      // 레이저가 먼저 차면 약점 열기보다 레이저가 앞선다
      if (phase.laserEvery > 0) {
        boss.laserTimer += dt;
        if (boss.laserTimer >= phase.laserEvery) {
          startLaser(boss, phase, ctx);
          break;
        }
      }
      if (boss.timer <= 0) {
        boss.state = 'open';
        boss.timer = phase.openFor;
      }
      break;
    }
    case 'aim': {
      boss.vulnerable = false;
      boss.y += (boss.homeY - boss.y) * Math.min(1, dt * 4);
      if (boss.timer <= 0) {
        boss.state = 'laser';
        boss.timer = phase.laserFire;
        ctx.onLaser?.();
      }
      break;
    }
    case 'laser': {
      boss.vulnerable = false;
      const step = phase.laserSweep * dt;
      boss.beamX = clamp(boss.beamX + boss.beamDir * step, 8, ctx.arenaWidth - 8);
      // 둘째 기둥은 반대쪽에서 마주 온다
      if (phase.twinLaser) boss.beamX2 = clamp(boss.beamX2 - step, 8, ctx.arenaWidth - 8);
      if (boss.timer <= 0) {
        boss.state = 'recover';
        boss.timer = 0.9;
      }
      break;
    }
    case 'open': {
      // 재생 버튼이 열린다 — 내려와서 밟히길 기다린다
      boss.vulnerable = true;
      boss.y += (phase.descendTo - boss.y) * Math.min(1, dt * 3.2);
      if (boss.timer <= 0) {
        boss.state = 'recover';
        boss.timer = 0.9;
      }
      break;
    }
    case 'recover': {
      boss.vulnerable = false;
      boss.y += (boss.homeY - boss.y) * Math.min(1, dt * 3.5);
      if (boss.timer <= 0) {
        boss.state = 'attack';
        boss.timer = phase.openEvery;
        boss.announce = null;
      }
      break;
    }
    default:
      break;
  }

  updateQuarters(boss, phase, ctx, dt);
}

/**
 * 레이저를 겨눈다.
 *
 * 훑는 방향은 **지금 플레이어가 서 있는 쪽**이다 — 쫓아온다는 게 읽혀야
 * "피해야 하는 것"이 되고, 안 그러면 그냥 배경 효과로 보인다.
 */
function startLaser(boss, phase, ctx) {
  boss.laserTimer = 0;
  boss.state = 'aim';
  boss.timer = phase.laserAim;
  const px = ctx.player.x + ctx.player.w / 2;
  if (phase.twinLaser) {
    // 양쪽 끝에서 안쪽으로 훑어 온다. 가운데에 반드시 설 자리가 남는다.
    boss.beamX = 8;
    boss.beamX2 = ctx.arenaWidth - 8;
    boss.beamDir = 1;
  } else {
    boss.beamX = boss.x + boss.w / 2;
    boss.beamX2 = boss.beamX;
    // 쫓아온다는 게 읽혀야 피해야 하는 것이 된다
    boss.beamDir = px >= boss.beamX ? 1 : -1;
  }
  ctx.onAim?.();
}

function fireRing(boss, phase, ctx) {
  const cx = boss.x + boss.w / 2;
  const cy = boss.y + boss.h / 2;
  const count = phase.shots;
  for (let i = 0; i < count; i++) {
    // 아래쪽 반원으로 부채꼴
    const angle = Math.PI * (0.15 + (0.7 * i) / Math.max(1, count - 1));
    ctx.spawnShot({
      x: cx - 3,
      y: cy - 3,
      w: 6,
      h: 6,
      vx: Math.cos(angle) * phase.shotSpeed,
      vy: Math.sin(angle) * phase.shotSpeed,
      life: 4,
      boss: true,
    });
  }
}

function updateQuarters(boss, phase, ctx, dt) {
  for (const q of boss.quarters) {
    if (q.delay > 0) {
      q.delay -= dt;
      continue;
    }
    q.spin += dt * 8;
    q.x += q.vx * dt;
    if (q.x < -60) q.x = ctx.arenaWidth + 40;
    if (q.x > ctx.arenaWidth + 60) q.x = -40;
  }
}

/**
 * 보스에게 한 대. 실제로 들어갔으면 true.
 * 밟기는 약점(재생 버튼)이 열렸을 때만, 던진 마이크는 언제든 통한다 —
 * 그게 아이템을 주우러 갈 이유가 된다.
 */
export function hitBoss(boss, { ranged = false } = {}) {
  if (boss.state === 'defeated') return false;
  if (!ranged && !boss.vulnerable) return false;
  boss.hp = Math.max(0, boss.hp - 1);
  boss.hurtFlash = 0.35;
  boss.vulnerable = false;
  boss.state = 'recover';
  boss.timer = 0.9;
  if (boss.hp <= 0) {
    boss.state = 'defeated';
    boss.defeatedAt = 0;
    boss.quarters = [];
  }
  return true;
}

/**
 * 합체했는가. 3페이즈에서 조각들이 도로 붙어 로봇이 된다.
 *
 * 페이즈는 뒤로 안 가므로(syncPhase) 한 번 합체하면 풀리지 않는다.
 * 그리는 쪽이 원반으로 그릴지 로봇으로 그릴지 이걸 보고 정한다.
 */
export const bossCombined = (boss) => !!boss && boss.phaseId >= 3;

/**
 * 강아지 공주가 아직 갇혀 있는가.
 *
 * 오프닝에서 앨범들이 채간 뒤로 보스 위 새장에 갇혀 있다.
 * **격파가 곧 구출이다** — 이 규칙을 여기 한 곳에만 두고, 그리는 쪽은 이걸 물어본다.
 */
export const princessCaged = (boss) => !!boss && boss.state !== 'defeated';

/** 남은 체력 비율 0~1 */
export const bossHealthRatio = (boss) => clamp(boss.hp / boss.maxHp, 0, 1);
