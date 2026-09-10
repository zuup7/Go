// 여기저기서 쓰는 작은 도우미들. (DOM 을 쓰지 않는다 — 테스트에서 그대로 import 한다)

export const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export const lerp = (a, b, t) => a + (b - a) * t;

/** 현재 값을 목표까지 step 만큼만 다가가게 한다 (가감속에 씀) */
export const approach = (value, target, step) =>
  value < target ? Math.min(value + step, target) : Math.max(value - step, target);

export const sign = (n) => (n > 0 ? 1 : n < 0 ? -1 : 0);

/** 두 사각형이 겹치는가 */
export const overlaps = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** 사각형의 중심 */
export const centerOf = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** 밀리초를 0:00 형태로 */
export const timeText = (ms) => {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};
