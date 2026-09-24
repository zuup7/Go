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

// ══════════════════════════════════════════════════════════════
// 좌판 아줌마 · 16×20
// ══════════════════════════════════════════════════════════════
//
// **실루엣이 노인과 한눈에 갈려야 한다.** 노인은 14칸에 꽉 찬 세로 기둥이고,
// 이쪽은 앉아 있어서 위가 비고 아래가 넓다 — 낮은 좌판이 바닥을 가로로 깐다.
// 같은 자리에 둘을 세워놓고 눈을 가늘게 떠도 어느 쪽인지 알 수 있어야 한다.
//
// 꽃무늬 옷과 뽀글머리로 「아줌마」를 읽힌다. 색도 노인(보라 로브·흰머리)과
// 겹치지 않게 분홍·갈색으로 잡았다.

const MPAL = {
  k: '#241a33', // 윤곽
  s: '#ffd9b3', // 살색 — 노인과 같은 색을 쓴다. 사람은 사람이다
  h: '#8a5238', // 뽀글머리
  c: '#ff8fb0', // 꽃무늬 상의
  f: '#ffd166', // 꽃잎 점 · 동전
  t: '#7a4a2a', // 좌판 나무
  d: '#4a2c18', // 좌판 그늘
  w: '#f2f0ff', // 좌판에 놓인 레코드
  e: '#20182e', // 눈·입
};

const MW = 16;
const MBLANK = '................';

/** 머리 일곱 줄 (2~8행). 뽀글이 얼굴을 감싼다 */
const MHEAD = {
  base: [
    '....kkkkkk......',
    '...khhhhhhk.....',
    '..khhhhhhhhk....',
    '..khhssssshk....',
    '..khsesseshk....',
    '...kssssssk.....',
    '....kseesk......',
  ],
  /**
   * 고개를 든다 — 눈이 **웃는 호**(k)로 바뀌고 입이 벌어진다.
   * 구멍(`.`)으로 눈을 그리면 얼굴에 뚫린 자국으로 보인다. 한 번 그래 봤다.
   */
  up: [
    '....kkkkkk......',
    '...khhhhhhk.....',
    '..khhhhhhhhk....',
    '..khhssssshk....',
    '..khsksskshk....',
    '...kssssssk.....',
    '....keeeek......',
  ],
};

/** 몸통 다섯 줄 (9~13행). 팔이 여기 붙는다 */
const MTORSO = {
  /** 무릎에 손을 얹고 앉았다 */
  sit: [
    '...kcccccck.....',
    '..scffcccfcs....',
    '..scccccccs.....',
    '...cfcccccf.....',
    '...kcccccck.....',
  ],
  /** 만세 — 두 팔이 어깨 위로. 손은 머리 옆까지 올라간다 (mbuild 의 hands) */
  hooray: [
    '.s.kcccccck.s...',
    '..scffcccfcs....',
    '...cccccccc.....',
    '...cfcccccf.....',
    '...kcccccck.....',
  ],
  /** 손뼉 — 두 손이 가슴 앞에서 만난다 */
  clap: [
    '...kcccccck.....',
    '..kcffcccfck....',
    '...cccsscc......',
    '...cfcccccf.....',
    '...kcccccck.....',
  ],
  /** 한 손을 들어 부른다 — 오른팔이 어깨 위로 */
  wave: [
    '...kcccccck.s...',
    '..scffcccfcs....',
    '..scccccccs.....',
    '...cfcccccf.....',
    '...kcccccck.....',
  ],
};

/**
 * 좌판 여섯 줄 (14~19행). **사람보다 넓다** — 그래야 앉은 것이 읽힌다.
 * 물건은 좌판 위(14~15행)에 놓이고, 아줌마의 아랫도리는 그 뒤로 가려진다.
 */
const MSTALL = [
  '.wwww......ffff.',
  '.wkkw......fkkf.',
  'tttttttttttttttt',
  '.dddddddddddddd.',
  '.dtttttttttttd..',
  '..kkkkkkkkkkkk..',
];

const mpoke = (row, i, ch) => row.slice(0, i) + ch + row.slice(i + 1);

/**
 * hands 는 [줄, 칸] 목록 — 조각 경계를 넘어 머리 옆까지 올라간 손을 **한 칸씩** 꽂는다.
 * 노인의 지팡이 기둥과 같은 수법이다: 조각에 그려 넣으면 그 조각을 빌려 쓰는
 * 다른 장에서 손 토막만 허공에 뜬다.
 */
const mbuild = (head, torso, { drop = 0, hands = [] } = {}) => {
  const body = drop > 0 ? torso.slice(0, torso.length - drop) : torso;
  let rows = [...Array(2 + drop).fill(MBLANK), ...head, ...body, ...MSTALL];
  for (const [r, c] of hands) rows[r] = mpoke(rows[r], c, 's');
  if (rows.length !== 20) throw new Error(`상인 프레임이 ${rows.length}줄이다 — 20줄이어야 한다`);
  for (const row of rows) {
    if (row.length !== MW) {
      throw new Error(`상인 프레임에 ${row.length}칸짜리 줄이 있다 — ${MW}칸이어야 한다`);
    }
  }
  return sprite(rows, MPAL);
};

export const SHOP_SPRITES = {
  sit: mbuild(MHEAD.base, MTORSO.sit),
  /** 숨 쉬듯 한 칸 내려앉은 장. 둘을 번갈아 쓰면 살아 있어 보인다 */
  sit2: mbuild(MHEAD.base, MTORSO.sit, { drop: 1 }),
  /** 가까이 오면 고개를 들고 손을 든다 */
  wave: mbuild(MHEAD.up, MTORSO.wave),
  wave2: mbuild(MHEAD.up, MTORSO.wave, { drop: 1 }),
  /** 골라 가면 좋아한다 — 만세와 손뼉을 번갈아. 손뼉은 한 칸 주저앉아 들썩인다 */
  hooray: mbuild(MHEAD.up, MTORSO.hooray, { hands: [[8, 0], [8, 13]] }),
  clap: mbuild(MHEAD.up, MTORSO.clap, { drop: 1 }),
};

/** 스프라이트를 npc 좌표에 놓을 때의 보정. 발밑은 노인과 같고 가로만 한 칸 넓다 */
export const SHOP_OFFSET = { x: -3, y: 14 - 20 };

/**
 * 지금 그릴 상인 프레임. 노인의 npcFrame 과 **같은 자리**다 —
 * 상태를 보고 고르는 일은 그리는 쪽이 아니라 여기서 한다.
 *
 * 가까이 오면 손을 들어 부른다. 이게 「누를 수 있다」를 몸으로 먼저 알린다.
 */
export function shopFrame({ near, cheer }, time) {
  // 좋아할 때는 빠르게 — 느리게 번갈면 박수가 아니라 체조가 된다
  if (cheer) return Math.floor(cheer.t * 6) % 2 === 0 ? SHOP_SPRITES.hooray : SHOP_SPRITES.clap;
  const beat = Math.floor(time * 2) % 2 === 1;
  if (near) return beat ? SHOP_SPRITES.wave2 : SHOP_SPRITES.wave;
  return beat ? SHOP_SPRITES.sit2 : SHOP_SPRITES.sit;
}

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
