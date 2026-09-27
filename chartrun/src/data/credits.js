// 엔딩 크레딧 — 결혼식이 끝나면 지나온 앨범 열일곱 장이 한 장씩 크게 지나간다.
//
// **글자는 없다.** 이 게임은 오프닝부터 엔딩까지 글자 한 줄 없이 굴러왔다.
// 앨범 이름을 띄우지 않고 커버만 보여준다 — 누가 봐도 「아 이거」 하는 건 커버다.
//
// 앨범은 ALBUMS 순서 그대로다. 그게 **판에서 만난 순서**라, 크레딧이
// 1스테이지 신인부터 마지막 판까지 지나온 길을 거꾸로 짚지 않고 그대로 되짚는다.
//
// 시각은 여기에만 적는다. 고르는 쪽(core)도 그리는 쪽(render)도 creditAt 을 탄다 —
// 둘이 따로 계산하면 「장면은 끝났는데 그림은 한 장 남은」 날이 온다.
import { ALBUMS } from './albums.js';

/** 처음 검은 화면에서 밝아지는 시간. 결혼식이 검게 닫고 끝나므로 이어서 밝힌다 */
export const CREDIT_IN = 0.8;

/** 한 장이 머무는 시간 (넘어가는 시간을 포함한다) */
export const CREDIT_HOLD = 1.25;

/** 다음 장으로 넘어가는 데 드는 시간. 한 장의 머묾 **앞머리**에 들어간다 */
export const CREDIT_SLIDE = 0.35;

/** 마지막 장이 빠진 뒤 두 사람만 남는 시간 */
export const CREDIT_OUT = 1.6;

export const CREDIT_COUNT = ALBUMS.length;

export const CREDITS_LENGTH = CREDIT_IN + CREDIT_COUNT * CREDIT_HOLD + CREDIT_OUT;

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * 크레딧 t 초의 모습.
 *
 *   index   지금 가운데 있는 앨범 (ALBUMS 자리). 아직/이미 없으면 -1
 *   slide   그 장이 들어오는 중인 정도 0→1. 1 이면 자리를 잡았다
 *   fade    화면 밝기 0→1. 처음에 밝아지고 끝에 어두워진다
 *   walk    두 사람이 화면을 가로지른 정도 0→1 (전체 길이에 걸쳐 한 번)
 *   out     마지막 장이 빠지는 정도 0→1 (OUT 구간에서만 0 이 아니다)
 */
export function creditAt(t) {
  const walk = clamp01(t / CREDITS_LENGTH);
  const fadeIn = clamp01(t / CREDIT_IN);
  const fadeOut = clamp01((CREDITS_LENGTH - t) / 0.6);
  const fade = Math.min(fadeIn, fadeOut);

  const inAlbums = t - CREDIT_IN;
  if (inAlbums < 0) return { index: -1, slide: 0, fade, walk, out: 0 };

  const index = Math.floor(inAlbums / CREDIT_HOLD);
  if (index >= CREDIT_COUNT) {
    // 마지막 장이 옆으로 빠져나간다 — 툭 사라지면 필름이 끊긴 것처럼 보인다
    const out = clamp01((inAlbums - CREDIT_COUNT * CREDIT_HOLD) / CREDIT_SLIDE);
    return { index: CREDIT_COUNT - 1, slide: 1, fade, walk, out };
  }
  const slide = clamp01((inAlbums - index * CREDIT_HOLD) / CREDIT_SLIDE);
  return { index, slide, fade, walk, out: 0 };
}
