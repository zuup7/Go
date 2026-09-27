// 보스를 그린다 — 몸 셋(원반·로봇·공룡)과 그 부속.
//
// **어떤 몸인지도 어떤 자세인지도 여기서 안 정한다.** core/boss.js 의
// bossBody·bossPose 가 정하고 여기는 물어보기만 한다. 컷신(sceneCuts.js)도
// 같은 몸을 그려야 해서 이 파일에서 가져다 쓴다 — 반대로 부르면 안 된다.

import { TILE } from '../core/physics.js';
import { drawCoverAt } from './albumArt.js';
import { drawSprite, makeCanvas } from './pixel.js';
import { DISC, BRIDE } from './sprites.js';
import { ALBUMS } from '../data/albums.js';
import { VIEW } from '../core/game.js';
import {
  bossPhase,
  bossHealthRatio,
  bossGhostRatio,
  princessCaged,
  bossBody,
  bossPose,
  NEUTRAL_POSE,
  laserBeams,
  tailBand,
  shockWaves,
  whirlGapX,
} from '../core/boss.js';
import {
  DARK,
  HORN,
  LIT,
  METAL,
  VINYL,
  RB,
  ROBOT_TOP,
  ROBOT_BOTTOM,
  armorCover,
  clamp01,
  coreRadius,
  ease,
  housingHalf,
  plate,
  slam,
  wedge,
} from './sceneParts.js';

// ── 보스 ────────────────────────────────────────────────────

/**
 * 고정 체력계 자리.
 *
 * DOM HUD 가 양 끝을 쓴다 — 왼쪽 `#순위`(x 6..17), 오른쪽 `PHASE`·시계(x 332..378).
 * 그 사이를 지나가야 글자 위에 안 겹친다.
 */
const HP_BAR = { x: 26, y: 6, w: 300, h: 6 };

/**
 * 보스 체력계. **화면 위 한 자리에 고정**이다.
 *
 * 예전에는 보스 몸 바로 아래에 붙여 따라다녔다. 화면을 안 가리는 건 좋았는데,
 * 이 보스는 **떠 있는 기계**라 발밑이 곧 추진기 자리다 — 체력계가 거기 붙어 있는
 * 한 부스트를 7픽셀보다 길게 뽑을 수가 없었다. 자리를 비켜주는 쪽을 골랐다.
 *
 * 그리는 순서가 중요하다: `drawBoss` **앞**에서 불러야 공주 새장이 바 앞에 걸린다.
 * 새장은 보스가 떠 있을 때 화면 꼭대기(y≈1..27)를 쓰는데, 바가 위에 덮이면
 * UI 가 공주를 가린다. 300픽셀 중 26픽셀이 가려지는 쪽이 낫다.
 */
export function drawBossHealth(ctx, boss, color) {
  const { x, y, w } = HP_BAR;
  ctx.fillStyle = 'rgba(6,2,14,0.8)';
  ctx.fillRect(x - 1, y - 1, w + 2, 7);
  ctx.fillStyle = '#2a1740';
  ctx.fillRect(x, y, w, 5);
  const ratio = bossHealthRatio(boss);
  // **방금 깎인 만큼**을 붉게 남긴다. 한 대가 3분의 1이라 순식간에 줄어드는데,
  // 잔상이 없으면 언제 얼마나 들어갔는지 눈이 못 따라간다. (boss.ghostHp 를
  // core 가 체력 쪽으로 천천히 끌어당긴다 — 그려지는 쪽에서 상태를 만들지 않는다)
  const ghost = Math.max(ratio, bossGhostRatio(boss));
  if (ghost > ratio) {
    ctx.fillStyle = '#ff2e63';
    ctx.fillRect(x, y, Math.round(w * ghost), 5);
  }
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
export function drawBossCore(ctx, cx, cy, open, time, rad = 11) {
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
export function drawFists(ctx, boss, ox, oy, color) {
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

/**
 * 마지막으로 구워둔 거대 로봇의 크기. **giantCanvas() 를 부른 뒤에** 읽어야 한다.
 * 굽는 것과 크기를 따로 내보내면 순서를 틀리기 쉬워서, 함수로 감싸 그때그때 읽게 뒀다.
 */
export const giantSize = () => giantBaked;

export function giantCanvas(color, dino = false) {
  // 열쇠에 형태를 같이 넣는다 — 색만 보면 공룡으로 바뀌어도 로봇 그림이 남는다
  if (giantBaked?.color === color && giantBaked?.dino === dino) return giantBaked.canvas;
  const r = GIANT_R;
  const top = r * ROBOT_TOP;
  const w = Math.ceil(r * 2.8);
  const h = Math.ceil(r * (ROBOT_BOTTOM - ROBOT_TOP)) + 4;
  const canvas = makeCanvas(w, h);
  const c = canvas.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.translate(Math.round(w / 2), Math.round(-top + 2));
  if (dino) drawDinoBody(c, r, 0, color, false);
  else drawRobotBody(c, r, 0, color, 1, false);
  drawBossCore(c, 0, 0, false, 0, coreRadius(r));
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'source-atop';
  c.fillStyle = 'rgba(58,24,92,0.86)';
  c.fillRect(0, 0, w, h);
  giantBaked = { color, dino, canvas, w, h, top };
  return canvas;
}

export function drawGiantRobot(ctx, boss, ox, time) {
  const down = boss.state === 'defeated';
  // 쓰러지면 배경도 같이 꺼진다 — 이겼는데 뒤에 그대로 서 있으면 안 진 것 같다
  const fade = down ? Math.max(0, 1 - boss.defeatedAt / 1.6) : 1;
  if (fade <= 0) return;

  const canvas = giantCanvas(bossPhase(boss).color, !!bossPhase(boss).dino);
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
export function drawSparks(ctx, cx, cy, r, since, color) {
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

/**
 * 하드 1·2페이즈의 몸 — **진화한 원반**.
 *
 * 보통 모드의 원반은 매끈한 LP 였다. 여기 있는 건 1회차에서 내가 밟아 부순 걸
 * 도로 붙여 만든 것이라, 몸이 갈라져 있고 그 틈으로 붉은 열이 샌다.
 *
 * **무섭게 보이는 건 표면 무늬가 아니라 실루엣이다.** 몸이 56px 짜리라
 * 안에 아무리 그려 넣어도 멀리서는 뭉개진다. 그래서 뿔을 길고 어둡게 뻗어
 * **원을 깨뜨린다** — 매끈한 원(1회차)과 톱니 실루엣(2회차)은 한눈에 갈린다.
 *
 * **열일곱 장은 쇠 소켓에 물려 박혀 있다.** 그냥 얹으면 스티커로 보인다.
 * 다만 소켓은 **어둡다** — armorCover 의 밝은 테를 열일곱 개 두르면 몸이
 * 사진 격자로 보이고, 저것들이 몸을 이룬다는 게 안 읽힌다.
 *
 * 두 고리 사이와 사이사이는 **일부러 비워둔다.** 빈틈으로 검은 몸과 붉은 금이
 * 보여야 "앨범이 몸에 박힌 것"이지, 꽉 채우면 "앨범을 붙인 판"이 된다.
 * 앨범 위에 눈은 안 그린다 — 6px 커버에 눈을 그리면 어느 앨범인지가 사라진다.
 *
 * grade 0 = 1페이즈, 1 = 2페이즈. 같은 몸이 한 단계 더 자란 것으로 보여야
 * 3페이즈의 공룡 변신이 갑자기 튀어나온 게 아니게 된다.
 */
export function drawEvolvedDisc(ctx, r, time, color, hurt, grade = 0, spin = 0, pose = null) {
  const breathe = 1 + Math.sin(time * 2.2) * 0.03;
  // 약점이 열리면 **껍질이 벌어지고 속이 달아오른다.** 가운데 재생버튼 하나로만
  // 알리면 지금 쳐도 되는지가 안 보인다 — 몸이 말해줘야 한다.
  const spread = pose ? pose.spread : 0;
  const heat = Math.min(1, (0.5 + Math.sin(time * 4) * 0.5) * (1 - spread) + spread);
  ctx.save();
  ctx.scale(breathe, breathe);

  // ── 뿔. 몸보다 느리게 돈다 — 같은 속도로 돌면 통째로 도는 바퀴가 된다
  ctx.save();
  ctx.rotate(spin * 0.45);
  const horns = 8 + grade * 4;
  for (let i = 0; i < horns; i++) {
    const a = (i / horns) * Math.PI * 2;
    // 길이를 하나씩 어긋나게 — 고르게 뻗으면 톱니바퀴가 되고 살아 있지 않다
    const len = r * (0.4 + 0.28 * grade) * (0.66 + ((i * 3) % 4) * 0.17);
    const tip = a + 0.2; // 한쪽으로 휜다
    const tx = Math.cos(tip) * (r + len);
    const ty = Math.sin(tip) * (r + len);
    wedge(
      ctx,
      [
        [Math.cos(a - 0.24) * r * 0.86, Math.sin(a - 0.24) * r * 0.86],
        [tx, ty],
        [Math.cos(a + 0.24) * r * 0.86, Math.sin(a + 0.24) * r * 0.86],
      ],
      { hurt, face: HORN, edge: '#000000', lit: '#cbb8e8' },
    );
    if (hurt) continue;
    // 끝이 벌겋게 달아 있다. 날 안쪽까지 물들여야 '달군 쇠'지, 끝에만 찍으면 핀 대가리다
    ctx.save();
    ctx.globalAlpha = 0.45 + heat * 0.45;
    ctx.fillStyle = '#ff3b3b';
    ctx.beginPath();
    ctx.moveTo(Math.cos(a - 0.13) * (r + len * 0.35), Math.sin(a - 0.13) * (r + len * 0.35));
    ctx.lineTo(tx, ty);
    ctx.lineTo(Math.cos(a + 0.13) * (r + len * 0.35), Math.sin(a + 0.13) * (r + len * 0.35));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // ── 몸에서 새는 열. 검은 덩어리만 있으면 식은 쇳덩이로 보인다
  if (!hurt) {
    const glow = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 1.5);
    glow.addColorStop(0, `rgba(255,46,99,${0.3 + heat * 0.2})`);
    glow.addColorStop(1, 'rgba(255,46,99,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 몸 — 검은 덩어리. 앨범 사이로 이게 보여야 "박혀 있다"가 된다
  ctx.fillStyle = hurt ? '#ffffff' : VINYL;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // ── 박힌 앨범 열일곱 장. 두 고리는 **반대로** 돈다 — 통째로 도는 원반과
  //    "따로따로 박혀 있는 것들"은 여기서 갈린다.
  // 안쪽 고리는 코어 밖에서 시작하고, 바깥 고리는 안쪽 고리 밖에서 시작한다 —
  // 겹치면 두 겹이 한 덩어리로 뭉개져서 몇 장이 박혀 있는지가 안 세어진다.
  const rings = [
    { n: 10, d: 0.86, s: 0.26, dir: 1 },
    { n: ALBUMS.length - 10, d: 0.56, s: 0.22, dir: -0.55 },
  ];
  let idx = 0;
  for (const ring of rings) {
    for (let k = 0; k < ring.n; k++) {
      const a = (k / ring.n) * Math.PI * 2 + spin * ring.dir + (ring.dir < 0 ? Math.PI / ring.n : 0);
      const d = ring.d + spread * 0.13;
      const px = Math.cos(a) * r * d;
      const py = Math.sin(a) * r * d;
      const size = Math.max(5, Math.round(r * ring.s));
      // 소켓 — 어두운 쇠테. 커버는 이 안에 물린다
      plate(ctx, px - size / 2 - 1, py - size / 2 - 1, size + 2, size + 2, {
        hurt,
        face: DARK,
        edge: DARK,
        lit: METAL,
      });
      if (!hurt) {
        drawCoverAt(ctx, ALBUMS[idx], Math.round(px - size / 2), Math.round(py - size / 2), size);
        // 몸에서 나온 열이 커버에도 비친다 — 열일곱 장이 한 몸으로 묶인다.
        // 다만 **옅게.** 진하게 덮으면 죄다 붉은 네모가 되고, 어느 앨범이 박혀 있는지가
        // 안 보인다 — 저것들이 1회차에서 밟은 그 앨범이라는 게 이 보스의 정체다.
        ctx.save();
        ctx.globalAlpha = 0.1 + heat * 0.1 + grade * 0.05;
        ctx.fillStyle = '#ff2e63';
        ctx.fillRect(Math.round(px - size / 2), Math.round(py - size / 2), size, size);
        ctx.restore();
      }
      idx++;
    }
  }

  // ── 벌어진 틈에서 속이 달아오른다. 앨범이 밀려난 자리를 이 빛이 메운다.
  if (!hurt && spread > 0.02) {
    ctx.save();
    ctx.globalAlpha = spread * 0.85;
    const inner = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
    inner.addColorStop(0, '#fff0f3');
    inner.addColorStop(0.45, '#ff2e63');
    inner.addColorStop(1, 'rgba(255,46,99,0)');
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ── 갈라진 금. **앨범을 그린 뒤**에 긋는다 — 밑에 깔면 소켓이 덮어서
  //    한 픽셀도 안 보인다. 바깥 고리 열 개 **사이**를 지나게 각도를 맞추고
  //    같은 속도로 돌리니 금은 계속 그 틈에 머문다. 곧게 그으면 바퀴살이
  //    되므로 한 번 꺾는다.
  if (!hurt) {
    ctx.save();
    ctx.rotate(spin);
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const a = ((i * 2 + 1) / 10) * Math.PI * 2;
      // 짧게, 바깥 테 쪽만. 가운데까지 길게 그으면 앨범 위를 쓸고 지나가서
      // 몸이 갈라진 게 아니라 빛나는 바람개비로 보인다.
      const path = () => {
        ctx.beginPath();
        ctx.moveTo(Math.cos(a - 0.07) * r * 0.68, Math.sin(a - 0.07) * r * 0.68);
        ctx.lineTo(Math.cos(a + 0.05) * r * 0.86, Math.sin(a + 0.05) * r * 0.86);
        ctx.lineTo(Math.cos(a - 0.03) * r * 1.03, Math.sin(a - 0.03) * r * 1.03);
      };
      // 붉은 번짐 위에 흰 심 — 한 겹만 그으면 어두운 몸에 묻혀서 안 보인다
      ctx.globalAlpha = 0.35 + heat * 0.3;
      ctx.strokeStyle = '#ff2e63';
      ctx.lineWidth = 3;
      path();
      ctx.stroke();
      ctx.globalAlpha = 0.55 + heat * 0.35;
      ctx.strokeStyle = '#ffd7de';
      ctx.lineWidth = 1;
      path();
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── 바깥 테 — 몸이 여기서 끝난다
  if (!hurt) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.55 + heat * 0.35;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

export function drawBoss(ctx, boss, ox, oy, time) {
  const cx = boss.x - ox + boss.w / 2;
  const cy = boss.y - oy + boss.h / 2;
  const phaseColor = bossPhase(boss).color;
  const r = boss.w / 2;

  // 어떤 몸인지도, 어떤 자세인지도 core/boss.js 한 곳에서만 정한다
  const body = bossBody(boss);
  const pose = bossPose(boss);

  /**
   * 지금 뭘 하는 중인지 몸으로 보여준다 — 겨눌 때 움츠러들고, 맞으면 밀리고,
   * 약점이 열리면 부푼다. 몸 셋(원반·로봇·공룡)이 **같은 변형을 쓴다**:
   * 부위마다 따로 적으면 셋이 제각각 움직여서 같은 놈으로 안 보인다.
   */
  const poseWrap = (draw) => {
    ctx.save();
    ctx.translate(cx + pose.recoil * pose.recoil * 7, cy - pose.recoil * 3);
    // 겨눌 때 세로로 눌리고, 열릴 때 부푼다
    ctx.scale(1 / pose.squash, pose.squash * (1 + pose.spread * 0.06));
    draw();
    ctx.restore();
  };

  // 3페이즈는 합체한 로봇이다 — 원반이 어깨가 되고 마디 나뉜 팔다리가 붙는다.
  // 격파해도 로봇으로 남긴다. 이긴 순간에 몸이 도로 원반으로 바뀌면 이긴 것 같지가 않다.
  if (body === 'robot' || body === 'dino') {
    const down = boss.state === 'defeated';
    poseWrap(() => {
      // 쓰러질 때는 옆으로 기운다 (다 돌지는 않는다 — 로봇은 구르지 않는다)
      if (down) ctx.rotate(Math.min(0.7, boss.defeatedAt * 0.6));
      // 하드 3페이즈부터는 **공룡로봇**이다. 껍질을 찢고 나온 모습이라
      // 서 있는 로봇과 실루엣이 아예 다르다 (가로로 길고 목과 꼬리가 뻗는다).
      if (body === 'dino') drawDinoBody(ctx, r, time, phaseColor, boss.hurtFlash > 0, pose);
      // 로봇도 **같은 포즈를 받는다.** 예전에는 안 넘겨줘서 84픽셀 공중에 떠 있든
      // 땅을 딛고 있든 똑같이 굳어 있었다 — 그게 「허공에 떠 있는 것 같다」의 정체다.
      else drawRobotBody(ctx, r, time, phaseColor, 1, boss.hurtFlash > 0, pose);
    });
    drawBossCore(ctx, cx, cy, boss.vulnerable, time);
    if (down) drawSparks(ctx, cx, cy, r, boss.defeatedAt, phaseColor);
    else drawFists(ctx, boss, ox, oy, phaseColor);
    if (princessCaged(boss)) drawCage(ctx, cx, cy + r * ROBOT_TOP - 16, time);
    return;
  }

  // 하드 1·2페이즈는 **진화한 원반**이다. 매끈한 LP 를 그대로 쓰면 2회차인데도
  // 1회차와 똑같은 놈이 나온 것이 되고, 3페이즈의 공룡 변신도 뜬금없어진다.
  if (body === 'evolved') {
    poseWrap(() =>
      drawEvolvedDisc(ctx, r, time, phaseColor, boss.hurtFlash > 0, boss.phaseId >= 2 ? 1 : 0, boss.spin, pose),
    );
    drawBossCore(ctx, cx, cy, boss.vulnerable, time);
    drawQuarterShards(ctx, boss, ox, oy, phaseColor);
    if (princessCaged(boss)) drawCage(ctx, cx, boss.y - oy - 30, time);
    return;
  }

  ctx.save();
  ctx.translate(cx + pose.recoil * pose.recoil * 7, cy - pose.recoil * 3);
  ctx.scale(1 / pose.squash, pose.squash * (1 + pose.spread * 0.06));
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

  drawQuarterShards(ctx, boss, ox, oy, phaseColor);

  // 싸우는 내내 그녀가 보스 위에 갇혀 있다 — 왜 여기까지 왔는지가 화면에 남아 있어야 한다
  if (princessCaged(boss)) drawCage(ctx, cx, boss.y - oy - 26, time);
}

/** 넷으로 쪼개진 조각 — 페이즈 색으로 테를 둘러 어느 페이즈인지 눈에 들어오게 */
export function drawQuarterShards(ctx, boss, ox, oy, color) {
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
}

/** 보스가 흘린 마이크(바닥)와 던진 마이크(공중) */
export function drawMics(ctx, game, ox, oy, time) {
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

export function drawMicShape(ctx, size) {
  const s = size / 10;
  ctx.fillStyle = '#d8dde8';
  ctx.fillRect(3 * s, 0, 4 * s, 5 * s); // 헤드
  ctx.fillStyle = '#8b93a8';
  ctx.fillRect(4 * s, 5 * s, 2 * s, 5 * s); // 손잡이
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(3 * s, 0, 4 * s, 2 * s);
}

/**
 * 어깨 견갑 — **반으로 쪼개진 원반**. 홈까지 그대로 남겨둔다.
 * 변신 전 물건이 몸에 남아 있어야 합체 로봇으로 읽힌다.
 */
export function pauldron(ctx, x, y, rad, side, color, hurt, cover) {
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
/**
 * 공룡로봇 — 하드 3페이즈부터의 몸.
 *
 * **박혀 있는 앨범이 이 보스의 정체다.** 1회차에서 우리가 밟아 없앤 열일곱 장이
 * 진화해서 돌아온 것이라, 등판·허벅지·목덜미에 그때 그 커버가 그대로 박혀 있다.
 * 그래서 armorCover 를 로봇 몸과 똑같이 쓴다 — 새 그림 규칙을 만들지 않는다.
 *
 * 서 있는 로봇과 **실루엣이 확실히 달라야** 변신이 읽힌다. 로봇은 세로로 길고
 * 좌우 대칭인데, 이쪽은 가로로 길고 목과 꼬리가 양쪽으로 뻗는다.
 */
/**
 * 공룡로봇의 몸.
 *
 * 움직임 값은 **전부 core 의 bossPose 에서 온다** (swing·paw·jaw·stride).
 * 여기서 boss.state 를 보고 계산하면 판정과 그림이 서로 다른 시계를 보게 된다.
 *
 * pose 에 기본값을 두는 게 중요하다 — giantCanvas() 가 추격 판의 거대 로봇을
 * 구울 때 보스 없이 이 함수를 부른다. 기본 자세가 없으면 구워둔 거인이 공격
 * 자세로 굳는다.
 */
/**
 * 공룡로봇의 몸.
 *
 * grow 는 **조립 진행도** 0~1 이다. 로봇(drawRobotBody)과 **같은 규칙**으로
 * 부위를 다섯 단계에 나눠 하나씩 꽂는다 — 뒷다리 · 몸통 · 꼬리 · 앞발 · 목머리.
 * 단계 수를 로봇과 맞춰야 합체 컷신의 시계(assembleAt)를 둘이 같이 쓸 수 있다.
 *
 * 2회차 변신은 「알에서 깨어난다」가 아니라 **「조립된다」**여야 한다 —
 * 1회차에서 부품을 불러 모아 로봇을 만든 그 공장에서 나온 물건이라야
 * 두 회차가 한 이야기로 읽힌다.
 */
export function drawDinoBody(ctx, r, time, color, hurt = false, pose = NEUTRAL_POSE, grow = 1) {
  const opt = { hurt };
  const hot = { hurt, face: color, lit: '#ffffff' };
  const px = (v) => v * r;
  /** 조립 다섯 단계 중 i 번째가 얼마나 꽂혔나 (로봇과 같은 계산) */
  const P = (i) => clamp01((grow - i * 0.2) / 0.2);
  const done = grow >= 1;
  const swing = pose.swing ?? 0;
  const paw = pose.paw ?? 0;
  const jaw = pose.jaw ?? 0;
  // 걸음은 **움직인 거리**로 돈다. 한 걸음에 이만큼(px) 가면 한 바퀴.
  const step = Math.sin(((pose.stride ?? 0) / 13) * Math.PI * 2);
  /**
   * 이 놈도 **떠 있는 기계**다 (homeY 40, 바닥에서 84px 위). 로봇과 똑같이
   * 높이를 몰라서 공중에 있든 땅을 딛든 같은 그림이었다.
   */
  // 조립 중에는 뜨지도 기울지도 않는다 — 부품이 제자리에 잠긴 걸로 보여야 한다
  const rise = done ? (pose.lift ?? 0) : 0;
  const lean = done ? (pose.lean ?? 0) : 0;
  // 숨쉬기. 뜰수록 크게 출렁인다 — 로봇 hover 와 같은 규칙이다.
  // 꼬리를 휘두르거나 발을 꽂는 동안에는 숨보다 그 동작이 커서 묻는다.
  const breathe =
    Math.sin(time * 2.4) * (1.5 + rise * 3.2) * (1 - Math.min(1, Math.abs(swing) + Math.abs(paw)));

  ctx.save();
  ctx.translate(0, Math.round(breathe));
  // 미는 쪽으로 기운다. 가로로 긴 몸이라 로봇보다 조금만 기울여야 미끄러져 보이지 않는다
  if (lean && rise) ctx.rotate(lean * rise * 0.045);

  // ── 꼬리 — 마디를 이어 붙인 사슬. swing 으로 감기고 휘둘린다.
  // 마디마다 조금씩 더 꺾어 호를 만든다. 뒤 마디는 덜, 끝은 더 — 통째로 같은
  // 각도로 돌리면 휘두르는 게 아니라 막대기가 회전하는 것으로 보인다.
  // 조립할 때는 **뒤에서** 날아와 꽂힌다 (2단계)
  slam(ctx, P(2), -110, 0, () => {
  ctx.save();
  ctx.translate(-px(0.55), -px(0.02));
  for (let i = 0; i < 5; i++) {
    const t = i / 5;
    // 마디 회전이 쌓이므로 한 마디 몫은 작아야 한다. 0.30 으로 했더니 다섯 마디가
    // 합쳐 2라디안이 넘어서 꼬리가 몸 위로 말려 올라갔다 (소용돌이가 됐다).
    ctx.rotate(-(0.05 + swing * 0.16) * (0.6 + t * 0.8));
    const w = px(0.3 - t * 0.2);
    plate(ctx, -px(0.28), -w / 2, px(0.3), w, opt);
    ctx.translate(-px(0.26), 0);
  }
  // 꼬리 끝의 날 — 이게 바닥을 훑는 그 꼬리다
  ctx.rotate(-swing * 0.3);
  plate(ctx, -px(0.34), -px(0.05), px(0.34), px(0.1), hot);
  ctx.restore();
  });

  // ── 뒷다리 (몸통 뒤) — 굵은 허벅지 + 꺾인 정강이.
  // 좌우가 반대 위상으로 굽어 걷는 것처럼 보인다. 발을 꽂는 동안에는 둘 다
  // 버틴다 (한쪽 발만 들고 내리찍으면 넘어질 자세다).
  slam(ctx, P(0), 0, 90, () => {
  for (const side of [-1, 1]) {
    const x = side * px(0.26);
    // 걸을 때 발이 오르내리는 몫. **pose.lift(뜬 높이)와 다른 것이다** —
    // 이름이 겹치면 한쪽이 조용히 가려져서 걸음이 사라진다.
    const footLift = paw < 0 ? 0 : step * side * px(0.07);
    // 떠 있으면 뒷다리가 아래로 늘어진다 (땅을 안 딛으니 버틸 이유가 없다)
    const dangle = rise * px(0.08) * (1 + Math.sin(time * 2.4 + side) * 0.3);
    plate(ctx, x - px(0.24), px(0.16), px(0.48), px(0.42), opt);
    armorCover(ctx, ALBUMS[side < 0 ? 3 : 12], x, px(0.36), px(0.26), hurt);
    plate(ctx, x - px(0.15), px(0.56) - footLift, px(0.3), px(0.34) + dangle, opt);
    // 발 — 앞으로 튀어나온 세 발톱
    plate(ctx, x - px(0.22), px(0.88) - footLift + dangle, px(0.52), px(0.14), opt);
    for (let i = 0; i < 3; i++) {
      plate(ctx, x + px(0.16) + i * px(0.06), px(0.9) - footLift + dangle, px(0.05), px(0.08), hot);
    }
  }
  });

  // ── 몸통 — 가로로 긴 통. 등에 앨범이 줄줄이 박혀 있다. 위에서 내려와 꽂힌다 (1단계)
  slam(ctx, P(1), 0, -90, () => {
  wedge(
    ctx,
    [
      [-px(0.62), -px(0.06)],
      [px(0.5), -px(0.26)],
      [px(0.62), px(0.3)],
      [-px(0.56), px(0.34)],
    ],
    opt,
  );
  for (let i = 0; i < 4; i++) {
    armorCover(ctx, ALBUMS[i * 3 + 2], -px(0.4) + i * px(0.28), px(0.06), px(0.22), hurt);
  }
  // 등지느러미 — 공룡으로 읽히게 하는 결정적인 실루엣
  for (let i = 0; i < 5; i++) {
    const bx = -px(0.5) + i * px(0.24);
    const h = px(0.18 + Math.sin(i * 0.9) * 0.08);
    wedge(ctx, [[bx, -px(0.1)], [bx + px(0.1), -px(0.1) - h], [bx + px(0.2), -px(0.1)]], hot);
  }
  });

  // ── 앞발 — 짧고 접혀 있다. paw 가 +면 치켜들고(예고), −면 내리꽂는다.
  slam(ctx, P(3), 70, 0, () => {
  for (const side of [-1, 1]) {
    const x = px(0.42) + side * px(0.06);
    ctx.save();
    // 발이 8px 짜리라 **각도만 돌리면 안 보인다.** 어깨째 들어 올려야 읽힌다.
    ctx.translate(x, px(0.06) - Math.max(0, paw) * px(0.26));
    // 내리찍는 중이 아니면 공중에서 앞발을 허우적거린다. 좌우가 엇갈려야
    // 매달린 인형이 아니라 균형을 잡는 짐승으로 보인다.
    const paddle = paw === 0 ? rise * Math.sin(time * 5.2 + side * 1.9) * 0.45 : 0;
    ctx.rotate(-paw * 0.85 + paddle);
    // 꽂을 때는 팔이 앞으로 뻗는다 (내던지는 길이가 곧 힘이다)
    const reach = Math.max(0, -paw);
    plate(ctx, -px(0.09), 0, px(0.18), px(0.24 + reach * 0.2), opt);
    plate(ctx, -px(0.08), px(0.28 + reach * 0.2), px(0.16), px(0.13 + reach * 0.06), hot);
    ctx.restore();
  }
  });

  // ── 목과 머리 — **마지막 철컥**. 위에서 얹힌다 (4단계)
  slam(ctx, P(4), 40, -90, () => {
  ctx.save();
  ctx.translate(px(0.5), -px(0.24));
  ctx.rotate(-jaw * 0.12);
  for (let i = 0; i < 4; i++) {
    const t = i / 4;
    plate(ctx, i * px(0.16), -i * px(0.14), px(0.26 - t * 0.06), px(0.26), opt);
  }
  armorCover(ctx, ALBUMS[8], px(0.22), -px(0.06), px(0.2), hurt);

  // ── 머리 — 긴 턱과 붉은 바이저. 아래턱이 jaw 만큼 벌어진다.
  const hx = px(0.56);
  const hy = -px(0.48);
  plate(ctx, hx, hy, px(0.5), px(0.26), opt);
  plate(ctx, hx + px(0.06), hy + px(0.07), px(0.34), px(0.08), { hurt, face: '#ff3b3b', lit: '#fff' });
  // 뿔
  wedge(ctx, [[hx + px(0.06), hy], [hx + px(0.16), hy - px(0.2)], [hx + px(0.22), hy]], hot);
  // 아래턱 — 턱 경첩(머리 뒤쪽)을 축으로 내려간다
  ctx.save();
  ctx.translate(hx + px(0.1), hy + px(0.24));
  ctx.rotate(jaw * 0.5);
  plate(ctx, 0, 0, px(0.44), px(0.12), opt);
  for (let i = 0; i < 4; i++) plate(ctx, px(0.04) + i * px(0.09), -px(0.06), px(0.05), px(0.06), hot);
  ctx.restore();
  ctx.restore();
  });

  ctx.restore();

  // ── 추진기 ──
  // 로봇과 **같은 함수**를 쓴다. 불길 생김새를 몸마다 따로 적으면 1회차 로봇과
  // 2회차 공룡이 다른 세계의 물건으로 보인다.
  // 기울기(lean) 밖에서 그린다 — 몸이 기울어도 불길은 아래로 떨어진다.
  if (done && rise > 0.02) {
    drawThrust(ctx, r, time, color, {
      lift: rise,
      hover: breathe,
      hurt,
      nozzles: [
        // 뒷발 두 짝 밑 — 이 몸의 주 추진기
        { x: -0.26, y: 1.02 },
        { x: 0.26, y: 1.02 },
        // 꼬리 밑동 아래 작은 것 하나. 가로로 긴 몸이라 뒤가 안 받치면 앞으로 고꾸라져 보인다
        { x: -0.5, y: 0.3, scale: 0.5 },
      ],
      /**
       * 공룡은 `r` 이 46(DINO_W/2)이라 로봇(28)보다 1.6배다. 같은 배수로 뽑으면
       * 불길이 몸보다 눈에 띄어서 **공룡이 아니라 불꽃놀이**로 보인다.
       * 화면에서 로봇과 비슷한 길이가 되게 되돌린다.
       */
      scale: 0.62,
      // 포효할 때(jaw) 확 뿜는다 — 공룡은 총이 없으니 여기가 힘주는 자리다
      boost: jaw * 0.45 + (pose.charge ?? 0) * 0.4,
      seed: 2,
    });
  }
}

/**
 * 팔 두 짝이 이 프레임에 어떤 각도인지. 어깨·팔꿈치 라디안과 총구 세기를 준다.
 *
 * **팔이 하는 일을 여기 한 곳에 모은다.** 그리는 쪽에 흩어놓으면 「쏠 때」와
 * 「겨눌 때」가 서로를 덮어써서 뭘 하는 중인지 안 읽힌다.
 *
 * 각도 부호: 캔버스는 시계방향이 +다. 아래로 늘어진 팔은 +로 돌리면 끝이
 * 오른쪽으로 간다. 그래서 **바깥으로 벌리려면 `-side`** 를 곱한다.
 *
 * 조립 중(done=false)에는 전부 0 이다 — 부품이 제자리에 잠긴 걸로 보여야 한다.
 */
function robotArms(time, pose, lift, done) {
  if (!done) return [ZERO_ARM, ZERO_ARM];
  const fire = pose.fire ?? 0;
  const charge = pose.charge ?? 0;
  const beam = pose.beam ?? 0;
  const spread = pose.spread ?? 0;
  const recoil = pose.recoil ?? 0;
  const lean = pose.lean ?? 0;

  return [-1, 1].map((side, i) => {
    // 떠 있는 동안 어깨가 오르내린다. 몸 출렁임(hover)과 **엇박**이라야
    // 통째로 위아래로 움직이는 게 아니라 팔이 따로 노는 걸로 보인다.
    const idle = Math.sin(time * 2.6 + Math.PI + i * 0.9) * lift;
    // 미는 쪽 반대로 끌린다 — 관성
    const trail = -lean * lift * 0.14;

    const shoulder =
      -side * (0.08 * lift + idle * 0.07) +
      trail +
      // 쏜 반동: 두 팔이 바깥으로 튕긴다. 0.85초마다 오므로 이 하나로 팔이 쉬지 않는다
      -side * fire * 0.45 +
      // 모을 때: 가슴 코어 쪽으로 오므리고 떤다
      side * charge * 0.5 +
      Math.sin(time * 40) * 0.05 * charge +
      // 쏘는 중: 활짝 벌려 버틴다 + 진동
      -side * beam * 0.85 +
      Math.sin(time * 33) * 0.06 * beam +
      // 약점이 열리면 팔을 젖혀 가슴을 드러낸다
      -side * spread * 0.55 +
      // 맞으면 뒤로 튕긴다
      -side * recoil * 0.3;

    const elbow =
      0.1 * lift +
      idle * 0.09 +
      fire * 0.4 - // 반동으로 접혔다 펴진다
      charge * 0.75 - // 모을 때 바짝 접는다
      beam * 0.2 + // 쏠 때 쭉 편다
      spread * 0.2 -
      recoil * 0.45;

    return { shoulder, elbow, muzzle: fire };
  });
}

/** 조립 중에 쓰는 「아무것도 안 하는 팔」 */
const ZERO_ARM = { shoulder: 0, elbow: 0, muzzle: 0 };

export function drawRobotBody(ctx, r, time, color, grow = 1, hurt = false, pose = NEUTRAL_POSE) {
  const opt = { hurt };
  const hot = { hurt, face: color, lit: '#ffffff' };
  const P = (i) => clamp01((grow - i * 0.2) / 0.2);
  const px = (v) => v * r;
  const done = grow >= 1;

  /**
   * 이 놈은 **떠 있는 기계**다. 예전에는 그걸 말해주는 게 1픽셀 위아래 흔들림
   * 하나뿐이라, 84픽셀 공중에 있든 땅을 딛고 있든 똑같이 굳어 있었다 —
   * "떠 있다" 가 아니라 "붙여넣은 그림" 으로 보이던 이유다.
   *
   * lift(얼마나 떴나)와 lean(어느 쪽으로 미나)을 받아 몸으로 보여준다.
   *
   * 셋 다 **다 붙고 나서만**(done) 산다. 조립 중에 들썩이고 기울면 부품이
   * 제자리에 잠긴 걸로 안 보인다 — 합체 컷신이 그래서 밋밋해진다.
   */
  const lift = done ? (pose.lift ?? 0) : 0;
  const lean = done ? (pose.lean ?? 0) : 0;
  // 뜰수록 크게 출렁인다. 땅을 딛으면 거의 멎는다 — 그 차이가 곧 "닿았다" 다.
  const hover = done ? Math.sin(time * 2.6) * (0.8 + lift * 3.4) : 0;
  // 미는 쪽으로 기운다. 가만히 있는 기계는 옆으로 미끄러지지 않는다.
  const tilt = lean * lift * 0.06;
  const arm = robotArms(time, pose, lift, done);
  // 아홉 발이 한꺼번에 나가면 몸이 **위로 밀린다**. 팔만 움직이고 몸이 가만히
  // 있으면 반동이 어디로 갔는지가 안 보인다.
  const kick = done ? (pose.fire ?? 0) : 0;

  ctx.save();
  ctx.translate(0, Math.round(hover - kick * px(0.1)));
  if (tilt) ctx.rotate(tilt);

  // ── 다리 ──
  slam(ctx, P(0), 0, 70, () => {
    for (const [i, side] of [-1, 1].entries()) {
      const x = side * px(RB.hipX);
      ctx.save();
      // 떠 있으면 다리가 아래로 늘어지고 무릎이 살짝 굽는다. 내려앉으면 쭉 펴고 버틴다.
      // 좌우가 엇갈리게 굽어야 매달린 인형이 아니라 자세를 잡는 기계로 읽힌다.
      const slack = lift * (1 + Math.sin(time * 2.6 + i * 2.1) * 0.35);
      ctx.translate(0, px(0.05) * slack);
      // **접히는 자리에서 접는다.** 몸 한가운데를 축으로 돌리면 1.4r 아래에 있는
      // 발이 크게 휘둘려서 두 다리가 서로 엇갈린다 — 실제로 그렇게 보였다.
      ctx.translate(x, px(RB.thighTop));
      ctx.rotate(side * slack * 0.07 - lean * lift * 0.05);
      ctx.translate(-x, -px(RB.thighTop));
      plate(ctx, x - px(0.17), px(RB.thighTop) - 2, px(0.34), px(RB.kneeTop - RB.thighTop) + 3, opt);
      armorCover(ctx, ALBUMS[i === 0 ? 1 : 16], x, px((RB.thighTop + RB.kneeTop) / 2), px(0.17), hurt);
      // 무릎에서 한 번 더 굽힌다 — 정강이가 접혀야 "발을 뗀" 것으로 보인다
      ctx.save();
      ctx.translate(x, px(RB.kneeTop));
      ctx.rotate(-slack * 0.13);
      ctx.translate(-x, -px(RB.kneeTop));
      plate(ctx, x - px(0.21), px(RB.kneeTop), px(0.42), px(RB.shinTop - RB.kneeTop) + 1, hot);
      plate(ctx, x - px(0.2), px(RB.shinTop), px(0.4), px(RB.footTop - RB.shinTop), opt);
      // 발은 앞으로 튀어나온다 — 세로 막대 두 개로는 서 있는 걸로 안 읽힌다
      plate(ctx, x - px(0.27), px(RB.footTop), px(0.54), px(RB.footBot - RB.footTop), opt);
      armorCover(ctx, ALBUMS[i === 0 ? 6 : 14], x, px((RB.shinTop + RB.footTop) / 2), px(0.2), hurt);
      ctx.restore();
      ctx.restore();
    }
  });

  // ── 팔 (몸통 뒤) ──
  slam(ctx, P(3), 0, 0, () => {
    for (const [i, side] of [-1, 1].entries()) {
      const x = side * px(RB.armX);
      const off = side * (1 - P(3)) * px(2.2);
      const a = arm[i];
      ctx.save();
      ctx.translate(Math.round(off), 0);
      // 어깨에서 접는다. 몸 한가운데를 축으로 돌리면 0.74r 아래에 달린 주먹만
      // 멀리 휘둘려서 팔이 몸에서 떨어져 나간 것처럼 보인다 (다리가 그랬다).
      ctx.translate(x, px(RB.armTop));
      ctx.rotate(a.shoulder);
      ctx.translate(-x, -px(RB.armTop));
      plate(ctx, x - px(0.11), px(RB.armTop), px(0.22), px(RB.elbow - RB.armTop), opt); // 윗팔
      // 팔꿈치에서 한 번 더 — 이게 있어야 팔을 '휘두르는' 게 아니라 '쓰는' 걸로 읽힌다
      ctx.translate(x, px(RB.elbow));
      ctx.rotate(a.elbow);
      ctx.translate(-x, -px(RB.elbow));
      plate(ctx, x - px(0.2), px(RB.elbow), px(0.4), px(RB.wrist - RB.elbow), opt); // 아래팔
      armorCover(ctx, ALBUMS[i === 0 ? 0 : 9], x, px((RB.elbow + RB.wrist) / 2), px(0.22), hurt); // 아래팔 장갑
      plate(ctx, x - px(0.2), px(RB.wrist), px(0.4), px(RB.fistBot - RB.wrist), opt); // 주먹
      for (let i = 0; i < 3; i++) {
        plate(ctx, x - px(0.16) + i * px(0.11), px(RB.wrist) + 2, px(0.08), 2, hot);
      }
      // 주먹 앞의 총구 — 쏜 직후에만 달아오른다. 아홉 발이 어디서 나왔는지가 보인다
      if (a.muzzle > 0.02) {
        ctx.globalAlpha = a.muzzle;
        ctx.fillStyle = '#fff0c4';
        const mw = Math.round(px(0.34) * a.muzzle);
        ctx.fillRect(Math.round(x - mw / 2), Math.round(px(RB.fistBot)), mw, Math.max(1, Math.round(px(0.16) * a.muzzle)));
        ctx.globalAlpha = 1;
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

  // ── 추진기 ──
  // 회전(tilt) **밖에서** 그린다 — 몸이 기울어도 불길은 늘 아래로 떨어진다.
  if (done && lift > 0.02) {
    drawThrust(ctx, r, time, color, {
      lift,
      hover: hover - kick * px(0.1),
      hurt,
      // 발 두 짝 밑. 다리가 관절에서 조금 접히지만 발바닥이 0.54r 로 넓어 안 벗어난다
      nozzles: [
        { x: -RB.hipX, y: RB.footBot },
        { x: RB.hipX, y: RB.footBot },
      ],
      // 쏠 때·모을 때 확 뿜는다 — 큰 걸 할수록 버티느라 더 태운다
      boost: (pose.fire ?? 0) * 0.5 + (pose.charge ?? 0) * 0.4 + (pose.beam ?? 0) * 0.3,
    });
  }
}

/**
 * 추진기 한 쌍.
 *
 * **이게 "떠 있다" 를 말해주는 그림이다.** 발밑에서 불길이 나와야 공중에 있는 게
 * 붙여넣은 그림이 아니라 스스로 버티는 기계로 보인다.
 *
 * 로봇과 공룡이 **같이 쓴다** — 노즐 자리만 다르게 받는다. 불길 생김새를 몸마다
 * 따로 적으면 둘이 다른 세계의 물건으로 보인다.
 *
 * lift 가 0 이면 저절로 다 꺼진다. 땅을 딛는 순간 조용해지는 게 곧 「닿았다」 다.
 * 세기(boost)는 쏠 때·모을 때 확 뿜으라고 부르는 쪽이 얹는다.
 */
function drawThrust(ctx, r, time, color, { lift, hover, hurt, nozzles, scale = 1, boost = 0, seed = 0 }) {
  const px = (v) => v * r;
  ctx.save();
  // 몸이 출렁인 만큼 같이 내려온다 — 안 따라가면 불길만 제자리에 뜬다
  ctx.translate(0, Math.round(hover));

  /**
   * **한 줄씩 좁혀 가며 찍는다.** 삼각형을 ctx.fill 로 그리면 가장자리가 번지는데
   * 이 게임의 다른 그림은 전부 정수 좌표 fillRect 라, 혼자만 흐릿해서 "불꽃"이
   * 아니라 "얼룩"으로 보였다.
   */
  const taper = (x, top, h, width, fill) => {
    ctx.fillStyle = fill;
    for (let y = 0; y < h; y++) {
      const w = Math.max(1, Math.round(width * (1 - y / h)));
      ctx.fillRect(x - (w >> 1), top + y, w, 1);
    }
  };

  for (const [i, n] of nozzles.entries()) {
    const x = Math.round(px(n.x));
    const top = Math.round(px(n.y)) - 1;
    const k = (n.scale ?? 1) * scale;
    // 좌우가 따로 깜빡인다. 같이 흔들리면 불 하나로 보인다.
    const flick = 0.66 + Math.sin(time * 27 + (i + seed) * 3.1) * 0.34;
    const len = Math.max(2, Math.round(px(0.78) * k * lift * flick * (1 + boost)));
    const w0 = Math.max(2, Math.round(px(0.32) * k));

    // 노즐 자체가 달아오른다 — 이게 없으면 부츠 밑에 불이 붙은 걸로 보인다
    ctx.globalAlpha = Math.min(1, 0.5 + lift * 0.5);
    ctx.fillStyle = hurt ? '#ffffff' : '#fff0c4';
    ctx.fillRect(x - (w0 >> 1), top - 1, w0, 2);

    // 바깥 → 가운데 → 속불. 세 겹이라야 불꽃으로 읽힌다
    ctx.globalAlpha = Math.min(1, 0.3 + lift * 0.3);
    taper(x, top, len, w0 + 2, hurt ? '#ffffff' : color);
    ctx.globalAlpha = Math.min(1, 0.6 + lift * 0.4);
    taper(x, top, Math.round(len * 0.78), w0, hurt ? '#ffffff' : color);
    ctx.globalAlpha = 1;
    taper(x, top, Math.max(1, Math.round(len * 0.42)), Math.max(1, w0 - 2), '#fff0c4');

    // 배기 불똥 — 노즐에서 떨어져 나가 사라진다. time 으로만 정해서 상태를 안 만든다
    // (파티클 배열에 넣으면 보스 하나가 매 프레임 쓰레기를 쌓는다)
    for (let s = 0; s < 3; s++) {
      const t = ((time * 1.7 + s * 0.37 + i * 0.19) % 1);
      ctx.globalAlpha = Math.max(0, 1 - t) * lift * 0.9;
      const sx = x + Math.round(Math.sin((s + i) * 21.3) * w0 * 0.5);
      ctx.fillStyle = s % 2 === 0 ? '#fff0c4' : color;
      ctx.fillRect(sx, top + len + Math.round(t * px(0.8) * k), 1, 1);
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/**
 * 공주가 갇힌 새장. 오프닝에서 채간 뒤로 합체 컷신·보스전 내내 여기 있다가,
 * 보스가 터질 때 부서진다. cx, cy 는 새장 한가운데.
 *
 * broken 이 0보다 크면 창살이 튀어나가고 그녀가 떨어진다 (0~1).
 */
export function drawCage(ctx, cx, cy, time, broken = 0) {
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

  drawSprite(ctx, BRIDE, Math.round(cx - BRIDE.w / 2), Math.round(y + 4 + sway + fall));

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

/**
 * 컷신 속 1·2페이즈 보스 몸통.
 *
 * **어느 몸을 그릴지 여기 한 곳에서만 고른다.** 컷신마다 따로 고르면 2회차에서
 * 방금까지 싸우던 놈과 컷신에 나오는 놈이 달라진다 — 실제로 그랬다.
 * 싸움 화면의 drawBoss 도 같은 갈림길(hard → 진화한 원반)을 쓴다.
 */
export function drawBossDisc(ctx, cx, cy, r, spin, time = 0, hard = false, grade = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  if (hard) {
    drawEvolvedDisc(ctx, r, time, '#7c5cff', false, grade, spin);
    ctx.restore();
    return;
  }
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


