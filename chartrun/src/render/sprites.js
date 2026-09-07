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
// 연갈색 말티푸. 티아라와 면사포를 썼다. 16×16.
const BRIDE_PAL = {
  g: '#ffd166', // 티아라
  w: '#fff6ef', // 면사포
  f: '#dcb98d', // 연갈색 털
  d: '#b98f5c', // 그늘진 털·귀
  e: '#2b1d12', // 눈
  n: '#7a5638', // 주둥이
  p: '#ff9ec4', // 코
};

export const BRIDE = sprite(
  [
    '.....gg.gg......',
    '....gggggggg....',
    '...wffffffffw...',
    '..wwdffffffdww..',
    '..wwdffffffdww..',
    '..wwdfeffefdww..',
    '..wwdffffffdww..',
    '...wdfnnnnfdw...',
    '...wwdfppfdww...',
    '....wffffffw....',
    '....ffffffff....',
    '...ffffffffff...',
    '...ffffffffff...',
    '...ff......ff...',
    '...dd......dd...',
    '................',
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
