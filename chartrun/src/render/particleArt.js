// 알갱이 그림. 상점에서 산 이펙트가 네모 대신 이걸 쓴다.
//
// 예전에는 **모양당 그림이 한 장**이었고, 그림을 쓰면 알갱이 색(p.color)이 통째로
// 무시됐다 — 꽃가루에 다섯 색을 적어둬도 한 색으로 나왔다. 그래서 꽃가루도
// 폭죽도 흑백도 결국 「색만 다른 같은 네모」로 보였다.
//
// 이제 모양 하나가 **여러 장**을 갖고, 장 고르는 법이 둘이다:
//   by: 'seed'  알갱이마다 다른 장 (꽃잎 세 모양이 섞여 날린다)
//   by: 'life'  **수명에 따라 넘어간다** (거품이 터지고 불꽃이 사그라든다)
//
// 색은 `spriteFor` 가 입힌다. 그림은 한 글자('o')로만 그리고 색은 나중에 준다.
import { sprite } from './pixel.js';

/**
 * 그림 한 장. 칸이 'o' 면 색이 칠해지고 '.' 면 비었다.
 *
 * **색을 여기 적지 않는다.** 이펙트가 정한 색(p.color)을 spriteFor 가 입힌다 —
 * 그래야 같은 꽃잎이 분홍·노랑·초록으로 날린다.
 */

// ── 꽃잎 세 모양 (킬·꽃가루) ────────────────────────────────
const PETAL_A = ['.oo.', 'oooo', 'oooo', '.oo.'];
const PETAL_B = ['..o..', '.ooo.', 'ooooo', '.ooo.', '..o..'];
const PETAL_C = ['oo..', 'oooo', '.ooo', '..o.'];

// ── 음표 두 모양 (킬·데스·음표) ────────────────────────────
/** 8분음표 — 기존 NOTE 와 같은 꼴이되 한 글자로 */
const NOTE_A = ['...oo', '..ooo', '..o.o', '..o.o', 'ooo..', 'ooo..', '.oo..'];
/** 붙은 음표 두 개 */
const NOTE_B = ['..ooooo', '..o...o', '..o...o', 'ooo.ooo', 'ooo.ooo', '.o...o.'];

// ── 반짝 네 장 (킬·폭죽) — 수명에 따라 커졌다 사라진다 ─────
const SPARK_1 = ['.o.', 'ooo', '.o.'];
const SPARK_2 = ['..o..', '..o..', 'ooooo', '..o..', '..o..'];
const SPARK_3 = ['..o..', '.o.o.', 'o...o', '.o.o.', '..o..'];
const SPARK_4 = ['o.o', '...', 'o.o'];

// ── 필름 조각 두 모양 (킬·흑백) ────────────────────────────
const FILM_A = ['ooooo', 'o.o.o', 'ooooo', 'o.o.o', 'ooooo'];
const FILM_B = ['oooo', 'o..o', 'o..o', 'oooo'];

// ── 하트 두 장 (킬·데스·하트) — 끝에 갈라진다 ──────────────
const HEART_1 = ['.oo.oo.', 'ooooooo', 'ooooooo', '.ooooo.', '...o...'];
const HEART_2 = ['.oo.oo.', 'oo.o.oo', 'oo...oo', '.o...o.', '.o...o.'];

// ── 연기 세 장 (킬·연기) — 부풀다 성글어진다 ───────────────
const PUFF_1 = ['.oo.', 'oooo', 'oooo', '.oo.'];
const PUFF_2 = ['.oooo.', 'oooooo', 'oooooo', 'oooooo', '.oooo.'];
const PUFF_3 = ['.o..o.', 'o.oo.o', '.o..o.', 'o.oo.o', '.o..o.'];

// ── 날개 두 장 (데스·승천) ─────────────────────────────────
const WING_L = ['ooo..', 'oooo.', '.oooo', '..ooo', '...o.'];
const WING_R = ['..ooo', '.oooo', 'oooo.', 'ooo..', '.o...'];

// ── 불꽃 세 장 (데스·폭발) — 사그라든다 ────────────────────
const FLAME_1 = ['..o..', '.ooo.', 'ooooo', 'ooooo', '.ooo.'];
const FLAME_2 = ['..o..', '.o.o.', 'oo.oo', '.ooo.'];
const FLAME_3 = ['.o.', 'o.o', '.o.'];

// ── 거품 세 장 (데스·거품) — 부풀다 **터진다** ─────────────
const BUB_1 = ['.oo.', 'o..o', 'o..o', '.oo.'];
const BUB_2 = ['.oooo.', 'oo..oo', 'o....o', 'o....o', 'oo..oo', '.oooo.'];
/** 터진 링 — 조각만 남는다. 이게 「팝」으로 읽히는 핵심이다 */
const BUB_POP = ['o.o.o.o', '.......', 'o.....o', '.......', 'o.o.o.o'];

// ── 반지 (킬·반지) — 결혼식 컷신과 같은 꼴 ─────────────────
const RING_A = ['.oo.', 'o..o', 'o..o', '.oo.'];

// ── 레코드 (데스·레코드) ───────────────────────────────────
const DISC_A = ['..oooo..', '.oooooo.', 'oo.oo.oo', 'oo.oo.oo', '.oooooo.', '..oooo..'];

/**
 * 모양 이름 → 그림들과 장 고르는 법.
 *
 * **이 표에 적은 이름과 data/effects.js 의 shape 이름이 서로 빠짐없이 맞아야 한다.**
 * 한쪽만 고치면 모양 이름만 붙고 **아무것도 안 그려진다** — tests/shop.test.js 가
 * 양방향으로 본다.
 */
export const PARTICLE_ART = {
  petal: { rows: [PETAL_A, PETAL_B, PETAL_C], by: 'seed' },
  note: { rows: [NOTE_A, NOTE_B], by: 'seed' },
  spark: { rows: [SPARK_1, SPARK_2, SPARK_3, SPARK_4], by: 'life' },
  film: { rows: [FILM_A, FILM_B], by: 'seed' },
  heart: { rows: [HEART_1, HEART_2], by: 'life' },
  puff: { rows: [PUFF_1, PUFF_2, PUFF_3], by: 'life' },
  wing: { rows: [WING_L, WING_R], by: 'seed' },
  flame: { rows: [FLAME_1, FLAME_2, FLAME_3], by: 'life' },
  bubble: { rows: [BUB_1, BUB_2, BUB_POP], by: 'life' },
  ring: { rows: [RING_A], by: 'seed' },
  disc: { rows: [DISC_A], by: 'seed' },
};

/**
 * 알갱이 하나가 지금 쓸 장 번호.
 *
 * `life` 는 **닳은 만큼** 넘어간다 (1 → 0 이므로 뒤집어서 센다).
 * 마지막 장에서 멈춰야 한다 — 안 그러면 다 닳는 순간 첫 장으로 되돌아가 깜빡인다.
 */
export function frameOf(art, p) {
  const n = art.rows.length;
  if (n === 1) return 0;
  if (art.by === 'life') {
    const used = 1 - Math.max(0, Math.min(1, p.life / p.max));
    return Math.min(n - 1, Math.floor(used * n));
  }
  return (p.seed ?? 0) % n;
}

/**
 * 색을 입힌 스프라이트. **같은 (이름·장·색)이면 같은 객체**를 돌려준다.
 *
 * 이게 중요하다 — bake()(pixel.js)가 스프라이트 **객체를 열쇠로** 구운 캔버스를
 * WeakMap 에 들고 있다. 매번 새로 만들면 알갱이마다 캔버스를 새로 굽는다.
 * (꾸미기의 spritesFor 와 같은 수법이다)
 */
const CACHE = new Map();
export function spriteFor(name, frame, color) {
  const art = PARTICLE_ART[name];
  if (!art) return null;
  const key = `${name}:${frame}:${color}`;
  let spr = CACHE.get(key);
  if (!spr) {
    spr = sprite(art.rows[frame] ?? art.rows[0], { o: color });
    CACHE.set(key, spr);
  }
  return spr;
}

/** 알갱이 하나가 지금 그릴 그림 (없으면 null — 그러면 예전처럼 네모다) */
export function particleSprite(p) {
  const art = PARTICLE_ART[p.shape];
  if (!art) return null;
  return spriteFor(p.shape, frameOf(art, p), p.color);
}
