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
import { phaseAt } from '../data/cutscene.js';

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
      const buried = above === T.GROUND || above === T.POPSPIKE;
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
    drawCoverAt(ctx, ALBUMS[i], Math.cos(angle) * d - 4, Math.sin(angle) * d - 4, 8);
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

  // 분열 조각
  for (const q of boss.quarters) {
    if (q.delay > 0) continue;
    ctx.save();
    ctx.translate(q.x - ox + q.w / 2, q.y - oy + q.h / 2);
    ctx.rotate(q.spin);
    ctx.fillStyle = '#241a33';
    ctx.fillRect(-q.w / 2, -q.h / 2, q.w, q.h);
    drawCoverAt(ctx, ALBUMS[(q.index * 4) % ALBUMS.length], -q.w / 2 + 2, -q.h / 2 + 2, q.w - 4);
    ctx.restore();
  }
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
      const size = 16 - 8 * mergeT;
      drawCoverAt(
        ctx,
        ALBUMS[i],
        cx + Math.cos(angle) * radius - size / 2,
        cy + Math.sin(angle) * radius * 0.72 - size / 2,
        Math.max(4, size),
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
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 1.4);
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
    for (let i = 0; i < ALBUMS.length; i++) {
      const angle = (i / ALBUMS.length) * Math.PI * 2;
      const d = r * 0.68;
      drawCoverAt(ctx, ALBUMS[i], Math.cos(angle) * d - 4, Math.sin(angle) * d - 4, 8);
    }
    ctx.restore();
    ctx.fillStyle = '#39ff9a';
    ctx.beginPath();
    ctx.arc(cx, cy, 10 * grow, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── 전체 ────────────────────────────────────────────────────
export function drawScene(ctx, game, time) {
  crisp(ctx);
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

  if (game.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.85, game.flash * 0.6)})`;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  }
}
