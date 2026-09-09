// 픽셀 월드를 캔버스에 그린다. 글자는 여기서 그리지 않는다 (한글은 DOM 이 맡는다).
import { TILE } from '../core/physics.js';
import { T } from '../core/world.js';
import { cameraOffset } from '../core/camera.js';
import { trapKey } from '../data/traps.js';
import { drawAlbum, drawCoverAt } from './albumArt.js';
import { drawSprite, crisp, makeCanvas } from './pixel.js';
import { playerFrame, PLAYER_OFFSET, NOTE, SHOT, SHOT_BOSS, DISC, BRIDE, RING } from './sprites.js';
import { ALBUMS } from '../data/albums.js';
import { VIEW } from '../core/game.js';
import { phaseAt, phaseAtIn, CUT_AT } from '../data/cutscene.js';
import { BOSS_CUTS, PHASE2_AT, PHASE3_AT, ENDING_AT } from '../data/bossCutscenes.js';
import { INTRO_CUT, INTRO_AT } from '../data/introCutscene.js';
import { drawBigTextCentered } from './bigtext.js';
import { bossPhase, princessCaged, bossCombined, laserBeam } from '../core/boss.js';
import { PLAYER } from '../core/player.js';

// ── 배경 ────────────────────────────────────────────────────
//
// 무대마다 하늘과 원경이 다르다. 어떤 그림을 그릴지는 stage.theme 이 고르고,
// 색은 stage.sky / far / ground 에서 온다 — 그림과 색을 따로 두면
// 같은 무대를 낮/밤으로 바꾸는 것도 색만 갈아끼우면 된다.

/** 열 번호로부터 항상 같은 값이 나오는 0~1 난수 (배경이 프레임마다 안 흔들리게) */
function noise(i, salt = 0) {
  const n = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/** 화면 폭을 step 간격으로 훑으며, 시차(depth)를 준 x 를 넘겨준다 */
function band(ox, depth, step, draw) {
  const shift = -ox * depth;
  const from = Math.floor(-shift / step) - 1;
  const to = from + Math.ceil(VIEW.w / step) + 2;
  for (let i = from; i <= to; i++) draw(Math.round(i * step + shift), i);
}

function drawSky(ctx, stage, ox, time) {
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW.h);
  grad.addColorStop(0, stage.sky[0]);
  grad.addColorStop(1, stage.sky[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);

  switch (stage.theme) {
    case 'meadow':
      drawClouds(ctx, ox, time);
      break;
    case 'forest':
      drawCanopy(ctx, stage, ox);
      break;
    case 'building':
      drawCeilingLights(ctx, ox, time);
      break;
    default:
      drawStars(ctx, time);
      break;
  }
}

/** 밤 무대의 반짝이는 별 */
function drawStars(ctx, time) {
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 26; i++) {
    const x = (i * 71) % VIEW.w;
    const y = (i * 37) % 90;
    if (Math.sin(time * 2 + i) > 0.2) ctx.fillRect(x, y, 1, 1);
  }
}

// ── 초원 ────────────────────────────────────────────────────
/** 아주 느리게 흐르는 구름. 바람이 부는 것처럼 시간에도 조금 밀린다. */
function drawClouds(ctx, ox, time) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  band(ox + time * 4, 0.08, 128, (x, i) => {
    const y = 14 + noise(i) * 44;
    const w = 22 + noise(i, 1) * 26;
    // 뭉게구름 — 납작한 덩어리 위에 봉우리 두 개
    ctx.fillRect(x, y + 4, w, 6);
    ctx.fillRect(x + 5, y, w * 0.4, 6);
    ctx.fillRect(x + w * 0.55, y + 1, w * 0.3, 5);
  });
  ctx.restore();
}

/** 겹겹이 물결치는 언덕. 뒤쪽일수록 연하고 느리게 흐른다. */
function drawHills(ctx, stage, ox) {
  const layers = [
    { depth: 0.12, base: 96, amp: 14, alpha: 0.35, wave: 0.011 },
    { depth: 0.24, base: 118, amp: 18, alpha: 0.55, wave: 0.008 },
    { depth: 0.42, base: 142, amp: 12, alpha: 0.8, wave: 0.016 },
  ];
  ctx.save();
  ctx.fillStyle = stage.far;
  for (const L of layers) {
    ctx.globalAlpha = L.alpha;
    ctx.beginPath();
    ctx.moveTo(0, VIEW.h);
    for (let x = 0; x <= VIEW.w; x += 6) {
      const t = (x - ox * L.depth) * L.wave;
      ctx.lineTo(x, L.base + Math.sin(t) * L.amp + Math.sin(t * 2.3) * L.amp * 0.4);
    }
    ctx.lineTo(VIEW.w, VIEW.h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** 바닥 근처의 풀포기와 들꽃 */
function drawGrassTufts(ctx, stage, ox, time) {
  ctx.save();
  band(ox, 0.75, 14, (x, i) => {
    const h = 5 + Math.floor(noise(i, 2) * 6);
    const sway = Math.sin(time * 1.6 + i) * 1.2;
    const y = VIEW.h - 30 - h;
    ctx.fillStyle = stage.ground[0];
    ctx.globalAlpha = 0.5;
    ctx.fillRect(x, y, 1, h);
    ctx.fillRect(Math.round(x + 2 + sway), y + 2, 1, h - 2);
    ctx.fillRect(Math.round(x - 2 - sway), y + 3, 1, h - 3);
    // 가끔 들꽃 한 송이
    if (noise(i, 3) > 0.86) {
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = noise(i, 4) > 0.5 ? '#ffe066' : '#ff8fb1';
      ctx.fillRect(x, y - 2, 2, 2);
    }
  });
  ctx.restore();
}

// ── 숲 ──────────────────────────────────────────────────────
/** 잎 덩어리 하나. 사각형으로 그리면 빌딩처럼 보여서 원을 겹쳐 쓴다. */
function leafBlob(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.arc(x - r * 0.7, y + r * 0.35, r * 0.72, 0, Math.PI * 2);
  ctx.arc(x + r * 0.75, y + r * 0.3, r * 0.66, 0, Math.PI * 2);
  ctx.fill();
}

/** 화면 위를 덮은 나뭇잎 지붕 */
function drawCanopy(ctx, stage, ox) {
  ctx.save();
  ctx.fillStyle = stage.far;
  ctx.globalAlpha = 0.45;
  band(ox, 0.08, 34, (x, i) => leafBlob(ctx, x, 4 + noise(i) * 16, 16 + noise(i, 1) * 8));
  ctx.globalAlpha = 0.8;
  band(ox, 0.16, 44, (x, i) => leafBlob(ctx, x + 12, -2 + noise(i, 2) * 14, 18 + noise(i, 3) * 9));
  ctx.restore();
}

/** 잎 사이로 비스듬히 떨어지는 빛줄기 — 숲이라는 걸 가장 크게 말해준다 */
function drawSunShafts(ctx, ox, time) {
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = '#fff6c9';
  band(ox, 0.3, 150, (x, i) => {
    const w = 14 + noise(i, 10) * 12;
    const sway = Math.sin(time * 0.4 + i) * 4;
    ctx.beginPath();
    ctx.moveTo(x + sway, 0);
    ctx.lineTo(x + w + sway, 0);
    ctx.lineTo(x + w + 46, VIEW.h - 28);
    ctx.lineTo(x + 46, VIEW.h - 28);
    ctx.closePath();
    ctx.fill();
  });
  ctx.restore();
}

/**
 * 앞뒤로 늘어선 나무. 줄기는 갈색이라 초록 배경에서 확실히 떠 보이고,
 * 앞쪽 나무일수록 굵고 성기게 서서 깊이가 생긴다.
 */
function drawTrees(ctx, stage, ox) {
  const trunk = stage.trunk ?? stage.far;
  const layers = [
    { depth: 0.2, step: 46, w: 5, top: 26, alpha: 0.4, leaf: 0 },
    { depth: 0.36, step: 78, w: 9, top: 16, alpha: 0.7, leaf: 15 },
    { depth: 0.58, step: 132, w: 14, top: 4, alpha: 1, leaf: 22 },
  ];
  ctx.save();
  for (const L of layers) {
    band(ox, L.depth, L.step, (x, i) => {
      const lean = Math.round((noise(i, 6) - 0.5) * 5);
      // 잎 먼저, 줄기가 그 위로 올라오게
      if (L.leaf) {
        ctx.globalAlpha = L.alpha * 0.85;
        ctx.fillStyle = stage.far;
        leafBlob(ctx, x + lean + L.w / 2, L.top + 10, L.leaf + noise(i, 11) * 6);
      }
      ctx.globalAlpha = L.alpha;
      ctx.fillStyle = trunk;
      ctx.fillRect(x + lean, L.top, L.w, VIEW.h - 28 - L.top);
      // 굵은 줄기에는 가지를 하나씩
      if (L.w >= 9) {
        const by = L.top + 34 + noise(i, 7) * 46;
        const dir = noise(i, 8) > 0.5 ? 1 : -1;
        ctx.fillRect(x + lean + (dir > 0 ? L.w : -14), by, 14, 3);
      }
    });
  }
  ctx.restore();
}

/** 바닥에 깔린 고사리 덤불 */
function drawFerns(ctx, stage, ox, time) {
  ctx.save();
  ctx.fillStyle = stage.ground[0];
  band(ox, 0.8, 20, (x, i) => {
    const h = 8 + noise(i, 9) * 8;
    const y = VIEW.h - 30 - h;
    ctx.globalAlpha = 0.55;
    for (let k = -2; k <= 2; k++) {
      const sway = Math.sin(time * 1.3 + i + k) * 1.5;
      ctx.fillRect(Math.round(x + k * 3 + sway), y + Math.abs(k) * 2, 2, h - Math.abs(k) * 2);
    }
  });
  ctx.restore();
}

// ── 건물 ────────────────────────────────────────────────────
/** 천장 형광등 — 일정한 간격이라 실내처럼 보인다 */
function drawCeilingLights(ctx, ox, time) {
  ctx.save();
  band(ox, 0.5, 96, (x, i) => {
    const flicker = Math.sin(time * 9 + i * 3) > -0.92 ? 1 : 0.35;
    ctx.globalAlpha = 0.75 * flicker;
    ctx.fillStyle = '#fdf6d8';
    ctx.fillRect(x + 24, 6, 44, 3);
    ctx.globalAlpha = 0.14 * flicker;
    ctx.fillRect(x + 18, 9, 56, 22);
  });
  ctx.restore();
}

/** 창문 격자와 기둥 */
function drawBuilding(ctx, stage, ox) {
  ctx.save();
  // 뒤편 벽과 창문
  ctx.fillStyle = stage.far;
  ctx.globalAlpha = 0.5;
  band(ox, 0.2, 26, (x, i) => {
    for (let r = 0; r < 4; r++) {
      const lit = noise(i, r) > 0.66;
      ctx.globalAlpha = lit ? 0.5 : 0.22;
      ctx.fillStyle = lit ? '#ffe9a8' : stage.far;
      ctx.fillRect(x + 3, 34 + r * 30, 18, 20);
    }
  });
  // 앞쪽 기둥
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = stage.far;
  band(ox, 0.45, 88, (x) => {
    ctx.fillRect(x, 20, 16, VIEW.h - 48);
    ctx.globalAlpha = 0.35;
    ctx.fillRect(x + 16, 20, 3, VIEW.h - 48);
    ctx.globalAlpha = 0.8;
  });
  ctx.restore();
}

/** 무대 바닥을 따라 지나가는 배관 */
function drawPipes(ctx, stage, ox) {
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = stage.ground[0];
  ctx.fillRect(0, VIEW.h - 34, VIEW.w, 2);
  band(ox, 0.75, 46, (x) => {
    ctx.fillRect(x, VIEW.h - 37, 4, 8);
  });
  ctx.restore();
}

// ── 차트 (스테이지 4 · 보스) ────────────────────────────────
function drawChartBars(ctx, stage, ox, time) {
  const shift = -ox * 0.35;
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = stage.far ?? stage.sky[1];
  band(ox, 0.35, 48, (x, i) => {
    const h = 40 + ((i * 29) % 70);
    ctx.fillRect(x + 6, VIEW.h - h - 40, 20, h);
  });
  // 소리에 맞춰 뛰는 EQ 막대
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = stage.ground[0];
  for (let i = 0; i < 24; i++) {
    const h = 8 + Math.abs(Math.sin(time * 3 + i * 0.6)) * 26;
    ctx.fillRect(i * 17 + ((shift * 0.5) % 17), VIEW.h - h - 28, 10, h);
  }
  ctx.restore();
}

/** 스테이지마다 다른 원경 — 시차를 줘서 달리는 느낌을 낸다 */
function drawParallax(ctx, stage, ox, time) {
  switch (stage.theme) {
    case 'meadow':
      drawHills(ctx, stage, ox);
      drawGrassTufts(ctx, stage, ox, time);
      break;
    case 'forest':
      drawTrees(ctx, stage, ox);
      drawSunShafts(ctx, ox, time);
      drawFerns(ctx, stage, ox, time);
      break;
    case 'building':
      drawBuilding(ctx, stage, ox);
      drawPipes(ctx, stage, ox);
      break;
    default:
      drawChartBars(ctx, stage, ox, time);
      break;
  }
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
  // 피격 무적. 그냥 일정하게 깜빡이면 **언제 끝나는지** 알 수가 없어서,
  // 끝이 가까울수록 빨리 깜빡이고 둘레의 테도 같이 옅어진다.
  const guard = player.invuln > 0 ? Math.min(1, player.invuln / PLAYER.invulnTime) : 0;
  if (guard > 0) {
    const rate = 14 + (1 - guard) * 34; // 남을수록 느리게, 끝날 때 다급하게
    if (Math.floor(time * rate) % 2 === 0) return;
  }
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

  // 무적이 얼마나 남았는지 — 둘레의 테가 같이 옅어진다
  if (guard > 0) {
    ctx.save();
    ctx.globalAlpha = guard * 0.8;
    ctx.strokeStyle = '#8fd8ff';
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(x) - 1.5, Math.round(y) - 1.5, 15, 19);
    ctx.restore();
  }

  // 대시 잔상 — 지나온 쪽으로 두 장 옅게. 새 상태 없이 dashTime 하나만 본다.
  if (player.dashTime > 0) {
    ctx.save();
    for (let i = 1; i <= 2; i++) {
      ctx.globalAlpha = 0.3 / i;
      drawSprite(ctx, frame, x - player.dir * i * 7, y, player.dir < 0);
    }
    ctx.restore();
  }

  // 대시가 언제 돌아오는지 — 발밑에서 줄어드는 막대. 다 차면 사라진다.
  // (피격 무적 테두리와 같은 원칙 — 끝나는 때가 보여야 쓸 수 있다.)
  if (player.dashCool > 0 && player.dashTime <= 0) {
    const left = Math.min(1, player.dashCool / PLAYER.dashCool);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(Math.round(x), Math.round(y) + 18, 12, 2);
    ctx.fillStyle = '#8fd8ff';
    ctx.fillRect(Math.round(x), Math.round(y) + 18, Math.round(12 * (1 - left)), 2);
  }

  // 찌그러짐 — 착지에 납작, 점프에 길쭉. 물리는 그대로고 그림만 늘였다 줄인다.
  // 조작이 화면에 즉시 보이는 게 조작감의 절반이다.
  const sy = 1 + player.stretch * 0.22 - player.squash * 0.3;
  if (Math.abs(sy - 1) < 0.01) {
    drawSprite(ctx, frame, x, y, player.dir < 0);
    return;
  }
  const sx = 1 / sy; // 부피를 지킨다 — 세로로 늘면 가로로 준다
  ctx.save();
  // 발밑을 기준으로 늘린다. 가운데를 기준으로 하면 착지할 때 땅에 파묻힌다.
  ctx.translate(Math.round(x) + 6, Math.round(y) + 16);
  ctx.scale(sx, sy);
  drawSprite(ctx, frame, -6, -16, player.dir < 0);
  ctx.restore();
}

/**
 * 레이저. 사각형은 core/boss.js 의 laserBeam 이 정한다 —
 * 여기서 다시 계산하면 보이는 자리와 죽는 자리가 언젠가 어긋난다.
 *
 * 예고(live=false)는 가는 선으로, 발사(live=true)는 굵은 기둥으로.
 * 둘이 한눈에 달라 보여야 "지금 맞는 건가"를 안 헷갈린다.
 */
function drawLaser(ctx, boss, ox, oy, time, color) {
  const beam = laserBeam(boss);
  if (!beam) return;
  const x = beam.x - ox;
  const y = beam.y - oy;
  const cx = x + beam.w / 2;

  if (!beam.live) {
    // 예고 — 깜빡이는 가는 선과, **곧 기둥이 설 자리**를 바닥에 폭 그대로 그린다.
    // 선만 그으면 얼마나 굵게 올지 몰라서 아슬아슬하게 서 있다 맞는다.
    const on = Math.floor(time * 16) % 2 === 0;
    ctx.save();
    ctx.fillStyle = on ? '#ffffff' : color;
    ctx.globalAlpha = on ? 0.95 : 0.5;
    ctx.fillRect(Math.round(cx) - 1, Math.round(y), 2, Math.round(beam.h));
    // 착탄 예정 자리 — 기둥과 같은 폭이라야 "여기 서면 맞는다"가 맞는 말이 된다
    ctx.globalAlpha = on ? 0.55 : 0.25;
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y + beam.h) - 4, beam.w, 4);
    ctx.restore();
    return;
  }

  // 발사 — 바깥 번짐, 안쪽 기둥, 가운데 흰 심지
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x) - 3, Math.round(y), beam.w + 6, Math.round(beam.h));
  ctx.globalAlpha = 1;
  ctx.fillRect(Math.round(x), Math.round(y), beam.w, Math.round(beam.h));
  ctx.fillStyle = '#ffffff';
  const core = 2 + (Math.floor(time * 30) % 2);
  ctx.fillRect(Math.round(cx) - core / 2, Math.round(y), core, Math.round(beam.h));
  // 바닥에 터지는 불티
  const spread = 10 + Math.sin(time * 40) * 3;
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(cx - spread / 2), Math.round(y + beam.h) - 3, Math.round(spread), 3);
  ctx.restore();
}

// ── 보스 ────────────────────────────────────────────────────
/** 체력계는 보스 바로 아래에 붙여 그린다 — 화면 위에 판을 깔면 게임을 가린다 */
function drawBossHealth(ctx, boss, ox, oy, color, drop = 0) {
  const w = boss.w + 12;
  const x = Math.round(boss.x - ox - 6);
  // drop 은 몸이 더 아래까지 내려올 때 쓴다 — 로봇은 다리가 있어서 그만큼 비켜야 한다
  const y = Math.round(boss.y - oy + boss.h + 4 + drop);
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

/**
 * 약점 — 가운데 재생 버튼. 열려 있을 때만 초록으로 빛난다.
 * 원반이든 로봇이든 약점은 같은 자리에 같은 모양이다 (로봇에서는 가슴 코어).
 */
function drawBossCore(ctx, cx, cy, open, time, rad = 11) {
  // 배경의 거대 로봇도 같은 그림을 쓴다 — 크기만 다르고 모양은 하나여야 한 몸으로 보인다
  const k = rad / 11;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = open ? '#39ff9a' : '#5c4a70';
  ctx.beginPath();
  ctx.arc(0, 0, rad, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = open ? '#04240f' : '#2a2136';
  ctx.beginPath();
  ctx.moveTo(-3 * k, -5 * k);
  ctx.lineTo(6 * k, 0);
  ctx.lineTo(-3 * k, 5 * k);
  ctx.fill();
  if (open) {
    ctx.strokeStyle = `rgba(57,255,154,${0.5 + Math.sin(time * 10) * 0.4})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, (14 + Math.sin(time * 8) * 2) * k, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * 합체한 뒤의 조각들 — 로켓 펀치. 궤도를 도는 건 2페이즈와 같지만,
 * 조각난 파편이 아니라 떼어낸 주먹으로 보여야 합체가 말이 된다.
 */
function drawFists(ctx, boss, ox, oy, color) {
  for (const q of boss.quarters) {
    if (q.delay > 0) continue;
    ctx.save();
    ctx.translate(q.x - ox + q.w / 2, q.y - oy + q.h / 2);
    // 주먹은 날아가는 쪽을 본다 — 도는 게 아니라 쏜 것이다
    const dir = q.vx > 0 ? 1 : -1;
    ctx.scale(dir, 1);
    // 뒤로 뻗은 화염
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.5 + Math.sin(q.spin * 3) * 0.2;
    ctx.fillRect(-q.w / 2 - 10, -3, 10, 6);
    ctx.globalAlpha = 1;
    // 주먹 — 몸과 같은 장갑판이라야 떼어낸 손으로 보인다
    plate(ctx, -q.w / 2, -q.h / 2, q.w, q.h);
    plate(ctx, -q.w / 2 + 3, -q.h / 2 + 3, q.w - 6, q.h - 6, { face: DARK, lit: METAL });
    // 손가락 마디
    for (let i = 0; i < 3; i++) {
      plate(ctx, q.w / 2 - 5, -q.h / 2 + 3 + i * 6, 4, 4, { face: color, lit: '#ffffff' });
    }
    ctx.restore();
  }
}

/**
 * 3페이즈 배경에 버티고 선 거대 로봇.
 *
 * 실제로 싸우는 몸은 56픽셀이라 아무리 잘 그려도 커 보이질 않는다. 뒤에 같은 몸을
 * 화면보다 크게 세워두면 **크기가 그림으로 읽힌다** — 지금 상대하는 게 저것이라는 뜻이다.
 * 몸 그림은 drawRobotBody 하나뿐이라, 로봇을 고치면 배경도 같이 바뀐다.
 */
const GIANT_R = 92;
/** 머리는 다 보이고 다리는 지형 뒤로 사라지는 높이 — "화면에 안 들어간다"가 요점이다 */
const GIANT_CY = 116;

/**
 * 거대 로봇을 한 번 구워둔다.
 *
 * 그냥 흐리게 겹쳐 그리면 앨범 커버가 알록달록하게 남아서 로봇이 아니라
 * 벽에 걸린 액자들처럼 보인다. 딴 캔버스에 그린 뒤 **제 픽셀 위에만**(source-atop)
 * 한 가지 색을 덮어 무늬를 눌러버리면, 덩치와 실루엣만 남는다.
 * 매 프레임 다시 구울 이유가 없어서 페이즈 색이 바뀔 때만 새로 굽는다.
 */
let giantBaked = null;

function giantCanvas(color) {
  if (giantBaked?.color === color) return giantBaked.canvas;
  const r = GIANT_R;
  const top = r * ROBOT_TOP;
  const w = Math.ceil(r * 2.8);
  const h = Math.ceil(r * (ROBOT_BOTTOM - ROBOT_TOP)) + 4;
  const canvas = makeCanvas(w, h);
  const c = canvas.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.translate(Math.round(w / 2), Math.round(-top + 2));
  drawRobotBody(c, r, 0, color, 1, false);
  drawBossCore(c, 0, 0, false, 0, coreRadius(r));
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'source-atop';
  c.fillStyle = 'rgba(58,24,92,0.86)';
  c.fillRect(0, 0, w, h);
  giantBaked = { color, canvas, w, h, top };
  return canvas;
}

function drawGiantRobot(ctx, boss, ox, time) {
  const down = boss.state === 'defeated';
  // 쓰러지면 배경도 같이 꺼진다 — 이겼는데 뒤에 그대로 서 있으면 안 진 것 같다
  const fade = down ? Math.max(0, 1 - boss.defeatedAt / 1.6) : 1;
  if (fade <= 0) return;

  const canvas = giantCanvas(bossPhase(boss).color);
  const { w, h, top } = giantBaked;
  // 시차 — 카메라를 천천히 따라오고, 아주 조금씩 흔들린다
  const x = Math.round(VIEW.w / 2 - ox * 0.12 - w / 2 + Math.sin(time * 0.6) * 2);
  const y = Math.round(GIANT_CY + top - 2);

  ctx.save();
  ctx.globalAlpha = 0.55 * fade;
  ctx.drawImage(canvas, x, y);
  ctx.restore();
  // 코어는 구운 그림 안에 이미 들어 있다. 여기에 따로 빛을 얹지 않는다 —
  // 배경의 재생 버튼이 초록으로 켜지면 저기를 밟으라는 말로 읽힌다.
}

/** 쓰러진 로봇의 관절에서 튀는 스파크 */
function drawSparks(ctx, cx, cy, r, since, color) {
  ctx.save();
  for (let i = 0; i < 7; i++) {
    const t = (since * 2.6 + i * 0.37) % 1;
    const a = i * 1.9 + since;
    const d = r * (0.3 + t * 1.1);
    ctx.globalAlpha = Math.max(0, 1 - t);
    ctx.fillStyle = i % 2 === 0 ? '#ffffff' : color;
    ctx.fillRect(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d * 0.8), 2, 2);
  }
  ctx.restore();
}

export function drawBoss(ctx, boss, ox, oy, time) {
  const cx = boss.x - ox + boss.w / 2;
  const cy = boss.y - oy + boss.h / 2;
  const phaseColor = bossPhase(boss).color;
  const r = boss.w / 2;

  // 3페이즈는 합체한 로봇이다 — 원반이 어깨가 되고 마디 나뉜 팔다리가 붙는다.
  // 격파해도 로봇으로 남긴다. 이긴 순간에 몸이 도로 원반으로 바뀌면 이긴 것 같지가 않다.
  if (bossCombined(boss)) {
    const down = boss.state === 'defeated';
    ctx.save();
    ctx.translate(cx, cy);
    // 쓰러질 때는 옆으로 기운다 (다 돌지는 않는다 — 로봇은 구르지 않는다)
    if (down) ctx.rotate(Math.min(0.7, boss.defeatedAt * 0.6));
    drawRobotBody(ctx, r, time, phaseColor, 1, boss.hurtFlash > 0);
    ctx.restore();
    drawBossCore(ctx, cx, cy, boss.vulnerable, time);
    if (down) drawSparks(ctx, cx, cy, r, boss.defeatedAt, phaseColor);
    else drawFists(ctx, boss, ox, oy, phaseColor);
    // 체력계는 발밑으로 내린다 — 몸 크기는 ROBOT_BOTTOM 한 곳에서만 온다
    if (!down) drawBossHealth(ctx, boss, ox, oy, phaseColor, r * ROBOT_BOTTOM - r + 4);
    if (princessCaged(boss)) drawCage(ctx, cx, cy + r * ROBOT_TOP - 16, time);
    return;
  }

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(boss.spin);

  // 거대 LP
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

  drawBossCore(ctx, cx, cy, boss.vulnerable, time);

  // 분열 조각 — 페이즈 색으로 테두리를 둘러 어느 페이즈인지 눈에 들어오게
  const color = phaseColor;
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

  // 싸우는 내내 그녀가 보스 위에 갇혀 있다 — 왜 여기까지 왔는지가 화면에 남아 있어야 한다
  if (princessCaged(boss)) drawCage(ctx, cx, boss.y - oy - 26, time);
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

  // 시각은 전부 CUT_AT 에서 온다 — 타임라인만 고쳐도 그림이 따라온다
  const gatherT = Math.min(1, t / CUT_AT.swirl);
  const swirlT = phase === 'gather' ? 0 : Math.min(1, (t - CUT_AT.swirl) / (CUT_AT.merge - CUT_AT.swirl));
  const mergeT = ['merge', 'flash', 'reveal'].includes(phase)
    ? Math.min(1, (t - CUT_AT.merge) / (CUT_AT.reveal - CUT_AT.merge))
    : 0;

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
    ctx.fillStyle = `rgba(255,255,255,${1 - Math.min(1, (t - CUT_AT.flash) / 0.5)})`;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  }

  if (phase === 'reveal' || phase === 'end') {
    const grow = Math.min(1, (t - CUT_AT.reveal) / 1.2);
    const r = 20 + 44 * grow;
    drawBossDisc(ctx, cx, cy, r, t * 1.4);
    ctx.fillStyle = '#39ff9a';
    ctx.beginPath();
    ctx.arc(cx, cy, 10 * grow, 0, Math.PI * 2);
    ctx.fill();
    // 합쳐진 원반 위에 새장이 얹힌다 — 여기서부터 보스전 내내 저 자리에 있다
    drawCage(ctx, cx, cy - r - 20 * grow, t);
  } else {
    // 빨려 들어가는 앨범들 한가운데에서 새장도 같이 돌아간다
    const swirlR = 34 + Math.sin(t * 2) * 5;
    drawCage(ctx, cx + Math.cos(t * 1.6) * swirlR, cy + Math.sin(t * 1.6) * swirlR * 0.5, t);
  }
}

// ── 합체 로봇 ───────────────────────────────────────────────
// 장갑 색. 판을 그리는 곳이 열 군데가 넘어서, 색을 여기 한 번만 적는다.
const DARK = '#241a33';
const METAL = '#5c4a70';
const LIT = '#a98cff';
const VINYL = '#14101d';

/**
 * 장갑판 한 장 — 어두운 테두리 + 금속 면 + 위·왼쪽 1px 하이라이트.
 *
 * 부위마다 fillRect 를 손으로 쌓으면 죄다 납작해진다. 여기 한 번만 두께를 주고
 * 모든 부위가 이걸 쓰면 재질이 저절로 같아진다.
 * hurt 면 전부 흰색 — 피격 표시를 부위마다 다시 적지 않는다.
 */
function plate(ctx, x, y, w, h, { face = METAL, edge = DARK, lit = LIT, hurt = false } = {}) {
  const X = Math.round(x);
  const Y = Math.round(y);
  const W = Math.max(1, Math.round(w));
  const H = Math.max(1, Math.round(h));
  ctx.fillStyle = hurt ? '#ffffff' : edge;
  ctx.fillRect(X, Y, W, H);
  if (W <= 2 || H <= 2) return;
  ctx.fillStyle = hurt ? '#ffffff' : face;
  ctx.fillRect(X + 1, Y + 1, W - 2, H - 2);
  ctx.fillStyle = hurt ? '#ffffff' : lit;
  ctx.fillRect(X + 1, Y + 1, W - 2, 1);
  ctx.fillRect(X + 1, Y + 1, 1, H - 2);
}

/** 각진 판 (사다리꼴 등). 첫 변이 빛 받는 모서리다. */
function wedge(ctx, pts, { face = METAL, edge = DARK, lit = LIT, hurt = false } = {}) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = hurt ? '#ffffff' : face;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = hurt ? '#ffffff' : edge;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  ctx.lineTo(pts[1][0], pts[1][1]);
  ctx.strokeStyle = hurt ? '#ffffff' : lit;
  ctx.stroke();
}

/**
 * 로봇 몸 비율 — 전부 r(원래 원반 반지름) 배수. 몸 한가운데가 (0,0).
 * 한 곳에서 고치면 새장·체력계 자리까지 따라온다.
 */
const RB = {
  // 가슴은 코어실(30px 고정)이 여유 있게 들어갈 만큼 넓어야 한다 — 좁으면 틀이 몸 밖으로 삐져나온다
  chestTop: -0.62, chestBot: 0.44, chestHalf: 0.6, waistHalf: 0.4,
  padX: 0.74, padY: -0.36, padR: 0.42,
  // 팔은 가슴 바깥으로 확실히 빼야 한다 — 겹치면 몸통에 먹혀서 팔로 안 읽힌다
  armX: 0.88, armTop: -0.2, elbow: 0.12, wrist: 0.54, fistBot: 0.74,
  hipX: 0.3, thighTop: 0.58, kneeTop: 0.84, shinTop: 1.0, footTop: 1.28, footBot: 1.42,
  headBot: -0.74, headTop: -1.12, headHalf: 0.32, crestTop: -1.34,
};

/**
 * 몸 한가운데 기준, 로봇이 실제로 차지하는 위·아래 (r 배수).
 *
 * 히트박스(56×56)를 넘는 건 머리·크레스트와 정강이·발뿐이고, 밟히는 코어는 늘 한가운데다.
 * 새장과 체력계가 이 값으로 자리를 잡는다 — 숫자를 두 군데 적어두면 몸을 키울 때 조용히 어긋난다.
 */
export const ROBOT_TOP = RB.crestTop;
export const ROBOT_BOTTOM = RB.footBot;

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/**
 * 가슴 코어실의 반쪽 크기. 작은 몸에서는 코어(반지름 11)가 들어갈 최소치를 지키고,
 * 큰 몸에서는 가슴 비율을 따라 같이 커진다 — 배경의 거대 로봇도 이 식을 쓴다.
 */
const housingHalf = (r) => Math.max(26, Math.min(30, r * 0.75), r * 0.62) / 2;

/** 그 몸 크기에 맞는 코어 반지름 */
const coreRadius = (r) => Math.max(11, housingHalf(r) * 0.74);

/**
 * 장갑에 박힌 앨범 한 장. 테를 둘러 **판에 끼워진 것**으로 보이게 한다 —
 * 그냥 얹으면 스티커로 보이고, 열일곱 장이 뭉쳐 만든 몸이라는 게 안 읽힌다.
 */
function armorCover(ctx, id, cx, cy, size, hurt) {
  const s = Math.round(size);
  if (hurt || s < 4) return;
  const x = Math.round(cx - s / 2);
  const y = Math.round(cy - s / 2);
  // 작을 때는 테를 빼야 한다 — 밝은 테가 그림보다 커지면 몸이 격자무늬로 보인다
  if (s >= 8) {
    ctx.fillStyle = LIT;
    ctx.fillRect(x - 1, y - 1, s + 2, s + 2);
  }
  drawCoverAt(ctx, id, x, y, s);
}

/** 잠기기 전에는 밖에서 날아든다. p=1 이면 제자리. */
function slam(ctx, p, dx, dy, draw) {
  if (p <= 0) return;
  ctx.save();
  if (p < 1) {
    const back = (1 - p) * (1 - p);
    ctx.translate(Math.round(dx * back), Math.round(dy * back));
    ctx.globalAlpha *= 0.4 + p * 0.6;
  }
  draw();
  ctx.restore();
}

/**
 * 어깨 견갑 — **반으로 쪼개진 원반**. 홈까지 그대로 남겨둔다.
 * 변신 전 물건이 몸에 남아 있어야 합체 로봇으로 읽힌다.
 */
function pauldron(ctx, x, y, rad, side, color, hurt, cover) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate(side * 0.16);
  ctx.beginPath();
  ctx.arc(0, 0, rad, Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = hurt ? '#ffffff' : VINYL;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = hurt ? '#ffffff' : color;
  ctx.stroke();
  if (!hurt) {
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, (rad * i) / 4, Math.PI, 0);
      ctx.stroke();
    }
    if (cover) armorCover(ctx, cover, 0, -rad * 0.42, rad * 0.62, false);
  }
  // 아래를 장갑으로 물린다 — 그냥 반원이면 원반이 얹힌 걸로만 보인다
  plate(ctx, -rad, -2, rad * 2, 5, { hurt, face: color, lit: '#ffffff' });
  ctx.restore();
}

/**
 * 합체한 3페이즈 보스 — 원반이 어깨가 되고 마디 나뉜 팔다리가 붙은 로봇.
 *
 * (0,0) 이 몸통 한가운데. r 은 원래 원반의 반지름.
 * grow 는 조립 진행도(0~1)로, 부위가 **다리 → 몸통 → 견갑 → 팔 → 머리** 순서로 잠긴다.
 * 기울기(spin)는 주지 않는다. 로봇은 돌지 않고 버티고 서 있어야 무겁다.
 */
function drawRobotBody(ctx, r, time, color, grow = 1, hurt = false) {
  const opt = { hurt };
  const hot = { hurt, face: color, lit: '#ffffff' };
  const P = (i) => clamp01((grow - i * 0.2) / 0.2);
  const px = (v) => v * r;
  const done = grow >= 1;

  ctx.save();
  // 다 붙고 나서만 숨을 쉰다. 조립 중에 들썩이면 잠긴 걸로 안 보인다.
  if (done) ctx.translate(0, Math.round(Math.sin(time * 2) * 1));

  // ── 다리 ──
  slam(ctx, P(0), 0, 70, () => {
    for (const [i, side] of [-1, 1].entries()) {
      const x = side * px(RB.hipX);
      plate(ctx, x - px(0.17), px(RB.thighTop) - 2, px(0.34), px(RB.kneeTop - RB.thighTop) + 3, opt);
      armorCover(ctx, ALBUMS[i === 0 ? 1 : 16], x, px((RB.thighTop + RB.kneeTop) / 2), px(0.17), hurt);
      plate(ctx, x - px(0.21), px(RB.kneeTop), px(0.42), px(RB.shinTop - RB.kneeTop) + 1, hot);
      plate(ctx, x - px(0.2), px(RB.shinTop), px(0.4), px(RB.footTop - RB.shinTop), opt);
      // 발은 앞으로 튀어나온다 — 세로 막대 두 개로는 서 있는 걸로 안 읽힌다
      plate(ctx, x - px(0.27), px(RB.footTop), px(0.54), px(RB.footBot - RB.footTop), opt);
      armorCover(ctx, ALBUMS[i === 0 ? 6 : 14], x, px((RB.shinTop + RB.footTop) / 2), px(0.2), hurt);
    }
  });

  // ── 팔 (몸통 뒤) ──
  slam(ctx, P(3), 0, 0, () => {
    for (const [i, side] of [-1, 1].entries()) {
      const x = side * px(RB.armX);
      const off = side * (1 - P(3)) * px(2.2);
      ctx.save();
      ctx.translate(Math.round(off), 0);
      plate(ctx, x - px(0.11), px(RB.armTop), px(0.22), px(RB.elbow - RB.armTop), opt); // 윗팔
      plate(ctx, x - px(0.2), px(RB.elbow), px(0.4), px(RB.wrist - RB.elbow), opt); // 아래팔
      armorCover(ctx, ALBUMS[i === 0 ? 0 : 9], x, px((RB.elbow + RB.wrist) / 2), px(0.22), hurt); // 아래팔 장갑
      plate(ctx, x - px(0.2), px(RB.wrist), px(0.4), px(RB.fistBot - RB.wrist), opt); // 주먹
      for (let i = 0; i < 3; i++) {
        plate(ctx, x - px(0.16) + i * px(0.11), px(RB.wrist) + 2, px(0.08), 2, hot);
      }
      ctx.restore();
    }
  });

  // ── 몸통 ──
  slam(ctx, P(1), 0, -70, () => {
    const top = px(RB.chestTop);
    const bot = px(RB.chestBot);
    // 어깨 넓고 허리 좁은 사다리꼴 — 사각형이면 아무리 칠해도 짜친다
    wedge(
      ctx,
      [
        [-px(RB.chestHalf), top],
        [px(RB.chestHalf), top],
        [px(RB.waistHalf), bot],
        [-px(RB.waistHalf), bot],
      ],
      opt,
    );
    plate(ctx, -px(RB.chestHalf), top - px(0.06), px(RB.chestHalf * 2), px(0.12), hot); // 칼라
    // 가슴 V — 코어를 가리키게 내려온다
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * px(0.34), top + px(0.08));
      ctx.rotate(side * 0.55);
      plate(ctx, -2, 0, 4, px(0.34), hot);
      ctx.restore();
    }
    // 코어실 — 코어(반지름 11 고정)가 어느 크기에서도 들어가되 가슴 밖으로는 안 나가야 한다
    const hs = housingHalf(r);
    plate(ctx, -hs, -hs, hs * 2, hs * 2, { hurt, face: VINYL, lit: METAL });
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        plate(ctx, sx > 0 ? hs - 6 : -hs, sy > 0 ? hs - 6 : -hs, 6, 6, hot);
      }
    }
    // 가슴 양옆 — 코어실 옆에 자리가 남을 때만 (작은 몸에서는 armorCover 가 알아서 건너뛴다)
    const strip = px(RB.chestHalf) - hs;
    for (const [i, side] of [-1, 1].entries()) {
      armorCover(ctx, ALBUMS[i === 0 ? 5 : 12], side * (hs + strip / 2), -px(0.06), strip - 2, hurt);
    }
    // 허리 통풍구
    for (let i = 0; i < 3; i++) plate(ctx, -px(0.22), bot - px(0.16) + i * px(0.06), px(0.44), 2, opt);
    // 골반
    plate(ctx, -px(0.3), bot - 1, px(0.6), px(RB.thighTop - RB.chestBot) + 2, opt);
    plate(ctx, -px(0.3), bot + 1, px(0.6), 2, hot);
  });

  // ── 견갑 (원반 반쪽) ──
  slam(ctx, P(2), 0, 0, () => {
    for (const [i, side] of [-1, 1].entries()) {
      const off = side * (1 - P(2)) * px(2.6);
      pauldron(
        ctx,
        side * px(RB.padX) + off,
        px(RB.padY),
        px(RB.padR),
        side,
        hurt ? '#ffffff' : color,
        hurt,
        ALBUMS[i === 0 ? 3 : 11],
      );
    }
  });

  // ── 머리 ──
  slam(ctx, P(4), 0, -80, () => {
    const top = px(RB.headTop);
    const bot = px(RB.headBot);
    const hw = px(RB.headHalf);
    plate(ctx, -px(0.08), bot - 2, px(0.16), px(0.1), opt); // 목
    // 헬멧은 어둡게. 몸과 같은 금속색으로 칠하면 얼굴이 아니라 어깨 사이 혹으로 보인다.
    wedge(ctx, [[-hw + 2, top], [hw - 2, top], [hw, bot], [-hw, bot]], { hurt, face: DARK, lit: LIT });
    for (const side of [-1, 1]) plate(ctx, side > 0 ? hw - 1 : -hw - px(0.09), top + px(0.1), px(0.1), px(0.18), hot); // 통풍구
    plate(ctx, -hw + 2, bot - px(0.08), hw * 2 - 4, px(0.08), opt); // 턱
    // 바이저 한 줄 — 눈 두 칸보다 이쪽이 기계다. 어두운 헬멧 위라야 켜진 게 보인다.
    const vy = Math.round(top + px(0.13));
    const vh = Math.max(2, Math.round(px(0.11)));
    ctx.save();
    ctx.fillStyle = hurt ? '#ffffff' : color;
    ctx.globalAlpha *= done ? 1 : 0.4;
    ctx.fillRect(Math.round(-hw + 2), vy - 1, Math.round(hw * 2 - 4), vh + 2);
    ctx.fillStyle = hurt ? '#ffffff' : done ? '#ffffff' : LIT;
    ctx.globalAlpha *= done ? 0.6 + Math.sin(time * 5) * 0.2 : 0.6;
    ctx.fillRect(Math.round(-hw + 3), vy, Math.round(hw * 2 - 6), vh);
    ctx.restore();
    // 크레스트 — 실루엣을 위로 찢는다
    plate(ctx, -px(0.05), px(RB.crestTop), px(0.1), px(RB.headTop - RB.crestTop) + 2, hot);
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * px(0.12), top + 1);
      ctx.rotate(side * 0.5);
      plate(ctx, -2, -px(0.2), 4, px(0.22), hot);
      ctx.restore();
    }
  });

  ctx.restore();
}

/**
 * 강아지 공주가 갇힌 새장. 오프닝에서 채간 뒤로 합체 컷신·보스전 내내 여기 있다가,
 * 보스가 터질 때 부서진다. cx, cy 는 새장 한가운데.
 *
 * broken 이 0보다 크면 창살이 튀어나가고 그녀가 떨어진다 (0~1).
 */
function drawCage(ctx, cx, cy, time, broken = 0) {
  const w = 26;
  const h = 26;
  const x = Math.round(cx - w / 2);
  const y = Math.round(cy - h / 2);

  // 부서지는 동안에는 그녀가 아래로 떨어진다
  const fall = broken > 0 ? ease(broken) * 40 : 0;
  const sway = broken > 0 ? 0 : Math.sin(time * 2) * 1.5;

  ctx.save();
  // 매달린 줄
  if (broken <= 0) {
    ctx.fillStyle = '#5c4a70';
    ctx.fillRect(Math.round(cx), y - 14, 1, 14);
  }

  drawSprite(ctx, BRIDE, Math.round(cx - 10), Math.round(y + 4 + sway + fall));

  // 창살 — 부서지면 사방으로 튄다
  ctx.globalAlpha = Math.max(0, 1 - broken * 1.4);
  ctx.strokeStyle = '#d8dde8';
  ctx.lineWidth = 1;
  const burst = broken * 26;
  ctx.strokeRect(x + 0.5 - burst * 0.3, y + 0.5 - burst * 0.3, w - 1 + burst * 0.6, h - 1 + burst * 0.6);
  for (let i = 1; i < 4; i++) {
    const bx = Math.round(x + (w * i) / 4) + 0.5;
    ctx.beginPath();
    ctx.moveTo(bx + (i - 2) * burst, y - burst * 0.3);
    ctx.lineTo(bx + (i - 2) * burst * 1.6, y + h + burst * 0.3);
    ctx.stroke();
  }
  ctx.restore();
}

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
    const p = Math.min(1, (t - PHASE2_AT.split) / 1.1);
    drawQuarters(ctx, CUT_CX, CUT_CY, r, p * p * (3 - 2 * p), time);
  } else {
    const amp = phase === 'crack' ? 3 : 1.4;
    drawBossDisc(ctx, CUT_CX + Math.sin(time * 57) * amp, CUT_CY + Math.cos(time * 63) * amp, r, time * 0.8);
    if (phase === 'crack') drawCracks(ctx, CUT_CX, CUT_CY, r, Math.min(1, (t - PHASE2_AT.crack) / 0.7));
  }
    // 조각들이 빠져나가 텅 빈 한가운데에 박는다
  if (phase === 'title') drawCutTitle(ctx, 'PHASE 2', t - PHASE2_AT.title, 4, 92);
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
/** 합체 단계들 — 차트를 조작한 뒤 조각들이 불려와 로봇이 된다 */
const P3_ROBOT = ['call', 'assemble', 'lock', 'core', 'title'];

function drawPhase3Cut(ctx, t, phase, time) {
  if (phase === 'shake') {
    drawBossDisc(ctx, CUT_CX + Math.sin(time * 61) * 3, CUT_CY, 40, time * 0.8);
    return;
  }

  if (P3_ROBOT.includes(phase)) {
    drawCombine(ctx, t, phase, time);
    // 다 붙고 나서 찍는다
    if (phase === 'title') drawCutTitle(ctx, 'PHASE 3', t - PHASE3_AT.title, 4, 14);
    return;
  }

  drawFakeChart(ctx, t, phase, time);
}

/** 한가운데서 뻗어나가는 집중선 */
function drawRays(ctx, cx, cy, spin, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.rotate(spin);
  ctx.fillStyle = color;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 340, a, a + Math.PI / 13);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** 2페이즈에서 갈라져 나간 조각 하나 (한가운데가 원점) */
function drawQuarterPiece(ctx, i, rr) {
  const a0 = i * (Math.PI / 2) - Math.PI / 4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, rr, a0, a0 + Math.PI / 2);
  ctx.closePath();
  ctx.fillStyle = VINYL;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#ff5d8f';
  ctx.stroke();
  for (let k = 0; k < 3; k++) {
    const a = a0 + (Math.PI / 2) * ((k + 0.5) / 3);
    const d = rr * 0.6;
    drawCoverAt(ctx, ALBUMS[(i * 4 + k) % ALBUMS.length], Math.cos(a) * d - 5, Math.sin(a) * d - 5, 10);
  }
}

/**
 * 집합 컷 — 조각 넷이 **각자의 칸**에서 정면으로 달려온다.
 * 넷을 한 화면에 흩어놓으면 그냥 떠다니는 걸로 보인다. 칸을 나눠야 "모인다"가 된다.
 */
function drawFormation(ctx, p, time) {
  const gw = VIEW.w / 2;
  const gh = VIEW.h / 2;
  for (let i = 0; i < 4; i++) {
    const x0 = (i % 2) * gw;
    const y0 = Math.floor(i / 2) * gh;
    const lead = clamp01(p * 1.4 - i * 0.1);
    const shear = 10;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0 + 2 + shear, y0 + 2);
    ctx.lineTo(x0 + gw - 2, y0 + 2);
    ctx.lineTo(x0 + gw - 2 - shear, y0 + gh - 2);
    ctx.lineTo(x0 + 2, y0 + gh - 2);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = '#0b0616';
    ctx.fillRect(x0, y0, gw, gh);
    drawRays(ctx, x0 + gw / 2, y0 + gh / 2, time * 1.5 + i, '#7c5cff', 0.22);
    ctx.save();
    ctx.translate(x0 + gw / 2, y0 + gh / 2);
    const s = 0.55 + lead * 1.5;
    ctx.scale(s, s);
    ctx.rotate(Math.sin(time * 3 + i) * 0.07);
    drawQuarterPiece(ctx, i, 26);
    ctx.restore();
    ctx.restore();
  }
}

/** 원반이 반으로 쩍 갈라진다 — 이 두 쪽이 어깨 견갑이 된다 */
function drawDiscSplit(ctx, cx, cy, r, p, time) {
  const gap = ease(p) * r * 0.55;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(cx + side * gap, cy);
    ctx.rotate(side * ease(p) * 0.45);
    ctx.beginPath();
    if (side < 0) ctx.arc(0, 0, r, Math.PI / 2, Math.PI * 1.5);
    else ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
    ctx.closePath();
    ctx.clip();
    drawBossDisc(ctx, 0, 0, r, time * 0.6);
    ctx.restore();
  }
}

/**
 * 조립 진행 — 부위 하나가 꽂히고, 번쩍하고, 다음까지 **멈춘다.**
 *
 * 매끄럽게 자라면 합체로 안 보인다. 칸의 앞 4분의 1 동안만 날아와 꽂히고
 * 나머지는 정지 — 그 정지가 "철컥"으로 읽힌다.
 * 시각은 PHASE3_AT 에서만 온다.
 */
function assembleAt(t) {
  const STEP_IN = 0.25;
  let i;
  let frac;
  let stepDur;
  if (t < PHASE3_AT.lock) {
    // assemble 구간을 넷으로 — 다리 · 몸통 · 견갑 · 팔
    stepDur = (PHASE3_AT.lock - PHASE3_AT.assemble) / 4;
    const s = (t - PHASE3_AT.assemble) / stepDur;
    i = Math.min(3, Math.max(0, Math.floor(s)));
    frac = clamp01(s - i);
  } else {
    // lock — 머리와 크레스트, 마지막 하나
    stepDur = PHASE3_AT.core - PHASE3_AT.lock;
    i = 4;
    frac = clamp01((t - PHASE3_AT.lock) / stepDur);
  }
  const q = Math.min(1, frac / STEP_IN);
  const since = Math.max(0, frac - STEP_IN) * stepDur;
  const hit = q >= 1 ? Math.max(0, 1 - since / 0.14) : 0;
  return { grow: (i + q) * 0.2, flash: hit, jolt: Math.sin(since * 70) * 3 * hit };
}

/** 다 붙은 로봇 뒤로 터지는 폭발들 — 이유는 없다. 원래 뒤에서 터진다. */
function drawBlasts(ctx, since, cy) {
  const spots = [[-72, -34], [70, -26], [-48, 28], [54, 36], [4, -58], [-90, 8]];
  ctx.save();
  spots.forEach(([dx, dy], i) => {
    const p = (since - i * 0.12) / 0.42;
    if (p <= 0 || p >= 1) return;
    const rr = 6 + p * 26;
    ctx.globalAlpha = 1 - p;
    // 동그라미로 그리면 행성처럼 보인다 — 삐죽삐죽해야 폭발이다
    ctx.fillStyle = i % 2 ? '#ffd166' : '#ff5d8f';
    ctx.beginPath();
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2 + i;
      const d = k % 2 ? rr : rr * 0.55;
      const fx = CUT_CX + dx + Math.cos(a) * d;
      const fy = cy + dy + Math.sin(a) * d;
      if (k === 0) ctx.moveTo(fx, fy);
      else ctx.lineTo(fx, fy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = Math.max(0, 1 - p * 2.4);
    ctx.beginPath();
    ctx.arc(CUT_CX + dx, cy + dy, rr * 0.4, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

/**
 * 합체. 조각이 각자 칸에서 달려오고, 부위가 하나씩 철컥철컥 잠기고,
 * 코어에 불이 들어오고, 폭발을 등지고 선다.
 *
 * grow 는 조립 진행도라 그리는 쪽(drawRobotBody)이 부위를 순서대로 붙이는 데 쓴다.
 * 시각은 PHASE3_AT 에서만 온다 — 타임라인을 고치면 여기도 따라온다.
 */
function drawCombine(ctx, t, phase, time) {
  const cy = CUT_CY + 6;
  // 합체 컷신의 몸은 크게 — 이 컷의 요점이 "커졌다" 이다
  const r = 52;

  if (phase === 'call') {
    const p = clamp01((t - PHASE3_AT.call) / (PHASE3_AT.assemble - PHASE3_AT.call));
    // 앞 7할은 형성 컷, 뒤 3할은 원반이 갈라지는 컷. 사이는 뚝 끊는다.
    if (p < 0.7) {
      drawFormation(ctx, p / 0.7, time);
    } else {
      drawRays(ctx, CUT_CX, cy, time * 1.2, '#7c5cff', 0.28);
      drawDiscSplit(ctx, CUT_CX, cy, r, (p - 0.7) / 0.3, time);
    }
    return;
  }

  const assembling = phase === 'assemble' || phase === 'lock';
  const { grow, flash, jolt } = assembling ? assembleAt(t) : { grow: 1, flash: 0, jolt: 0 };

  drawRays(ctx, CUT_CX, cy, time * 0.9, '#7c5cff', 0.2);
  if (phase === 'title') drawBlasts(ctx, t - PHASE3_AT.title, cy);

  ctx.save();
  ctx.translate(Math.round(CUT_CX + jolt), cy);
  drawRobotBody(ctx, r, time, '#7c5cff', grow);
  ctx.restore();

  if (phase === 'core' || phase === 'title') {
    // 코어 점화 — 에너지 링이 밖으로 퍼진다
    const lit = ease((t - PHASE3_AT.core) / 0.6);
    for (const ring of [0, 0.35]) {
      const q = clamp01((t - PHASE3_AT.core) / 0.9 - ring);
      if (q <= 0 || q >= 1) continue;
      ctx.save();
      ctx.globalAlpha = 1 - q;
      ctx.strokeStyle = '#39ff9a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(CUT_CX, cy, 12 + q * 80, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    drawBossCore(ctx, CUT_CX, cy, true, time);
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - lit) * 0.8;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    ctx.restore();
  } else {
    if (grow >= 0.4) drawBossCore(ctx, CUT_CX + jolt, cy, false, time);
    // 부위가 꽂힐 때마다 화면이 한 번 하얘진다
    if (flash > 0) {
      ctx.save();
      ctx.globalAlpha = flash * 0.55;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, VIEW.w, VIEW.h);
      ctx.restore();
    }
  }
}

function drawFakeChart(ctx, t, phase, time) {
  const x = 62;
  const w = VIEW.w - 124;
  const rowH = 21;
  const top = 34;
  const slide = Math.min(1, (t - PHASE3_AT.chart) / 0.45);

  ctx.save();
  ctx.translate((1 - slide) * VIEW.w, 0);
  ctx.fillStyle = 'rgba(6,2,14,0.92)';
  ctx.fillRect(x - 8, top - 10, w + 16, rowH * 6 + 16);
  ctx.strokeStyle = '#7c5cff';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 7.5, top - 9.5, w + 15, rowH * 6 + 15);

  const rig = phase === 'chart' ? 0 : Math.min(1, (t - PHASE3_AT.rig) / 1.0);
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

// ── 엔딩 2부: 결혼식 ────────────────────────────────────────
// 차트 순위표가 그대로 결혼식장이 된다. 줄 서 있던 앨범들이 하객이 되고,
// 1위 자리는 꽃 아치 아래가 된다.

const WEDDING = ['aisle', 'bride', 'vow', 'ring', 'kiss'];
const isWedding = (phase) => WEDDING.includes(phase);

/** 0→1 로 부드럽게 */
const ease = (p) => {
  const q = Math.min(1, Math.max(0, p));
  return q * q * (3 - 2 * q);
};

/** 꽃 아치 — 분홍·흰 꽃송이를 반원으로 얹는다 */
function drawArch(ctx, cx, cy, r, grow) {
  ctx.save();
  ctx.globalAlpha *= grow;
  // 기둥 둘
  ctx.fillStyle = '#5b8f4a';
  ctx.fillRect(cx - r - 3, cy - 4, 4, 46);
  ctx.fillRect(cx + r - 1, cy - 4, 4, 46);
  // 아치를 따라 꽃
  const n = 15;
  for (let i = 0; i <= n; i++) {
    const a = Math.PI + (i / n) * Math.PI;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r * 0.85;
    if (i / n > grow) break;
    ctx.fillStyle = '#4f8a42';
    ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 5, 5);
    ctx.fillStyle = i % 3 === 0 ? '#fff6ef' : '#ff9ec4';
    ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
  }
  ctx.restore();
}

/** 흩날리는 꽃잎 */
function drawPetals(ctx, time, amount) {
  ctx.save();
  for (let i = 0; i < 34; i++) {
    if (i / 34 > amount) break;
    const speed = 14 + noise(i, 21) * 22;
    const x = (noise(i, 22) * VIEW.w + Math.sin(time * 0.8 + i) * 12) % VIEW.w;
    const y = ((time * speed + noise(i, 23) * 240) % (VIEW.h + 20)) - 10;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = i % 4 === 0 ? '#fff6ef' : i % 4 === 1 ? '#ffd166' : '#ff9ec4';
    ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
  }
  ctx.restore();
}

/** 버진로드와 양옆에 늘어선 하객(앨범 열일곱 장) */
function drawVenue(ctx, t, time, grow) {
  const floor = CHART_TOP + 3 * CHART_ROW;
  ctx.save();
  ctx.globalAlpha *= grow;

  // 붉은 카펫
  ctx.fillStyle = '#8e2340';
  ctx.fillRect(0, floor, VIEW.w, 26);
  ctx.fillStyle = '#c33a5c';
  ctx.fillRect(0, floor + 2, VIEW.w, 20);
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(0, floor + 2, VIEW.w, 1);
  ctx.fillRect(0, floor + 21, VIEW.w, 1);

  // 하객 — 카펫 양옆에 줄지어 앉는다
  for (let i = 0; i < ALBUMS.length; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const rank = Math.floor(i / 2);
    const x = VIEW.w / 2 + side * (58 + rank * 34);
    const bob = Math.sin(time * 3 + i) * 1.5;
    drawCoverAt(ctx, ALBUMS[i], x - 7, floor - 18 + bob, 14);
  }
  ctx.restore();
  return floor;
}

/** 왕관 쓴 주인공과 연갈색 말티푸 공주 */
function drawCouple(ctx, t, phase, time, floor) {
  const cx = VIEW.w / 2;
  const standY = floor - 12;

  // 신부는 오른쪽에서 걸어 들어와 가운데에 선다
  const walk = ease((t - ENDING_AT.bride) / (ENDING_AT.vow - ENDING_AT.bride));
  const brideX = phase === 'aisle' ? VIEW.w + 20 : VIEW.w + 20 + (cx + 10 - (VIEW.w + 20)) * walk;
  // 신랑은 반대쪽으로 조금 물러나 자리를 만든다
  const groomX = cx - 22 + (phase === 'aisle' ? 0 : 0);

  // 걷는 동안에는 살짝 통통 튄다
  const hop = phase === 'bride' ? Math.abs(Math.sin(time * 7)) * 2 : 0;

  drawSprite(ctx, playerFrame({ onGround: true, vx: 0 }), groomX, standY - 4);
  drawCrown(ctx, groomX + 1, standY - 13, time);
  // 나비넥타이
  ctx.fillStyle = '#2b1d12';
  ctx.fillRect(Math.round(groomX) + 4, Math.round(standY) + 3, 4, 2);

  // 발이 카펫에 정확히 닿게 — 스프라이트 키가 바뀌어도 따라오도록 높이에서 뺀다
  drawSprite(ctx, BRIDE, Math.round(brideX), Math.round(floor - BRIDE.h - hop));

  // 반지가 둘 사이에 떠오른다
  if (phase === 'ring' || phase === 'kiss') {
    const rise = ease((t - ENDING_AT.ring) / 0.8);
    const y = standY - 4 - rise * 16 + Math.sin(time * 3) * 1.5;
    drawSprite(ctx, RING, cx - 3, Math.round(y));
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#fff6ef';
    for (let i = 0; i < 6; i++) {
      const a = time * 2.5 + (i / 6) * Math.PI * 2;
      if (Math.sin(a * 3) < 0) continue;
      ctx.fillRect(Math.round(cx + Math.cos(a) * 12), Math.round(y + 3 + Math.sin(a) * 9), 1, 1);
    }
    ctx.restore();
  }

  // 마지막엔 커다란 하트
  if (phase === 'kiss') {
    const pop = ease((t - ENDING_AT.kiss) / 0.5);
    drawHeart(ctx, cx, standY - 26, 10 * pop, time);
  }
}

/** 픽셀 하트 */
function drawHeart(ctx, cx, cy, r, time) {
  if (r <= 0) return;
  const beat = 1 + Math.sin(time * 5) * 0.08;
  const s = r * beat;
  ctx.save();
  ctx.fillStyle = '#ff4d7d';
  ctx.beginPath();
  ctx.arc(cx - s * 0.5, cy - s * 0.3, s * 0.55, 0, Math.PI * 2);
  ctx.arc(cx + s * 0.5, cy - s * 0.3, s * 0.55, 0, Math.PI * 2);
  ctx.moveTo(cx - s, cy - s * 0.1);
  ctx.lineTo(cx, cy + s);
  ctx.lineTo(cx + s, cy - s * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ff9ec4';
  ctx.fillRect(Math.round(cx - s * 0.55), Math.round(cy - s * 0.5), Math.max(1, Math.round(s * 0.25)), 2);
  ctx.restore();
}

/** 축포 — 마지막에 터진다 */
function drawConfetti(ctx, t, time) {
  const since = t - ENDING_AT.kiss;
  if (since < 0) return;
  ctx.save();
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2 + noise(i, 31) * 0.6;
    const speed = 40 + noise(i, 32) * 90;
    const x = VIEW.w / 2 + Math.cos(a) * speed * since;
    const y = VIEW.h / 2 + Math.sin(a) * speed * since * 0.7 + since * since * 40;
    if (y > VIEW.h) continue;
    ctx.globalAlpha = Math.max(0, 1 - since / 3);
    ctx.fillStyle = ['#ffd166', '#ff9ec4', '#7ee0a0', '#8fbaff', '#fff6ef'][i % 5];
    ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
  }
  ctx.restore();
}

/** 결혼식 전체 */
function drawWedding(ctx, t, phase, time) {
  const grow = ease((t - ENDING_AT.aisle) / 1.0);
  const floor = drawVenue(ctx, t, time, grow);
  drawArch(ctx, VIEW.w / 2, CHART_TOP + CHART_ROW, 40, ease((t - ENDING_AT.aisle) / 1.4));
  drawCouple(ctx, t, phase, time, floor);
  drawPetals(ctx, time, phase === 'aisle' ? grow * 0.5 : 1);
  if (phase === 'kiss') drawConfetti(ctx, t, time);
}

function drawEndingCut(ctx, t, phase, time) {
  if (isWedding(phase)) {
    drawWedding(ctx, t, phase, time);
    return;
  }
  if (phase === 'crack') {
    const p = Math.min(1, t / ENDING_AT.burst);
    drawBossDisc(ctx, CUT_CX + Math.sin(time * 70) * p * 3, CUT_CY, 40, time * 0.6);
    drawCracks(ctx, CUT_CX, CUT_CY, 40, p);
    // 아직 갇혀 있다. 이 다음 컷에서 부서진다.
    drawCage(ctx, CUT_CX, CUT_CY - 60, time);
    return;
  }

  if (phase === 'burst') {
    const p = Math.min(1, (t - ENDING_AT.burst) / 0.8);
    ctx.save();
    ctx.fillStyle = `rgba(255,255,255,${(1 - p) * 0.9})`;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    ctx.restore();
  }

  // 보스가 터지면 새장도 같이 부서진다 — 격파가 곧 구출이다
  if (phase === 'burst' || phase === 'scatter') {
    const broken = Math.min(1, (t - ENDING_AT.burst) / 1.4);
    drawCage(ctx, CUT_CX, CUT_CY - 60, time, broken);
  }

  // 앨범 열일곱 장: 흩어진 자리 → 차트 줄
  const spread = phase === 'burst' ? Math.min(1, (t - ENDING_AT.burst) / 0.8) : 1;
  const line = ['chartline', 'empty', 'climb', 'crown'].includes(phase) ? Math.min(1, (t - ENDING_AT.chartline) / 1.4) : 0;
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
    const p = phase === 'crown' ? 1 : Math.min(1, (t - ENDING_AT.climb) / 1.0);
    const px = CHART_X + 40;
    const py = VIEW.h - 30 + (y + 1 - (VIEW.h - 30)) * p;
    drawSprite(ctx, playerFrame({ onGround: p >= 1, vx: 0 }), px, py);
    if (phase === 'crown') drawCrown(ctx, px + 1, py - 9, time);
  }
  ctx.restore();

  if (phase === 'crown') drawCutTitle(ctx, '#1', t - ENDING_AT.crown, 5, 6);
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

// ── 오프닝: 방구석 → 차트 밑바닥 → 달리기 ───────────────────
// 대사는 없다. 왜 달리는지는 화면이 말한다.

/** 오프닝 차트 한 줄의 크기 */
const IN_X = 52;
const IN_W = 280;
const IN_ROW = 26;
/** 내가 걸린 맨 아랫줄의 화면상 y */
const IN_MINE_Y = 158;
/** 방 안 책상의 왼쪽 끝 */
const ROOM_DESK_X = 34;
/** 방 안에서 내가 서 있는 자리 (바닥 176 에 발이 닿는다) */
const ROOM_ME_X = 214;
const ROOM_ME_Y = 160;
/** 그 옆의 강아지 공주 (20×20 이라 바닥에서 20 을 뺀다) */
const ROOM_HER_X = 180;
const ROOM_HER_Y = 156;

/** 좁은 방 — 벽, 창문, 책상, 그 위의 마이크 */
function drawRoom(ctx, time) {
  const floor = 176;
  ctx.fillStyle = '#241a33';
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  // 벽지 세로줄
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  for (let x = 0; x < VIEW.w; x += 12) ctx.fillRect(x, 0, 5, floor);

  // 창문 — 바깥은 밤이고, 별이 몇 개 떠 있다
  ctx.fillStyle = '#0d0a1a';
  ctx.fillRect(46, 34, 62, 48);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 7; i++) {
    if (Math.sin(time * 1.6 + i * 2.1) < 0.1) continue;
    ctx.fillRect(50 + ((i * 23) % 54), 38 + ((i * 17) % 40), 1, 1);
  }
  ctx.fillStyle = '#4a3566';
  ctx.fillRect(46, 34, 62, 2);
  ctx.fillRect(46, 80, 62, 2);
  ctx.fillRect(75, 34, 2, 48);

  // 바닥
  ctx.fillStyle = '#191026';
  ctx.fillRect(0, floor, VIEW.w, VIEW.h - floor);
  ctx.fillStyle = '#2e2140';
  ctx.fillRect(0, floor, VIEW.w, 2);

  // 책상은 왼쪽에 — 오른쪽을 비워둬야 마지막에 그리로 달려나갈 수 있다
  ctx.fillStyle = '#3b2a18';
  ctx.fillRect(ROOM_DESK_X, 150, 112, 6);
  ctx.fillStyle = '#2a1e11';
  ctx.fillRect(ROOM_DESK_X + 6, 156, 5, 20);
  ctx.fillRect(ROOM_DESK_X + 101, 156, 5, 20);
  // 스툴 — 옆에서 본 모양. 세로 기둥에 가로대를 걸치면 십자가처럼 보인다.
  // 벽(#241a33)보다 확실히 밝아야 다리가 보인다 — 같은 색이면 좌석만 떠 있다.
  ctx.fillStyle = '#4a3566';
  ctx.fillRect(ROOM_DESK_X + 118, 160, 20, 3);
  ctx.fillStyle = '#3d2c58';
  ctx.fillRect(ROOM_DESK_X + 121, 163, 3, 13);
  ctx.fillRect(ROOM_DESK_X + 132, 163, 3, 13);
  return floor;
}

/** 커버 위에 뜨는 눈 — 앨범이 나를 내려다본다 */
function drawWatchingEyes(ctx, x, y, size, time, look) {
  const w = Math.max(2, Math.round(size / 5));
  const ey = Math.round(y + size * 0.4);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(Math.round(x + size * 0.18), ey, w, w);
  ctx.fillRect(Math.round(x + size * 0.6), ey, w, w);
  ctx.fillStyle = '#101018';
  const drop = Math.round(w * 0.4 + Math.sin(time * 2) * 0.5);
  ctx.fillRect(Math.round(x + size * 0.18), ey + drop, w - 1, w - drop);
  ctx.fillRect(Math.round(x + size * 0.6), ey + drop, w - 1, w - drop);
  if (look) {
    // 찌푸린 눈썹 — 반갑지 않다는 뜻
    ctx.fillStyle = '#ff2e63';
    ctx.fillRect(Math.round(x + size * 0.16), ey - 3, w + 1, 1);
    ctx.fillRect(Math.round(x + size * 0.58), ey - 3, w + 1, 1);
  }
}

/** 앨범이 박힌 차트 한 줄 */
function drawIntroRow(ctx, y, album, ratio, time, watching) {
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(IN_X, y, IN_W, IN_ROW - 6);
  drawCoverAt(ctx, album, IN_X + 6, y + 1, 18);
  if (watching) drawWatchingEyes(ctx, IN_X + 6, y + 1, 18, time, true);
  ctx.fillStyle = '#7c5cff';
  ctx.fillRect(IN_X + 30, y + 5, Math.max(2, (IN_W - 40) * ratio), 10);
}

/** 내가 걸린 맨 아랫줄 — #100 */
function drawMineRow(ctx, y, time, glow) {
  ctx.fillStyle = '#1b0a20';
  ctx.fillRect(IN_X, y, IN_W, IN_ROW - 6);
  ctx.strokeStyle = glow ? '#ffd166' : '#6b3a8f';
  ctx.lineWidth = 1;
  ctx.strokeRect(IN_X + 0.5, y + 0.5, IN_W - 1, IN_ROW - 7);
  drawSprite(ctx, playerFrame({ onGround: true, vx: 0 }), IN_X + 8, y - 2);
  drawBigTextCentered(ctx, '#100', IN_X + 74, y + 4, 2, '#ffd166', null);
  ctx.fillStyle = '#4a2a66';
  ctx.fillRect(IN_X + 122, y + 5, 8, 10);
}

export function drawIntroCut(ctx, t) {
  const phase = phaseAtIn(INTRO_CUT, t, 'room');
  const time = t;
  ctx.fillStyle = '#0a0410';
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);

  // ── 1부: 방 ──────────────────────────────────────────────
  const inRoom = ['room', 'note', 'upload'].includes(phase);
  const snatching = phase === 'snatch' || phase === 'reach';
  const grabbing = phase === 'grab' || phase === 'run';
  if (inRoom || snatching || grabbing) {
    drawRoom(ctx, time);
    const px = ROOM_ME_X;
    const py = ROOM_ME_Y;

    // 강아지 공주 — 원래 옆에 같이 있다. 앨범이 채가면 위로 끌려 올라간다.
    if (!grabbing) {
      // 앨범이 내려와 붙잡기까지 0.5초, 그 뒤로 같이 올라간다.
      // 너무 빨리 올리면 데려가는 앨범이 화면 밖으로 나가서 "누가 데려갔는지" 가 사라진다.
      const dive = snatching ? Math.min(1, (t - INTRO_AT.snatch) / 0.5) : 0;
      const lift = snatching ? ease((t - INTRO_AT.snatch - 0.5) / 1.6) : 0;
      // 음표가 나오면 좋아서 폴짝 뛴다
      const hop = phase === 'note' ? Math.abs(Math.sin(time * 6)) * 4 : 0;
      const herY = ROOM_HER_Y - hop - lift * 130;
      // 잡힌 뒤에는 버둥거린다
      const shake = lift > 0 ? Math.sin(time * 30) * 2 : 0;
      drawSprite(ctx, BRIDE, Math.round(ROOM_HER_X + shake), Math.round(herY));

      // 채가는 앨범 — 위(차트)에서 내려와 머리 위를 잡고 도로 올라간다
      if (snatching) {
        const rest = ROOM_HER_Y - 22;
        drawCoverAt(ctx, ALBUMS[0], ROOM_HER_X + shake, -26 + dive * (rest + 26) - lift * 130, 20);
        // 끌려 올라가는 자국
        if (lift > 0) {
          ctx.save();
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = '#e8ecf7';
          for (let i = 0; i < 3; i++) {
            const sy = herY + 24 + ((time * 90 + i * 18) % 44);
            ctx.fillRect(Math.round(ROOM_HER_X + 4 + i * 6), Math.round(sy), 1, 6);
          }
          ctx.restore();
        }
      }
    }

    // 책상 위 마이크 (쥐기 전까지만)
    if (!grabbing) {
      ctx.save();
      ctx.translate(ROOM_DESK_X + 52, 138);
      drawMicShape(ctx, 12);
      ctx.restore();
    }

    // 달려나가는 동안에는 오른쪽으로 빠진다
    const runP = phase === 'run' ? ease((t - INTRO_AT.run) / 1.2) : 0;
    const x = px + runP * 160;
    // 놓칠 때는 그녀 쪽으로 뛰어오른다 — 가만히 서 있으면 "놓쳤다" 로 안 읽힌다.
    // 점프 프레임(팔다리를 뻗은 자세)에 실제로 뛰는 포물선을 얹는다.
    const reaching = phase === 'reach';
    const jumpP = reaching ? Math.min(1, (t - INTRO_AT.reach) / 0.9) : 0;
    const hopUp = reaching ? Math.sin(jumpP * Math.PI) * 18 : 0;
    const frame = playerFrame({
      onGround: !reaching,
      vx: phase === 'run' ? 90 : 0,
      animTime: time,
    });
    // 뻗는 동안에는 그녀 쪽(왼쪽)을 본다
    drawSprite(ctx, frame, x - reaching * 10, py - hopUp, reaching);

    // 쥔 마이크
    if (grabbing) {
      ctx.save();
      ctx.translate(Math.round(x) + 12, Math.round(py) + 4);
      drawMicShape(ctx, 9);
      ctx.restore();
    }

    // 음표가 마이크 위로 떠올랐다가, 위로 빨려 올라간다 — 곡이 나왔고, 올렸다
    if (phase === 'note' || phase === 'upload') {
      const rise = phase === 'upload' ? ease((t - INTRO_AT.upload) / 0.9) : 0;
      const ny = 126 - rise * 150 + Math.sin(time * 4) * 2;
      ctx.save();
      ctx.globalAlpha = 1 - rise * 0.3;
      drawSprite(ctx, NOTE, ROOM_DESK_X + 54, ny);
      ctx.restore();
    }

    // 흩어져 있던 음표들이 손으로 모인다
    if (grabbing) {
      const pull = ease((t - INTRO_AT.grab) / 1.0);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const d = (1 - pull) * (44 + noise(i, 40) * 26);
        ctx.save();
        ctx.globalAlpha = 0.35 + pull * 0.65;
        drawSprite(ctx, NOTE, x + 2 + Math.cos(a) * d, py + Math.sin(a) * d * 0.8);
        ctx.restore();
      }
    }
    return;
  }

  // ── 2부: 차트 ────────────────────────────────────────────
  // 위에서 내려오고, 그 다음 위로 훑는다 (훑기는 차트를 아래로 미는 것이다).
  // 훑는 폭은 한 줄 반뿐이다 — 내 줄이 화면 밖으로 나가면
  // "내가 밑바닥이다" 라는 그림 자체가 사라진다.
  const drop = ease((t - INTRO_AT.chart) / 0.9);
  const scan = phase === 'look' || phase === 'block' ? ease((t - INTRO_AT.look) / 1.4) : 0;
  const closing = phase === 'block' ? ease((t - INTRO_AT.block) / 1.0) : 0;

  ctx.save();
  ctx.translate(0, (1 - drop) * -VIEW.h + scan * IN_ROW * 1.6);

  // 내 위에 쌓인 앨범 줄. 위로 갈수록 순위가 높으니 막대도 길어진다 —
  // 거꾸로 그리면 위로 갈수록 초라해 보여서 그림이 뜻과 어긋난다.
  const ROWS = 14;
  for (let i = 0; i < ROWS; i++) {
    const y = IN_MINE_Y - (i + 1) * IN_ROW + closing * (i + 1) * 3;
    // 훑는 만큼 화면이 아래로 밀리므로, 그만큼은 위로 더 그려야 꼭대기가 안 빈다
    if (y + IN_ROW * 2 < -IN_ROW) continue;
    ctx.save();
    // 위쪽은 아직 못 본 세상이라 조금 흐리게
    ctx.globalAlpha = Math.max(0.4, 1 - i * 0.055);
    drawIntroRow(ctx, y, ALBUMS[i % ALBUMS.length], 0.34 + (i / (ROWS - 1)) * 0.62, time, phase === 'block');
    ctx.restore();
  }

  if (phase !== 'chart') drawMineRow(ctx, IN_MINE_Y, time, phase === 'bottom');
  ctx.restore();

  // 벽처럼 닫힐 때 화면이 눌리는 느낌
  if (closing > 0) {
    ctx.fillStyle = `rgba(6,2,14,${closing * 0.35})`;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
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
  // 스테이지 선택도 타이틀 배경 위에 뜬다 (판이 아직 없어서 그릴 월드가 없다)
  if (game.scene === 'title' || game.scene === 'select') {
    drawTitle(ctx, time);
    return;
  }
  if (game.scene === 'intro') {
    drawIntroCut(ctx, game.cutsceneTime);
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

  drawSky(ctx, stage, ox, time);
  drawParallax(ctx, stage, ox, time);
  // 3페이즈에서는 그 뒤로 거대 로봇이 버티고 선다 (원경 다음, 지형 앞)
  if (game.boss && bossCombined(game.boss)) drawGiantRobot(ctx, game.boss, ox, time);
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
  if (game.boss) {
    drawBoss(ctx, game.boss, ox, oy, time);
    drawLaser(ctx, game.boss, ox, oy, time, bossPhase(game.boss).color);
  }

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
