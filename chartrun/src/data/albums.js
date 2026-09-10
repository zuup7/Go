// ★ 앨범 적 17종.
//
// `name` 은 레벨을 편집할 때 어느 놈인지 부르려고 두는 이름이고 화면에는 안 나온다.
// `art` 는 커버 사진 경로. null 이면 아래 `cover` 무늬를 코드로 그린다.
// 사진을 바꾸거나 더 넣는 법은 assets/albums/README.md 참고.
//   art: 'assets/albums/a01.png'  →  그 그림이 커버 자리에 그대로 들어간다.
//   art: null                     →  아래 `cover` 패턴을 코드로 그린다.
// 행동·충돌·수치는 그림과 완전히 분리돼 있어서 사진을 넣어도 게임은 그대로다.
//
// 자세한 방법은 chartrun/assets/albums/README.md 참고.

/** 행동 아키타입 9종. 17마리가 이 9종에 수치를 달리해 얹힌다. */
export const BEHAVIORS = [
  'walker', // 좌우 순찰, 낭떠러지에서 돌아섬
  'hopper', // 주기적으로 플레이어 쪽으로 폴짝
  'flyer', // 사인파로 공중 부유
  'charger', // 같은 높이에 들어오면 돌진
  'shooter', // 음표 탄환 발사
  'spinner', // 회전하며 빠르게 이동, 낭떠러지 무시
  'dropper', // 천장에 붙어있다 아래를 지나가면 낙하
  'shielder', // 위에 가시 — 밟으면 내가 죽는다
  'splitter', // 밟으면 작은 앨범 둘로 분열
];

/** 커버 패턴 (render/albumArt.js 가 해석) */
export const COVERS = ['stripes', 'checker', 'radial', 'noise', 'face', 'vinyl', 'burst', 'wave', 'legend'];

const defaults = {
  art: null,
  hp: 1,
  speed: 26,
  // 커버 무늬가 보여야 하므로 타일(16)보다 크게 잡는다. 발밑은 spawnAlbum 이 맞춰준다.
  size: 20,
  stompable: true,
  score: 100,
};

const album = (data) => ({ ...defaults, ...data });

export const ALBUMS = [
  // ── 스테이지 1 · 인디 신인의 거리 ─────────────────────────────
  album({
    id: 'a01',
    art: 'assets/albums/a01.png',
    name: '데뷔 싱글',
    stage: 1,
    behavior: 'walker',
    palette: ['#241a2e', '#ff5d8f', '#ffd6e8'],
    cover: 'stripes',
    speed: 22,
  }),
  album({
    id: 'a02',
    art: 'assets/albums/a02.png',
    name: '리메이크 앨범',
    stage: 1,
    behavior: 'hopper',
    palette: ['#1d2b2b', '#5ad1a5', '#e8fff6'],
    cover: 'vinyl',
    speed: 20,
    jumpPower: 190,
    hopEvery: 1.4,
  }),
  album({
    id: 'a03',
    art: 'assets/albums/a03.png',
    name: '여름 시즌송',
    stage: 1,
    behavior: 'flyer',
    palette: ['#12304d', '#3fc1ff', '#fff7a8'],
    cover: 'wave',
    speed: 24,
    amplitude: 22,
    period: 2.6,
  }),
  album({
    id: 'a04',
    art: 'assets/albums/a04.png',
    name: '감성 발라드',
    stage: 1,
    behavior: 'shooter',
    palette: ['#241f33', '#8f7bd6', '#ffeaf7'],
    cover: 'radial',
    speed: 12,
    fireEvery: 2.2,
    shotSpeed: 70,
  }),

  // ── 스테이지 2 · 음악방송 스튜디오 ────────────────────────────
  album({
    id: 'a05',
    art: 'assets/albums/a05.png',
    name: '아이돌 컴백작',
    stage: 2,
    behavior: 'charger',
    palette: ['#2a1030', '#ff3b7f', '#ffe066'],
    cover: 'burst',
    speed: 26,
    chargeSpeed: 130,
    chargeRange: 110,
  }),
  album({
    id: 'a06',
    art: 'assets/albums/a06.png',
    name: '클럽 리믹스',
    stage: 2,
    behavior: 'spinner',
    palette: ['#171a3a', '#7c5cff', '#39ffd0'],
    cover: 'checker',
    speed: 78,
  }),
  album({
    id: 'a07',
    art: 'assets/albums/a07.png',
    name: '조명 아래 라이브',
    stage: 2,
    behavior: 'dropper',
    palette: ['#2b220f', '#ffc93c', '#fff3c4'],
    cover: 'radial',
    dropRange: 26,
  }),
  album({
    id: 'a08',
    art: 'assets/albums/a08.png',
    name: '컴필레이션',
    stage: 2,
    behavior: 'splitter',
    palette: ['#20262e', '#8ad3ff', '#ffffff'],
    cover: 'noise',
    speed: 30,
    size: 24,
    splitInto: 2,
  }),

  // ── 스테이지 3 · 스트리밍 서버 내부 ───────────────────────────
  album({
    id: 'a09',
    art: 'assets/albums/a09.png',
    name: '알고리즘 추천',
    stage: 3,
    behavior: 'shielder',
    palette: ['#0f2027', '#2ec4b6', '#e0fbfc'],
    cover: 'checker',
    speed: 30,
    stompable: false,
  }),
  album({
    id: 'a10',
    art: 'assets/albums/a10.png',
    name: '새벽 자작곡',
    stage: 3,
    behavior: 'flyer',
    palette: ['#191a3a', '#6c7bff', '#c9d6ff'],
    cover: 'wave',
    speed: 42,
    amplitude: 34,
    period: 1.8,
  }),
  album({
    id: 'a11',
    art: 'assets/albums/a11.png',
    name: '랩 믹스테잎',
    stage: 3,
    behavior: 'shooter',
    palette: ['#231400', '#ff8c1a', '#ffe9c7'],
    cover: 'burst',
    speed: 18,
    fireEvery: 1.4,
    shotSpeed: 95,
    shotSpread: 3,
  }),
  album({
    id: 'a12',
    art: 'assets/albums/a12.png',
    name: '광고 삽입곡',
    stage: 3,
    behavior: 'charger',
    palette: ['#2d0f1b', '#ff2e63', '#fff5cc'],
    cover: 'stripes',
    speed: 30,
    chargeSpeed: 165,
    chargeRange: 140,
  }),
  album({
    id: 'a13',
    art: 'assets/albums/a13.png',
    name: '드라마 OST',
    stage: 3,
    behavior: 'dropper',
    palette: ['#2b1524', '#ff7eb6', '#ffe9f4'],
    cover: 'face',
    dropRange: 34,
  }),

  // ── 스테이지 4 · 차트 정상 계단 ───────────────────────────────
  album({
    id: 'a14',
    art: 'assets/albums/a14.png',
    name: '밀리언셀러',
    stage: 4,
    behavior: 'walker',
    palette: ['#2b2411', '#d4af37', '#fff8dc'],
    cover: 'vinyl',
    speed: 34,
    hp: 2,
    size: 24,
    score: 200,
  }),
  album({
    id: 'a15',
    art: 'assets/albums/a15.png',
    name: '트로트 대작',
    stage: 4,
    behavior: 'hopper',
    palette: ['#301616', '#ff6b35', '#ffe8b6'],
    cover: 'burst',
    speed: 26,
    jumpPower: 270,
    hopEvery: 1.0,
    score: 200,
  }),
  album({
    id: 'a16',
    art: 'assets/albums/a16.png',
    name: '페스티벌 헤드라이너',
    stage: 4,
    behavior: 'spinner',
    palette: ['#101d3d', '#00e5ff', '#ff4dd8'],
    cover: 'noise',
    speed: 112,
    score: 200,
  }),
  album({
    id: 'a17',
    name: '레전드 명반',
    stage: 4,
    behavior: 'shielder',
    // 열일곱 중 유일하게 사진이 없다. 은색 얼굴 무늬로는 다른 앨범과 구분이 안 돼서
    // 금박 명반 무늬를 따로 그린다 (render/albumArt.js 의 'legend').
    palette: ['#141210', '#d4af37', '#fff3c4'],
    cover: 'legend',
    speed: 40,
    hp: 2,
    size: 24,
    stompable: false,
    score: 300,
  }),
];

export const ALBUM_BY_ID = new Map(ALBUMS.map((a) => [a.id, a]));

/** 타일맵의 'a'~'q' 한 글자를 앨범 id 로 (a → a01, b → a02 …) */
export const albumIdFromChar = (ch) => {
  const index = ch.charCodeAt(0) - 'a'.charCodeAt(0);
  if (index < 0 || index >= ALBUMS.length) return null;
  return ALBUMS[index].id;
};

/** 앨범 id 를 타일맵 글자로 (레벨 편집할 때 참고용) */
export const charForAlbum = (id) => {
  const index = ALBUMS.findIndex((a) => a.id === id);
  return index < 0 ? null : String.fromCharCode('a'.charCodeAt(0) + index);
};

export const albumsOfStage = (stage) => ALBUMS.filter((a) => a.stage === stage);
