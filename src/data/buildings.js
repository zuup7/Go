// 마을 건물. 레벨을 올릴수록 효과가 커진다.
// effect(level) 가 돌려주는 값은 마을 보너스로 합산된다.
//  income      : 연 수입 가산 (만원)
//  incomeRate  : 소득 배율 가산
//  expenseRate : 생활비 배율 가산 (음수면 절약)
//  happiness   : 매년 가족 행복 가산
//  grow        : 스탯별 매년 성장 가산
export const BUILDINGS = [
  {
    id: 'house', label: '우리 집', icon: '🏠', base: 0, step: 900, maxLevel: 5, startLevel: 1,
    desc: '가족이 쉬는 곳. 넓을수록 마음도 넓어진다.',
    effect: (lv) => ({ happiness: lv * 1.2, expenseRate: -0.02 * lv }),
  },
  {
    id: 'garden', label: '텃밭', icon: '🌱', base: 350, step: 300, maxLevel: 5,
    desc: '먹거리를 직접 기른다. 생활비가 줄어든다.',
    effect: (lv) => ({ expenseRate: -0.04 * lv, income: 60 * lv, grow: { health: 0.2 * lv } }),
  },
  {
    id: 'shop', label: '가게', icon: '🏪', base: 900, step: 700, maxLevel: 5,
    desc: '마을 사람들이 드나드는 우리 가게.',
    effect: (lv) => ({ income: 260 * lv, incomeRate: 0.02 * lv }),
  },
  {
    id: 'school', label: '학교', icon: '🏫', base: 1400, step: 1100, maxLevel: 4, requires: { villageLevel: 2 },
    desc: '아이들이 더 빨리 배운다.',
    effect: (lv) => ({ grow: { intellect: 0.6 * lv }, happiness: 0.4 * lv }),
  },
  {
    id: 'clinic', label: '보건소', icon: '🏥', base: 1600, step: 1200, maxLevel: 4, requires: { villageLevel: 2 },
    desc: '가족의 건강을 지킨다. 수명이 늘어난다.',
    effect: (lv) => ({ grow: { health: 0.7 * lv }, lifespan: 1.2 * lv }),
  },
  {
    id: 'park', label: '공원', icon: '🌳', base: 800, step: 600, maxLevel: 4,
    desc: '산책하기 좋은 초록 공간.',
    effect: (lv) => ({ happiness: 1.1 * lv, grow: { fitness: 0.4 * lv } }),
  },
  {
    id: 'studio', label: '공방', icon: '🎨', base: 1200, step: 900, maxLevel: 4, requires: { villageLevel: 2 },
    desc: '만들고 그리는 사람들의 아지트.',
    effect: (lv) => ({ grow: { creativity: 0.7 * lv }, income: 120 * lv }),
  },
  {
    id: 'gym', label: '체육관', icon: '🏋️', base: 1100, step: 800, maxLevel: 4, requires: { villageLevel: 2 },
    desc: '땀 흘리는 만큼 튼튼해진다.',
    effect: (lv) => ({ grow: { fitness: 0.8 * lv, health: 0.2 * lv } }),
  },
  {
    id: 'cafe', label: '카페', icon: '☕', base: 1500, step: 1000, maxLevel: 4, requires: { villageLevel: 3 },
    desc: '만남이 시작되는 곳. 인연을 만나기 쉬워진다.',
    effect: (lv) => ({ income: 200 * lv, happiness: 0.6 * lv, romance: 0.05 * lv }),
  },
  {
    id: 'library', label: '도서관', icon: '📚', base: 2000, step: 1400, maxLevel: 4, requires: { villageLevel: 3 },
    desc: '조용히 앉아 있기만 해도 똑똑해지는 기분.',
    effect: (lv) => ({ grow: { intellect: 0.9 * lv }, happiness: 0.3 * lv }),
  },
  {
    id: 'market', label: '시장', icon: '🧺', base: 2600, step: 1800, maxLevel: 4, requires: { villageLevel: 4 },
    desc: '마을 경제의 심장.',
    effect: (lv) => ({ incomeRate: 0.05 * lv, expenseRate: -0.03 * lv }),
  },
  {
    id: 'theater', label: '극장', icon: '🎭', base: 3200, step: 2200, maxLevel: 3, requires: { villageLevel: 5 },
    desc: '마을의 자랑. 축제가 열린다.',
    effect: (lv) => ({ happiness: 2 * lv, income: 300 * lv, grow: { charm: 0.5 * lv } }),
  },
];

export const BUILDING_BY_ID = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));

/** 다음 레벨 건설/증축 비용 */
export function buildCost(building, currentLevel) {
  return building.base + building.step * currentLevel;
}
