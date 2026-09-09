// 저장/불러오기. 기록·해금·설정만 담는다 (진행 중인 판은 저장하지 않는다).
export const SAVE_KEY = 'chartrun/save-v1';
export const SAVE_VERSION = 1;

const storage = () => (typeof localStorage === 'undefined' ? null : localStorage);

export const emptySave = () => ({
  bestRank: 100,
  chartOuts: 0,
  clearedStages: [],
  revealedTraps: [],
  bestTimeMs: null,
  muted: false,
  /** 소리 크기 0~1 (core/audio.js 의 VOLUME_STEPS 중 하나). 음소거와는 별개다. */
  volume: 1,
  /**
   * 오프닝 컷신을 한 번 봤는지. 본 뒤로는 시작할 때 바로 스테이지 1 이다.
   * (예전에 있던 seenIntro 는 읽는 곳이 없는데 저장할 때마다 true 가 돼서
   *  기존 플레이어가 오프닝을 영영 못 보게 된다 — 그래서 칸을 새로 뒀다)
   */
  seenOpening: false,
  /** 개발자 모드 (비번 1234). 켜면 스테이지를 골라 들어갈 수 있다 */
  dev: false,
  /**
   * 한 바퀴를 끝냈는가. 이걸로 스테이지 1 의 NPC 와 하드모드가 열린다.
   * (칸을 더하는 건 공짜다 — deserialize 가 emptySave() 위에 덮어쓰므로
   *  이 칸이 없는 옛 저장은 false 로 열린다. seenOpening 과 같은 방식이다.)
   */
  clearedOnce: false,
  /** 하드모드까지 끝냈는가 */
  clearedHard: false,
  /** 하드모드 최고 기록. 보통 기록과 **따로** 둔다 — 둘은 같은 판이 아니다 */
  bestHardTimeMs: null,
});

export function serialize(data) {
  return JSON.stringify({ version: SAVE_VERSION, savedAt: Date.now(), data });
}

export function deserialize(text) {
  const parsed = JSON.parse(text);
  if (!parsed?.data) throw new Error('저장 형식이 올바르지 않습니다.');
  if (parsed.version !== SAVE_VERSION) throw new Error('저장 버전이 다릅니다.');
  return { ...emptySave(), ...parsed.data };
}

export function loadSave() {
  const store = storage();
  if (!store) return emptySave();
  const text = store.getItem(SAVE_KEY);
  if (!text) return emptySave();
  try {
    return deserialize(text);
  } catch {
    return emptySave();
  }
}

export function writeSave(data) {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(SAVE_KEY, serialize(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  storage()?.removeItem(SAVE_KEY);
}

/**
 * 이번 기록이 최고 기록을 깼는가. 기록이 아직 없으면 처음 세운 것이니 참이다.
 * (mergeRun 이 실제로 갱신하는 조건과 같은 판단이라, 화면 표시와 저장이 어긋나지 않는다)
 */
export const beatRecord = (save, timeMs, hard = false) => {
  const best = hard ? save?.bestHardTimeMs : save?.bestTimeMs;
  return timeMs != null && (best == null || timeMs < best);
};

/** 이번 판의 결과를 기록에 합친다 */
export function mergeRun(save, run) {
  const next = { ...save };
  // 골라 들어간 판(개발자 모드)은 기록을 건드리지 않는다.
  // 보스만 골라 이기고 "최고 기록"이 되면 기록이 거짓말이 된다.
  if (!run.partial) next.bestRank = Math.min(save.bestRank, run.rank ?? save.bestRank);
  next.chartOuts = (save.chartOuts ?? 0) + (run.chartOuts ?? 0);
  if (run.clearedStage != null && !next.clearedStages.includes(run.clearedStage)) {
    next.clearedStages = [...next.clearedStages, run.clearedStage].sort((a, b) => a - b);
  }
  if (run.revealedTraps) {
    next.revealedTraps = [...new Set([...(save.revealedTraps ?? []), ...run.revealedTraps])];
  }
  if (run.clearedOnce) next.clearedOnce = true;
  if (run.clearedHard) next.clearedHard = true;
  // 하드 기록은 하드 칸으로 간다. 안 나누면 어려운 판을 깬 시간이 보통 기록을 덮어써서
  // "최고 기록"이 무슨 판의 기록인지 알 수 없게 된다.
  if (!run.partial && run.timeMs != null && beatRecord(save, run.timeMs, run.hard)) {
    if (run.hard) next.bestHardTimeMs = run.timeMs;
    else next.bestTimeMs = run.timeMs;
  }
  return next;
}
