// 고양이마리오풍 트롤 함정.
//
// 강도는 "중간" — 처음엔 반드시 당하지만, 한 번 당하면 화면에 붉게 표시되고
// 목숨은 무한이라 외우면 반드시 클리어할 수 있다. 진행을 막는 함정은 없다.
//
// 설명 문구는 두지 않는다. 함정이 뭘 하는지는 글로 읽는 게 아니라 당해 보고 안다.

export const TRAPS = {
  fakePlatform: {
    char: '%',
  },
  reverseFloor: {
    char: '~',
  },
  baitBlock: {
    char: 'X',
  },
  invisibleBlock: {
    char: 'I',
  },
  popSpike: {
    char: 'v',
  },
  fakeGoal: {
    char: 'F',
  },
  fallingAlbum: {
    char: 'g',
  },
  crumbleFloor: {
    char: ',',
  },
  risingWall: {
    char: '|',
  },
  reverseZone: {
    char: 'R',
  },
  blackout: {
    char: '@',
  },
};

/** 시간이 지나면 저절로 풀리는 구간 효과 (영구히 걸리면 게임이 끝난다) */
export const ZONE_EFFECTS = {
  reversed: { seconds: 4 },
  blackout: { seconds: 3.5 },
};

export const TRAP_KINDS = Object.keys(TRAPS);

export function createTrapMemory(revealed = []) {
  const seen = new Set(revealed);
  return {
    has: (key) => seen.has(key),
    reveal: (key) => {
      seen.add(key);
      return key;
    },
    get size() {
      return seen.size;
    },
    toJSON: () => [...seen],
  };
}

export const trapKey = (tx, ty) => `${tx},${ty}`;
