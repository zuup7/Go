// 주인공 스프라이트. 12×16 픽셀, 히트박스(10×14)보다 살짝 크다.
import { sprite } from './pixel.js';

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

const HEAD = [
  '....kkkk....',
  '...kkkkkk...',
  '..kkkkkkkk..',
  '..kssssssk..',
  '..kskssksk..',
  '..ksskkssk..',
  '...kssssk...',
];

/** 달릴 때 앞으로 숙인 머리 — 한 칸 앞으로 나간다 */
const HEAD_LEAN = [
  '.....kkkk...',
  '....kkkkkk..',
  '...kkkkkkkk.',
  '...kssssssk.',
  '...kskssksk.',
  '...ksskkssk.',
  '....kssssk..',
];

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
const build = (head, torso, legs, drop = 0) => {
  const body = drop > 0 ? torso.slice(0, torso.length - drop) : torso;
  const rows = [...Array(drop).fill(BLANK), ...head, ...body, ...legs];
  if (rows.length !== 16) throw new Error(`프레임이 ${rows.length}줄이다 — 16줄이어야 한다`);
  return sprite(rows, PAL);
};

export const PLAYER_SPRITES = {
  stand: build(HEAD, TORSO.idle, LEGS.stand),
  runPassA: build(HEAD_LEAN, TORSO.swingA, LEGS.passA),
  runReachA: build(HEAD_LEAN, TORSO.swingA, LEGS.reachA, 1),
  runPassB: build(HEAD_LEAN, TORSO.swingB, LEGS.passB),
  runReachB: build(HEAD_LEAN, TORSO.swingB, LEGS.reachB, 1),
  jump: build(HEAD, TORSO.rise, LEGS.jump),
  fall: build(HEAD, TORSO.fall, LEGS.fall),
  dash: build(HEAD_LEAN, TORSO.dash, LEGS.dash),
};

/**
 * 달리기 한 바퀴. 닿음 → 스침 → 닿음(반대) → 스침(반대).
 * 몸이 닿음에서 내려앉고 스침에서 올라와, 걸음마다 위아래로 까딱인다.
 */
const RUN_CYCLE = [
  PLAYER_SPRITES.runReachA,
  PLAYER_SPRITES.runPassA,
  PLAYER_SPRITES.runReachB,
  PLAYER_SPRITES.runPassB,
];

/** 이만큼 달릴 때마다 발이 한 칸 넘어간다 (픽셀) */
const STRIDE = 9;

/** 이보다 빨리 떨어지고 있으면 떨어지는 그림 */
const FALLING = 40;

/** 상태에 맞는 프레임 하나 고르기 */
export function playerFrame(player) {
  if (player.dashTime > 0) return PLAYER_SPRITES.dash;
  if (!player.onGround) return player.vy > FALLING ? PLAYER_SPRITES.fall : PLAYER_SPRITES.jump;
  if (Math.abs(player.vx) < 6) return PLAYER_SPRITES.stand;
  // **시간이 아니라 달린 거리**로 돈다. 시간으로 돌리면 느리게 걸을 때 발이 미끄러진다.
  const step = Math.floor((player.stride ?? 0) / STRIDE) % RUN_CYCLE.length;
  return RUN_CYCLE[step];
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

// ── 엔딩의 강아지 공주 ───────────────────────────────────────
// 통통한 옆모습 + **검은 테두리**. 테두리가 이 그림체의 전부다시피 해서,
// 실루엣 바깥을 전부 K 로 두른다. 털색은 실제 사진의 크림빛 금발.
//
// 눈과 코도 검정이라 테두리에 닿으면 그냥 먹혀버린다. 눈은 사방을 털로 감싸고,
// 코는 주둥이를 왼쪽으로 한 칸 내밀어 그 끝에서 테두리와 뭉치게 뒀다.
// 공주 드레스를 입고 두 발로 서 있다. 20×20.
const BRIDE_PAL = {
  K: '#1a1410', // 테두리·눈·코
  g: '#ffd166', // 티아라
  G: '#fff0b8', // 티아라 반짝임
  w: '#fffaf2', // 면사포·드레스 밑단
  m: '#e9cf9f', // 금빛 털
  d: '#b8894a', // 늘어진 귀 (털색과 확실히 달라야 귀로 보인다)
  h: '#ffffff', // 눈동자 반짝임
  n: '#1a1410', // 코
  e: '#1a1410', // 눈
  p: '#ff9ec4', // 드레스
  P: '#e85f95', // 드레스 주름
};

export const BRIDE = sprite(
  [
    '.....gg.gg..........',
    '....gGgGgGg.........',
    '...KKKKKKKKK........',
    '..KKmmmmmmmKKw......',
    '..KmmmmmmmmmKdKw....',
    '..KmmmhemmmmKddKw...',
    '..KmmmeemmmmKddKw...',
    '.KKmmmeemmmmKddKw...',
    'KKKmmmmmmmmmKddK....',
    '.KKmmmmmmmmmKddK....',
    '..KKmmmmmmmKKddK....',
    '...KKKmmmmmKKddK....',
    '.....KKmmmmmKKKK....',
    '....KppppppppK......',
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
