// 성격·재능 특성. 유전으로 자손에게 이어질 수 있다.
// bonus: 매년 스탯 성장 보정 / income: 소득 배율 / happiness: 매년 행복 보정
export const TRAITS = [
  { id: 'diligent', label: '성실함', icon: '📚', desc: '무슨 일이든 꾸준히 해낸다.', bonus: { intellect: 1 }, income: 0.08 },
  { id: 'genius', label: '천재성', icon: '🧠', desc: '배움의 속도가 남다르다.', rare: true, bonus: { intellect: 2 }, income: 0.15 },
  { id: 'charming', label: '사교적', icon: '💐', desc: '사람들이 곁에 모인다.', bonus: { charm: 1.5 } },
  { id: 'athletic', label: '운동신경', icon: '🏃', desc: '몸 쓰는 일에 재능이 있다.', bonus: { fitness: 1.5, health: 0.5 } },
  { id: 'artistic', label: '예술혼', icon: '🎨', desc: '세상을 다르게 본다.', bonus: { creativity: 1.5 } },
  { id: 'greenThumb', label: '초록손', icon: '🌱', desc: '기르는 것마다 잘 자란다.', bonus: { health: 0.5 }, income: 0.05 },
  { id: 'frugal', label: '알뜰함', icon: '🪙', desc: '생활비가 적게 든다.', expense: -0.15 },
  { id: 'spender', label: '낭비벽', icon: '💸', desc: '돈이 손에 남지 않는다.', expense: 0.2, happiness: 1 },
  { id: 'optimist', label: '낙천적', icon: '☀️', desc: '어떤 일도 웃어넘긴다.', happiness: 2 },
  { id: 'anxious', label: '걱정많음', icon: '🌧️', desc: '작은 일에도 마음을 쓴다.', happiness: -1.5 },
  { id: 'homebody', label: '집순이/집돌이', icon: '🛋️', desc: '집에 있을 때 가장 편안하다.', happiness: 1, bonus: { charm: -0.5 } },
  { id: 'adventurous', label: '모험심', icon: '🧭', desc: '새로운 것에 먼저 손을 뻗는다.', bonus: { fitness: 0.5, creativity: 0.5 } },
  { id: 'kind', label: '다정함', icon: '🤍', desc: '가족의 마음을 잘 헤아린다.', happiness: 1, bonus: { charm: 0.5 } },
  { id: 'stubborn', label: '고집', icon: '🪨', desc: '한번 정하면 굽히지 않는다.', bonus: { fitness: 0.5 }, happiness: -0.5 },
  { id: 'lucky', label: '행운아', icon: '🍀', desc: '이상하게 일이 잘 풀린다.', rare: true, income: 0.1, happiness: 1 },
  { id: 'ironBody', label: '강골', icon: '🛡️', desc: '좀처럼 아프지 않다.', bonus: { health: 1.5 } },
  { id: 'frail', label: '병약함', icon: '🩹', desc: '몸이 약한 편이다.', bonus: { health: -1 } },
  { id: 'leader', label: '리더십', icon: '🎖️', desc: '사람을 이끄는 힘이 있다.', income: 0.12, bonus: { charm: 0.5 } },
  { id: 'craftsman', label: '손재주', icon: '🔨', desc: '만드는 일에 능하다.', bonus: { creativity: 1 }, income: 0.06 },
  { id: 'dreamer', label: '몽상가', icon: '💭', desc: '늘 다른 세계를 그린다.', bonus: { creativity: 1 }, income: -0.05, happiness: 1 },
];

export const TRAIT_BY_ID = Object.fromEntries(TRAITS.map((t) => [t.id, t]));

export const commonTraits = () => TRAITS.filter((t) => !t.rare);
