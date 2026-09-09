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
    laserEvery: 0,
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
    laserEvery: 0,
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
    // ── 레이저. 3페이즈에만 있다 ──────────────────────────────
    // 여기까지 오면 보스는 합체 로봇이다. 수치만 올라간 공격을 아무리 얹어도
    // "최종 형태"로 안 읽힌다. 로봇만 할 수 있는 기술이 하나는 있어야 한다.
    /** attack 중 이만큼 지나면 레이저를 쓴다. 0 이면 안 쓴다 */
    laserEvery: 5.0,
    /** 예고(유도선만, 안 아프다) */
    laserAim: 0.9,
    /** 발사 — 96 * 1.6 ≈ 154px 를 훑는다. 아레나(640)보다 한참 짧다 */
    laserFire: 1.6,
    /**
     * 훑는 속도. **달리기(PLAYER.maxSpeed = 124)보다 반드시 느려야 한다** —
     * 넘기는 순간 달려서 못 피하는 판이 되고, 그건 트롤이 아니라 그냥 불합리다.
     * tests/boss.test.js 가 이 부등호를 지킨다.
     */
    laserSweep: 96,
  },
];

/** 남은 체력 비율로 페이즈를 고른다 */
export function phaseFor(hp, maxHp = BOSS_MAX_HP) {
  const ratio = Math.max(0, hp) / maxHp;
  return PHASES.find((p) => ratio > p.from) ?? PHASES[PHASES.length - 1];
}
