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
// 실제 사진을 보고 맞춘 말티푸. 사진에서 가져온 것:
//   · 털은 갈색이 아니라 **크림빛 금발**. 주둥이와 가슴은 거의 흰색에 가깝다.
//   · 귀도 같은 금발이다 (갈색으로 칠하면 딴 개가 된다). 턱 아래까지 길게 늘어진다.
//   · 새까맣고 큰 코가 얼굴에서 제일 진한 것.
//   · 눈이 크고 **동그랗다**. 네모난 덩어리로 칠하면 해골이 된다 — 위아래를 깎는다.
// 18×18.
const BRIDE_PAL = {
  g: '#ffd166', // 티아라
  G: '#fff0b8', // 티아라 반짝임
  w: '#fffaf2', // 면사포
  m: '#e9cf9f', // 머리·등의 금빛 털
  d: '#d2a95f', // 귀 (조금 더 진한 금빛 — 갈색이 아니다)
  c: '#f7ead2', // 주둥이·가슴의 크림색
  e: '#1b1410', // 눈
  h: '#ffffff', // 눈동자 반짝임
  n: '#241d1a', // 코
};

export const BRIDE = sprite(
  [
    '.......g.g.g......',
    '......gGgGgGg.....',
    '.....wmmmmmmw.....',
    '....wmmmmmmmmw....',
    '...wdmmmmmmmmdw...',
    '..wdmmmmmmmmmmdw..',
    '..wdmmhemmhemmdw..',
    '..wdmeeemmeeemdw..',
    '..wdmmeemmeemmdw..',
    '..wdmmmccccmmmdw..',
    '..wdmmccnnccmmdw..',
    '..wdmcccnncccmdw..',
    '...wddccccccddw...',
    '....wccccccccw....',
    '....cccccccccc....',
    '...cccccccccccc...',
    '...cccccccccccc...',
    '....ccc....ccc....',
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
