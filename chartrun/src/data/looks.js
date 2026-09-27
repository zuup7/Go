// 주인공 꾸미기. 머리 한 벌 + 옷 색 + 바지 색.
//
// **여기는 데이터만 둔다** (core 가 읽는다). 머리 그림 자체는 render/sprites.js 에
// 있다 — 그림은 DOM 쪽이라 core 가 못 본다. 둘이 어긋나지 않게
// tests/look.test.js 가 **양방향으로** 맞춰본다 (id 가 여기 있는데 그림이 없거나,
// 그림만 있고 여기 없으면 잡힌다). 소리 표를 타임라인과 맞추는 것과 같은 수법이다.

/** 머리 — id 는 sprites.js 의 그림 이름이다 */
export const HAIRS = [
  { id: 'base', label: '기본' },
  { id: 'cap', label: '모자' },
  { id: 'band', label: '머리띠' },
  { id: 'long', label: '장발' },
];

/**
 * 옷 색. 첫 칸이 원래 색이라 **아무것도 안 고른 사람은 지금과 똑같이** 보인다.
 * 색은 전부 게임이 이미 쓰는 것들이다 (assets/style.css 의 --hot·--good·--warn 등) —
 * 새 색을 들이면 픽셀 화면에서 혼자 떠 보인다.
 */
export const JACKETS = [
  { label: '하늘', color: '#4ec3ff' },
  { label: '분홍', color: '#ff5d8f' },
  { label: '초록', color: '#39ff9a' },
  { label: '노랑', color: '#ffd166' },
  { label: '보라', color: '#a98cff' },
  { label: '하양', color: '#e8e4f0' },
];

export const PANTS = [
  { label: '남색', color: '#33324a' },
  { label: '검정', color: '#20182e' },
  { label: '청바지', color: '#3a5a9a' },
  { label: '베이지', color: '#b89a6a' },
];

/**
 * 꾸미기 화면의 줄. **고르는 쪽(core)과 그리는 쪽(hud)이 이걸 같이 쓴다** —
 * 여기 또 적으면 화면은 맞는데 엉뚱한 칸이 바뀐다 (스테이지 선택에서 겪은 그 사고다).
 */
export const LOOK_SLOTS = [
  { key: 'hair', label: '머리', items: HAIRS },
  { key: 'jacket', label: '옷', items: JACKETS },
  { key: 'pants', label: '바지', items: PANTS },
];

export const DEFAULT_LOOK = { hair: 0, jacket: 0, pants: 0 };

/**
 * 저장값을 믿지 않는다. 옛 저장에는 이 칸이 아예 없고, 항목을 줄이면
 * 있던 번호가 범위 밖으로 나간다 — 그러면 그림이 undefined 가 되어 안 그려진다.
 */
export function sanitizeLook(look) {
  const out = { ...DEFAULT_LOOK };
  for (const slot of LOOK_SLOTS) {
    const n = Math.trunc(look?.[slot.key] ?? 0);
    out[slot.key] = Number.isFinite(n) && n >= 0 && n < slot.items.length ? n : 0;
  }
  return out;
}

/** 캐시 열쇠. 같은 차림새면 스프라이트를 다시 굽지 않는다 */
export const lookKey = (look) => {
  const l = sanitizeLook(look);
  return LOOK_SLOTS.map((s) => l[s.key]).join('-');
};

/** 한 칸을 옆으로 넘긴다 (양쪽 끝에서 돌아온다) */
export const cycleLook = (look, key, step) => {
  const l = sanitizeLook(look);
  const slot = LOOK_SLOTS.find((s) => s.key === key);
  if (!slot) return l;
  const n = slot.items.length;
  return { ...l, [key]: (((l[key] + step) % n) + n) % n };
};
