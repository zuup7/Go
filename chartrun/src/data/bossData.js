// 최종 보스 — 앨범 열일곱 장이 합쳐진 원반. 수치만 둔다.

// 페이즈당 3대. 12 였을 때는 밟기로만 깎아야 해서 3페이즈를 아무도 못 봤다.
export const BOSS_MAX_HP = 9;

/**
 * 페이즈. from 은 "남은 체력 비율이 이 값보다 크면 이 페이즈" 라는 뜻.
 * 순서대로 검사하므로 위에서부터 1 → 2 → 3.
 */
export const PHASES = [
  {
    id: 1,
    from: 2 / 3,
    color: '#ff5d8f',
    micEvery: 5.0,
    fireEvery: 1.6,
    shots: 5,
    shotSpeed: 78,
    openEvery: 4.2,
    openFor: 2.2,
    descendTo: 118,
    minionEvery: 0,
    quarters: 0,
  },
  {
    id: 2,
    from: 1 / 3,
    color: '#ffc93c',
    micEvery: 4.2,
    fireEvery: 1.15,
    shots: 7,
    shotSpeed: 95,
    openEvery: 3.4,
    openFor: 1.8,
    descendTo: 126,
    minionEvery: 0,
    quarters: 4,
    quarterSpeed: 150,
  },
  {
    id: 3,
    from: -1,
    color: '#7c5cff',
    micEvery: 3.4,
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
  },
];

/** 남은 체력 비율로 페이즈를 고른다 */
export function phaseFor(hp, maxHp = BOSS_MAX_HP) {
  const ratio = Math.max(0, hp) / maxHp;
  return PHASES.find((p) => ratio > p.from) ?? PHASES[PHASES.length - 1];
}
