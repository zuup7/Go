// 주인공 스프라이트. 12×16 픽셀, 히트박스(10×14)보다 살짝 크다.
import { sprite } from './pixel.js';
import { HAIRS, JACKETS, PANTS, DEFAULT_LOOK, sanitizeLook, lookKey } from '../data/looks.js';

const PAL = {
  k: '#20182e', // 머리·윤곽
  s: '#ffd9b3', // 살색
  j: '#4ec3ff', // 재킷
  r: '#ff5d8f', // 포인트
  p: '#33324a', // 바지
  m: '#d8dde8', // 마이크
  w: '#ffffff',
};

const W = 12;
const BLANK = '............';

/**
 * 머리 네 벌. **어느 벌이든 7줄 × 12칸**이고, 얼굴(눈·입)은 아래 네 줄에서
 * 똑같다 — 머리만 갈아 끼우는 것이라 표정은 안 건드린다.
 *
 * 벌마다 숙인 것(달릴 때)을 따로 둔다. 한 칸 앞으로 나간 것뿐인데, 코드로
 * 밀면 12칸 밖으로 나가는 줄이 생겨서 손으로 적어둔다.
 *
 * `H` 는 **옷 색을 따라간다** (모자를 옷과 맞춘다). `R` 은 포인트 색이다.
 * 이름(base·cap·band·long)은 data/looks.js 의 HAIRS 와 같아야 한다 —
 * 어긋나면 tests/look.test.js 가 양쪽에서 잡는다.
 */
const HAIR = {
  base: {
    head: [
      '....kkkk....',
      '...kkkkkk...',
      '..kkkkkkkk..',
      '..kssssssk..',
      '..kskssksk..',
      '..ksskkssk..',
      '...kssssk...',
    ],
    lean: [
      '.....kkkk...',
      '....kkkkkk..',
      '...kkkkkkkk.',
      '...kssssssk.',
      '...kskssksk.',
      '...ksskkssk.',
      '....kssssk..',
    ],
  },
  /** 캡 모자 — 챙이 앞(오른쪽)으로 나간다. 색은 옷을 따라간다 */
  cap: {
    head: [
      '...HHHHHH...',
      '..HHHHHHHHH.',
      '..kkkkkkkk..',
      '..kssssssk..',
      '..kskssksk..',
      '..ksskkssk..',
      '...kssssk...',
    ],
    lean: [
      '....HHHHHH..',
      '...HHHHHHHHH',
      '...kkkkkkkk.',
      '...kssssssk.',
      '...kskssksk.',
      '...ksskkssk.',
      '....kssssk..',
    ],
  },
  /** 머리띠 — 머리선 자리에 포인트 색 한 줄 */
  band: {
    head: [
      '....kkkk....',
      '...kkkkkk...',
      '.RRRRRRRRRR.',
      '..kssssssk..',
      '..kskssksk..',
      '..ksskkssk..',
      '...kssssk...',
    ],
    lean: [
      '.....kkkk...',
      '....kkkkkk..',
      '..RRRRRRRRRR',
      '...kssssssk.',
      '...kskssksk.',
      '...ksskkssk.',
      '....kssssk..',
    ],
  },
  /** 장발 — 옆머리가 턱 밑까지 내려온다 */
  long: {
    head: [
      '....kkkk....',
      '...kkkkkk...',
      '..kkkkkkkk..',
      '.kksssssskk.',
      '.kksksskskk.',
      '.kksskksskk.',
      '.kkksssskkk.',
    ],
    lean: [
      '.....kkkk...',
      '....kkkkkk..',
      '...kkkkkkkk.',
      '..kksssssskk',
      '..kksksskskk',
      '..kksskksskk',
      '..kkksssskkk',
    ],
  },
};

const TORSO = {
  /** 가만히 — 두 팔이 몸 옆에 */
  idle: [
    '..jjjjjjjj..',
    '.jjjjrrjjjj.',
    '.jjjjjjjjjjm',
    '.sjjjjjjjjs.',
    '..jjjjjjjj..',
    '..pppppppp..',
    '..pppppppp..',
  ],
  /** 달리기 A — 앞팔이 앞으로 */
  swingA: [
    '..jjjjjjjj..',
    '.jjjjrrjjjj.',
    '.jjjjjjjjjjm',
    '.jjjjjjjjjss',
    '.sjjjjjjjj..',
    '..pppppppp..',
    '..pppppppp..',
  ],
  /** 달리기 B — 앞팔이 뒤로 (팔이 반대로 흔들린다) */
  swingB: [
    '..jjjjjjjj..',
    '.jjjjrrjjjj.',
    '.jjjjjjjjjjm',
    'ssjjjjjjjjj.',
    '..jjjjjjjjs.',
    '..pppppppp..',
    '..pppppppp..',
  ],
  /** 대시 — 두 팔을 뒤로 완전히 젖힌다. 몸이 앞으로 쏠린 자세다 */
  dash: [
    '..jjjjjjjj..',
    '.jjjjrrjjjj.',
    's.jjjjjjjjjm',
    'ss.jjjjjjjj.',
    '...jjjjjjjj.',
    '..pppppppp..',
    '..pppppppp..',
  ],
  /** 뜬 순간 — 두 팔이 위로 */
  rise: [
    's.jjjjjjjj.s',
    '.jjjjrrjjjj.',
    '.jjjjjjjjjjm',
    '.jjjjjjjjjj.',
    '..jjjjjjjj..',
    '..pppppppp..',
    '..pppppppp..',
  ],
  /** 떨어지는 중 — 두 팔이 균형 잡느라 옆으로 벌어진다 */
  fall: [
    '..jjjjjjjj..',
    '.jjjjrrjjjj.',
    'sjjjjjjjjjjm',
    's.jjjjjjjj.s',
    '..jjjjjjjj.s',
    '..pppppppp..',
    '..pppppppp..',
  ],
};

const LEGS = {
  stand: ['..kkk..kkk..', '..kkk..kkk..'],
  /** 두 다리가 몸 밑에서 스치는 순간 (몸이 제일 높다) */
  passA: ['...kkkkkk...', '...kk.kkk...'],
  passB: ['...kkkkkk...', '...kkk.kk...'],
  /** 발이 땅에 닿아 벌어진 순간 (몸이 한 칸 내려앉는다) */
  reachA: ['..kkkkkk....', '.kkk....kkk.'],
  reachB: ['....kkkkkk..', '.kkk....kkk.'],
  jump: ['.kkk....kkk.', '..kk......k.'],
  /** 떨어질 때는 두 다리를 모아 버틴다 */
  fall: ['..kk....kk..', '.kkk....kkk.'],
  /** 대시 — 다리가 뒤로 쭉 뻗는다 */
  dash: ['.kkkkkkkkk..', 'kk..........'],
};

/**
 * 프레임 하나. 항상 12×16 이다.
 *
 * drop 은 "몸이 주저앉은 정도". 위에 빈 줄을 그만큼 넣고 **몸통에서** 같은 수만큼
 * 덜어낸다. 다리에서 덜면 접지 프레임마다 다리가 사라져서 걷는 게 안 보인다 —
 * 실제로 한 번 그렇게 만들어놓고 화면에서 다리를 잃어버렸다.
 * 몸통이 줄어드는 건 발이 땅을 찰 때 상체가 눌리는 것이라 그림으로도 맞다.
 */
const build = (pal, head, torso, legs, drop = 0) => {
  const body = drop > 0 ? torso.slice(0, torso.length - drop) : torso;
  const rows = [...Array(drop).fill(BLANK), ...head, ...body, ...legs];
  if (rows.length !== 16) throw new Error(`프레임이 ${rows.length}줄이다 — 16줄이어야 한다`);
  // 머리를 네 벌로 늘리면서 넣었다. 한 줄만 길어도 sprite 의 너비가 늘어나
  // **그 프레임만 옆으로 밀린다** — 달리다 머리가 덜컥거리는 걸로 보인다.
  for (const row of rows) {
    if (row.length !== W) throw new Error(`프레임에 ${row.length}칸짜리 줄이 있다 — ${W}칸이어야 한다`);
  }
  return sprite(rows, pal);
};

/** 차림새 한 벌의 여덟 프레임 */
const buildSet = (look) => {
  const l = sanitizeLook(look);
  const hair = HAIR[HAIRS[l.hair].id];
  const pal = {
    ...PAL,
    j: JACKETS[l.jacket].color,
    p: PANTS[l.pants].color,
    H: JACKETS[l.jacket].color, // 모자는 옷을 따라간다
    R: PAL.r, // 머리띠는 포인트 색
  };
  const b = (head, torso, legs, drop) => build(pal, head, torso, legs, drop);
  const frames = {
    stand: b(hair.head, TORSO.idle, LEGS.stand),
    runPassA: b(hair.lean, TORSO.swingA, LEGS.passA),
    runReachA: b(hair.lean, TORSO.swingA, LEGS.reachA, 1),
    runPassB: b(hair.lean, TORSO.swingB, LEGS.passB),
    runReachB: b(hair.lean, TORSO.swingB, LEGS.reachB, 1),
    jump: b(hair.head, TORSO.rise, LEGS.jump),
    fall: b(hair.head, TORSO.fall, LEGS.fall),
    dash: b(hair.lean, TORSO.dash, LEGS.dash),
  };
  // 달리기 한 바퀴는 **frames 바깥**에 둔다. 안에 섞으면 「프레임을 전부 돌며
  // 크기를 재는」 테스트가 배열 하나를 프레임으로 알고 걸린다 (실제로 걸렸다).
  return {
    frames,
    run: [frames.runReachA, frames.runPassA, frames.runReachB, frames.runPassB],
  };
};

/**
 * 구운 차림새를 들고 있는다.
 *
 * **새로 만들어야지 고치면 안 된다.** bake() 는 스프라이트 **객체를 열쇠로**
 * WeakMap 에 구워두므로, PAL 을 제자리에서 바꾸면 색만 바뀌고 화면은 옛 그림
 * 그대로다. 차림새마다 객체를 따로 만들어 두면 그 캐시가 저절로 맞는다.
 */
const SETS = new Map();
export const spritesFor = (look) => {
  const key = lookKey(look);
  if (!SETS.has(key)) SETS.set(key, buildSet(look));
  return SETS.get(key);
};

/**
 * 지금 그릴 차림새.
 *
 * playerFrame 은 **일곱 군데**에서 불린다 — 판을 그리는 곳 둘, 컷신 다섯.
 * 인자로 넘기면 컷신 속 깊은 함수까지 줄줄이 고쳐야 하고, 한 군데라도 빠뜨리면
 * 「판에서는 꾸민 대로인데 결혼식에서는 원래 옷」이 된다. 그래서 여기서 한 번
 * 정하고 모두가 같은 걸 본다 (scene.js 가 매 프레임 setLook 을 부른다 — 값이
 * 같으면 Map 조회 한 번이라 공짜다).
 */
let current = spritesFor(DEFAULT_LOOK);
export const setLook = (look) => {
  current = spritesFor(look);
};

/** 기본 차림새의 프레임 여덟 장 */
export const PLAYER_SPRITES = spritesFor(DEFAULT_LOOK).frames;

/**
 * 달리기 한 바퀴. 닿음 → 스침 → 닿음(반대) → 스침(반대).
 * 몸이 닿음에서 내려앉고 스침에서 올라와, 걸음마다 위아래로 까딱인다.
 */
/** 이만큼 달릴 때마다 발이 한 칸 넘어간다 (픽셀) */
const STRIDE = 9;

/** 이보다 빨리 떨어지고 있으면 떨어지는 그림 */
const FALLING = 40;

/**
 * 상태에 맞는 프레임 하나 고르기.
 *
 * 달리기 한 바퀴는 닿음 → 스침 → 닿음(반대) → 스침(반대). 몸이 닿음에서
 * 내려앉고 스침에서 올라와, 걸음마다 위아래로 까딱인다.
 */
export function playerFrame(player, set = current) {
  const f = set.frames;
  if (player.dashTime > 0) return f.dash;
  if (!player.onGround) return player.vy > FALLING ? f.fall : f.jump;
  if (Math.abs(player.vx) < 6) return f.stand;
  // **시간이 아니라 달린 거리**로 돈다. 시간으로 돌리면 느리게 걸을 때 발이 미끄러진다.
  const step = Math.floor((player.stride ?? 0) / STRIDE) % set.run.length;
  return set.run[step];
}

/** 스프라이트를 히트박스 기준으로 놓을 때의 보정 */
export const PLAYER_OFFSET = { x: -1, y: -2 };

// 재생수(음표) — 8×8
export const NOTE = sprite(
  [
    '....nn..',
    '...nnn..',
    '...n.n..',
    '...n.n..',
    '..nnn...',
    '.nnnn...',
    '..nnn...',
    '........',
  ],
  { n: '#ffd166' },
);

// 적이 쏘는 음표 탄환 — 6×6
export const SHOT = sprite(
  [
    '..oo..',
    '.oiio.',
    'oiiiio',
    'oiiiio',
    '.oiio.',
    '..oo..',
  ],
  { o: '#ff5d8f', i: '#fff0f5' },
);

// 보스가 쏘는 탄환
export const SHOT_BOSS = sprite(
  [
    '..oo..',
    '.oiio.',
    'oiiiio',
    'oiiiio',
    '.oiio.',
    '..oo..',
  ],
  { o: '#7c5cff', i: '#e6dcff' },
);

// 체크포인트 디스크 — 12×12
export const DISC = sprite(
  [
    '...dddd...',
    '.dddddddd.',
    '.ddwwwwdd.',
    'ddwwwwwwdd',
    'ddwwkkwwdd',
    'ddwwkkwwdd',
    'ddwwwwwwdd',
    '.ddwwwwdd.',
    '.dddddddd.',
    '...dddd...',
  ],
  { d: '#39d0ff', w: '#eaf8ff', k: '#20182e' },
);

// ── 엔딩의 공주 ──────────────────────────────────────────────
// **정면**을 보는 모습 + 검은 테두리. 테두리가 이 그림체의 전부다시피 해서,
// 실루엣 바깥을 전부 K 로 두른다.
//
// **9칸을 축으로 좌우대칭**이다. 드레스가 원래 9칸 중심이라 머리도 거기 맞춘다 —
// 옆모습일 땐 안 보이던 반 칸 어긋남이 정면에서는 바로 티가 난다.
//
// 머리카락이 얼굴 양옆을 감싸고 어깨까지 내려온다. 바깥 칸은 d(어두운 쪽),
// 안쪽은 m — 두 겹이라야 부피가 보인다.
// 눈도 검정이라 테두리에 닿으면 먹혀버려서, 사방을 살색으로 한 칸씩 감쌌다.
// 눈동자 반짝임(h)은 정면에서 안 쓴다 — 양쪽에 다 넣으면 20px 에서 눈이 번진다.
// 살색은 주인공과 **같은 값**이다 — 둘이 같은 그림 속 사람으로 보여야 한다.
// 20×20 이고 이 크기는 바꾸면 안 된다. 새장과 2회차 엔딩이 이 폭에 맞춰 자리를 잡는다.
//
// (예전에 "왼쪽을 보는 게 중요하다, 주인공이 그쪽으로 손을 뻗으니까" 라고 적어뒀는데
//  **틀린 말이었다.** 손 뻗을 때 뒤집히는 건 주인공이고 이 스프라이트는 어디서도
//  뒤집어 그리지 않는다. 방향은 연출과 무관하다.)
const BRIDE_PAL = {
  K: '#1a1410', // 테두리·눈
  g: '#ffd166', // 티아라
  G: '#fff0b8', // 티아라 반짝임
  w: '#fffaf2', // 면사포·드레스 밑단
  s: '#ffd9b3', // 살색 (주인공 PAL.s 와 같은 값)
  m: '#e9cf9f', // 머리카락
  d: '#b8894a', // 뒤로 넘어간 머리 (밝은 쪽과 확실히 달라야 겹이 보인다)
  h: '#ffffff', // 눈동자 반짝임
  e: '#1a1410', // 눈
  p: '#ff9ec4', // 드레스
  P: '#e85f95', // 드레스 주름
};

export const BRIDE = sprite(
  [
    '.......gg.gg........',
    '......gGgGgGg.......',
    '....KKKKKKKKKKK.....',
    '...KdmmmmmmmmmdK....',
    '...KdmmmmmmmmmdK....',
    '...KdmsssssssmdK....',
    '...KdmsssssssmdK....',
    '...KdmsesssesmdK....',
    '...KdmsssssssmdK....',
    '...KdmsssKsssmdK....',
    '...KdmsssssssmdK....',
    '...KdmmsssssmmdK....',
    '....KdmmsssmmdK.....',
    '....KpppppppppK.....',
    '...KpppppppppppK....',
    '...KpPpppppppPpK....',
    '..KpppppppppppppK...',
    '..KpPppppppppppPK...',
    '.KwwwwwwwwwwwwwwwK..',
    '.KKKKKKKKKKKKKKKKK..',
  ],
  BRIDE_PAL,
);

/** 결혼반지 — 엔딩에서 둘 사이에 떠오른다 */
export const RING = sprite(
  [
    '..ww..',
    '.wggw.',
    'wg..gw',
    'wg..gw',
    '.wggw.',
    '..ww..',
  ],
  { w: '#fff6ef', g: '#ffd166' },
);
