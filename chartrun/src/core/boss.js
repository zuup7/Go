// 보스전. 체력에 따라 세 페이즈를 지나며, 페이즈는 절대 되돌아가지 않는다.
import { BOSS_MAX_HP, PHASES, phaseFor } from '../data/bossData.js';
import { spawnAlbum } from './enemy.js';
import { clamp } from './util.js';

export const BOSS_W = 56;
export const BOSS_H = 56;

export function createBoss(arenaWidth) {
  return {
    x: arenaWidth / 2 - BOSS_W / 2,
    y: 40,
    w: BOSS_W,
    h: BOSS_H,
    homeY: 40,
    hp: BOSS_MAX_HP,
    maxHp: BOSS_MAX_HP,
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
    announce: null,
    defeatedAt: 0,
  };
}

export const bossPhase = (boss) => PHASES.find((p) => p.id === boss.phaseId) ?? PHASES[0];

/** 체력이 깎이면 페이즈를 다시 본다. 뒤로는 가지 않는다. */
export function syncPhase(boss) {
  const next = phaseFor(boss.hp, boss.maxHp);
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
  boss.spin += dt * (1.2 + boss.phaseId * 0.5);
  boss.bob += dt;
  boss.hurtFlash = Math.max(0, boss.hurtFlash - dt);
  boss.timer -= dt;

  // 좌우로 천천히 배회
  const speed = 26 + boss.phaseId * 12;
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
      if (boss.timer <= 0) {
        boss.state = 'open';
        boss.timer = phase.openFor;
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

/** 약점을 밟았다. 실제로 들어갔으면 true */
export function hitBoss(boss) {
  if (!boss.vulnerable || boss.state === 'defeated') return false;
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

/** 남은 체력 비율 0~1 */
export const bossHealthRatio = (boss) => clamp(boss.hp / boss.maxHp, 0, 1);
