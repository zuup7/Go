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
