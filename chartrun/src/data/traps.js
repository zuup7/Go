// 고양이마리오풍 트롤 함정.
//
// 강도는 "중간" — 처음엔 반드시 당하지만, 한 번 당하면 화면에 표시되고(revealed)
// 목숨은 무한이라 외우면 반드시 클리어할 수 있다. 진행을 막는 함정은 없다.

export const TRAPS = {
  fakePlatform: {
    char: '%',
    label: '가짜 발판',
    hint: '밟는 순간 사라진다',
    revealedHint: '이거 가짜야',
  },
  reverseFloor: {
    char: '~',
    label: '역주행 바닥',
    hint: '올라서면 뒤로 밀린다',
    revealedHint: '뒤로 밀림 주의',
  },
  baitBlock: {
    char: 'X',
    label: '낚시 블록',
    hint: '아이템인 줄 알았지? 폭탄이다',
    revealedHint: '열지 마',
  },
  invisibleBlock: {
    char: 'I',
    label: '투명 블록',
    hint: '보이지 않는 벽이 점프를 막는다',
    revealedHint: '여기 뭐 있음',
  },
  popSpike: {
    char: 'v',
    label: '불쑥 가시',
    hint: '지나가면 바닥에서 솟는다',
    revealedHint: '밟지 마',
  },
  fakeGoal: {
    char: 'F',
    label: '도망가는 골',
    hint: '다가가면 달아난다. 진짜는 따로 있다',
    revealedHint: '가짜 골',
  },
  fallingAlbum: {
    char: 'g',
    label: '낙하 앨범',
    hint: '머리 위에서 떨어진다',
    revealedHint: '위 조심',
  },
};

export const TRAP_KINDS = Object.keys(TRAPS);

/** 죽었을 때 뜨는 병맛 문구 */
export const DEATH_MESSAGES = [
  '음원 사재기 의혹으로 차트아웃',
  '소속사와 계약이 해지되었습니다',
  '무대에서 미끄러짐 · 실시간 검색어 1위',
  '가사를 까먹었다',
  '앨범에 깔렸다',
  '립싱크가 걸렸다',
  '스트리밍 서버 점검 중',
  '팬카페 탈퇴 러시',
  '역주행 실패',
  '음정이 나갔다',
  '마이크 배터리 방전',
  '컴백 무대에서 넘어짐',
  '심의에서 반려되었다',
  '앨범 재고가 창고에 남았다',
  '차트에서 조용히 사라졌다',
];

/** 구멍에 빠져 죽었을 때 */
export const PIT_MESSAGES = [
  '차트 밖으로 떨어졌다',
  '순위권 아래로 추락',
  '아무도 찾지 않는 곳으로',
];

/**
 * 함정 기억. 한 번 당한 함정은 다음부터 화면에 살짝 표시된다.
 * key 는 'tx,ty' 형태의 좌표 문자열.
 */
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
