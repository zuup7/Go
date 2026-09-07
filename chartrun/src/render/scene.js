// 픽셀 월드를 캔버스에 그린다. 글자는 여기서 그리지 않는다 (한글은 DOM 이 맡는다).
import { TILE } from '../core/physics.js';
import { T } from '../core/world.js';
import { cameraOffset } from '../core/camera.js';
import { trapKey } from '../data/traps.js';
import { drawAlbum, drawCoverAt } from './albumArt.js';
import { drawSprite, crisp } from './pixel.js';
import { playerFrame, PLAYER_OFFSET, NOTE, SHOT, SHOT_BOSS, DISC } from './sprites.js';
import { ALBUMS } from '../data/albums.js';
import { VIEW } from '../core/game.js';
import { phaseAt, phaseAtIn } from '../data/cutscene.js';
import { BOSS_CUTS } from '../data/bossCutscenes.js';
import { drawBigTextCentered } from './bigtext.js';
import { bossPhase } from '../core/boss.js';

// ── 배경 ────────────────────────────────────────────────────
function drawSky(ctx, stage, time) {
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW.h);
  grad.addColorStop(0, stage.sky[0]);
  grad.addColorStop(1, stage.sky[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  // 반짝이는 별 = 재생수 알갱이
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 26; i++) {
    const x = (i * 71) % VIEW.w;
    const y = (i * 37) % 90;
    if (Math.sin(time * 2 + i) > 0.2) ctx.fillRect(x, y, 1, 1);
  }
}

/** 스테이지마다 다른 원경 — 시차를 줘서 달리는 느낌을 낸다 */
function drawParallax(ctx, stage, ox, time) {
  const shift = -ox * 0.35;
  ctx.save();
  ctx.globalAlpha = 0.85;
  // 원경은 지형색이 아니라 전용 색을 쓴다 — 안 그러면 땅과 배경이 뒤섞여 안 보인다
  ctx.fillStyle = stage.far ?? stage.sky[1];
  const step = 48;
  for (let i = -1; i < VIEW.w / step + 2; i++) {
    const x = Math.round(i * step + (shift % step));
    switch (stage.number) {
      case 2: {
        // 스튜디오 조명
        ctx.fillRect(x + 8, 24, 6, 26);
        ctx.fillRect(x + 4, 50, 14, 8);
        break;
      }
      case 3: {
        // 서버 랙
        ctx.fillRect(x, 60, 30, 100);
        ctx.globalAlpha = 0.25;
        for (let r = 0; r < 6; r++) ctx.fillRect(x + 4, 66 + r * 14, 22, 4);
        ctx.globalAlpha = 0.5;
        break;
      }
      case 4: {
        // 차트 막대
        const h = 40 + ((i * 29) % 70);
        ctx.fillRect(x + 6, VIEW.h - h - 40, 20, h);
        break;
      }
      default: {
        // 도시 실루엣
        const h = 30 + ((i * 47) % 60);
        ctx.fillRect(x, VIEW.h - h - 40, 34, h);
        break;
      }
    }
  }
  // EQ 막대 (모든 스테이지 공통, 바닥 근처)
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = stage.ground[0];
  for (let i = 0; i < 24; i++) {
    const h = 8 + Math.abs(Math.sin(time * 3 + i * 0.6)) * 26;
    ctx.fillRect(i * 17 + ((shift * 0.5) % 17), VIEW.h - h - 28, 10, h);
  }
  ctx.restore();
}

// ── 타일 ────────────────────────────────────────────────────
function drawTile(ctx, ch, x, y, stage, revealed, time, buried = false) {
  const [light, dark] = stage.ground;
  switch (ch) {
    case T.GROUND:
      ctx.fillStyle = '#0a0512';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = dark;
      ctx.fillRect(x, y + 1, TILE - 1, TILE - 1);
      // 잔디 같은 밝은 윗면은 하늘과 맞닿은 칸에만 — 안 그러면 땅속에 줄이 생긴다
      if (!buried) {
        ctx.fillStyle = light;
        ctx.fillRect(x, y, TILE, 3);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(x + 2, y + 6, 3, 2);
      ctx.fillRect(x + 9, y + 10, 4, 2);
      break;
    case T.PLATFORM:
      ctx.fillStyle = '#0a0512';
      ctx.fillRect(x, y, TILE, 7);
      ctx.fillStyle = light;
      ctx.fillRect(x, y, TILE, 4);
      ctx.fillStyle = dark;
      ctx.fillRect(x, y + 4, TILE, 2);
      break;
    case T.FAKE:
      // 진짜 발판과 똑같이 생겼다. 한 번 당한 뒤에야 표시가 뜬다.
      ctx.fillStyle = '#0a0512';
      ctx.fillRect(x, y, TILE, 7);
      ctx.fillStyle = light;
      ctx.fillRect(x, y, TILE, 4);
      ctx.fillStyle = dark;
      ctx.fillRect(x, y + 4, TILE, 2);
      if (revealed) {
        ctx.fillStyle = 'rgba(255,60,90,0.85)';
        for (let i = 0; i < TILE; i += 4) ctx.fillRect(x + i, y + 1, 2, 2);
      }
      break;
    case T.ITEM:
    case T.BAIT: {
      const bob = Math.sin(time * 4 + x) * 0.5;
      ctx.fillStyle = '#c98a2b';
      ctx.fillRect(x, y + bob, TILE, TILE);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(x + 1, y + 1 + bob, TILE - 2, TILE - 2);
      ctx.fillStyle = '#7a4a12';
      // ? 모양
      ctx.fillRect(x + 5, y + 4 + bob, 6, 2);
      ctx.fillRect(x + 9, y + 6 + bob, 2, 2);
      ctx.fillRect(x + 7, y + 8 + bob, 3, 2);
      ctx.fillRect(x + 7, y + 12 + bob, 2, 2);
      if (ch === T.BAIT && revealed) {
        ctx.fillStyle = '#ff2e63';
        ctx.fillRect(x + 2, y + 2 + bob, TILE - 4, 2);
        ctx.fillRect(x + 2, y + TILE - 4 + bob, TILE - 4, 2);
      }
      break;
    }
    case T.USED:
      ctx.fillStyle = '#6b5a3a';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#4a3d27';
      ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
      break;
    case T.INVISIBLE:
      if (revealed) {
        ctx.strokeStyle = 'rgba(255,255,255,0.30)';
        ctx.setLineDash([2, 2]);
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        ctx.setLineDash([]);
      }
      break;
    case T.REVERSE: {
      ctx.fillStyle = '#3b3550';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#8a7fb8';
      ctx.fillRect(x, y, TILE, 3);
      // 왼쪽으로 흐르는 화살표
      const off = Math.floor(time * 22) % TILE;
      ctx.fillStyle = '#d5cbff';
      for (let i = 0; i < 2; i++) {
        const ax = x + ((i * 8 - off + TILE * 2) % TILE);
        ctx.fillRect(ax, y + 7, 4, 2);
        ctx.fillRect(ax, y + 6, 1, 4);
      }
      break;
    }
    case T.SPIKE:
      ctx.fillStyle = '#e8ecf7';
      for (let i = 0; i < 4; i++) {
        const sx = x + i * 4;
        ctx.beginPath();
        ctx.moveTo(sx, y + TILE);
        ctx.lineTo(sx + 2, y + 4);
        ctx.lineTo(sx + 4, y + TILE);
        ctx.fill();
      }
      ctx.fillStyle = '#8b93a8';
      ctx.fillRect(x, y + TILE - 3, TILE, 3);
      break;
    case T.CRUMBLE:
      // 평범한 땅인 척한다. 밟히면 game 이 흔들림을 얹는다.
      ctx.fillStyle = '#0a0512';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = dark;
      ctx.fillRect(x, y + 1, TILE - 1, TILE - 1);
      if (!buried) {
        ctx.fillStyle = light;
        ctx.fillRect(x, y, TILE, 3);
      }
      if (revealed) {
        // 갈라진 금
        ctx.strokeStyle = 'rgba(255,60,90,0.85)';
        ctx.beginPath();
        ctx.moveTo(x + 3, y + 4);
        ctx.lineTo(x + 7, y + 9);
        ctx.lineTo(x + 5, y + 13);
        ctx.moveTo(x + 10, y + 5);
        ctx.lineTo(x + 13, y + 12);
        ctx.stroke();
      }
      break;
    case T.RISEN:
      ctx.fillStyle = '#0a0512';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#5c4a70';
      ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
      ctx.fillStyle = '#a58bc4';
      ctx.fillRect(x + 1, y + 1, TILE - 2, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x + 3, y + 5, TILE - 6, 1);
      ctx.fillRect(x + 3, y + 10, TILE - 6, 1);
      break;
    case T.POPSPIKE:
      // 평범한 땅인 척한다
      ctx.fillStyle = '#0a0512';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = dark;
      ctx.fillRect(x, y + 1, TILE - 1, TILE - 1);
      if (!buried) {
        ctx.fillStyle = light;
        ctx.fillRect(x, y, TILE, 3);
      }
      if (revealed) {
        ctx.fillStyle = 'rgba(255,60,90,0.9)';
        ctx.fillRect(x + 3, y + 1, 2, 1);
        ctx.fillRect(x + 7, y + 1, 2, 1);
        ctx.fillRect(x + 11, y + 1, 2, 1);
      }
      break;
    default:
      break;
  }
}

function drawTiles(ctx, game, ox, oy, time) {
  const { world, trapMemory } = game;
  const tx0 = Math.max(0, Math.floor(ox / TILE) - 1);
  const tx1 = Math.min(world.width - 1, Math.floor((ox + VIEW.w) / TILE) + 1);
  const ty0 = Math.max(0, Math.floor(oy / TILE) - 1);
  const ty1 = Math.min(world.height - 1, Math.floor((oy + VIEW.h) / TILE) + 1);
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const ch = world.charAt(tx, ty);
      if (ch === T.EMPTY) continue;
      const revealed = trapMemory.has(trapKey(tx, ty));
      const above = world.charAt(tx, ty - 1);
      const buried = above === T.GROUND || above === T.POPSPIKE || above === T.CRUMBLE;
      drawTile(ctx, ch, tx * TILE - ox, ty * TILE - oy, world.stage, revealed, time, buried);
    }
  }
}

// ── 물체들 ──────────────────────────────────────────────────
function drawFlag(ctx, x, y, time, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#e8ecf7';
  ctx.fillRect(x + 7, y - TILE * 2, 2, TILE * 3);
  ctx.fillStyle = color;
  const wave = Math.sin(time * 6) * 2;
  ctx.beginPath();
  ctx.moveTo(x + 9, y - TILE * 2);
  ctx.lineTo(x + 22 + wave, y - TILE * 2 + 5);
  ctx.lineTo(x + 9, y - TILE * 2 + 10);
  ctx.fill();
  ctx.restore();
}

/** 아직 안 솟은 벽은 한 번 당한 뒤에야 자리가 표시된다 */
function drawWallHints(ctx, game, ox, oy, time) {
  for (const wall of game.world.risingWalls) {
    if (wall.risen || !game.trapMemory.has(trapKey(wall.tx, wall.ty))) continue;
    ctx.save();
    ctx.globalAlpha = 0.35 + Math.sin(time * 4) * 0.15;
    ctx.strokeStyle = '#ff5d8f';
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(wall.tx * TILE - ox + 0.5, (wall.ty - 1) * TILE - oy + 0.5, TILE - 1, TILE * 2 - 1);
    ctx.setLineDash([]);
    ctx.restore();
  }
}

/** 구간 트리거 자리 — 이것도 한 번 당한 뒤에만 보인다 */
function drawZoneHints(ctx, game, ox, oy, time) {
  const colors = { reversed: '#39d0ff', blackout: '#ffd166' };
  for (const zone of game.world.zones) {
    if (!game.trapMemory.has(trapKey(zone.tx, zone.ty))) continue;
    ctx.save();
    ctx.globalAlpha = 0.3 + Math.sin(time * 3 + zone.tx) * 0.12;
    ctx.fillStyle = colors[zone.kind] ?? '#fff';
    ctx.fillRect(zone.x - ox + 2, zone.y - oy - TILE, TILE - 4, TILE * 2);
    ctx.restore();
  }
}

function drawPopSpikes(ctx, world, ox, oy) {
  for (const spike of world.popSpikes) {
    if (!spike.popped || spike.t <= 0) continue;
    const x = spike.tx * TILE - ox;
    const baseY = spike.ty * TILE - oy;
    const h = TILE * spike.t;
    ctx.fillStyle = '#f2f5ff';
    for (let i = 0; i < 3; i++) {
      const sx = x + 2 + i * 4;
      ctx.beginPath();
      ctx.moveTo(sx, baseY);
      ctx.lineTo(sx + 2, baseY - h);
      ctx.lineTo(sx + 4, baseY);
      ctx.fill();
    }
  }
}

function drawPlayer(ctx, player, ox, oy, time) {
  if (player.invuln > 0 && Math.floor(time * 20) % 2 === 0) return;
  const frame = playerFrame(player);
  const x = player.x - ox + PLAYER_OFFSET.x;
  const y = player.y - oy + PLAYER_OFFSET.y;
  if (player.dead) {
    ctx.save();
    ctx.translate(Math.round(x + 6), Math.round(y + 8));
    ctx.rotate(Math.PI);
    drawSprite(ctx, frame, -6, -8, false);
    ctx.restore();
    return;
  }
  if (player.power === 'mic') {
    ctx.fillStyle = 'rgba(255,209,102,0.35)';
    ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 14, 18);
  }
  drawSprite(ctx, frame, x, y, player.dir < 0);
}

// ── 보스 ────────────────────────────────────────────────────
/** 체력계는 보스 바로 아래에 붙여 그린다 — 화면 위에 판을 깔면 게임을 가린다 */
function drawBossHealth(ctx, boss, ox, oy, color) {
  const w = boss.w + 12;
  const x = Math.round(boss.x - ox - 6);
  const y = Math.round(boss.y - oy + boss.h + 4);
  ctx.fillStyle = 'rgba(6,2,14,0.8)';
  ctx.fillRect(x - 1, y - 1, w + 2, 7);
  ctx.fillStyle = '#2a1740';
  ctx.fillRect(x, y, w, 5);
  const ratio = Math.max(0, boss.hp / boss.maxHp);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.round(w * ratio), 5);
  // 남은 대수를 눈금으로 — 몇 대 남았는지 바로 읽힌다
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  for (let i = 1; i < boss.maxHp; i++) ctx.fillRect(x + Math.round((w * i) / boss.maxHp), y, 1, 5);
}

export function drawBoss(ctx, boss, ox, oy, time) {
  const cx = boss.x - ox + boss.w / 2;
  const cy = boss.y - oy + boss.h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(boss.spin);

  // 거대 LP
  const r = boss.w / 2;
  ctx.fillStyle = boss.hurtFlash > 0 ? '#ffffff' : '#14101d';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  for (let i = 1; i <= 5; i++) {
    ctx.beginPath();
    ctx.arc(0, 0, (r * i) / 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  // 열일곱 조각이 박힌 라벨
  for (let i = 0; i < ALBUMS.length; i++) {
    const angle = (i / ALBUMS.length) * Math.PI * 2;
    const d = r * 0.68;
    drawCoverAt(ctx, ALBUMS[i], Math.cos(angle) * d - 6, Math.sin(angle) * d - 6, 12);
  }
  ctx.restore();

  // 가운데 재생 버튼 = 약점 (열려 있을 때만 빛난다)
  ctx.save();
  ctx.translate(cx, cy);
  const open = boss.vulnerable;
  ctx.fillStyle = open ? '#39ff9a' : '#5c4a70';
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = open ? '#04240f' : '#2a2136';
  ctx.beginPath();
  ctx.moveTo(-3, -5);
  ctx.lineTo(6, 0);
  ctx.lineTo(-3, 5);
  ctx.fill();
  if (open) {
    ctx.strokeStyle = `rgba(57,255,154,${0.5 + Math.sin(time * 10) * 0.4})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 14 + Math.sin(time * 8) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // 분열 조각 — 페이즈 색으로 테두리를 둘러 어느 페이즈인지 눈에 들어오게
  const color = bossPhase(boss).color;
  for (const q of boss.quarters) {
    if (q.delay > 0) continue;
    ctx.save();
    ctx.translate(q.x - ox + q.w / 2, q.y - oy + q.h / 2);
    ctx.rotate(q.spin);
    ctx.fillStyle = color;
    ctx.fillRect(-q.w / 2, -q.h / 2, q.w, q.h);
    ctx.fillStyle = '#241a33';
    ctx.fillRect(-q.w / 2 + 1, -q.h / 2 + 1, q.w - 2, q.h - 2);
    drawCoverAt(ctx, ALBUMS[(q.index * 4) % ALBUMS.length], -q.w / 2 + 3, -q.h / 2 + 3, q.w - 6);
    ctx.restore();
  }

  if (boss.state !== 'defeated') drawBossHealth(ctx, boss, ox, oy, color);
}

/** 보스가 흘린 마이크(바닥)와 던진 마이크(공중) */
function drawMics(ctx, game, ox, oy, time) {
  for (const mic of game.mics) {
    const bob = mic.landed ? Math.sin(mic.bob) * 1.5 : 0;
    const blink = mic.life < 3 && Math.floor(time * 10) % 2 === 0;
    if (blink) continue;
    ctx.save();
    ctx.translate(Math.round(mic.x - ox), Math.round(mic.y - oy + bob));
    ctx.fillStyle = 'rgba(255,209,102,0.35)';
    ctx.fillRect(-2, -2, mic.w + 4, mic.h + 4);
    drawMicShape(ctx, mic.w);
    ctx.restore();
  }
  for (const mic of game.thrown) {
    ctx.save();
    ctx.translate(Math.round(mic.x - ox) + mic.w / 2, Math.round(mic.y - oy) + mic.h / 2);
    ctx.rotate(mic.spin);
    ctx.translate(-mic.w / 2, -mic.h / 2);
    drawMicShape(ctx, mic.w);
    ctx.restore();
  }
}

function drawMicShape(ctx, size) {
  const s = size / 10;
  ctx.fillStyle = '#d8dde8';
  ctx.fillRect(3 * s, 0, 4 * s, 5 * s); // 헤드
  ctx.fillStyle = '#8b93a8';
  ctx.fillRect(4 * s, 5 * s, 2 * s, 5 * s); // 손잡이
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(3 * s, 0, 4 * s, 2 * s);
}

// ── 합체 컷신 ───────────────────────────────────────────────
export function drawCutscene(ctx, t) {
  const phase = phaseAt(t);
  ctx.fillStyle = '#0a0410';
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);

  const cx = VIEW.w / 2;
  const cy = VIEW.h / 2 - 12;

  // 배경 소용돌이
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = '#7c5cff';
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.arc(cx, cy, 20 + i * 16 + Math.sin(t * 3 + i) * 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  const gatherT = Math.min(1, t / 4.2);
  const swirlT = phase === 'gather' ? 0 : Math.min(1, (t - 4.2) / 2);
  const mergeT = ['merge', 'flash', 'reveal'].includes(phase) ? Math.min(1, (t - 6.2) / 2.4) : 0;

  if (phase !== 'reveal') {
    for (let i = 0; i < ALBUMS.length; i++) {
      const angle = (i / ALBUMS.length) * Math.PI * 2 + t * (0.6 + swirlT * 4);
      const startR = 210;
      const radius = startR * (1 - gatherT) + (72 - 60 * mergeT) * gatherT;
      const size = 22 - 12 * mergeT;
      drawCoverAt(
        ctx,
        ALBUMS[i],
        cx + Math.cos(angle) * radius - size / 2,
        cy + Math.sin(angle) * radius * 0.72 - size / 2,
        Math.max(6, size),
      );
    }
  }

  if (phase === 'flash') {
    ctx.fillStyle = `rgba(255,255,255,${1 - Math.min(1, (t - 8.6) / 0.5)})`;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  }

  if (phase === 'reveal' || phase === 'end') {
    const grow = Math.min(1, (t - 9) / 1.2);
    const r = 20 + 44 * grow;
    drawBossDisc(ctx, cx, cy, r, t * 1.4);
    ctx.fillStyle = '#39ff9a';
    ctx.beginPath();
    ctx.arc(cx, cy, 10 * grow, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 열일곱 장이 한 장이 된 모습. 합체 컷신과 보스 컷신이 같은 그림을 쓴다. */
function drawBossDisc(ctx, cx, cy, r, spin) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(spin);
  ctx.fillStyle = '#14101d';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  for (let i = 1; i <= 5; i++) {
    ctx.beginPath();
    ctx.arc(0, 0, (r * i) / 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  const size = Math.max(6, r * 0.19);
  for (let i = 0; i < ALBUMS.length; i++) {
    const angle = (i / ALBUMS.length) * Math.PI * 2;
    const d = r * 0.68;
    drawCoverAt(ctx, ALBUMS[i], Math.cos(angle) * d - size / 2, Math.sin(angle) * d - size / 2, size);
  }
  ctx.restore();
}


// ── 보스전 컷신 (페이즈 전환 · 엔딩) ────────────────────────
// 월드를 평소대로 그린 뒤 그 위에 얹는다. 한글 대사는 DOM 대사창이 맡는다.

const CUT_CX = VIEW.w / 2;
const CUT_CY = VIEW.h / 2 - 6;

export function drawBossCut(ctx, game, time) {
  const cut = BOSS_CUTS[game.bossCut.id];
  if (!cut) return;
  const t = game.bossCut.t;
  const len = game.bossCut.length;
  const phase = phaseAtIn(cut.timeline, t, 'shake');

  // 들어올 때 어두워지고 나갈 때 다시 밝아진다 — 싸움으로 뚝 끊겨 돌아가면 어지럽다
  const fade = Math.max(0, Math.min(1, t / 0.3, (len - t) / 0.4));
  ctx.save();
  ctx.fillStyle = `rgba(4,2,10,${0.94 * fade})`;
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  ctx.globalAlpha = fade;

  if (game.bossCut.id === 'phase2') drawPhase2Cut(ctx, t, phase, time);
  else if (game.bossCut.id === 'phase3') drawPhase3Cut(ctx, t, phase, time);
  else drawEndingCut(ctx, t, phase, time);

  ctx.restore();
}

/** 화면 가로로 박히는 큰 제목 (PHASE 2, #1 …) */
function drawCutTitle(ctx, text, since, scale, y) {
  const p = Math.min(1, Math.max(0, since) / 0.25);
  const h = 7 * scale;
  ctx.save();
  ctx.globalAlpha *= p;
  ctx.fillStyle = 'rgba(6,2,14,0.88)';
  ctx.fillRect(0, y - 6, VIEW.w, h + 12);
  ctx.fillStyle = '#ff5d8f';
  ctx.fillRect(0, y - 7, VIEW.w, 1);
  ctx.fillRect(0, y + h + 6, VIEW.w, 1);
  drawBigTextCentered(ctx, text, VIEW.w / 2, y, scale, '#ffd166');
  ctx.restore();
}

/** 원반에 번지는 금 */
function drawCracks(ctx, cx, cy, r, p) {
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    for (let step = 1; step <= 4; step++) {
      const d = (r * p * step) / 4;
      const wob = Math.sin(i * 3 + step) * 5 * p;
      ctx.lineTo(cx + Math.cos(a) * d + Math.cos(a + 1.57) * wob, cy + Math.sin(a) * d + Math.sin(a + 1.57) * wob);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// ── 페이즈 2: 한 장이 네 조각으로 ───────────────────────────
function drawPhase2Cut(ctx, t, phase, time) {
  const r = 40;
  if (phase === 'split' || phase === 'title') {
    const p = Math.min(1, (t - 1.9) / 1.1);
    drawQuarters(ctx, CUT_CX, CUT_CY, r, p * p * (3 - 2 * p), time);
  } else {
    const amp = phase === 'crack' ? 3 : 1.4;
    drawBossDisc(ctx, CUT_CX + Math.sin(time * 57) * amp, CUT_CY + Math.cos(time * 63) * amp, r, time * 0.8);
    if (phase === 'crack') drawCracks(ctx, CUT_CX, CUT_CY, r, Math.min(1, (t - 1.2) / 0.7));
  }
    // 조각들이 빠져나가 텅 빈 한가운데에 박는다
  if (phase === 'title') drawCutTitle(ctx, 'PHASE 2', t - 3.4, 4, 92);
}

function drawQuarters(ctx, cx, cy, r, p, time) {
  for (let i = 0; i < 4; i++) {
    const a0 = i * (Math.PI / 2) - Math.PI / 4;
    const mid = a0 + Math.PI / 4;
    const off = 6 + 46 * p;
    ctx.save();
    ctx.translate(cx + Math.cos(mid) * off, cy + Math.sin(mid) * off * 0.62);
    ctx.rotate(Math.sin(time * 2 + i) * 0.08);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r * 0.92, a0, a0 + Math.PI / 2);
    ctx.closePath();
    ctx.fillStyle = '#14101d';
    ctx.fill();
    ctx.strokeStyle = '#ff5d8f';
    ctx.lineWidth = 1;
    ctx.stroke();
    for (let k = 0; k < 4; k++) {
      const a = a0 + (Math.PI / 2) * ((k + 0.5) / 4);
      const d = r * 0.55;
      drawCoverAt(ctx, ALBUMS[(i * 4 + k) % ALBUMS.length], Math.cos(a) * d - 5, Math.sin(a) * d - 5, 10);
    }
    ctx.restore();
  }
}

// ── 페이즈 3: 실시간 차트를 대놓고 조작한다 ─────────────────
function drawPhase3Cut(ctx, t, phase, time) {
  if (phase === 'shake') {
    drawBossDisc(ctx, CUT_CX + Math.sin(time * 61) * 3, CUT_CY, 40, time * 0.8);
    return;
  }
  drawFakeChart(ctx, t, phase, time);
    // 조작된 차트 위에 도장처럼 찍는다
  if (phase === 'title') drawCutTitle(ctx, 'PHASE 3', t - 4.0, 4, 92);
}

function drawFakeChart(ctx, t, phase, time) {
  const x = 62;
  const w = VIEW.w - 124;
  const rowH = 21;
  const top = 34;
  const slide = Math.min(1, (t - 1.1) / 0.45);

  ctx.save();
  ctx.translate((1 - slide) * VIEW.w, 0);
  ctx.fillStyle = 'rgba(6,2,14,0.92)';
  ctx.fillRect(x - 8, top - 10, w + 16, rowH * 6 + 16);
  ctx.strokeStyle = '#7c5cff';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 7.5, top - 9.5, w + 15, rowH * 6 + 15);

  const rig = phase === 'chart' ? 0 : Math.min(1, (t - 2.6) / 1.0);
  // 원래 1~5위였던 줄들이 한 칸씩 밀려 내려간다
  for (let i = 0; i < 5; i++) {
    drawChartRow(ctx, x, top + (i + rig) * rowH, w, `${i + 1 + Math.round(rig)}`, ALBUMS[i], 0.9 - i * 0.11, '#7c5cff');
  }
  // 꼴찌에 있던 보스가 1위로 솟는다
  const by = top + 5 * (1 - rig) * rowH;
  drawChartRow(ctx, x, by, w, '1', null, 0.55 + 0.45 * rig, '#ff5d8f', time);
  ctx.restore();
}

function drawChartRow(ctx, x, y, w, rank, album, barRatio, color, time) {
  const boss = !album;
  ctx.fillStyle = boss ? '#1b0a20' : 'rgba(255,255,255,0.06)';
  ctx.fillRect(x, y, w, 16);
  if (boss) {
    ctx.strokeStyle = '#ff5d8f';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 15);
  }
  drawBigTextCentered(ctx, rank, x + 10, y + 3, 2, '#f2f0ff', null);
  if (album) {
    drawCoverAt(ctx, album, x + 20, y + 1, 14);
  } else {
    // 보스 줄 — 앨범 대신 합체 원반이 돌아간다
    drawBossDisc(ctx, x + 27, y + 8, 7, (time ?? 0) * 2);
  }
  ctx.fillStyle = color;
  ctx.fillRect(x + 38, y + 4, Math.max(2, (w - 46) * barRatio), 8);
}

// ── 엔딩: 터지고, 줄 서고, 꼭대기에 내가 선다 ───────────────
const CHART_X = 96;
const CHART_W = 192;
const CHART_TOP = 58;
const CHART_ROW = 22;
/** 1위 아래로 보여줄 줄 수 (2위부터) */
const CHART_ROWS = 5;

/** 흩어진 앨범 i 의 위치 (퍼짐 정도 spread) */
function scatterAt(i, spread, time) {
  const a = (i / ALBUMS.length) * Math.PI * 2 + 0.7;
  const d = spread * (60 + (i % 5) * 26);
  return {
    x: CUT_CX + Math.cos(a) * d,
    y: CUT_CY + Math.sin(a) * d * 0.7 + Math.sin(time * 1.5 + i) * 3 * spread,
  };
}

function drawEndingCut(ctx, t, phase, time) {
  if (phase === 'crack') {
    const p = Math.min(1, t / 1.8);
    drawBossDisc(ctx, CUT_CX + Math.sin(time * 70) * p * 3, CUT_CY, 40, time * 0.6);
    drawCracks(ctx, CUT_CX, CUT_CY, 40, p);
    return;
  }

  if (phase === 'burst') {
    const p = Math.min(1, (t - 1.8) / 0.8);
    ctx.save();
    ctx.fillStyle = `rgba(255,255,255,${(1 - p) * 0.9})`;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    ctx.restore();
  }

  // 앨범 열일곱 장: 흩어진 자리 → 차트 줄
  const spread = phase === 'burst' ? Math.min(1, (t - 1.8) / 0.8) : 1;
  const line = ['chartline', 'empty', 'climb', 'crown'].includes(phase) ? Math.min(1, (t - 4.4) / 1.4) : 0;
  const ease = line * line * (3 - 2 * line);

  if (line > 0) drawChartFrame(ctx, ease);

  for (let i = 0; i < ALBUMS.length; i++) {
    const from = scatterAt(i, spread, time);
    if (i < CHART_ROWS) {
      // 2위부터 아래로 줄을 선다
      const to = { x: CHART_X + 22, y: CHART_TOP + (i + 1) * CHART_ROW + 3 };
      const x = from.x + (to.x - from.x) * ease;
      const y = from.y + (to.y - from.y) * ease;
      drawCoverAt(ctx, ALBUMS[i], x - 8, y - 8, 16);
    } else {
      // 나머지는 화면 밖으로 밀려난다 — 순위표는 여섯 줄뿐이다
      ctx.save();
      ctx.globalAlpha *= Math.max(0, 1 - ease);
      const push = scatterAt(i, spread + ease * 2.2, time);
      drawCoverAt(ctx, ALBUMS[i], push.x - 8, push.y - 8, 16);
      ctx.restore();
    }
  }

  if (line > 0) drawTopRow(ctx, t, phase, time, ease);
}

function drawChartFrame(ctx, ease) {
  ctx.save();
  ctx.globalAlpha *= ease;
  ctx.fillStyle = 'rgba(6,2,14,0.9)';
  ctx.fillRect(CHART_X - 10, CHART_TOP - 10, CHART_W + 20, CHART_ROW * (CHART_ROWS + 1) + 14);
  ctx.strokeStyle = '#7c5cff';
  ctx.lineWidth = 1;
  ctx.strokeRect(CHART_X - 9.5, CHART_TOP - 9.5, CHART_W + 19, CHART_ROW * (CHART_ROWS + 1) + 13);
  for (let i = 1; i <= CHART_ROWS; i++) {
    const y = CHART_TOP + i * CHART_ROW;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(CHART_X, y - 5, CHART_W, CHART_ROW - 4);
    drawBigTextCentered(ctx, `${i + 1}`, CHART_X + 10, y - 1, 2, '#b3aecd', null);
    ctx.fillStyle = '#4a2a66';
    ctx.fillRect(CHART_X + 34, y + 1, CHART_W - 44, 6);
  }
  ctx.restore();
}

/** 맨 윗줄 — 비어 있다가, 내가 올라서고, 왕관이 박힌다 */
function drawTopRow(ctx, t, phase, time, ease) {
  const y = CHART_TOP;
  ctx.save();
  ctx.globalAlpha *= ease;

  const blink = phase === 'empty' && Math.floor(time * 3) % 2 === 0;
  ctx.strokeStyle = blink ? '#ffd166' : '#6b3a8f';
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 1;
  ctx.strokeRect(CHART_X + 0.5, y - 4.5, CHART_W - 1, CHART_ROW - 5);
  ctx.setLineDash([]);
  drawBigTextCentered(ctx, '1', CHART_X + 10, y - 1, 2, '#ffd166', null);

  if (phase === 'climb' || phase === 'crown') {
    const p = phase === 'crown' ? 1 : Math.min(1, (t - 8.4) / 1.0);
    const px = CHART_X + 40;
    const py = VIEW.h - 30 + (y + 1 - (VIEW.h - 30)) * p;
    drawSprite(ctx, playerFrame({ onGround: p >= 1, vx: 0 }), px, py);
    if (phase === 'crown') drawCrown(ctx, px + 1, py - 9, time);
  }
  ctx.restore();

  if (phase === 'crown') drawCutTitle(ctx, '#1', t - 9.4, 5, 6);
}

function drawCrown(ctx, x, y, time) {
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(x, y + 3, 10, 4);
  ctx.fillRect(x, y, 2, 4);
  ctx.fillRect(x + 4, y - 1, 2, 5);
  ctx.fillRect(x + 8, y, 2, 4);
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 5; i++) {
    const a = time * 2 + i * 1.3;
    if (Math.sin(a * 3) < 0) continue;
    ctx.fillRect(Math.round(x + 5 + Math.cos(a) * 22), Math.round(y + 2 + Math.sin(a) * 14), 1, 1);
  }
}

// ── 타이틀 배경 ─────────────────────────────────────────────
/** 앞으로 만날 앨범 열일곱 장이 천천히 흘러간다 */
export function drawTitle(ctx, time) {
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW.h);
  grad.addColorStop(0, '#12071f');
  grad.addColorStop(1, '#2d0e3d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);

  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  for (let i = 0; i < 40; i++) {
    const x = (i * 97) % VIEW.w;
    const y = (i * 53) % VIEW.h;
    if (Math.sin(time * 1.7 + i) > 0) ctx.fillRect(x, y, 1, 1);
  }

  // 뒤편의 차트 막대
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#ff5d8f';
  for (let i = 0; i < 20; i++) {
    const h = 14 + Math.abs(Math.sin(time * 1.6 + i * 0.7)) * 62;
    ctx.fillRect(i * 20 + 2, VIEW.h - h, 14, h);
  }
  ctx.restore();

  for (let i = 0; i < ALBUMS.length; i++) {
    const speed = 9 + (i % 5) * 4;
    const size = 16 + (i % 3) * 6;
    const x = ((i * 71 - time * speed) % (VIEW.w + 60)) + (VIEW.w + 60);
    const y = 22 + ((i * 47) % (VIEW.h - 70)) + Math.sin(time * 1.2 + i) * 6;
    ctx.save();
    ctx.globalAlpha = 0.5 + (i % 3) * 0.16;
    drawCoverAt(ctx, ALBUMS[i], (x % (VIEW.w + 60)) - 30, y, size);
    ctx.restore();
  }
}

// ── 전체 ────────────────────────────────────────────────────
export function drawScene(ctx, game, time) {
  crisp(ctx);
  if (game.scene === 'title') {
    drawTitle(ctx, time);
    return;
  }
  if (game.scene === 'cutscene') {
    drawCutscene(ctx, game.cutsceneTime);
    return;
  }
  if (!game.world) {
    ctx.fillStyle = '#0a0410';
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    return;
  }

  const { x: ox, y: oy } = cameraOffset(game.camera);
  const stage = game.world.stage;

  drawSky(ctx, stage, time);
  drawParallax(ctx, stage, ox, time);
  drawTiles(ctx, game, ox, oy, time);
  drawPopSpikes(ctx, game.world, ox, oy);
  drawWallHints(ctx, game, ox, oy, time);
  drawZoneHints(ctx, game, ox, oy, time);

  // 체크포인트
  for (const cp of game.world.checkpoints) {
    ctx.save();
    ctx.globalAlpha = cp.taken ? 1 : 0.55;
    drawSprite(ctx, DISC, cp.x - ox - 3, cp.y - oy - 2 + Math.sin(time * 3) * 1.5);
    ctx.restore();
  }

  // 재생수
  for (const pickup of game.world.pickups) {
    if (pickup.taken) continue;
    drawSprite(ctx, NOTE, pickup.x - ox - 1, pickup.y - oy - 2 + Math.sin(time * 5 + pickup.x) * 1.5);
  }

  // 가짜 골 / 진짜 골
  for (const fake of game.world.fakeGoals) {
    if (fake.gone) continue;
    drawFlag(ctx, fake.x + fake.offset - ox, fake.y - oy, time, '#ff5d8f', fake.fade ?? 1);
  }
  if (game.world.goal) drawFlag(ctx, game.world.goal.x - ox, game.world.goal.y - oy, time, '#39ff9a');

  for (const album of game.albums) drawAlbum(ctx, album, ox, oy, time);

  for (const shot of game.shots) {
    drawSprite(ctx, shot.boss ? SHOT_BOSS : SHOT, shot.x - ox, shot.y - oy + Math.sin(shot.wobble) * 1.5);
  }

  drawMics(ctx, game, ox, oy, time);
  if (game.boss) drawBoss(ctx, game.boss, ox, oy, time);

  drawPlayer(ctx, game.player, ox, oy, time);

  // 알갱이와 숫자
  for (const p of game.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x - ox), Math.round(p.y - oy), p.size, p.size);
  }
  ctx.globalAlpha = 1;
  for (const txt of game.texts) {
    ctx.globalAlpha = Math.max(0, txt.life / txt.max);
    ctx.fillStyle = txt.color;
    ctx.font = '8px monospace';
    ctx.fillText(txt.text, Math.round(txt.x - ox), Math.round(txt.y - oy));
  }
  ctx.globalAlpha = 1;

  drawEffects(ctx, game, ox, oy, time);

  if (game.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.85, game.flash * 0.6)})`;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  }

  // 컷신은 맨 위에 — 싸움 화면이 그 아래로 비친다
  if (game.bossCut) drawBossCut(ctx, game, time);
}

/** 구간 효과 연출 — 정전은 내 주변만 남기고, 역재생은 화면을 물들인다 */
function drawEffects(ctx, game, ox, oy, time) {
  const { blackout, reversed } = game.effects;

  if (blackout > 0) {
    const cx = game.player.x - ox + game.player.w / 2;
    const cy = game.player.y - oy + game.player.h / 2;
    // 꺼질 때와 켜질 때 살짝 부드럽게
    const strength = Math.min(1, blackout, 0.6 + Math.sin(time * 30) * 0.02);
    const radius = 46 + Math.sin(time * 6) * 3;
    const glow = ctx.createRadialGradient(cx, cy, radius * 0.35, cx, cy, radius);
    glow.addColorStop(0, 'rgba(0,0,0,0)');
    glow.addColorStop(1, `rgba(0,0,0,${0.96 * strength})`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    // 원 바깥은 완전히 덮는다 (그라디언트는 사각형 모서리까지 안 닿는다)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, VIEW.w, VIEW.h);
    ctx.arc(cx, cy, radius, 0, Math.PI * 2, true);
    ctx.fillStyle = `rgba(0,0,0,${0.96 * strength})`;
    ctx.fill('evenodd');
    ctx.restore();
  }

  if (reversed > 0) {
    ctx.fillStyle = `rgba(57,208,255,${0.12 + Math.sin(time * 8) * 0.05})`;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    // 왼쪽으로 흐르는 줄무늬 — 되감기는 느낌
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    const off = Math.floor(time * 90) % 24;
    for (let x = -24; x < VIEW.w + 24; x += 24) ctx.fillRect(x - off, 0, 8, VIEW.h);
  }
}
