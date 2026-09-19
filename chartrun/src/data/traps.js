// 고양이마리오풍 트롤 함정 — **당한 자리를 기억하는 일**과 **구간 효과**만 여기 있다.
//
// 강도는 "중간" — 처음엔 반드시 당하지만, 한 번 당하면 화면에 붉게 표시되고
// 목숨은 무한이라 외우면 반드시 클리어할 수 있다. 진행을 막는 함정은 없다.
//
// 설명 문구는 두지 않는다. 함정이 뭘 하는지는 글로 읽는 게 아니라 당해 보고 안다.
//
// **장치 글자 목록은 여기 없다.** 그건 core/world.js 의 T 하나뿐이다.
// 예전에는 같은 글자를 여기 한 벌 더 적어뒀는데 게임은 그 표를 한 번도 안 읽었고,
// 테스트만 그쪽을 보고 있어서 world.js 에 장치를 넣고 여기를 잊어도 그냥 통과했다.

/** 시간이 지나면 저절로 풀리는 구간 효과 (영구히 걸리면 게임이 끝난다) */
export const ZONE_EFFECTS = {
  reversed: { seconds: 4 },
  blackout: { seconds: 3.5 },
  /**
   * 쫓아오는 것이 확 빨라지는 시간.
   * 추격 판은 판 자체에 chase 가 적혀 있어 처음부터 붙는다 — 이건 그 위에 얹는 완급이다.
   */
  surge: { seconds: 3 },
  /**
   * 하늘에서 폭탄이 떨어지는 시간.
   * 떨어질 자리에 그림자가 먼저 뜨므로 보고 피할 수 있다 —
   * 예고 없이 하늘에서 죽으면 트롤이 아니라 그냥 불합리한 게임이다.
   */
  bombs: { seconds: 5 },
};

/** 구간 효과 이름 → 0 인 상태. game.effects 를 두 곳에 손으로 적어두지 않으려고 여기서 만든다 */
export const emptyEffects = () => Object.fromEntries(Object.keys(ZONE_EFFECTS).map((k) => [k, 0]));

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

/**
 * 함정을 어디서 당했는지 기억하는 열쇠.
 *
 * ns 는 스테이지 이름이다. 이게 없으면 **스테이지가 달라도 같은 칸이면 같은 열쇠**라,
 * 하드모드 (12,9) 가 스테이지 1 에서 당한 표시를 물려받아 처음부터 붉게 뜬다.
 * 보통 판은 ns 없이 예전 형식 그대로 둔다 — 형식을 바꾸면 이미 저장된 표시가 다 날아간다.
 */
export const trapKey = (tx, ty, ns = '') => (ns ? `${ns}:${tx},${ty}` : `${tx},${ty}`);
