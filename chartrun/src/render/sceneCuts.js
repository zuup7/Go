// 컷신을 그린다 — 오프닝·합체·페이즈 전환·엔딩·결혼식·2회차.
//
// **대사는 없다.** 무슨 일이 벌어지는지는 전부 그림이 말한다.
// 시각은 하나도 여기 안 적는다 — data/ 의 타임라인이 정하고 여기는 읽기만 한다.
// 보스 몸은 sceneBoss.js 에서 가져다 쓴다. 컷신과 싸움 화면이 다른 놈을 그리면 안 된다.

import { drawCoverAt } from './albumArt.js';
import { drawSprite } from './pixel.js';
import { playerFrame, NOTE, DISC, BRIDE, RING } from './sprites.js';
import { ALBUMS } from '../data/albums.js';
import { VIEW } from '../core/game.js';
import { phaseAt, phaseAtIn, CUT_AT } from '../data/cutscene.js';
import {
  BOSS_CUTS,
  PHASE2_AT,
  PHASE3_AT,
  PHASE4_AT,
  HARD3_AT,
  BOSS_DOWN_AT,
  ENDING_AT,
  HARD_END_AT,
} from '../data/bossCutscenes.js';
import { INTRO_CUT, INTRO_AT, HARD_OPEN_CUT, HARD_OPEN_AT } from '../data/introCutscene.js';
import { drawBigTextCentered } from './bigtext.js';
import { VINYL, clamp01, ease, mixHex, noise } from './sceneParts.js';
import { drawBossCore, drawBossDisc, drawCage, drawDinoBody, drawEvolvedDisc, drawMicShape, drawRobotBody } from './sceneBoss.js';

// ── 합체 컷신 ───────────────────────────────────────────────
export function drawCutscene(ctx, t, hard = false) {
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
    drawBossDisc(ctx, cx, cy, r, t * 1.4, t, hard, 0);
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

  if (game.bossCut.id === 'phase2') drawPhase2Cut(ctx, t, phase, time, game.hard);
  else if (game.bossCut.id === 'phase3') drawPhase3Cut(ctx, t, phase, time);
  else if (game.bossCut.id === 'hard3') drawHard3Cut(ctx, t, phase, time);
  else if (game.bossCut.id === 'phase4') drawPhase4Cut(ctx, t, phase, time);
  else if (game.bossCut.id === 'bossdown') drawBossDownCut(ctx, t, phase, time, game.hard);
  else if (game.bossCut.id === 'hardEnd') drawHardEndCut(ctx, t, phase, time);
  else drawEndingCut(ctx, t, phase, time);

  ctx.restore();
}

/** 화면 가로로 박히는 큰 제목 (PHASE 2, #1 …) */
export function drawCutTitle(ctx, text, since, scale, y) {
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
function drawPhase2Cut(ctx, t, phase, time, hard) {
  const r = 40;
  if (phase === 'split' || phase === 'title') {
    const p = Math.min(1, (t - PHASE2_AT.split) / 1.1);
    drawQuarters(ctx, CUT_CX, CUT_CY, r, p * p * (3 - 2 * p), time);
  } else {
    const amp = phase === 'crack' ? 3 : 1.4;
    // 2회차면 1페이즈 내내 보던 **진화한 원반**에 금이 가야 한다 (grade 0 = 1페이즈)
    drawBossDisc(ctx, CUT_CX + Math.sin(time * 57) * amp, CUT_CY + Math.cos(time * 63) * amp, r, time * 0.8, time, hard, 0);
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

/**
 * 4페이즈 (하드모드) — 이미 합체한 로봇이 한계를 넘는다.
 *
 * **새 몸을 그리지 않는다.** 여기서 또 새 형태를 만들면 3페이즈 합체가 시시해진다.
 * 있는 drawRobotBody 를 벌겋게 달구고, 이음새에서 빛이 새어 나오게 하는 것으로 끝낸다.
 */
const P4_HOT = '#ff3b3b';

/**
 * 하드 3페이즈 — **껍질을 찢고 공룡로봇이 나온다.**
 *
 * 이야기가 여기서 드러난다: 1회차에서 밟아 없앤 앨범들이 바닥에서 떠올라
 * 보스에게 달라붙고, 그 무게로 껍질이 갈라진다. 대사는 없다 — 그림이 말한다.
 */
function drawHard3Cut(ctx, t, phase, time) {
  const r = 52;

  // 밟혀 사라졌던 앨범들이 바닥에서 떠오른다
  if (phase === 'graves' || phase === 'swarm') {
    const rise = clamp01((t - HARD3_AT.graves) / 1.2);
    const pull = clamp01((t - HARD3_AT.swarm) / 1.2);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const floorY = CUT_CY + 62;
      const gx = CUT_CX + Math.cos(a) * 84;
      // 떠오른 뒤 보스 쪽으로 빨려 들어간다
      const x = gx + (CUT_CX - gx) * pull;
      const y = floorY - rise * 40 + (CUT_CY - (floorY - 40)) * pull;
      ctx.save();
      ctx.globalAlpha = rise * (1 - pull * 0.3);
      drawCoverAt(ctx, ALBUMS[i % ALBUMS.length], x - 6, y - 6, 12);
      ctx.restore();
    }
  }

  ctx.save();
  const shakeAmt = phase === 'shake' ? 3 : phase === 'shell' ? 2 : 0;
  ctx.translate(CUT_CX + Math.sin(time * 63) * shakeAmt, CUT_CY);

  if (phase === 'shake' || phase === 'graves' || phase === 'swarm' || phase === 'shell') {
    // 아직 **진화한 원반**이다 — 이 컷신 직전까지 2페이즈로 싸우던 그 몸.
    // 여기서 로봇을 그리면 있지도 않았던 놈이 찢어지는 게 된다.
    drawEvolvedDisc(ctx, r, time, '#7c5cff', false, 1, time * 0.5);
    if (phase === 'shell') {
      const crack = clamp01((t - HARD3_AT.shell) / 1.0);
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 2;
      ctx.globalAlpha = crack;
      for (let i = 0; i < 4; i++) {
        const a = -1.2 + i * 0.7;
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.3);
        ctx.lineTo(Math.cos(a) * r * crack, Math.sin(a) * r * crack - r * 0.2);
        ctx.stroke();
      }
    }
  } else {
    // 갈라진 틈에서 목과 꼬리가 뻗어 나온다
    const out = clamp01((t - HARD3_AT.hatch) / 1.4);
    ctx.scale(0.6 + out * 0.4, 0.6 + out * 0.4);
    drawDinoBody(ctx, r, time, phase === 'roar' || phase === 'title' ? '#ff3b3b' : '#7c5cff', false);
  }
  ctx.restore();

  // 포효 — 화면이 붉게 번쩍인다
  if (phase === 'roar') {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 0.5 - (t - HARD3_AT.roar) * 0.6);
    ctx.fillStyle = '#ff3b3b';
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    ctx.restore();
  }
}

/**
 * 보스가 쓰러진다 — **박혀 있던 앨범이 하나씩 떨어져 나간다.**
 * 진화가 풀리는 것이 곧 패배다. 그냥 사라지면 이긴 것 같지가 않다.
 */
function drawBossDownCut(ctx, t, phase, time, hard) {
  const r = 52;
  const kneel = clamp01((t - BOSS_DOWN_AT.kneel) / 1.0);
  const gone = clamp01((t - BOSS_DOWN_AT.burst) / 0.8);

  ctx.save();
  // 비틀거리다 무릎이 꺾인다
  ctx.translate(CUT_CX + Math.sin(time * 26) * (1 - kneel) * 4, CUT_CY + kneel * 26);
  ctx.rotate(kneel * 0.35);
  ctx.globalAlpha = 1 - gone;
  // hurt 는 **한 프레임짜리** 피격 번쩍임이다. 컷신 내내 켜두면 몸이 하얗게 날아가
  // 무엇이 쓰러지는지가 안 보인다. 색이 식는 것으로 죽어가는 걸 보여준다.
  // 쓰러지는 건 **방금까지 싸우던 그 몸**이다 — 보통 모드는 합체 로봇,
  // 하드는 껍질을 찢고 나온 공룡. 하나로 고정하면 한쪽은 딴 놈이 죽는다.
  const dying = mixHex('#ff3b3b', '#3a2a4e', kneel);
  if (hard) drawDinoBody(ctx, r, time, dying, false);
  else drawRobotBody(ctx, r, time, dying, 1, false);
  ctx.restore();

  // 박혀 있던 앨범이 튕겨 나간다
  if (t >= BOSS_DOWN_AT.shed) {
    const k = t - BOSS_DOWN_AT.shed;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.4;
      const d = k * (60 + i * 9);
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - k * 0.5);
      drawCoverAt(ctx, ALBUMS[i], CUT_CX + Math.cos(a) * d - 6, CUT_CY + Math.sin(a) * d - 6 + k * k * 30, 12);
      ctx.restore();
    }
  }

  // 코어가 터진다
  if (phase === 'burst') {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - gone);
    ctx.fillStyle = '#fff';
    const rad = 8 + gone * 90;
    ctx.beginPath();
    ctx.arc(CUT_CX, CUT_CY, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawPhase4Cut(ctx, t, phase, time) {
  const r = 52;
  if (phase === 'shake') {
    ctx.save();
    ctx.translate(CUT_CX + Math.sin(time * 63) * 3, CUT_CY);
    drawRobotBody(ctx, r, time, '#7c5cff', 1, false);
    ctx.restore();
    return;
  }

  // 과열 — 이음새마다 빛이 샌다. 색이 보라에서 붉게 넘어간다.
  const heat = clamp01((t - PHASE4_AT.overheat) / 1.4);
  const color = phase === 'overheat' ? mixHex('#7c5cff', P4_HOT, heat) : P4_HOT;

  ctx.save();
  const jolt = phase === 'core' ? Math.sin(time * 90) * 2 : Math.sin(time * 40) * heat;
  ctx.translate(CUT_CX + jolt, CUT_CY);
  drawRobotBody(ctx, r, time, color, 1, false);
  ctx.restore();
  drawBossCore(ctx, CUT_CX + jolt, CUT_CY, phase === 'core' || phase === 'title', time, 14);

  // 이음새에서 새는 빛
  if (heat > 0) {
    ctx.save();
    ctx.globalAlpha = 0.35 + Math.sin(time * 18) * 0.2 * heat;
    ctx.fillStyle = '#fff0c4';
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + time * 0.6;
      ctx.fillRect(CUT_CX + Math.cos(a) * r * 0.7 - 2, CUT_CY + Math.sin(a) * r * 0.7 - 1, 5, 2);
    }
    ctx.restore();
  }

  // 뒤의 거대 로봇이 일어선다 — 크기가 그림으로 읽히는 자리다
  if (phase === 'rise' || phase === 'core' || phase === 'title') {
    const up = clamp01((t - PHASE4_AT.rise) / 1.2);
    ctx.save();
    ctx.globalAlpha = 0.3 * up;
    ctx.fillStyle = P4_HOT;
    ctx.fillRect(0, VIEW.h - VIEW.h * up, VIEW.w, VIEW.h * up);
    ctx.restore();
  }

  if (phase === 'title') drawCutTitle(ctx, 'FINAL', t - PHASE4_AT.title, 4, 14);
}

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

/** 왕관 쓴 주인공과 공주 */
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
/** 그 옆의 공주 (20×20 이라 바닥에서 20 을 뺀다) */
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
export function drawWatchingEyes(ctx, x, y, size, time, look) {
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
  const snatching = phase === 'taken' || phase === 'reach';
  const grabbing = phase === 'grab' || phase === 'run';
  if (inRoom || snatching || grabbing) {
    drawRoom(ctx, time);
    const px = ROOM_ME_X;
    const py = ROOM_ME_Y;

    // 공주 — 원래 옆에 같이 있다. 앨범이 채가면 위로 끌려 올라간다.
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

// ── 2회차 시작: 졌던 것들이 되살아나 복수하러 온다 ──────────
//
// **내가 안 나온다.** 하드모드는 내 이야기가 아니라 저들 이야기다 —
// 1회차에서 내가 밟아 부순 앨범 열일곱 장이 조각난 채로 되살아나 진화한다.
// 화면에 나오는 나는 저들이 부수는 왕관과 저들이 들어 올리는 새장뿐이다.
//
// 1회차 오프닝(방구석·차트)도 엔딩(결혼식)도 여기서는 다시 안 쓴다.
// 다시 쓰면 전에 본 장면이 되고, 2회차가 새로 시작하는 느낌이 안 난다.

/**
 * 진화한 앨범 한 장 — 커버는 그대로인데 가시가 돋고 벌겋게 달아오른다.
 *
 * **커버를 다시 그리지 않는다.** 1회차에서 밟아 없앤 바로 그 앨범이라는 게
 * 한눈에 읽혀야 해서, 있는 그림 위에 가시와 붉은 기와 노려보는 눈만 얹는다.
 * 2회차 엔딩(진화가 식는 장면)도 같은 함수를 grow 만 거꾸로 줘서 쓴다.
 */
function evolvedCover(ctx, album, cx, cy, size, grow, time) {
  const half = size / 2;
  if (grow > 0) {
    ctx.save();
    ctx.fillStyle = '#ff3b3b';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + time * 0.7;
      const len = half * 0.9 * grow * (0.7 + Math.sin(time * 9 + i) * 0.3);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a - 0.3) * half, cy + Math.sin(a - 0.3) * half);
      ctx.lineTo(cx + Math.cos(a) * (half + len), cy + Math.sin(a) * (half + len));
      ctx.lineTo(cx + Math.cos(a + 0.3) * half, cy + Math.sin(a + 0.3) * half);
      ctx.fill();
    }
    ctx.restore();
  }
  drawCoverAt(ctx, album, cx - half, cy - half, size);
  if (grow <= 0) return;
  ctx.save();
  ctx.globalAlpha = grow * 0.45;
  ctx.fillStyle = '#ff3b3b';
  ctx.fillRect(Math.round(cx - half), Math.round(cy - half), Math.round(size), Math.round(size));
  ctx.restore();
  // 노려보는 눈 — 오프닝에서 차트가 나를 내려다볼 때 쓴 그 눈이다
  drawWatchingEyes(ctx, cx - half, cy - half, size, time, true);
}

/** 잔해가 깔린 바닥 높이 */
const HO_FLOOR = 176;
/** 되살아나는 앨범 수. 열일곱을 다 세우면 한 장이 12px 이라 조각이 안 보인다 */
const HO_COUNT = 13;

/** i 번째가 다시 설 자리 (뒷줄 · 앞줄 두 겹으로 세운다) */
function hoSpot(i) {
  const back = i < 6;
  const n = back ? 6 : HO_COUNT - 6;
  const k = back ? i : i - 6;
  return {
    x: (VIEW.w / (n + 1)) * (k + 1) + (back ? 0 : -10),
    y: back ? HO_FLOOR - 46 : HO_FLOOR - 20,
    size: back ? 18 : 24,
  };
}

/**
 * 부서진 커버 한 장. 네 조각이 바닥에 흩어져 있다가 `mend` 로 도로 붙는다.
 *
 * 조각은 **커버를 잘라서** 만든다 — 조각용 그림을 따로 그리면 되살아난 뒤의 커버와
 * 안 맞아서, 부서진 게 그 앨범이었다는 게 안 읽힌다.
 */
function shatteredCover(ctx, album, spot, mend, jitter, time, seed) {
  const s = spot.size;
  const half = s / 2;
  for (let j = 0; j < 4; j++) {
    const jx = j % 2;
    const jy = j >> 1;
    // 흩어져 있던 자리 — 바닥에 널브러져 있다
    const away = 22 + noise(seed + j, 5) * 54;
    const dir = (j === 0 || j === 2 ? -1 : 1) * (0.5 + noise(seed + j, 6));
    const fromX = spot.x + dir * away;
    // 위아래로도 흩어놔야 **널브러진 잔해**로 보인다. 한 줄로 세우면 진열대가 된다.
    const fromY = HO_FLOOR - 4 - noise(seed + j, 7) * 26;
    const toX = spot.x - half + jx * half;
    const toY = spot.y - half + jy * half;
    const wob = jitter * (Math.sin(time * 26 + seed + j * 2) * 1.6);
    const x = Math.round(fromX + (toX - fromX) * mend + wob);
    const y = Math.round(fromY + (toY - fromY) * mend + wob * 0.6);
    // 아직 안 붙은 조각은 아무렇게나 뒹군다. 붙으면서 반듯해진다.
    const ang = (1 - mend) * (noise(seed + j, 8) - 0.5) * 1.6;
    ctx.save();
    ctx.translate(x + half / 2, y + half / 2);
    ctx.rotate(ang);
    ctx.translate(-(x + half / 2), -(y + half / 2));
    ctx.beginPath();
    ctx.rect(x, y, half, half);
    ctx.clip();
    drawCoverAt(ctx, album, x - jx * half, y - jy * half, s);
    ctx.restore();
  }
  // 도로 붙어도 금은 남는다 — 되살아난 것이지 새것이 아니다.
  // **다 붙은 뒤에만** 긋는다. 조각이 아직 날아오는 중에 그으면 허공에 십자선이 뜬다.
  if (mend <= 0.72) return;
  ctx.save();
  ctx.globalAlpha = (mend - 0.72) / 0.28;
  ctx.strokeStyle = '#0b0510';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(spot.x, spot.y - half);
  ctx.lineTo(spot.x, spot.y + half);
  ctx.moveTo(spot.x - half, spot.y);
  ctx.lineTo(spot.x + half, spot.y);
  ctx.stroke();
  ctx.restore();
}

/** 바닥에서 피어오르는 잉걸 — 여기가 무엇이 죽은 자리인지 말해준다 */
function drawEmbers(ctx, time, amount) {
  if (amount <= 0) return;
  ctx.save();
  for (let i = 0; i < 26; i++) {
    if (i / 26 > amount) break;
    const speed = 12 + noise(i, 12) * 18;
    const x = (noise(i, 13) * VIEW.w + Math.sin(time * 0.9 + i) * 6) % VIEW.w;
    const y = HO_FLOOR - ((time * speed + noise(i, 14) * 200) % (HO_FLOOR + 20));
    ctx.globalAlpha = Math.max(0, (y / HO_FLOOR) * 0.8);
    ctx.fillStyle = i % 3 === 0 ? '#ffd166' : '#ff5d3c';
    ctx.fillRect(Math.round(x), Math.round(y), 1, 2);
  }
  ctx.restore();
}

export function drawHardOpenCut(ctx, t) {
  const phase = phaseAtIn(HARD_OPEN_CUT, t, 'grave');
  const time = t;
  const cx = VIEW.w / 2;

  // ── 잔해가 깔린 바닥 ────────────────────────────────────
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW.h);
  grad.addColorStop(0, '#0a0410');
  grad.addColorStop(1, '#2a0810');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);

  const rage = t >= HARD_OPEN_AT.evolve ? clamp01((t - HARD_OPEN_AT.evolve) / 2.2) : 0;
  const march = t >= HARD_OPEN_AT.march ? ease((t - HARD_OPEN_AT.march) / 1.8) : 0;

  // 밑에서 새어 나오는 붉은 빛 — stir 부터 커진다
  const glow = t >= HARD_OPEN_AT.stir ? clamp01((t - HARD_OPEN_AT.stir) / 1.6) : 0;
  if (glow > 0) {
    ctx.save();
    ctx.globalAlpha = glow * (0.25 + rage * 0.35) * (0.8 + Math.sin(time * 5) * 0.2);
    const g2 = ctx.createLinearGradient(0, HO_FLOOR - 60, 0, HO_FLOOR);
    g2.addColorStop(0, 'rgba(255,59,59,0)');
    g2.addColorStop(1, '#ff3b3b');
    ctx.fillStyle = g2;
    ctx.fillRect(0, HO_FLOOR - 60, VIEW.w, 60);
    ctx.restore();
  }
  drawEmbers(ctx, time, glow);

  ctx.fillStyle = '#150a1c';
  ctx.fillRect(0, HO_FLOOR, VIEW.w, VIEW.h - HO_FLOOR);
  ctx.fillStyle = '#2a1533';
  ctx.fillRect(0, HO_FLOOR, VIEW.w, 2);

  // 몰려오는 동안 화면이 붉게 덮인다. 무리보다 **먼저** 깔아야 저들이 그 앞에 선다.
  if (march > 0) {
    ctx.save();
    ctx.globalAlpha = march * 0.4;
    ctx.fillStyle = '#ff3b3b';
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    ctx.restore();
  }

  // ── 조각이 떨리고, 붙고, 진화한다 ───────────────────────
  const mend = t >= HARD_OPEN_AT.mend ? ease((t - HARD_OPEN_AT.mend) / 1.5) : 0;
  const jitter = t >= HARD_OPEN_AT.stir ? clamp01((t - HARD_OPEN_AT.stir) / 0.6) * (1 - mend) : 0;
  // 앞으로 나선 놈이 있는 동안에는 나머지를 눌러 둔다 — 안 그러면 어디를 봐야 할지 모른다
  const front = phase === 'smash' ? 'smash' : phase === 'cage' || phase === 'march' ? 'cage' : null;
  const dim = phase === 'smash' || phase === 'cage';

  ctx.save();
  // 몰려오는 동안에는 통째로 커지며 이쪽으로 내려온다
  if (march > 0) {
    ctx.translate(cx, HO_FLOOR);
    ctx.scale(1 + march * 0.5, 1 + march * 0.5);
    ctx.translate(-cx, -HO_FLOOR + march * 14);
  }
  if (dim) ctx.globalAlpha = 0.4;
  for (let i = 0; i < HO_COUNT; i++) {
    const spot = hoSpot(i);
    const album = ALBUMS[(i * 3) % ALBUMS.length];
    const step = march * (8 + (i % 4) * 5);
    ctx.save();
    ctx.translate(0, Math.round(step));
    if (rage <= 0) shatteredCover(ctx, album, spot, mend, jitter, time, i * 7);
    else evolvedCover(ctx, album, spot.x, spot.y, spot.size, rage, time);
    ctx.restore();
  }
  ctx.restore();

  // ── 앞으로 나선 하나 ────────────────────────────────────
  //
  // **화면 앞까지 걸어 나온다.** 줄 안에서 조금 커지는 것으로는 왕관도 새장도
  // 12픽셀짜리라 아무것도 안 읽힌다. 앞으로 나와야 무엇을 하는지가 보인다.
  if (!front) return;
  const fy = HO_FLOOR - 34 + march * 26;
  const fsize = 40 + march * 22;

  if (front === 'smash') {
    const p = clamp01((t - HARD_OPEN_AT.smash) / 1.2);
    const walk = ease(clamp01(p * 2.4));
    const x = cx - 40 + walk * 40;
    evolvedCover(ctx, ALBUMS[4], x, fy - (1 - walk) * 14, fsize * (0.7 + walk * 0.3), 1, time);
    // 집어 든 왕관 — 크게 그려야 "내 것" 이라는 게 읽힌다
    const top = fy - fsize / 2 - 14;
    if (p < 0.55) {
      ctx.save();
      ctx.translate(x, top);
      ctx.scale(2.4, 2.4);
      drawCrown(ctx, -5, -4, time);
      ctx.restore();
    } else {
      // 쪼갠다
      const k = (p - 0.55) / 0.45;
      ctx.save();
      ctx.fillStyle = '#ffd166';
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + 0.3;
        ctx.globalAlpha = Math.max(0, 1 - k);
        ctx.fillRect(
          Math.round(x + Math.cos(a) * k * 46),
          Math.round(top + Math.sin(a) * k * 26 + k * k * 40),
          3,
          3,
        );
      }
      ctx.restore();
    }
    return;
  }

  // 인질 — 보스전에서 그녀가 왜 갇혀 있는지를 여기서 설명한다
  const p = clamp01((t - HARD_OPEN_AT.cage) / 1.3);
  const walk = ease(clamp01(p * 2.4));
  const x = cx + 34 - walk * 34;
  evolvedCover(ctx, ALBUMS[9], x, fy - (1 - walk) * 14, fsize * (0.7 + walk * 0.3), 1, time);
  drawCage(ctx, x, fy - fsize / 2 - 20 - ease(p) * 12, time);

}

// ── 2회차 엔딩: 차트가 무대가 된다 ──────────────────────────
//
// 1회차 엔딩은 결혼식이었다. 사적인 결말이라 같은 걸 또 보여주면 두 번 달린 값이 없다.
// 여기는 **가수로서의 결말**이다 — 나를 막아섰던 열일곱 장이 관객으로 앉고,
// 그 앞에 내가 선다. #100 방구석에서 시작한 이야기가 여기서 닫힌다.

/** 무대 바닥 높이 */
const HE_STAGE_Y = 138;

/** 무대 조명 한 줄기 — 위에서 부채꼴로 내려온다 */
function drawSpot(ctx, x, w, color, alpha, sweep) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - 4, 0);
  ctx.lineTo(x + 4, 0);
  ctx.lineTo(x + w / 2 + sweep, HE_STAGE_Y);
  ctx.lineTo(x - w / 2 + sweep, HE_STAGE_Y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** 픽셀 별 — 두 번째 1위에는 ★ 가 붙는다 */
function drawStar(ctx, cx, cy, r, time) {
  if (r <= 0) return;
  const spin = Math.sin(time * 2) * 0.08;
  ctx.save();
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2 + spin;
    const d = i % 2 ? r * 0.44 : r;
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff3c4';
  ctx.fillRect(Math.round(cx - r * 0.2), Math.round(cy - r * 0.5), Math.max(1, Math.round(r * 0.2)), 2);
  ctx.restore();
}

/** 관객이 된 앨범 열일곱 장. 흩어진 자리에서 무대 아래로 모인다 */
function drawAudience(ctx, gather, cool, time) {
  const base = VIEW.h - 16;
  if (gather > 0.5) {
    ctx.save();
    ctx.globalAlpha = (gather - 0.5) * 2;
    ctx.fillStyle = '#1a1026';
    ctx.fillRect(0, base + 8, VIEW.w, VIEW.h - base - 8);
    ctx.restore();
  }
  for (let i = 0; i < ALBUMS.length; i++) {
    const row = i % 2;
    const col = Math.floor(i / 2);
    const toX = 16 + col * 40 + row * 20;
    const toY = base - row * 16;
    // 흩어져 있던 자리 (엔딩 1부의 scatterAt 과 같은 배치라 이어지는 그림이 된다)
    const from = scatterAt(i, 1, time);
    const x = from.x + (toX - from.x) * gather;
    const jump = gather >= 1 ? Math.abs(Math.sin(time * 4 + i * 0.7)) * 5 : 0;
    const y = from.y + (toY - from.y) * gather - jump;
    // 아직 다 안 식었으면 벌건 기가 남아 있다
    evolvedCover(ctx, ALBUMS[i], x, y, 14, Math.max(0, 1 - cool), time);
    // 야광봉 — 관객이라는 게 한눈에 읽혀야 한다
    if (gather < 0.6) continue;
    ctx.save();
    ctx.globalAlpha = (gather - 0.6) * 2.5;
    ctx.fillStyle = i % 3 === 0 ? '#39ff9a' : i % 3 === 1 ? '#8fd8ff' : '#ffd166';
    const wave = Math.sin(time * 4 + i) * 3;
    ctx.fillRect(Math.round(x + 7), Math.round(y - 12 + wave), 2, 9);
    ctx.restore();
  }
}

function drawHardEndCut(ctx, t, phase, time) {
  const cx = VIEW.w / 2;
  ctx.fillStyle = '#0a0410';
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);

  // ── 풀려난다 ────────────────────────────────────────────
  if (phase === 'free') {
    const p = clamp01((t - HARD_END_AT.free) / 1.6);
    ctx.save();
    ctx.fillStyle = `rgba(255,255,255,${Math.max(0, 0.9 - p * 1.3)})`;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    ctx.restore();
    drawCage(ctx, cx, 74, time, p);
    return;
  }

  const cool = clamp01((t - HARD_END_AT.calm) / 1.5);
  const stage = t >= HARD_END_AT.stage ? ease((t - HARD_END_AT.stage) / 1.4) : 0;
  const gather = t >= HARD_END_AT.crowd ? ease((t - HARD_END_AT.crowd) / 1.4) : 0;
  const encore = t >= HARD_END_AT.encore ? clamp01((t - HARD_END_AT.encore) / 1.0) : 0;

  // ── 무대 뒤 조명 ────────────────────────────────────────
  if (stage > 0) {
    const sweep = Math.sin(time * 1.6) * 40;
    drawSpot(ctx, 70, 90, '#7c5cff', 0.14 * stage + encore * 0.1, sweep);
    drawSpot(ctx, cx, 100, '#ffd166', 0.16 * stage + encore * 0.12, -sweep * 0.6);
    drawSpot(ctx, VIEW.w - 70, 90, '#ff5d8f', 0.14 * stage + encore * 0.1, -sweep);
  }

  // ── 차트 막대가 솟아 무대가 된다 ────────────────────────
  const top = VIEW.h - (VIEW.h - HE_STAGE_Y) * stage;
  if (stage > 0) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    for (let i = 0; i < 10; i++) {
      const h = (26 + ((i * 29) % 64)) * stage;
      ctx.fillStyle = i % 2 ? '#3a1f52' : '#4a2a66';
      ctx.fillRect(i * 40 + 4, top - h, 30, h);
    }
    ctx.restore();
    // 무대 상판
    ctx.fillStyle = '#241a33';
    ctx.fillRect(0, top, VIEW.w, VIEW.h - top);
    ctx.fillStyle = '#5c4a70';
    ctx.fillRect(0, top, VIEW.w, 3);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(0, top + 3, VIEW.w, 1);
  }

  // ── 적이 관객이 된다 ────────────────────────────────────
  drawAudience(ctx, gather, cool, time);

  // ── 둘이 무대에 선다 ────────────────────────────────────
  if (t >= HARD_END_AT.duet) {
    const up = ease((t - HARD_END_AT.duet) / 0.9);
    const standY = top - 16 + (1 - up) * 30;
    const groomX = cx - 26;
    const brideX = cx + 6;
    ctx.save();
    ctx.globalAlpha = up;
    drawSprite(ctx, playerFrame({ onGround: true, vx: 0 }), groomX, standY - 4);
    drawCrown(ctx, groomX + 1, standY - 13, time);
    drawSprite(ctx, BRIDE, Math.round(brideX), Math.round(top - BRIDE.h));
    // 마이크가 둘이다 — 이번엔 같이 부른다
    for (const [mx, my] of [
      [groomX + 13, standY - 2],
      [brideX + 20, top - BRIDE.h + 8],
    ]) {
      ctx.save();
      ctx.translate(Math.round(mx), Math.round(my));
      drawMicShape(ctx, 9);
      ctx.restore();
    }
    ctx.restore();
  }

  // ── 앙코르 — 조명이 터지고 종이가 날린다 ────────────────
  if (encore > 0) {
    const since = t - HARD_END_AT.encore;
    ctx.save();
    for (let i = 0; i < 70; i++) {
      const a = (i / 70) * Math.PI * 2 + noise(i, 31) * 0.6;
      const speed = 30 + noise(i, 32) * 80;
      const x = cx + Math.cos(a) * speed * since;
      const y = HE_STAGE_Y - 20 + Math.sin(a) * speed * since * 0.6 + since * since * 26;
      if (y > VIEW.h || y < -4) continue;
      ctx.globalAlpha = Math.max(0, 1 - since / 4);
      ctx.fillStyle = ['#ffd166', '#ff9ec4', '#7ee0a0', '#8fbaff', '#fff6ef'][i % 5];
      ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
    }
    ctx.restore();
  }

  // ── ★ 두 번째 1위 ──────────────────────────────────────
  if (phase !== 'star' && phase !== 'end') return;
  const pop = ease((t - HARD_END_AT.star) / 0.6);
  drawStar(ctx, cx, 24, 17 * pop, time);
  // 무대 위의 둘을 가리지 않게 위쪽에 얹는다 — 이 컷의 주인공은 저 둘이다
  drawCutTitle(ctx, '#1', t - HARD_END_AT.star - 0.3, 4, 46);
}

