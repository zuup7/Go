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

/**
 * 하드모드 — 네 페이즈. **1회차에서 우리가 밟아 없앤 앨범들이 진화해서 돌아왔다.**
 *
 * 그래서 몸에 앨범이 박혀 있다. 1·2페이즈는 원반 형태지만, **3페이즈에서
 * 공룡로봇으로 변신한다** — 원반이 뒤로 접히고 목과 꼬리가 뻗어 나온다.
 *
 * 공룡이 되면 공격의 **축이 바뀐다.** 레이저는 세로 기둥이라 옆으로 비켜서 피했지만,
 * 꼬리와 충격파는 **바닥을 훑는 가로 공격**이라 뛰어서만 피한다. 수치만 올린 게
 * 아니라 피하는 방법 자체가 달라야 "새 형태"로 읽힌다.
 */
/** 공룡로봇으로 변신하는 페이즈 (여기부터 몸이 바뀌고 새 패턴이 나온다) */
export const DINO_FROM_PHASE = 3;
export const HARD_PHASES = [
  {
    id: 1,
    from: 3 / 4,
    color: '#ff5d8f',
    micEvery: 4.2,
    fireEvery: 1.2,
    shots: 7,
    shotSpeed: 95,
    openEvery: 3.6,
    openFor: 1.9,
    descendTo: 118,
    minionEvery: 0,
    quarters: 0,
    laserEvery: 6.0,
    laserAim: 0.9,
    laserFire: 1.6,
    laserSweep: 96,
  },
  {
    id: 2,
    from: 2 / 4,
    color: '#ffc93c',
    micEvery: 3.8,
    fireEvery: 1.0,
    shots: 9,
    shotSpeed: 110,
    openEvery: 3.0,
    openFor: 1.7,
    descendTo: 126,
    minionEvery: 4.0,
    minions: ['a01', 'a06'],
    quarters: 4,
    quarterSpeed: 175,
    laserEvery: 5.2,
    laserAim: 0.85,
    laserFire: 1.6,
    laserSweep: 100,
  },
  {
    id: 3,
    from: 1 / 4,
    color: '#7c5cff',
    micEvery: 3.2,
    fireEvery: 0.8,
    shots: 11,
    shotSpeed: 124,
    openEvery: 2.6,
    openFor: 1.5,
    descendTo: 132,
    minionEvery: 3.0,
    minions: ['a01', 'a06', 'a02'],
    quarters: 4,
    quarterSpeed: 195,
    laserEvery: 4.4,
    laserAim: 0.8,
    laserFire: 1.7,
    laserSweep: 104,
    // ── 공룡 형태 ────────────────────────────────────────────
    /** 이 페이즈부터 몸이 공룡로봇이다 */
    dino: true,
    /** 꼬리를 휘두른다. 바닥을 훑는 가로 공격 — **뛰어야만** 피한다 */
    tailEvery: 6.5,
    tailAim: 0.7,
    tailSweep: 1.1,
    /** 훑는 높이(바닥에서 이만큼). 점프(2.95칸 ≈ 47px)로 넘을 수 있어야 한다 */
    tailHeight: 20,
    /** 앞발로 내리찍는다. 충격파가 바닥을 타고 양쪽으로 퍼진다 */
    stompEvery: 5.0,
    stompAim: 0.75,
    /** 충격파가 퍼지는 속도. 달리기(124)보다 빨라도 된다 — 뛰어서 넘는 것이므로 */
    waveSpeed: 190,
    waveHeight: 14,
  },
  {
    id: 4,
    from: -1,
    color: '#ff3b3b',
    micEvery: 2.8,
    fireEvery: 0.7,
    shots: 12,
    shotSpeed: 132,
    openEvery: 2.4,
    openFor: 1.4,
    descendTo: 134,
    minionEvery: 2.6,
    minions: ['a01', 'a06', 'a02', 'a15'],
    quarters: 6,
    quarterSpeed: 210,
    laserEvery: 3.8,
    laserAim: 0.8,
    laserFire: 1.8,
    laserSweep: 108,
    /**
     * 기둥이 둘. 양쪽에서 안쪽으로 훑어 온다.
     * 둘 사이에는 반드시 설 자리가 남아야 한다 — 테스트가 그걸 지킨다.
     */
    twinLaser: true,
    dino: true,
    tailEvery: 5.2,
    tailAim: 0.6,
    tailSweep: 1.2,
    tailHeight: 24,
    stompEvery: 4.0,
    stompAim: 0.65,
    waveSpeed: 215,
    waveHeight: 16,
  },
];

/** 하드모드 체력. 페이즈당 세 대는 그대로 두고 페이즈만 하나 늘린다 */
export const HARD_MAX_HP = 12;

/** 이 판이 볼 페이즈 표와 체력 */
export const phasesFor = (hard) => (hard ? HARD_PHASES : PHASES);
export const maxHpFor = (hard) => (hard ? HARD_MAX_HP : BOSS_MAX_HP);

/** 남은 체력 비율로 페이즈를 고른다 */
export function phaseFor(hp, maxHp = BOSS_MAX_HP, phases = PHASES) {
  const ratio = Math.max(0, hp) / maxHp;
  return phases.find((p) => ratio > p.from) ?? phases[phases.length - 1];
}
