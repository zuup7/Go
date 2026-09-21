// 킬·데스 이펙트와 그걸 사는 데 쓰는 점수.
//
// **이펙트는 그림이 아니라 값이다.** addParticles(core/game.js)가 받는 것들을
// 그대로 적어둔다 — 그래서 「밟으면 정말 그 색 그 개수가 나오나」를 브라우저 없이
// 확인할 수 있다. 모양(shape)만 그리는 쪽이 읽는다.
//
// 첫 칸(base)은 **값이 0 이고 지금과 똑같다.** 아무것도 안 산 사람 화면은 안 변한다.

/**
 * 킬 — 앨범을 밟았을 때.
 *
 * `split` 은 「양옆으로 나눠 튄다」다. 밟기는 접점이 분명해서 사방으로 퍼지면
 * 어디를 밟았는지가 안 읽힌다 (addParticles 주석의 그 이야기). 폭죽처럼
 * 일부러 사방으로 터뜨리는 것만 false 로 둔다.
 */
export const KILLS = [
  {
    id: 'base',
    label: '기본',
    cost: 0,
    // colors 가 없으면 **밟힌 앨범 색**을 쓴다. 지금 그대로다
    count: 4,
    speed: 70,
    split: true,
  },
  {
    id: 'confetti',
    label: '꽃가루',
    cost: 1,
    colors: ['#ff5d8f', '#ffd166', '#39ff9a', '#4ec3ff', '#ffffff'],
    count: 7,
    speed: 55,
    // 천천히 떠올랐다 나풀나풀 내려앉는다
    gravity: 90,
    lift: 55,
    life: 1.5,
    split: true,
  },
  {
    id: 'note',
    label: '음표',
    cost: 1,
    colors: ['#ffd166'],
    count: 4,
    speed: 65,
    gravity: 200,
    lift: 55,
    life: 1.0,
    shape: 'note',
    split: true,
  },
  {
    id: 'boom',
    label: '폭죽',
    cost: 1,
    colors: ['#ffffff', '#ffd166', '#ff5d8f'],
    count: 14,
    speed: 130,
    gravity: 260,
    life: 0.5,
    size: 2,
    // 여기만 사방이다 — 「터졌다」가 읽혀야 한다
    split: false,
  },
  {
    id: 'mono',
    label: '흑백',
    cost: 1,
    colors: ['#f2f0ff', '#b3aecd', '#5a5766'],
    count: 6,
    speed: 80,
    life: 0.7,
    split: true,
  },
  {
    id: 'heart',
    label: '하트',
    cost: 1,
    colors: ['#ff5d8f', '#ffd7e2'],
    count: 6,
    speed: 85,
    gravity: 220,
    lift: 50,
    life: 0.9,
    shape: 'heart',
    split: true,
  },
  {
    // 결혼식 컷신의 반지를 그대로 쓴다. 이 게임에서 제일 어울리는 것이라
    // 새로 그릴 이유가 없다 (render/sprites.js 의 RING, 6×6)
    id: 'ring',
    label: '반지',
    cost: 1,
    colors: ['#ffd166'],
    count: 4,
    speed: 70,
    gravity: 230,
    lift: 60,
    life: 1.1,
    shape: 'ring',
    split: true,
  },
  {
    id: 'smoke',
    label: '연기',
    cost: 1,
    colors: ['#b3aecd', '#8a7fb8', '#5a5766'],
    count: 8,
    speed: 30,
    // 위로 느리게 흩어졌다 사라진다. 큰 알갱이라야 연기로 읽힌다
    gravity: -20,
    lift: 18,
    life: 1.6,
    size: 3,
    split: true,
  },
];

/** 데스 — 내가 죽었을 때. 밟기와 달리 원래부터 사방이다 */
export const DEATHS = [
  {
    id: 'base',
    label: '기본',
    cost: 0,
    colors: ['#ff5d8f', '#ffd166', '#ffffff'],
    count: 14,
    speed: 110,
    life: 0.9,
  },
  {
    id: 'soul',
    label: '승천',
    cost: 1,
    colors: ['#ffffff', '#cfe6a6', '#a98cff'],
    count: 12,
    speed: 26,
    // 중력을 음수로 두면 **위로만** 천천히 오른다
    gravity: -40,
    lift: 30,
    life: 1.8,
    size: 2,
  },
  {
    id: 'heart',
    label: '하트',
    cost: 1,
    colors: ['#ff5d8f', '#ffd7e2'],
    count: 8,
    speed: 70,
    gravity: 150,
    lift: 60,
    life: 1.4,
    shape: 'heart',
  },
  {
    id: 'pop',
    label: '폭발',
    cost: 1,
    colors: ['#ffffff', '#ffd166', '#ff5d8f', '#ff9ec4'],
    count: 22,
    speed: 190,
    gravity: 380,
    life: 0.6,
    size: 3,
    /** 이것만 화면을 더 흔든다 (core 가 읽는다) */
    shake: 2.0,
  },
  {
    id: 'note',
    label: '음표',
    cost: 1,
    colors: ['#ffd166'],
    count: 9,
    speed: 80,
    gravity: 190,
    lift: 55,
    life: 1.3,
    shape: 'note',
  },
  {
    // 합체 컷신의 레코드판. 10×10 이라 **개수를 적게** 둔다 — 많으면 화면이 덮인다
    id: 'disc',
    label: '레코드',
    cost: 1,
    colors: ['#f2f0ff'],
    count: 5,
    speed: 95,
    gravity: 300,
    lift: 70,
    life: 1.1,
    shape: 'disc',
  },
  {
    id: 'bubble',
    label: '거품',
    cost: 1,
    colors: ['#ffffff', '#cfe6ff', '#a9d8ff'],
    count: 14,
    speed: 22,
    // 아주 느리게 위로, 오래 남는다 — 물속 같은 느낌
    gravity: -28,
    lift: 16,
    life: 2.4,
    size: 2,
  },
];

/** 상점 줄 한 벌. 고르는 쪽(core)과 그리는 쪽(hud)이 **이걸 같이 쓴다** */
export const FX_SLOTS = [
  { key: 'kill', label: '킬', items: KILLS },
  // 「죽음」이 아니라 「데스」다. 열다섯 개가 되면서 칸이 셋으로 늘어나
  // 이름이 한 글자만 길어도 화면 밖으로 나간다
  { key: 'death', label: '데스', items: DEATHS },
];

/** 목록 전체를 한 줄로. 상점 화면이 이 순서로 보여준다 */
export const SHOP_ITEMS = FX_SLOTS.flatMap((slot) =>
  slot.items.map((item) => ({
    ...item,
    slot: slot.key,
    uid: `${slot.key}:${item.id}`,
    /** 짧은 이름 (꾸미기처럼 한 줄에 하나만 보일 때) */
    name: item.label,
    /**
     * 목록에 적히는 이름. **어느 쪽인지를 같이 적는다** — 킬과 죽음이 칸 둘로
     * 나뉘어 보이긴 하는데, 「기본 / 기본」처럼 이름만 늘어놓으면 어느 칸이
     * 무엇인지 알 길이 없다 (화면을 보고서야 알았다).
     */
    // 가운뎃점만, **공백은 뺀다** — 칸이 셋이라 한 글자가 아쉽다
    label: `${slot.label}·${item.label}`,
  })),
);

export const DEFAULT_FX = { kill: 'base', death: 'base' };

/** 값이 0 인 건 처음부터 가진 것으로 친다 — 목록에 값 0 과 ✓ 를 같이 적을 일이 없다 */
export const owns = (save, uid) => {
  const item = SHOP_ITEMS.find((i) => i.uid === uid);
  if (!item) return false;
  // 개발자 모드면 전부 가진 셈. **사지는 않는다** — 끼워서 써보기만 하고,
  // owned 는 안 건드리므로 모드를 끄면 진짜 산 것만 남는다 (setDevMode 가
  // 끄면서 sanitizeFx 를 다시 돌린다).
  //
  // 만든 사람이 이펙트를 훑어보려고 완주를 열세 번 할 수는 없다.
  if (save?.dev) return true;
  return item.cost === 0 || (save?.owned ?? []).includes(uid);
};

/**
 * 번 점수. 완주 1회 = 1점, 하드 완주는 거기 2점 더.
 *
 * **후하게 잡았다.** 선물받는 사람은 한두 번 깨고 만다. 비싸게 굴면 값만 적힌
 * 빈 상점을 보게 된다 — 음표를 다 모아야 열리는 숨은 화면에서 겪은 그 실수다.
 */
export const earned = (save) => (save?.clears ?? 0) + (save?.hardClears ?? 0) * 2;

/**
 * 쓴 점수. **따로 저장하지 않고 가진 것들의 값을 더한다.**
 * 두 군데 적으면 언젠가 어긋난다 — 진짜인 건 「가진 목록」 하나뿐이다.
 * (값을 나중에 고쳐도 저절로 맞는다)
 */
export const spent = (save) =>
  SHOP_ITEMS.filter((i) => i.cost > 0 && (save?.owned ?? []).includes(i.uid)).reduce(
    (n, i) => n + i.cost,
    0,
  );

export const points = (save) => earned(save) - spent(save);

/** 화면에 적을 점수. 개발자 모드면 ∞ — 값이 안 보이면 왜 다 되는지 모른다 */
export const pointsText = (save) => (save?.dev ? '∞' : String(points(save)));

export const canBuy = (save, uid) => {
  const item = SHOP_ITEMS.find((i) => i.uid === uid);
  return !!item && !owns(save, uid) && points(save) >= item.cost;
};

/** 지금 끼운 이펙트의 값들 */
export const fxOf = (save, key) => {
  const slot = FX_SLOTS.find((s) => s.key === key);
  const want = save?.fx?.[key];
  return slot.items.find((i) => i.id === want) ?? slot.items[0];
};

/**
 * 저장값을 믿지 않는다.
 *
 * 없는 id 를 끼워두면 이펙트가 undefined 가 되어 **밟아도 아무것도 안 튄다.**
 * 안 산 걸 끼워둔 것도 되돌린다 — 저장을 손으로 고쳐 공짜로 쓰는 길을 막는 게
 * 아니라, 목록에서 뺀 항목이 남아 있을 때 조용히 깨지지 않게 하려는 것이다.
 */
export function sanitizeFx(save) {
  const out = { ...DEFAULT_FX };
  for (const slot of FX_SLOTS) {
    const want = save?.fx?.[slot.key];
    const uid = `${slot.key}:${want}`;
    if (slot.items.some((i) => i.id === want) && owns(save, uid)) out[slot.key] = want;
  }
  return out;
}

/** 목록에 없는 id 가 저장에 남아 있으면 걷어낸다 */
export const sanitizeOwned = (owned) =>
  [...new Set(owned ?? [])].filter((uid) => SHOP_ITEMS.some((i) => i.uid === uid && i.cost > 0));
