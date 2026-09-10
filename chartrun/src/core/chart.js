// 스테이지 진행률을 "음원차트 순위"로 바꾼다. 이게 곧 진행도 바다.
import { clamp } from './util.js';

export const CHART_SEGMENTS = [
  { from: 100, to: 50 },
  { from: 50, to: 20 },
  { from: 20, to: 5 },
  { from: 5, to: 2 },
];

/** 보스를 잡으면 도달하는 자리 */
export const TOP_RANK = 1;

/**
 * stage: 0부터 시작하는 스테이지 번호, t: 그 스테이지 안에서의 진행률 0~1
 * 스테이지가 넘어가도 순위가 되돌아가지 않도록 구간을 이어 붙였다.
 */
export function rankAt(stage, t) {
  const index = Math.min(Math.max(Math.trunc(stage), 0), CHART_SEGMENTS.length - 1);
  const seg = CHART_SEGMENTS[index];
  const p = clamp(t, 0, 1);
  return Math.max(seg.to, Math.round(seg.from - (seg.from - seg.to) * p));
}

/** 순위 표시용 문자열 */
export const rankText = (rank) => `#${rank}`;

