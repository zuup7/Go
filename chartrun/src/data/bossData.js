// 최종 보스 《초합체 정규앨범 — 명반(名盤)》 의 수치와 대사.

export const BOSS_NAME = '초합체 정규앨범';
export const BOSS_TITLE = '《명반 名盤》';
export const BOSS_MAX_HP = 12;

/**
 * 페이즈. from 은 "남은 체력 비율이 이 값보다 크면 이 페이즈" 라는 뜻.
 * 순서대로 검사하므로 위에서부터 1 → 2 → 3.
 */
export const PHASES = [
  {
    id: 1,
    from: 2 / 3,
    name: '회전 · 음표 탄막',
    color: '#ff5d8f',
    fireEvery: 1.6,
    shots: 5,
    shotSpeed: 78,
    openEvery: 4.2,
    openFor: 2.2,
    descendTo: 118,
    minionEvery: 0,
    quarters: 0,
    line: '너 따위가 1위를 넘봐?',
  },
  {
    id: 2,
    from: 1 / 3,
    name: '분열 · 4중 돌진',
    color: '#ffc93c',
    fireEvery: 1.15,
    shots: 7,
    shotSpeed: 95,
    openEvery: 3.4,
    openFor: 1.8,
    descendTo: 126,
    minionEvery: 0,
    quarters: 4,
    quarterSpeed: 150,
    line: '한 장이 아니야. 나는 열일곱 장이다!',
  },
  {
    id: 3,
    from: -1,
    name: '사재기 · 총력전',
    color: '#7c5cff',
    fireEvery: 0.85,
    shots: 9,
    shotSpeed: 112,
    openEvery: 2.8,
    openFor: 1.6,
    descendTo: 132,
    minionEvery: 3.2,
    minions: ['a01', 'a06', 'a02'],
    quarters: 4,
    quarterSpeed: 185,
    line: '순위는 돈으로 사는 거야!',
  },
];

/** 페이즈가 바뀔 때 뜨는 대사 */
export const PHASE_LINES = {
  2: ['이 정도로 될 줄 알았어?', '갈라져도 나는 나야.'],
  3: ['좋아, 정정당당은 여기까지.', '음원 사재기 들어간다!'],
};

/** 보스를 때렸을 때 나오는 비명 */
export const BOSS_HURT_LINES = [
  '재생수가... 줄어든다...!',
  '이럴 리가 없어',
  '내 팬덤은 어디 갔지',
  '한 장만 더 팔았어도',
  '스밍이 끊긴다',
];

export const BOSS_DEFEAT_LINES = [
  '좋은... 노래였어...',
  '이제 네 차례다, 신인.',
];

/** 남은 체력 비율로 페이즈를 고른다 */
export function phaseFor(hp, maxHp = BOSS_MAX_HP) {
  const ratio = Math.max(0, hp) / maxHp;
  return PHASES.find((p) => ratio > p.from) ?? PHASES[PHASES.length - 1];
}
