// 픽셀 월드를 캔버스에 그린다. 글자는 여기서 그리지 않는다 (한글은 DOM 이 맡는다).
//
// **바깥에서 부르는 입구는 drawScene 하나뿐이다** (ui/app.js). 그리는 코드가 한 파일에
// 4천 줄이라 주제별로 갈랐다 — 아래로 갈수록 기대는 쪽이다. 거꾸로 부르면 순환이 된다:
//
//   scene.js      배경·타일·판 위의 물체들 + drawScene (전체를 짜맞춘다)
//   sceneCuts.js  컷신 전부 (오프닝·합체·페이즈·엔딩·2회차)
//   sceneBoss.js  보스 몸 셋과 그 부속
//   sceneParts.js 셋이 같이 쓰는 조각 (색·장갑판·이징)
import { TILE } from '../core/physics.js';
import { T } from '../core/world.js';
import { cameraOffset } from '../core/camera.js';
import { drawAlbum, drawCoverAt } from './albumArt.js';
import { drawSprite, crisp, makeCanvas } from './pixel.js';
import { npcInReach, npcDancing, markKey, CEIL_BLADE, SLAB_HANG } from '../core/game.js';
import { npcFrame, npcSpin, npcBob, NPC_OFFSET } from './npcSprites.js';
import { talkTimeline } from '../data/npcTalk.js';
import { CAUGHT_CUT, CAUGHT_AT } from '../data/caughtCut.js';
import { playerFrame, setLook, PLAYER_OFFSET, NOTE, HEART, SHOT, SHOT_BOSS, DISC, BRIDE, RING } from './sprites.js';

/** 알갱이가 네모 대신 쓸 그림 (data/effects.js 의 shape 이름) */
const PARTICLE_SHAPES = { note: NOTE, heart: HEART };
import { ALBUMS } from '../data/albums.js';
import { VIEW } from '../core/game.js';
import {
  bossPhase,
  bossCombined,
  ceilingSlabs,
  laserBeams,
  tailBand,
  shockWaves,
  whirlGapX,
} from '../core/boss.js';
import { clamp01, ease, noise, band, beatKind, mixHex } from './sceneParts.js';
import {
  drawBoss,
  drawGiantRobot,
  drawMics,
  drawBossHealth,
  giantSize,
  giantCanvas,
} from './sceneBoss.js';
import { drawBossCut, drawCutTitle, drawCutscene, drawHardOpenCut, drawIntroCut } from './sceneCuts.js';
import { PLAYER } from '../core/player.js';

// ── 배경 ────────────────────────────────────────────────────
//
// 무대마다 하늘과 원경이 다르다. 어떤 그림을 그릴지는 stage.theme 이 고르고,
// 색은 stage.sky / far / ground 에서 온다 — 그림과 색을 따로 두면

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
    case 'ice':
      drawAurora(ctx, ox, time);
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

// ── 얼음 ────────────────────────────────────────────────────
/** 하늘에 천천히 흐르는 오로라 띠 */
function drawAurora(ctx, ox, time) {
  ctx.save();
  for (let L = 0; L < 3; L++) {
    ctx.globalAlpha = 0.13 - L * 0.03;
    ctx.fillStyle = L % 2 ? '#8fd8ff' : '#7cffd0';
    ctx.beginPath();
    ctx.moveTo(0, 20 + L * 16);
    for (let x = 0; x <= VIEW.w; x += 8) {
      const t = (x - ox * 0.05) * 0.02 + time * 0.3 + L;
      ctx.lineTo(x, 20 + L * 16 + Math.sin(t) * 9 + Math.sin(t * 2.1) * 4);
    }
    for (let x = VIEW.w; x >= 0; x -= 8) {
      const t = (x - ox * 0.05) * 0.02 + time * 0.3 + L;
      ctx.lineTo(x, 34 + L * 16 + Math.sin(t) * 9);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  drawStars(ctx, time);
}

/** 원경의 빙산 — 각진 실루엣이라 언덕과 확실히 다르게 읽힌다 */
function drawBergs(ctx, stage, ox) {
  ctx.save();
  ctx.fillStyle = stage.far;
  band(ox, 0.3, 56, (x, i) => {
    const h = 34 + ((i * 37) % 46);
    ctx.beginPath();
    ctx.moveTo(x - 26, VIEW.h - 34);
    ctx.lineTo(x - 6, VIEW.h - 34 - h);
    ctx.lineTo(x + 8, VIEW.h - 34 - h * 0.62);
    ctx.lineTo(x + 30, VIEW.h - 34);
    ctx.closePath();
    ctx.fill();
  });
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = stage.ground[0];
  ctx.fillRect(0, VIEW.h - 36, VIEW.w, 3);
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
    case 'ice':
      drawBergs(ctx, stage, ox);
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
    case T.ICE:
      // 얼음 — 미끄러워 보여야 밟기 전에 안다
      ctx.fillStyle = '#0a0512';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#4e7fa8';
      ctx.fillRect(x, y + 1, TILE - 1, TILE - 1);
      ctx.fillStyle = '#bfe6ff';
      ctx.fillRect(x, y, TILE, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(x + 2, y + 5, 5, 1);
      ctx.fillRect(x + 9, y + 9, 4, 1);
      break;
    case T.SPRING: {
      // 용수철 — 감긴 모양이라 "밟으면 튄다"가 그림으로 읽힌다
      ctx.fillStyle = '#0a0512';
      ctx.fillRect(x, y + 4, TILE, TILE - 4);
      ctx.fillStyle = '#39ff9a';
      ctx.fillRect(x + 1, y + 4, TILE - 2, 3);
      ctx.fillStyle = '#1c8f5a';
      for (let i = 0; i < 3; i++) ctx.fillRect(x + 3, y + 8 + i * 3, TILE - 6, 2);
      break;
    }
    case T.BLINK:
      // 켜져 있을 때만 그린다 — 꺼진 동안은 game 이 글자를 지우므로 여기 안 온다
      ctx.fillStyle = '#0a0512';
      ctx.fillRect(x, y, TILE, 7);
      ctx.fillStyle = '#8fd8ff';
      ctx.fillRect(x, y, TILE, 4);
      ctx.fillStyle = '#2d6f96';
      ctx.fillRect(x, y + 4, TILE, 2);
      break;
    case T.CEILSPIKE:
      // 천장에 붙은 채로는 평범한 천장인 척한다. 내려오는 건 drawCeilSpikes 가 그린다.
      ctx.fillStyle = '#0a0512';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = dark;
      ctx.fillRect(x, y, TILE - 1, TILE - 1);
      ctx.fillStyle = light;
      ctx.fillRect(x, y + TILE - 3, TILE, 3);
      break;
    default:
      break;
  }
}

/**
 * 시간에 따라 움직이는 칸. 이것만 매 프레임 새로 그리고, 나머지는 구워서 쓴다.
 */
const LIVE_TILES = new Set([T.ITEM, T.BAIT, T.REVERSE]);
// (깜빡이는 발판은 글자 자체가 사라졌다 나타나므로 구워도 된다 — 켜져 있을 때만 그려진다)

/**
 * 한 번 당해야 표시가 뜨는 칸. **이것만** 함정 기억을 뒤진다.
 *
 * markKey 는 칸마다 문자열을 하나 만든다. 화면의 대부분은 땅과 발판인데
 * 걔들한테까지 물어보면 1초에 2만 개짜리 쓰레기가 나온다 — 표시가 뜰 리 없는 칸이다.
 */
const MARKABLE = new Set([T.FAKE, T.INVISIBLE, T.CRUMBLE, T.POPSPIKE, T.BAIT]);

/**
 * 구워둔 칸 그림. 땅 한 칸이 fillRect 다섯 번인데 화면에 수백 칸이 깔린다 —
 * 한 번 구워두고 drawImage 한 번으로 찍으면 그리기 호출이 통째로 줄어든다.
 *
 * 굽는 것도 drawTile 을 그대로 쓴다. 그림을 두 벌 적어두면 언젠가 서로 어긋난다.
 */
const tileCache = new Map();
let tileCacheFor = null;

const tileKeyOf = (ch, revealed, buried) =>
  ch.charCodeAt(0) * 4 + (revealed ? 2 : 0) + (buried ? 1 : 0);

function tileCanvas(ch, stage, revealed, buried) {
  // 무대가 바뀌면 땅 색이 바뀐다 — 그때만 통째로 버린다
  if (tileCacheFor !== stage) {
    tileCache.clear();
    tileCacheFor = stage;
  }
  const key = tileKeyOf(ch, revealed, buried);
  let canvas = tileCache.get(key);
  if (canvas) return canvas;
  canvas = makeCanvas(TILE, TILE);
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  drawTile(g, ch, 0, 0, stage, revealed, 0, buried);
  tileCache.set(key, canvas);
  return canvas;
}

function drawTiles(ctx, game, ox, oy, time) {
  const { world, trapMemory } = game;
  const stage = world.stage;
  const tx0 = Math.max(0, Math.floor(ox / TILE) - 1);
  const tx1 = Math.min(world.width - 1, Math.floor((ox + VIEW.w) / TILE) + 1);
  const ty0 = Math.max(0, Math.floor(oy / TILE) - 1);
  const ty1 = Math.min(world.height - 1, Math.floor((oy + VIEW.h) / TILE) + 1);
  for (let ty = ty0; ty <= ty1; ty++) {
    const y = ty * TILE - oy;
    for (let tx = tx0; tx <= tx1; tx++) {
      const ch = world.charAt(tx, ty);
      if (ch === T.EMPTY) continue;
      const x = tx * TILE - ox;
      const revealed = MARKABLE.has(ch) && trapMemory.has(markKey(game, tx, ty));
      const above = world.charAt(tx, ty - 1);
      const buried = above === T.GROUND || above === T.POPSPIKE || above === T.CRUMBLE;
      if (LIVE_TILES.has(ch)) drawTile(ctx, ch, x, y, stage, revealed, time, buried);
      else ctx.drawImage(tileCanvas(ch, stage, revealed, buried), x, y);
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
    if (wall.risen || !game.trapMemory.has(markKey(game, wall.tx, wall.ty))) continue;
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
    if (!game.trapMemory.has(markKey(game, zone.tx, zone.ty))) continue;
    ctx.save();
    ctx.globalAlpha = 0.3 + Math.sin(time * 3 + zone.tx) * 0.12;
    ctx.fillStyle = colors[zone.kind] ?? '#fff';
    ctx.fillRect(zone.x - ox + 2, zone.y - oy - TILE, TILE - 4, TILE * 2);
    ctx.restore();
  }
}

/** 내려오는 천장 가시 — 솟는 가시를 위아래만 뒤집은 것이다 */
function drawCeilSpikes(ctx, world, ox, oy) {
  for (const spike of world.ceilSpikes) {
    if (!spike.popped || spike.t <= 0) continue;
    const x = spike.tx * TILE - ox;
    const top = (spike.ty + 1) * TILE - oy;
    // **판정과 같은 길이로 그린다.** 예전에는 그림이 한 칸인데 판정은 세 칸이라,
    // 보이지도 않는 자리에서 죽었다. 길이는 한 곳(CEIL_BLADE)에서만 정한다.
    const len = TILE * CEIL_BLADE * spike.t;
    ctx.fillStyle = '#8b93a8';
    ctx.fillRect(x, top - 2, TILE, 2);
    ctx.fillStyle = '#f2f5ff';
    for (let i = 0; i < 3; i++) {
      const sx = x + 2 + i * 4;
      ctx.beginPath();
      ctx.moveTo(sx, top);
      ctx.lineTo(sx + 2, top + len);
      ctx.lineTo(sx + 4, top);
      ctx.fill();
    }
    // 창끝 — 어디까지 내려왔는지가 한눈에 보여야 한다
    ctx.fillStyle = '#ff3b3b';
    ctx.fillRect(x + 6, top + len - 3, 4, 3);
  }
}

/** 아직 안 먹은 가짜 체크포인트. 진짜와 똑같이 생겼다 — 그게 함정이다 */
function drawFakeChecks(ctx, game, ox, oy, time) {
  for (const fc of game.world.fakeChecks) {
    if (fc.taken) continue;
    const marked = game.trapMemory.has(markKey(game, fc.tx, fc.ty));
    ctx.save();
    ctx.globalAlpha = 0.55;
    drawSprite(ctx, DISC, fc.x - ox - 3, fc.y - oy - 2 + Math.sin(time * 3) * 1.5);
    // 한 번 당한 뒤에야 가짜라는 표시가 뜬다
    if (marked) {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#ff2e63';
      ctx.fillRect(Math.round(fc.x - ox - 2), Math.round(fc.y - oy - 6), 10, 2);
    }
    ctx.restore();
  }
}

/**
 * 뒤에서 밀고 오는 거대 로봇.
 *
 * **새로 그리지 않는다** — 3페이즈 배경용으로 이미 구워둔 giantCanvas 를 옆으로 세워 쓴다.
 * 죽는 자리는 세로 띠 하나(chaser.x)뿐이다. 그림이 아무리 커도 판정이 하나여야
 * "저기 닿으면 죽는다"가 안 헷갈린다.
 */
/**
 * 하늘에서 떨어지는 폭탄. **그림자가 먼저다.**
 *
 * 떨어질 자리에 바닥 그림자를 먼저 깔아두고, 예고가 끝나야 폭탄이 내려온다.
 * 그림자는 어둠(정전) 속에서도 보이게 밝게 그린다 — 정전과 겹치는 구간에서
 * 이게 유일한 단서다.
 */
function drawBombs(ctx, game, ox, oy, time) {
  if (!game.bombs?.length) return;
  ctx.save();
  for (const bomb of game.bombs) {
    const x = Math.round(bomb.x - ox);
    const gy = Math.round(bomb.groundY - oy);

    // 떨어질 자리 — 두근거리는 고리
    const pulse = 0.55 + Math.sin(time * 18) * 0.45;
    ctx.globalAlpha = bomb.warn > 0 ? 0.35 + pulse * 0.5 : 0.8;
    ctx.fillStyle = '#ff3b3b';
    ctx.fillRect(x - 7, gy - 2, 14, 2);
    ctx.fillRect(x - 7, gy - 5, 2, 3);
    ctx.fillRect(x + 5, gy - 5, 2, 3);

    if (bomb.warn > 0) {
      // 아직 안 떨어졌다 — 위쪽 가장자리에 곧 온다는 표시만
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(x - 3, Math.max(0, gy - VIEW.h + 4), 6, 4);
      continue;
    }

    const y = Math.round(bomb.y - oy);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#241a33';
    ctx.fillRect(x - 5, y - 5, 10, 10);
    ctx.fillStyle = '#4a3a5e';
    ctx.fillRect(x - 4, y - 4, 8, 8);
    ctx.fillStyle = '#ff8f3c';
    ctx.fillRect(x - 2, y - 2, 4, 4);
    // 심지
    ctx.fillStyle = Math.floor(time * 20) % 2 ? '#ffd166' : '#ff3b3b';
    ctx.fillRect(x - 1, y - 8, 2, 3);
  }
  ctx.restore();
}

function drawChaser(ctx, game, ox, oy, time) {
  if (!game.chaser) return;
  const x = Math.round(game.chaser.x - ox);
  const surging = game.effects.surge > 0;
  const color = surging ? '#ff3b3b' : '#7c5cff';
  const canvas = giantCanvas(color);
  const { w, h } = giantSize();

  ctx.save();
  // 로봇 뒤는 아예 어둡게 — 저기로는 못 돌아간다
  ctx.fillStyle = 'rgba(10,2,16,0.92)';
  ctx.fillRect(x - VIEW.w, 0, VIEW.w, VIEW.h);

  // 몸통 — 화면 왼쪽 밖에서 절반쯤 걸쳐 밀고 들어온다
  ctx.globalAlpha = 0.9;
  const bob = Math.sin(time * 3) * 2;
  ctx.drawImage(canvas, Math.round(x - w * 0.62), Math.round(VIEW.h - h * 0.9 + bob));

  // 앞으로 뻗은 손 — 여기가 판정선이다
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  ctx.fillRect(x - 10, 0, 3, VIEW.h);
  ctx.fillStyle = surging ? '#fff0c4' : '#d5cbff';
  for (let y = -oy % 14; y < VIEW.h; y += 14) {
    const reach = 4 + Math.sin(time * 9 + y * 0.3) * 2;
    ctx.fillRect(x - 10, y, reach, 4);
  }
  ctx.restore();
}

/**
 * 얼마나 붙었는지 — 화면 왼쪽 가장자리의 얇은 띠. 가까울수록 붉어진다.
 * 숫자는 안 쓴다. 이 게임에는 글자가 없다.
 */
function drawChaseGauge(ctx, game, time) {
  if (!game.chaser) return;
  const gap = game.player.x - game.chaser.x;
  const near = Math.max(0, Math.min(1, 1 - gap / 220));
  ctx.save();
  ctx.fillStyle = 'rgba(10,2,16,0.65)';
  ctx.fillRect(0, 0, 5, VIEW.h);
  const color = near > 0.7 ? '#ff2e63' : near > 0.4 ? '#ffc93c' : '#7c5cff';
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.6 + near * 0.4;
  ctx.fillRect(0, 0, 5, Math.round(VIEW.h * near));
  // 바짝 붙으면 화면 왼쪽 가장자리가 같이 뛴다 — 3px 짜리 띠는 달리면서 못 본다
  if (near > 0.6) {
    ctx.globalAlpha = (near - 0.6) * 1.6 * (0.5 + Math.sin(time * 14) * 0.5);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 26, VIEW.h);
  }
  ctx.restore();
}

/**
 * 잡혔다. 그림자 → 손 → 암전. **글자는 없다.**
 * 어느 단계인지는 타임라인이 정한다 (시각을 여기 또 적지 않는다).
 */
function drawCaught(ctx, game, ox, oy, time) {
  const c = game.caught;
  if (!c) return;
  const kind = beatKind(CAUGHT_CUT, c.t);
  if (!kind || kind === 'end') return;
  const px = game.player.x - ox + game.player.w / 2;
  const py = game.player.y - oy;

  ctx.save();
  if (kind === 'shadow') {
    // 왼쪽부터 덮인다
    const k = clamp01((c.t - CAUGHT_AT.shadow) / 0.7);
    ctx.fillStyle = 'rgba(10,2,16,0.8)';
    ctx.fillRect(0, 0, VIEW.w * k, VIEW.h);
  } else {
    ctx.fillStyle = 'rgba(10,2,16,0.8)';
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  }

  // 덮개 **위에** 주인공을 다시 그린다 — 잡히는 건 나인데
  // 어둠에 같이 묻히면 무슨 일이 일어났는지 안 보인다.
  if (kind !== 'black') {
    drawSprite(
      ctx,
      playerFrame({ ...game.player, invuln: 0 }),
      Math.round(game.player.x - ox + PLAYER_OFFSET.x),
      Math.round(game.player.y - oy + PLAYER_OFFSET.y),
      game.player.dir < 0,
    );
  }

  if (kind === 'grab') {
    // 거대한 손이 위에서 내려와 붙잡는다
    const k = clamp01((c.t - CAUGHT_AT.grab) / 0.9);
    const handY = -60 + (py + 10) * k;
    ctx.fillStyle = '#5c4a70';
    ctx.fillRect(px - 26, handY - 40, 52, 44);
    ctx.fillStyle = '#241a33';
    ctx.fillRect(px - 22, handY - 36, 44, 36);
    // 손가락 넷이 내려와 감싼다
    ctx.fillStyle = '#5c4a70';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(px - 24 + i * 13, handY, 9, 16 + i % 2 * 4);
    }
    ctx.fillStyle = '#ff3b3b';
    ctx.fillRect(px - 18, handY - 30, 36, 3);
  }

  if (kind === 'black') {
    const k = clamp01((c.t - CAUGHT_AT.black) / 0.8);
    ctx.fillStyle = `rgba(0,0,0,${k})`;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  }
  ctx.restore();
}

/**
 * 2회차 문 옆에 선 사람. **한 바퀴 돌기 전에도 서 있다.**
 *
 * 예전에는 깨기 전이면 아무 반응이 없어서 판에 박힌 장식처럼 보였다. 이제
 * 가까이 가면 **돌아보고 지팡이를 든다** — 말을 건다는 걸 몸으로 먼저 알린다.
 * 무슨 말을 하는지는 core 가 정한다 (npcSays); 여기서는 그 말을 그리기만 한다.
 */
function drawNpc(ctx, game, ox, oy, time) {
  for (const npc of game.world.npcs) {
    const x = Math.round(npc.x - ox);
    const y = Math.round(npc.y - oy);
    const dancing = npcDancing(game, npc);
    // 춤출 때는 스핀이 방향을 정한다. 평소엔 플레이어 쪽을 본다
    const faceLeft = dancing
      ? npcSpin(time)
      : npc.near && game.player.x + game.player.w / 2 < npc.x + 5;
    // 통통 뛴다. 프레임 자체의 위아래와 겹쳐 과장된다
    const hop = dancing ? npcBob(time) : 0;

    ctx.save();
    drawSprite(
      ctx,
      npcFrame({ near: npc.near, dancing }, time),
      x + NPC_OFFSET.x,
      y + NPC_OFFSET.y - hop,
      faceLeft,
    );
    // 신나서 음표가 튀어나온다. time 으로만 만드는 값이라 상태를 안 늘린다
    if (dancing) {
      for (let i = 0; i < 3; i++) {
        const k = ((time * 0.9 + i * 0.34) % 1);
        ctx.globalAlpha = Math.max(0, 1 - k) * 0.9;
        const side = i % 2 ? 8 : -6;
        drawSprite(ctx, NOTE, x + side + Math.sin(k * 6 + i) * 2, y - 10 - k * 16);
      }
      ctx.globalAlpha = 1;
    }
    // 누를 수 있으면 머리 위에 꼭지가 뜬다 (대사는 없다 — 누를 수 있다는 신호뿐)
    if (npcInReach(game) === npc) {
      const bob = Math.sin(time * 5) * 1.5;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 3, Math.round(y - 14 + bob), 4, 4);
      ctx.fillStyle = '#241a33';
      ctx.fillRect(x + 4, Math.round(y - 13 + bob), 2, 2);
    }
    ctx.restore();
  }
}

/**
 * NPC 의 말풍선. **글자는 없다.**
 *
 * 이 게임은 오프닝부터 엔딩까지 글자 한 줄 없이 굴러왔다. NPC 하나 때문에 그걸 깨느니
 * 그림 세 장으로 말한다 — 트로피(1등은 했다) → 갈라진 트로피와 더 뻗는 차트(위가 있다)
 * → 문(저기로 가라).
 */
function drawNpcTalk(ctx, game, ox, oy, time) {
  // 멈추는 이야기(npcTalk)와 지나가며 뜨는 한 마디(npcHint)는 **같은 말풍선**이다.
  // 둘이 다른 건 판이 멈추느냐뿐이라, 그리는 건 한 군데서 한다.
  const talk = game.npcTalk ?? game.npcHint;
  if (!talk) return;
  const npc = game.world.npcs[0];
  if (!npc) return;
  const kind = beatKind(talkTimeline(talk.id), talk.t);
  if (!kind || kind === 'end') return;

  const bx = Math.round(npc.x - ox - 14);
  const by = Math.round(npc.y - oy - 44);
  const w = 40;
  const h = 34;

  // 말풍선
  ctx.save();
  ctx.fillStyle = 'rgba(14,8,28,0.94)';
  ctx.fillRect(bx, by, w, h);
  ctx.strokeStyle = '#a98cff';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx + 0.5, by + 0.5, w - 1, h - 1);
  ctx.fillStyle = 'rgba(14,8,28,0.94)';
  ctx.fillRect(bx + 14, by + h, 5, 5);

  const cx = bx + w / 2;
  const cy = by + h / 2;

  if (kind === 'trophy') {
    // 트로피 — 1등은 했다
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(cx - 6, cy - 9, 12, 8);
    ctx.fillRect(cx - 2, cy - 1, 4, 5);
    ctx.fillRect(cx - 7, cy + 4, 14, 3);
    ctx.fillStyle = '#fff3c4';
    ctx.fillRect(cx - 5, cy - 8, 3, 2);
    // 손잡이
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(cx - 9, cy - 8, 2, 4);
    ctx.fillRect(cx + 7, cy - 8, 2, 4);
  } else if (kind === 'crack') {
    // 금이 간 트로피 + 위로 더 뻗는 차트
    ctx.fillStyle = '#8a7a4a';
    ctx.fillRect(cx - 12, cy - 6, 10, 7);
    ctx.fillRect(cx - 13, cy + 1, 12, 2);
    ctx.fillStyle = '#0e081c';
    ctx.fillRect(cx - 8, cy - 6, 1, 7);
    ctx.fillRect(cx - 6, cy - 3, 1, 4);
    // 차트가 위로 뻗는다
    ctx.fillStyle = '#ff5d8f';
    for (let i = 0; i < 4; i++) ctx.fillRect(cx + 1 + i * 4, cy + 3 - i * 3, 3, 3 + i * 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx + 13, cy - 10, 3, 1);
    ctx.fillRect(cx + 14, cy - 11, 1, 3);
  } else if (kind === 'empty') {
    // 빈 받침 — 여기 올릴 게 아직 없다. 컵 자리는 점선으로만 그린다
    ctx.fillStyle = '#5a4a72';
    ctx.fillRect(cx - 2, cy - 1, 4, 5);
    ctx.fillRect(cx - 7, cy + 4, 14, 3);
    ctx.fillStyle = '#8a7fb8';
    for (let i = 0; i < 12; i += 2) ctx.fillRect(cx - 6 + i, cy - 9, 1, 1);
    for (let i = 0; i < 8; i += 2) {
      ctx.fillRect(cx - 6, cy - 9 + i, 1, 1);
      ctx.fillRect(cx + 5, cy - 9 + i, 1, 1);
    }
    // **안은 채우지 않는다.** 흐린 금색이라도 채워두면 「빛바랜 트로피가 있다」로
    // 읽혀서 뜻이 뒤집힌다. 대신 테두리가 느리게 맥박쳐 자리만 가리킨다
    ctx.globalAlpha = 0.35 + Math.sin(time * 3) * 0.25;
    ctx.fillStyle = '#ffd166';
    for (let i = 0; i < 12; i += 2) ctx.fillRect(cx - 6 + i, cy - 9, 1, 1);
    ctx.globalAlpha = 1;
  } else if (kind === 'shut') {
    // 빗장 걸린 문 — 아직 아니다
    ctx.fillStyle = '#140828';
    ctx.fillRect(cx - 6, cy - 10, 12, 20);
    ctx.strokeStyle = '#3a2a55';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - 5.5, cy - 9.5, 11, 19);
    // 가로 빗장 둘
    ctx.fillStyle = '#8a7fb8';
    ctx.fillRect(cx - 9, cy - 5, 18, 3);
    ctx.fillRect(cx - 9, cy + 3, 18, 3);
    // 자물쇠. 열려고 흔들다 마는 것처럼 한 픽셀 떤다
    const jig = Math.round(Math.sin(time * 18) * (Math.sin(time * 1.2) > 0.6 ? 1 : 0));
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(cx - 3 + jig, cy - 1, 6, 5);
    ctx.fillStyle = '#8a7fb8';
    ctx.fillRect(cx - 2 + jig, cy - 4, 1, 3);
    ctx.fillRect(cx + 1 + jig, cy - 4, 1, 3);
    ctx.fillRect(cx - 2 + jig, cy - 5, 4, 1);
  } else if (kind === 'portal') {
    // 문 — 저기로 가라
    ctx.fillStyle = '#140828';
    ctx.fillRect(cx - 6, cy - 10, 12, 20);
    for (let i = 0; i < 3; i++) {
      const k = ((time * 0.9 + i * 0.33) % 1);
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = i % 2 ? '#ff5d8f' : '#7c5cff';
      ctx.strokeRect(cx - 6 * k, cy - 10 * k, 12 * k, 20 * k);
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/** 하드모드로 가는 문. 말을 걸기 전에는 자리만 흐릿하다 */
function drawPortal(ctx, game, ox, oy, time) {
  for (const p of game.world.portals) {
    const x = Math.round(p.x - ox);
    const y = Math.round(p.y - oy);
    ctx.save();
    if (!p.open) {
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = '#7c5cff';
      ctx.setLineDash([2, 3]);
      ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE * 2 - 1);
      ctx.setLineDash([]);
      ctx.restore();
      continue;
    }
    // 열린 문 — 안쪽으로 빨려드는 고리
    ctx.fillStyle = '#140828';
    ctx.fillRect(x, y, TILE, TILE * 2);
    for (let i = 0; i < 4; i++) {
      const k = (time * 0.8 + i * 0.25) % 1;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = i % 2 ? '#ff5d8f' : '#7c5cff';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + TILE / 2 - (TILE / 2) * k, y + TILE - TILE * k, TILE * k, TILE * 2 * k);
    }
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
/**
 * 공룡의 가로 공격 — 꼬리와 충격파.
 *
 * 사각형은 core/boss.js 의 tailBand / shockWaves 가 정한다. 여기서 다시 계산하면
 * 보이는 자리와 죽는 자리가 언젠가 어긋난다 (레이저와 같은 규칙).
 *
 * 레이저는 **세로 기둥**이고 이건 **가로 띠**다. 한눈에 달라 보여야
 * "옆으로 비켜야 하나, 뛰어야 하나" 를 안 헷갈린다.
 */
/**
 * 하늘에서 떨어지는 땅.
 *
 * **매달린 모습을 반드시 그린다.** 이 함정만 시간 예고가 없으므로, 대신
 * "저 위에 뭔가 매달려 있다"가 눈에 보여야 한다 — 지형을 읽으면 알 수 있는 예고다.
 * 안 그리면 아무 이유 없이 죽는 것이 되고, 그건 트롤이 아니라 불합리다.
 */
/** 폭탄이 터진 자리에 남은 불. 밟을 수 없는 칸이라 **눈에 확 띄어야** 한다 */
function drawFires(ctx, game, ox, oy, time) {
  if (!game.fires?.length) return;
  ctx.save();
  for (const fire of game.fires) {
    const x = Math.round(fire.x - ox);
    const y = Math.round(fire.groundY - oy);
    // 꺼질 때가 되면 옅어진다 — 언제 다시 밟을 수 있는지 보여야 한다
    ctx.globalAlpha = Math.min(1, fire.t / 0.4);
    for (let i = 0; i < 5; i++) {
      const h = 6 + Math.abs(Math.sin(time * 12 + i * 1.3)) * 7;
      ctx.fillStyle = i % 2 ? '#ff8f3c' : '#ffd166';
      ctx.fillRect(x - 8 + i * 4, y - h, 3, h);
    }
    ctx.fillStyle = '#ff3b3b';
    ctx.fillRect(x - 9, y - 2, 18, 2);
  }
  ctx.restore();
}

function drawDropSlabs(ctx, game, ox, oy, time) {
  const slabs = game.world?.dropSlabs;
  if (!slabs?.length) return;
  ctx.save();
  for (const slab of slabs) {
    if (slab.done) continue;
    const x = Math.round(slab.tx * TILE - ox);
    const marked = game.trapMemory.has(markKey(game, slab.tx, slab.ty));

    if (!slab.fired) {
      // 매달려 있다 — 천장에 붙은 쇠덩이. 살짝 떨어서 "곧 떨어질 것" 으로 읽힌다
      const y = Math.round((slab.ty - SLAB_HANG) * TILE - oy + Math.sin(time * 3) * 0.6);
      ctx.fillStyle = '#5a5470';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#8a83a8';
      ctx.fillRect(x + 1, y + 1, TILE - 2, 3);
      ctx.fillStyle = '#241a33';
      for (let i = 0; i < 3; i++) ctx.fillRect(x + 3 + i * 4, y + TILE - 4, 2, 3);
      // 매달린 사슬 — 위에서 내려온 것이라는 표시
      ctx.fillStyle = '#3a3550';
      ctx.fillRect(x + TILE / 2 - 1, Math.max(0, y - 40), 2, 40);
      // 한 번 당한 자리는 붉게 남는다 (다른 함정과 같은 규칙)
      if (marked) {
        const my = Math.round(slab.ty * TILE - oy);
        ctx.fillStyle = 'rgba(255,59,59,0.5)';
        ctx.fillRect(x, my, TILE, 3);
      }
      continue;
    }

    // 떨어지는 중 — 잔상을 길게 남긴다. 빨라서 그냥 그리면 순간이동처럼 보인다
    const y = Math.round(slab.y - oy);
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#8a83a8';
    ctx.fillRect(x + 2, y - 26, TILE - 4, 26);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#5a5470';
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(x, y + TILE - 3, TILE, 3);
  }
  ctx.restore();
}

function drawGroundSweeps(ctx, boss, ox, oy, time, color) {
  const tail = tailBand(boss);
  if (tail) {
    const x = Math.round(tail.x - ox);
    const y = Math.round(tail.y - oy);
    ctx.save();
    if (!tail.live) {
      // 예고 — 지나갈 자리에 얇은 밑줄만
      ctx.globalAlpha = 0.4 + Math.sin(time * 20) * 0.25;
      ctx.fillStyle = color;
      ctx.fillRect(x, y + tail.h - 2, tail.w, 2);
    } else {
      // 휘두르는 중 — 두꺼운 띠 + 앞쪽에 잔상
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(x, y, tail.w, tail.h);
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x + (boss.tailDir > 0 ? tail.w - 4 : 0), y, 4, tail.h);
      ctx.globalAlpha = 0.3;
      for (let i = 1; i <= 3; i++) {
        ctx.fillStyle = color;
        ctx.fillRect(x - boss.tailDir * i * 10, y + 3, 8, tail.h - 6);
      }
    }
    ctx.restore();
  }

  // 회오리의 **빈 자리**를 바닥에 표시한다. 안 보이면 어디로 갈지 알 수가 없다.
  const gapX = whirlGapX(boss);
  if (gapX != null) {
    const gx = Math.round(gapX - ox);
    const gy = Math.round(boss.floorY - oy);
    ctx.save();
    ctx.globalAlpha = boss.state === 'whirlAim' ? 0.45 + Math.sin(time * 16) * 0.3 : 0.7;
    ctx.fillStyle = '#39ff9a';
    ctx.fillRect(gx - 14, gy - 3, 28, 3);
    for (let i = 0; i < 3; i++) ctx.fillRect(gx - 12 + i * 11, gy - 10, 3, 6);
    ctx.restore();
  }

  // 천장에서 떨어지는 조각
  for (const slab of ceilingSlabs(boss)) {
    const x = Math.round(slab.x - ox);
    ctx.save();
    if (slab.warn > 0) {
      // 예고 — 떨어질 자리에 바닥 표시
      const gy = Math.round(boss.floorY - oy);
      ctx.globalAlpha = 0.4 + Math.sin(time * 20) * 0.3;
      ctx.fillStyle = '#ff3b3b';
      ctx.fillRect(x, gy - 3, slab.w, 3);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(x + 4, 2, 8, 5);
    } else {
      const y = Math.round(slab.y - oy);
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#8a83a8';
      ctx.fillRect(x + 2, y - 20, slab.w - 4, 20);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#5a5470';
      ctx.fillRect(x, y, slab.w, slab.h);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(x, y + slab.h - 3, slab.w, 3);
    }
    ctx.restore();
  }

  for (const wave of shockWaves(boss)) {
    const x = Math.round(wave.x - ox);
    const y = Math.round(wave.y - oy);
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#ffd166';
    // 바닥에서 솟는 삼각 파도 — 뛰어 넘는 것이라 위가 뾰족해야 읽힌다
    ctx.beginPath();
    ctx.moveTo(x, y + wave.h);
    ctx.lineTo(x + wave.w / 2, y);
    ctx.lineTo(x + wave.w, y + wave.h);
    ctx.fill();
    ctx.fillStyle = '#ff8f3c';
    ctx.fillRect(x + 2, y + wave.h - 3, wave.w - 4, 3);
    ctx.restore();
  }
}

function drawLaser(ctx, boss, ox, oy, time, color) {
  for (const beam of laserBeams(boss)) drawBeam(ctx, beam, ox, oy, time, color);
}

function drawBeam(ctx, beam, ox, oy, time, color) {
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

// ── 숨은 화면 ───────────────────────────────────────────────
/**
 * 음표를 다 모으면 열리는 방. 지나온 앨범 열일곱 장이 한자리에 놓인다.
 *
 * **새로 그리는 그림이 없다** — drawCoverAt 이 어떤 크기로든 커버를 그려주므로
 * 격자에 얹기만 하면 된다. 글자도 안 쓴다 (앨범 이름은 원래 화면에 안 나온다).
 */
// top 은 격자 위 여백. 아래에는 「뒤로」 버튼이 얹히므로 위보다 조금 더 남긴다.
const GAL = { cols: 6, size: 44, gap: 8, top: 26 };

/**
 * 꾸미기 화면. 타이틀 배경 위에 주인공을 **크게** 세우고 달리게 한다.
 *
 * 서 있는 그림만 보여주면 모자·장발이 달릴 때 어떻게 보이는지 알 수 없다.
 * 그래서 제자리에서 달리는 걸 보여준다 — stride 를 시간으로 굴리면
 * 판에서 달릴 때와 **같은 사이클**이 돈다 (playerFrame 이 거리로 고르므로).
 */
export function drawLook(ctx, game, time) {
  drawTitle(ctx, time);
  // 패널이 화면 가운데를 덮으므로 주인공은 **왼쪽 아래**에 둔다
  const cx = 62;
  const cy = VIEW.h - 46;
  const Z = 3;

  // 발 디딜 자리 — 허공에 떠 있으면 크기가 안 읽힌다
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(cx - 22, cy + 1, 44, 3);

  const frame = playerFrame({
    onGround: true,
    vx: 40,
    vy: 0,
    dashTime: 0,
    stride: time * 60,
  });
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(cx - (frame.w * Z) / 2, cy - frame.h * Z);
  ctx.scale(Z, Z);
  drawSprite(ctx, frame, 0, 0);
  ctx.restore();
}

export function drawGallery(ctx, time) {
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW.h);
  grad.addColorStop(0, '#09040f');
  grad.addColorStop(1, '#1d0a2b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);

  // 별. 타이틀보다 성기게 — 여기는 조용한 방이다
  ctx.fillStyle = 'rgba(255,255,255,0.26)';
  for (let i = 0; i < 26; i++) {
    const x = (i * 131) % VIEW.w;
    const y = (i * 79) % VIEW.h;
    if (Math.sin(time * 1.3 + i * 1.7) > 0.2) ctx.fillRect(x, y, 1, 1);
  }

  const { cols, size, gap, top } = GAL;
  const rowW = cols * size + (cols - 1) * gap;
  const left = Math.round((VIEW.w - rowW) / 2);

  for (let i = 0; i < ALBUMS.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = left + col * (size + gap);
    // 줄마다 조금씩 엇갈려 뜬다 — 열일곱 장이 한꺼번에 오르내리면 격자가 출렁인다
    const y = top + row * (size + gap) + Math.sin(time * 1.1 + i * 0.7) * 1.5;

    // 커버 뒤에 옅은 빛 — 어두운 배경에서 격자 모양이 먼저 읽힌다
    ctx.fillStyle = 'rgba(255,209,102,0.10)';
    ctx.fillRect(x - 2, Math.round(y) - 2, size + 4, size + 4);
    drawCoverAt(ctx, ALBUMS[i], x, Math.round(y), size);
  }
}

// ── 전체 ────────────────────────────────────────────────────
export function drawScene(ctx, game, time) {
  // 꾸민 차림새를 **여기 한 군데서** 정한다. playerFrame 은 판에서 둘, 컷신에서
  // 다섯 번 불리는데 인자로 넘기면 한 군데만 빠뜨려도 「판에서는 꾸민 대로인데
  // 결혼식에서는 원래 옷」이 된다. 값이 같으면 Map 조회 한 번이라 공짜다.
  setLook(game.save?.look);
  crisp(ctx);
  // 스테이지 선택도 타이틀 배경 위에 뜬다 (판이 아직 없어서 그릴 월드가 없다)
  if (game.scene === 'title' || game.scene === 'select') {
    drawTitle(ctx, time);
    return;
  }
  if (game.scene === 'look') {
    drawLook(ctx, game, time);
    return;
  }
  if (game.scene === 'gallery') {
    drawGallery(ctx, time);
    return;
  }
  if (game.scene === 'intro') {
    // 1회차 오프닝과 2회차 시작은 같은 장면을 타고 그림만 다르다
    if (game.introCut === 'hardopen') drawHardOpenCut(ctx, game.cutsceneTime);
    else drawIntroCut(ctx, game.cutsceneTime);
    return;
  }
  if (game.scene === 'cutscene') {
    drawCutscene(ctx, game.cutsceneTime, game.hard);
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
  drawCeilSpikes(ctx, game.world, ox, oy);
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

  drawFakeChecks(ctx, game, ox, oy, time);
  if (game.world.portals.length) drawPortal(ctx, game, ox, oy, time);
  if (game.world.npcs.length) drawNpc(ctx, game, ox, oy, time);

  for (const album of game.albums) drawAlbum(ctx, album, ox, oy, time);

  for (const shot of game.shots) {
    drawSprite(ctx, shot.boss ? SHOT_BOSS : SHOT, shot.x - ox, shot.y - oy + Math.sin(shot.wobble) * 1.5);
  }

  drawMics(ctx, game, ox, oy, time);
  if (game.boss) {
    // 체력계를 **보스보다 먼저** 그린다. 화면 위 고정 자리인데(sceneBoss 의 HP_BAR),
    // 보스가 떠 있으면 공주 새장이 바로 거기에 걸린다 — 나중에 그리면 UI 가 공주를 덮는다.
    if (game.boss.state !== 'defeated') drawBossHealth(ctx, game.boss, bossPhase(game.boss).color);
    drawBoss(ctx, game.boss, ox, oy, time);
    drawLaser(ctx, game.boss, ox, oy, time, bossPhase(game.boss).color);
    drawGroundSweeps(ctx, game.boss, ox, oy, time, bossPhase(game.boss).color);
  }

  drawPlayer(ctx, game.player, ox, oy, time);

  // 알갱이와 숫자.
  // 모양(shape)은 상점에서 산 이펙트만 붙는다 — 없으면 예전 그대로 네모다.
  for (const p of game.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    const px = Math.round(p.x - ox);
    const py = Math.round(p.y - oy);
    const spr = PARTICLE_SHAPES[p.shape];
    if (spr) drawSprite(ctx, spr, px - (spr.w >> 1), py - (spr.h >> 1));
    else {
      ctx.fillStyle = p.color;
      ctx.fillRect(px, py, p.size, p.size);
    }
  }
  ctx.globalAlpha = 1;
  for (const txt of game.texts) {
    ctx.globalAlpha = Math.max(0, txt.life / txt.max);
    ctx.fillStyle = txt.color;
    ctx.font = '8px monospace';
    ctx.fillText(txt.text, Math.round(txt.x - ox), Math.round(txt.y - oy));
  }
  ctx.globalAlpha = 1;

  drawDropSlabs(ctx, game, ox, oy, time);
  drawFires(ctx, game, ox, oy, time);
  drawBombs(ctx, game, ox, oy, time);
  drawChaser(ctx, game, ox, oy, time);
  drawChaseGauge(ctx, game, time);
  drawNpcTalk(ctx, game, ox, oy, time);
  drawCaught(ctx, game, ox, oy, time);
  drawEffects(ctx, game, ox, oy, time);

  if (game.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.85, game.flash * 0.6)})`;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  }

  // 싸움이 시작될 때 PHASE 1 카드. 2·3·4페이즈는 전환 컷신이 이름을 박아주는데
  // 1페이즈만 아무것도 없이 불쑥 시작했다. **컷신은 안 만든다** — 시작은 전환이 아니라
  // 시작이고, 보스전에 들어갈 때마다 4초씩 붙잡히면 성가시다. 카드만 얹고 안 멈춘다.
  if (game.scene === 'boss' && !game.bossCut && game.sceneTime < PHASE1_CARD) {
    ctx.save();
    // 끝에서 스르륵 걷힌다 — 툭 사라지면 깜빡인 것처럼 보인다
    ctx.globalAlpha = Math.min(1, (PHASE1_CARD - game.sceneTime) / 0.35);
    drawCutTitle(ctx, 'PHASE 1', game.sceneTime, 4, 92);
    ctx.restore();
  }

  // 컷신은 맨 위에 — 싸움 화면이 그 아래로 비친다
  if (game.bossCut) drawBossCut(ctx, game, time);
  // 쓰러지는 컷신과 엔딩 사이의 숨. 앞 컷신이 검게 닫고 끝났으니 **검은 채로 둔다** —
  // 안 덮으면 0.3초 동안 아레나가 도로 보였다가 엔딩이 시작된다.
  else if (game.bossCutGap > 0) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  }
}

/** PHASE 1 카드가 떠 있는 시간 */
const PHASE1_CARD = 1.4;

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

