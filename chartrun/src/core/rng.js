// 결정론적 난수 생성기 (mulberry32). 시드를 저장/복원하면 같은 흐름이 재현된다.
export function createRng(seed = Date.now()) {
  let state = seed >>> 0;

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    /** 0 이상 1 미만 실수 */
    float: next,
    /** min 이상 max 이하 정수 */
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    /** 확률 p(0~1)로 true */
    chance: (p) => next() < p,
    /** 배열에서 하나 고르기 */
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    /** 가중치 배열에서 하나 고르기. weightOf 는 항목 -> 가중치 */
    weighted: (arr, weightOf = (x) => x.weight ?? 1) => {
      const total = arr.reduce((sum, x) => sum + Math.max(0, weightOf(x)), 0);
      if (total <= 0) return arr[0];
      let roll = next() * total;
      for (const item of arr) {
        roll -= Math.max(0, weightOf(item));
        if (roll <= 0) return item;
      }
      return arr[arr.length - 1];
    },
    /** 배열을 섞은 새 배열 */
    shuffle: (arr) => {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    get state() {
      return state;
    },
    set state(value) {
      state = value >>> 0;
    },
  };
}
