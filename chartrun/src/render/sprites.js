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

const HEAD = [
  '....kkkk....',
  '...kkkkkk...',
  '..kkkkkkkk..',
  '..kssssssk..',
  '..kskssksk..',
  '..ksskkssk..',
  '...kssssk...',
];

const TORSO = [
  '..jjjjjjjj..',
  '.jjjjrrjjjj.',
  '.jjjjjjjjjjm',
  '.sjjjjjjjjs.',
  '..jjjjjjjj..',
  '..pppppppp..',
  '..pppppppp..',
];

const LEGS = {
  stand: ['..kkk..kkk..', '..kkk..kkk..'],
  runA: ['..kkkkkk....', '.kkk....kkk.'],
  runB: ['....kkkkkk..', '.kkk....kkk.'],
  jump: ['.kkk....kkk.', '..kk......k.'],
};

const build = (legs) => sprite([...HEAD, ...TORSO, ...legs], PAL);

export const PLAYER_SPRITES = {
  stand: build(LEGS.stand),
  runA: build(LEGS.runA),
  runB: build(LEGS.runB),
  jump: build(LEGS.jump),
};

/** 상태에 맞는 프레임 하나 고르기 */
export function playerFrame(player) {
  if (!player.onGround) return PLAYER_SPRITES.jump;
  if (Math.abs(player.vx) < 6) return PLAYER_SPRITES.stand;
  const phase = Math.floor(player.animTime * 10) % 2;
  return phase === 0 ? PLAYER_SPRITES.runA : PLAYER_SPRITES.runB;
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
// 연갈색 말티푸. 귀여움은 비율에서 나온다 — 머리를 몸보다 크게(2/3),
// 눈을 크게(2×3) 잡고 흰 점을 찍어 살리고, 볼터치와 혓바닥을 더한다.
// 18×18.
const BRIDE_PAL = {
  g: '#ffd166', // 티아라
  G: '#fff0b8', // 티아라 반짝임
  w: '#fff6ef', // 면사포
  m: '#e3c096', // 연갈색 털
  f: '#f5dcb8', // 밝은 털 (뭉실뭉실해 보이게)
  d: '#a3763f', // 귀·그늘 (털색과 확실히 달라야 귀가 귀로 보인다)
  e: '#2f2119', // 눈
  h: '#ffffff', // 눈동자 반짝임
  n: '#4a3527', // 코
  p: '#ff9ec4', // 볼터치·혓바닥
};

export const BRIDE = sprite(
  [
    '.......g.g.g......',
    '......gGgGgGg.....',
    '.....wggggggw.....',
    '....wmmmmmmmmw....',
    '...wdmmmmmmmmdw...',
    '..wddmmmmmmmmddw..',
    '..wddmhemmhemddw..',
    '..wddmeemmeemddw..',
    '..wddmeemmeemddw..',
    '..wddpmmnnmmpddw..',
    '...wdmmmppmmmdw...',
    '...wddmmmmmmddw...',
    '....wdmmmmmmdw....',
    '.....mmmmmmmm.....',
    '....mmffmmffmm....',
    '...mmmmmmmmmmmm...',
    '...mmmmmmmmmmmm...',
    '....mmm....mmm....',
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
