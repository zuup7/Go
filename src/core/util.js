// 여기저기서 쓰는 작은 도우미들.

export const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export const won = (amount) => `${Math.round(amount).toLocaleString('ko-KR')}만원`;

export const STAT_KEYS = ['health', 'intellect', 'charm', 'creativity', 'fitness'];

export const STAT_LABELS = {
  health: '건강',
  intellect: '지능',
  charm: '매력',
  creativity: '창의',
  fitness: '체력',
};

export const STAGES = [
  { id: 'baby', label: '유아', min: 0, max: 4 },
  { id: 'child', label: '아동', min: 5, max: 12 },
  { id: 'teen', label: '청소년', min: 13, max: 18 },
  { id: 'young', label: '청년', min: 19, max: 34 },
  { id: 'adult', label: '중년', min: 35, max: 59 },
  { id: 'senior', label: '노년', min: 60, max: 200 },
];

export const stageOf = (age) => STAGES.find((s) => age >= s.min && age <= s.max) ?? STAGES[STAGES.length - 1];

export const EDUCATION_LABELS = ['무학', '중졸', '고졸', '대졸', '대학원졸'];

/** 사람 목록에서 조건에 맞는 사람만 */
export const peopleWhere = (game, predicate) => Object.values(game.people).filter(predicate);

/** 평균 (빈 배열이면 fallback) */
export const average = (nums, fallback = 0) =>
  nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : fallback;
