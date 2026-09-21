// 2회차 문 옆에 선 노인. 14×20 픽셀.
//
// 주인공(sprites.js)과 **같은 판**을 쓴다 — 문자열 픽셀 표를 조각으로 나눠 겹친다.
// 예전엔 fillRect 여섯 줄을 손으로 찍었는데, 팔도 다리도 없어서 확대해 보면
// 사람이 아니라 문짝에 얼굴이 붙은 걸로 읽혔다.
//
// 지팡이도 **프레임 안에 굽는다.** 따로 그리면 몸에서 떨어져 떠 보이고,
// 자세가 바뀔 때마다 지팡이 좌표를 따로 맞춰줘야 한다.
import { sprite } from './pixel.js';

const PAL = {
  k: '#241a33', // 윤곽·로브 그늘
  s: '#ffd9b3', // 살색
  h: '#f4f2ff', // 흰머리·수염 — 살색(#ffd9b3)과 확실히 갈려야 한다
  r: '#7c5cff', // 로브
  d: '#4a2f7a', // 로브 그늘
  w: '#8a7fb8', // 지팡이 대
  g: '#ffd166', // 지팡이 구슬
  e: '#20182e', // 눈
};

const W = 14;
const BLANK = '..............';

/**
 * 지팡이 윗동 2줄. 구슬이 머리보다 높이 뜬다.
 * 서 있을 때는 오른쪽에 세우고, 들면 한 칸 더 위로 간다 — 그건 몸통 조각이 맡는다.
 */
const TOP = {
  /** 구슬이 머리 위에 뜬다. 아래로 기둥(11번 칸)이 몸을 타고 바닥까지 내려간다 */
  stand: ['..........ggg.', '..............'],
  /** 들었다 — 구슬에 불이 들어오고, 기둥은 바닥에서 떨어진다 (LEGS.greet) */
  greet: ['..........ggg.', '..........ggg.'],
  /** 춤출 때는 지팡이를 놓는다. 두 팔을 다 써야 병맛이 산다 */
  none: [BLANK, BLANK],
};

/**
 * 머리 7줄 — 흰머리와 흰수염이 얼굴을 감싼다.
 *
 * 바깥을 k 로 두른다. 안 그러면 밝은 초원 위에서 **흰 덩어리**로 뭉개진다
 * (한 번 그렇게 만들어놓고 확대해서야 알았다).
 */
const HEAD = {
  /** 얼굴 두 줄, **수염 세 줄.** 수염이 길어야 첫눈에 노인으로 읽힌다 */
  base: [
    '...kkkkkk.....',
    '..khhhhhhk....',
    '..ksessesk....',
    '..kssssssk....',
    '..khhhhhhk....',
    '..khhhhhhk....',
    '...khhhk......',
  ],
  /** 고개를 든다 — 눈이 한 칸 위로, 수염이 앞으로 들린다 */
  up: [
    '..kkkkkkkk....',
    '..ksessesk....',
    '..kssssssk....',
    '..khhhhhhk....',
    '..khhhhhhk....',
    '...khhhhk.....',
    '....khhk......',
  ],
  /** 춤 — 입을 벌리고 고개를 왼쪽으로 젖힌다 */
  yell: [
    '..kkkkkk......',
    '.khhhhhhk.....',
    '.ksessesk.....',
    '.kseeeesk.....',
    '.khhhhhhk.....',
    '.khhhhhhk.....',
    '..khhhk.......',
  ],
  /** 오른쪽으로 젖힌다 */
  yellR: [
    '....kkkkkk....',
    '...khhhhhhk...',
    '...ksessesk...',
    '...kseeeesk...',
    '...khhhhhhk...',
    '...khhhhhhk...',
    '.....khhhk....',
  ],
};

/** 몸통 7줄 — 팔이 여기 붙는다 (주인공 TORSO 와 같은 방식) */
const TORSO = {
  /** 지팡이를 짚고 섰다. 한 손(10칸)이 기둥을 쥔다 */
  stand: [
    '..rrrrrrrr....',
    '.srrrrrrrrs...',
    '..rrrrrrrr....',
    '..rdrrrrdr....',
    '..rrrrrrrr....',
    '..rrrrrrrr....',
    '..dddddddd....',
  ],
  /** 지팡이를 들었다 — 쥔 손이 한 칸 위로 올라간다 */
  greet: [
    '..rrrrrrrrs...',
    '.srrrrrrrr....',
    '..rrrrrrrr....',
    '..rdrrrrdr....',
    '..rrrrrrrr....',
    '..rrrrrrrr....',
    '..dddddddd....',
  ],
  /** 만세 — 두 팔이 위로 쭉 */
  up: [
    's.rrrrrrrr.s..',
    '.srrrrrrrrs...',
    '..rrrrrrrr....',
    '..rdrrrrdr....',
    '..rrrrrrrr....',
    '..rrrrrrrr....',
    '..dddddddd....',
  ],
  /** 팔을 아래로 붙이고 웅크린다 */
  down: [
    '..rrrrrrrr....',
    '..rrrrrrrr....',
    '.srrrrrrrrs...',
    '.srdrrrrdrs...',
    '..rrrrrrrr....',
    '..rrrrrrrr....',
    '..dddddddd....',
  ],
  /** 왼팔 위, 오른팔 옆 */
  leanL: [
    's.rrrrrrrr....',
    '.srrrrrrrr....',
    '..rrrrrrrrs...',
    '..rdrrrrdr....',
    '..rrrrrrrr....',
    '..rrrrrrrr....',
    '..dddddddd....',
  ],
  /** 오른팔 위, 왼팔 옆 */
  leanR: [
    '..rrrrrrrr.s..',
    '..rrrrrrrrs...',
    '.srrrrrrrr....',
    '..rdrrrrdr....',
    '..rrrrrrrr....',
    '..rrrrrrrr....',
    '..dddddddd....',
  ],
};

/** 다리 4줄 — 로브 밑으로 나온 발 */
const LEGS = {
  /** 지팡이 기둥이 여기서 바닥에 닿는다 */
  stand: ['..dddddddd....', '..dd....dd....', '..kk....kk....', '..kk....kk....'],
  /** 들었을 때 — 기둥이 바닥에서 떨어진다 */
  greet: ['..dddddddd....', '..dd....dd....', '..kk....kk....', '..kk....kk....'],
  /** 벌린 다리 */
  wide: ['..dddddddd....', '.dd......dd...', '.kk......kk...', 'kk........kk..'],
  /** 모은 다리 (웅크릴 때) */
  close: ['..dddddddd....', '...dddddd.....', '...kk.kk......', '...kk.kk......'],
  /** 한 발을 든다 */
  kickL: ['..dddddddd....', '..dd....dd....', '.kk.....kk....', 'kk......kk....'],
  kickR: ['..dddddddd....', '..dd....dd....', '..kk.....kk...', '..kk......kk..'],
};

/**
 * 프레임 하나. 항상 14×20 이다 (지팡이 2 + 머리 7 + 몸통 7 + 다리 4).
 *
 * drop 은 「몸이 주저앉은 정도」. 위에 빈 줄을 그만큼 넣고 **몸통에서** 덜어낸다 —
 * 주인공 build() 와 같은 규칙이다. 다리에서 덜면 춤출 때 다리가 사라진다.
 */
/** 지팡이 기둥이 서는 칸 */
const STAFF_COL = 11;
const poke = (row, i, ch) => row.slice(0, i) + ch + row.slice(i + 1);

/**
 * 프레임 하나. 항상 14×20 이다 (지팡이 2 + 머리 7 + 몸통 7 + 다리 4).
 *
 * drop 은 「몸이 주저앉은 정도」. 위에 빈 줄을 그만큼 넣고 **몸통에서** 덜어낸다 —
 * 주인공 build() 와 같은 규칙이다. 다리에서 덜면 춤출 때 다리가 사라진다.
 *
 * staff 는 기둥을 세울 줄 범위다. **조각 그림에는 기둥을 안 그린다** —
 * 머리 조각에 그려뒀더니 그 머리를 빌려 쓰는 춤 프레임에서 기둥 토막만
 * 허공에 떠 있었다. 기둥은 조각이 아니라 **한 칸**이므로 여기서 한 번에 꽂는다.
 */
const build = (top, head, torso, legs, { drop = 0, staff = null } = {}) => {
  const body = drop > 0 ? torso.slice(0, torso.length - drop) : torso;
  let rows = [...Array(drop).fill(BLANK), ...top, ...head, ...body, ...legs];
  if (staff) {
    rows = rows.map((row, i) => (i >= staff[0] && i < staff[1] ? poke(row, STAFF_COL, 'w') : row));
  }
  if (rows.length !== 20) throw new Error(`NPC 프레임이 ${rows.length}줄이다 — 20줄이어야 한다`);
  for (const row of rows) {
    if (row.length !== W) throw new Error(`NPC 프레임에 ${row.length}칸짜리 줄이 있다 — ${W}칸이어야 한다`);
  }
  return sprite(rows, PAL);
};

export const NPC_SPRITES = {
  /** 구슬 밑(1줄)부터 바닥까지 기둥을 세우고 짚는다 */
  stand: build(TOP.stand, HEAD.base, TORSO.stand, LEGS.stand, { staff: [1, 20] }),
  /** 들었다 — 기둥이 발밑에서 떨어진다 */
  greet: build(TOP.greet, HEAD.up, TORSO.greet, LEGS.greet, { staff: [1, 17] }),
  // 병맛 춤 네 장. 지팡이는 놓는다 — 두 팔을 다 써야 병맛이 산다.
  // 한 장씩 웃기면 안 되고 **루프가** 웃겨야 한다.
  dance1: build(TOP.none, HEAD.yell, TORSO.up, LEGS.wide), // 만세
  dance2: build(TOP.none, HEAD.base, TORSO.down, LEGS.close, { drop: 1 }), // 웅크림
  dance3: build(TOP.none, HEAD.yellR, TORSO.leanL, LEGS.kickL), // 왼쪽
  dance4: build(TOP.none, HEAD.yell, TORSO.leanR, LEGS.kickR), // 오른쪽
};

/** 춤 한 바퀴 (초당 8장) */
const DANCE = [NPC_SPRITES.dance1, NPC_SPRITES.dance2, NPC_SPRITES.dance3, NPC_SPRITES.dance2, NPC_SPRITES.dance4];
const DANCE_FPS = 8;

/** 스프라이트를 npc 좌표(발바닥이 npc.y + 14)에 놓을 때의 보정 */
export const NPC_OFFSET = { x: -2, y: 14 - 20 };

/**
 * 지금 그릴 프레임. 주인공의 playerFrame 과 같은 자리다 —
 * **상태를 보고 고르는 일은 여기서만** 한다.
 */
export function npcFrame({ near, dancing }, time) {
  if (dancing) return DANCE[Math.floor(time * DANCE_FPS) % DANCE.length];
  return near ? NPC_SPRITES.greet : NPC_SPRITES.stand;
}

/**
 * 춤추다 한 바퀴 도는 순간인가.
 *
 * 옆모습도 뒷모습도 안 그리고 **좌우 반전을 빠르게 토글**해서 도는 것처럼 보이게 한다.
 * 2.4초마다 0.3초 동안. 계속 돌리면 그냥 깜빡이는 걸로 보이고 병맛이 안 산다.
 */
export const npcSpin = (time) => {
  const phase = time % 2.4;
  return phase < 0.3 && Math.floor(phase * 40) % 2 === 1;
};

/** 춤출 때 몸이 통통 뜨는 높이 (픽셀) */
export const npcBob = (time) => Math.abs(Math.sin(time * DANCE_FPS * 0.5 * Math.PI)) * 2;
