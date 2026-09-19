// 그리는 쪽 셋(세계·보스·컷신)이 **같이 쓰는 조각들**.
//
// 여기 있는 것들은 아무 데도 기대지 않는다 — 그래야 위 세 파일이 서로를 안 부르고도
// 같은 색과 같은 재질을 쓸 수 있다. 뭔가를 여기 넣기 전에 "이게 정말 셋 다
// 쓰는 것인가" 를 먼저 보라. 아니면 쓰는 쪽에 두는 게 맞다.
import { drawCoverAt } from './albumArt.js';
import { VIEW } from '../core/game.js';
import { drawHangulCentered, hangulWidth } from './bigtext.js';

// 같은 무대를 낮/밤으로 바꾸는 것도 색만 갈아끼우면 된다.

/** 열 번호로부터 항상 같은 값이 나오는 0~1 난수 (배경이 프레임마다 안 흔들리게) */
export function noise(i, salt = 0) {
  const n = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/** 화면 폭을 step 간격으로 훑으며, 시차(depth)를 준 x 를 넘겨준다 */
export function band(ox, depth, step, draw) {
  const shift = -ox * depth;
  const from = Math.floor(-shift / step) - 1;
  const to = from + Math.ceil(VIEW.w / step) + 2;
  for (let i = from; i <= to; i++) draw(Math.round(i * step + shift), i);
}

// ── 합체 로봇 ───────────────────────────────────────────────
// 장갑 색. 판을 그리는 곳이 열 군데가 넘어서, 색을 여기 한 번만 적는다.
export const DARK = '#241a33';
export const METAL = '#5c4a70';
export const LIT = '#a98cff';
export const VINYL = '#14101d';
/** 진화한 원반의 뿔 — 배경보다 밝아야 실루엣이 보인다 (VINYL 이면 테두리만 남는다) */
export const HORN = '#4a3560';

/**
 * 장갑판 한 장 — 어두운 테두리 + 금속 면 + 위·왼쪽 1px 하이라이트.
 *
 * 부위마다 fillRect 를 손으로 쌓으면 죄다 납작해진다. 여기 한 번만 두께를 주고
 * 모든 부위가 이걸 쓰면 재질이 저절로 같아진다.
 * hurt 면 전부 흰색 — 피격 표시를 부위마다 다시 적지 않는다.
 */
export function plate(ctx, x, y, w, h, { face = METAL, edge = DARK, lit = LIT, hurt = false } = {}) {
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
export function wedge(ctx, pts, { face = METAL, edge = DARK, lit = LIT, hurt = false } = {}) {
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
export const RB = {
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

export const clamp01 = (v) => Math.min(1, Math.max(0, v));

/** 타임라인에서 지금 어느 단계인지 (시각은 자료 쪽에만 적혀 있다) */
export function beatKind(timeline, t) {
  let cur = null;
  for (const step of timeline) {
    if (t >= step.at) cur = step.kind;
    else break;
  }
  return cur;
}

/** #rrggbb 두 색을 k(0~1) 만큼 섞는다 */
export function mixHex(a, b, k) {
  const n = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [ar, ag, ab] = n(a);
  const [br, bg, bb] = n(b);
  const c = (x, y) => Math.round(x + (y - x) * k).toString(16).padStart(2, '0');
  return `#${c(ar, br)}${c(ag, bg)}${c(ab, bb)}`;
}

/**
 * 가슴 코어실의 반쪽 크기. 작은 몸에서는 코어(반지름 11)가 들어갈 최소치를 지키고,
 * 큰 몸에서는 가슴 비율을 따라 같이 커진다 — 배경의 거대 로봇도 이 식을 쓴다.
 */
export const housingHalf = (r) => Math.max(26, Math.min(30, r * 0.75), r * 0.62) / 2;

/** 그 몸 크기에 맞는 코어 반지름 */
export const coreRadius = (r) => Math.max(11, housingHalf(r) * 0.74);

/**
 * 장갑에 박힌 앨범 한 장. 테를 둘러 **판에 끼워진 것**으로 보이게 한다 —
 * 그냥 얹으면 스티커로 보이고, 열일곱 장이 뭉쳐 만든 몸이라는 게 안 읽힌다.
 */
export function armorCover(ctx, id, cx, cy, size, hurt) {
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
export function slam(ctx, p, dx, dy, draw) {
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

/**
 * 0~1 을 부드럽게. 시작과 끝에서 느리고 가운데가 빠르다 (smoothstep).
 * 컷신에서 걸어 들어오고 솟아오르는 것이 전부 이걸 탄다.
 */
export const ease = (p) => {
  const q = clamp01(p);
  return q * q * (3 - 2 * q);
};



/**
 * 차트 판 위에 붙는 「음원차트」 딱지.
 *
 * 이 게임의 척추는 #100 → #1 순위인데, 화면에 뜨는 판이 **무슨 차트인지**는
 * 글자로 적힌 적이 없었다. 앨범이 줄줄이 박혀 있으니 짐작은 되지만,
 * 오프닝에서 처음 보는 사람은 그냥 순위표로 읽는다.
 *
 * 차트가 나오는 네 곳(오프닝·3페이즈·엔딩·2회차 엔딩)이 **이 함수 하나**를 부른다.
 * 네 곳에 따로 그리면 언젠가 하나만 어긋난다.
 *
 * (cx, y) 는 딱지의 **가운데 위**. 판 안쪽 위 여백이 10px 밖에 없어서
 * 판 **위에** 얹는 자리로 쓴다.
 */
export function drawChartLabel(ctx, cx, y, alpha = 1, { bar = false, scale = 1 } = {}) {
  if (alpha <= 0.01) return;
  const w = hangulWidth('음원차트', scale);
  const h = 11 * scale;
  ctx.save();
  ctx.globalAlpha *= alpha;

  // 글자 뒤를 깔아준다 — 차트 줄 위에 그냥 얹으면 획이 배경에 묻힌다.
  //
  // **판 테두리가 있으면 작은 상자, 없으면 화면을 가로지르는 띠.** 오프닝과
  // 2회차 엔딩은 차트가 화면을 꽉 채워서 얹을 여백이 없다 — 거기서 상자로 두면
  // 줄 위에 얹힌 쪽지처럼 보인다. 띠로 두면 사이트 머리글로 읽힌다.
  ctx.fillStyle = 'rgba(6,2,14,0.85)';
  if (bar) {
    ctx.fillRect(0, Math.round(y) - 4, VIEW.w, h + 8);
    ctx.fillStyle = '#7c5cff';
    ctx.fillRect(0, Math.round(y) + h + 3, VIEW.w, 1);
  } else {
    ctx.fillRect(Math.round(cx - w / 2) - 4, Math.round(y) - 3, w + 8, h + 6);
    ctx.strokeStyle = '#7c5cff';
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(cx - w / 2) - 3.5, Math.round(y) - 2.5, w + 7, h + 5);
  }
  drawHangulCentered(ctx, '음원차트', cx, y, scale, '#ffd166', null);
  ctx.restore();
}
