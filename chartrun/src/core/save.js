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
  seenIntro: false,
  /** 개발자 모드 (비번 1234). 켜면 스테이지를 골라 들어갈 수 있다 */
  dev: false,
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
  if (!run.partial && run.timeMs != null && (save.bestTimeMs == null || run.timeMs < save.bestTimeMs)) {
    next.bestTimeMs = run.timeMs;
  }
  return next;
}
