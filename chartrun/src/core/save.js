// 저장/불러오기. 기록·해금·설정만 담는다 (진행 중인 판은 저장하지 않는다).
export const SAVE_KEY = 'chartrun/save-v1';
export const SAVE_VERSION = 1;

import { DEFAULT_LOOK } from '../data/looks.js';
import { DEFAULT_FX, sanitizeOwned } from '../data/effects.js';

/**
 * 저장소. 없으면 null 이고, 그러면 게임은 기록 없이 그냥 돌아간다.
 *
 * 쿠키·사이트 데이터가 막힌 기기(file:// WebView 에서 DomStorage 를 꺼둔 경우)에서는
 * localStorage 를 **읽기만 해도** SecurityError 를 던진다. typeof 로는 못 막는다 —
 * 프로퍼티를 실제로 읽으므로 그 자리에서 터지고, 그러면 진입점이 통째로 죽는다.
 */
const storage = () => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

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
  /**
   * 조작 안내를 한 번 봤는지. 폰에서는 index.html 의 조작 설명이 숨겨져 있어서
   * (style.css 의 `body.handheld .help`) 처음 하는 사람은 보스전에 튀어나오는
   * 「대시」·「마이크」 버튼이 뭔지 모른다.
   * 첫 판에만 타이틀에 띄우고 그 뒤로는 안 띄운다. (seenOpening 과 같은 방식이다)
   */
  seenHelp: false,
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
  /**
   * 주운 음표의 **자리**들 (`스테이지:칸` 열쇠). 개수가 아니라 자리를 남기는 게 핵심이다 —
   * 죽으면 음표가 되살아나므로(spawnEntities) 개수만 세면 같은 걸 두 번 센다.
   * revealedTraps 와 같은 모양이라 여러 판에 걸쳐 모을 수 있다.
   */
  foundNotes: [],
  /**
   * 꾸민 차림새 `{ hair, jacket, pants }` (data/looks.js 의 번호들).
   * 저장값을 그대로 믿지 않는다 — sanitizeLook 을 거쳐서 쓴다. 항목을 줄이면
   * 있던 번호가 범위 밖으로 나가고, 그러면 그림이 undefined 가 되어 안 그려진다.
   */
  look: { ...DEFAULT_LOOK },
  /**
   * 완주 횟수. 상점의 점수는 **이걸로** 센다 (data/effects.js 의 earned).
   * clearedOnce 는 참·거짓뿐이라 「몇 번 깼나」를 담을 수 없어서 따로 둔다.
   */
  clears: 0,
  /** 그중 하드모드 완주. 2점씩 더 쳐준다 */
  hardClears: 0,
  /** 산 이펙트들의 id (`kill:note` 꼴). 쓴 점수는 이 목록에서 계산한다 */
  owned: [],
  /** 끼운 이펙트 */
  fx: { ...DEFAULT_FX },
  /**
   * **하던 판.** 없으면 null.
   *
   * 이 칸이 생기기 전에는 게임을 닫으면 판이 통째로 날아갔다 — 스테이지 3 을 하다
   * 나가면 1 부터 다시였다. 게다가 스테이지 선택은 한 바퀴를 깨야 열려서
   * (`selectItems` 의 `needs: 'clearedOnce'`), 첫 판을 도는 중에 나간 사람은
   * 돌아올 방법이 **아예 없었다.**
   *
   * { stage, hard, boss, forceHub, checkpoint: {x,y}|null,
   *   elapsedMs, chartOuts, plays, score, defeated, partial }
   *
   * **한 시점을 통째로 찍은 것**이다. 자리는 체크포인트에서 가져오고 숫자는
   * 나가던 순간에서 가져오면, 체크포인트 뒤에 주운 음표를 돌아와서 또 줍는다.
   * 그래서 체크포인트를 밟는 순간·판이 시작되는 순간에만 찍는다 (ui/app.js).
   */
  resume: null,
});

export function serialize(data) {
  return JSON.stringify({ version: SAVE_VERSION, savedAt: Date.now(), data });
}

export function deserialize(text) {
  const parsed = JSON.parse(text);
  if (!parsed?.data) throw new Error('저장 형식이 올바르지 않습니다.');
  if (parsed.version !== SAVE_VERSION) throw new Error('저장 버전이 다릅니다.');
  return backfillClears({ ...emptySave(), ...parsed.data });
}

/**
 * **이미 깬 사람이 0점으로 시작하지 않게** 한다.
 *
 * 완주 횟수는 상점을 만들면서 생긴 칸이라, 그 전에 깬 사람의 저장에는 없다.
 * 그대로 두면 다 깨고 온 사람이 값만 적힌 빈 상점을 보게 된다.
 * clearedOnce 는 「한 번은 깼다」는 뜻이므로 최소 1회로 쳐준다 — 세던 값이
 * 이미 있으면 안 건드린다(한 번만 메운다).
 */
function backfillClears(save) {
  const next = { ...save };
  if (next.clearedOnce && !(next.clears > 0)) next.clears = 1;
  if (next.clearedHard && !(next.hardClears > 0)) next.hardClears = 1;
  next.owned = sanitizeOwned(next.owned);
  return next;
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
  // 음표도 같은 방식으로 합친다 — 한 판에서 놓친 걸 다음 판에서 주워도 쌓인다
  if (run.foundNotes) {
    next.foundNotes = [...new Set([...(save.foundNotes ?? []), ...run.foundNotes])];
  }
  // 하던 판은 **키가 있을 때만** 건드린다.
  // null 을 넣는 것(판이 끝났다)과 안 건드리는 것을 구별해야 해서 `in` 으로 본다 —
  // 타이틀에서 M 로 음소거만 해도 persist 가 도는데, 그때 하던 판이 지워지면 안 된다.
  if ('resume' in run) next.resume = run.resume;
  if (run.clearedOnce) next.clearedOnce = true;
  if (run.clearedHard) next.clearedHard = true;
  /**
   * 완주를 **센다.** 상점 점수가 여기서 나온다.
   *
   * `partial` 은 빼야 한다 — 개발자 모드로 보스만 골라 이기는 것도 엔딩으로 이어지는데,
   * 그걸 세면 스테이지 선택으로 점수를 얼마든지 찍어낼 수 있다.
   * (기록을 안 갱신하는 조건과 같은 판단이다. 위 bestRank 와 나란히 둔 이유다)
   */
  if (run.clearedOnce && !run.partial) {
    next.clears = (save.clears ?? 0) + 1;
    if (run.clearedHard) next.hardClears = (save.hardClears ?? 0) + 1;
  }
  // 하드 기록은 하드 칸으로 간다. 안 나누면 어려운 판을 깬 시간이 보통 기록을 덮어써서
  // "최고 기록"이 무슨 판의 기록인지 알 수 없게 된다.
  if (!run.partial && run.timeMs != null && beatRecord(save, run.timeMs, run.hard)) {
    if (run.hard) next.bestHardTimeMs = run.timeMs;
    else next.bestTimeMs = run.timeMs;
  }
  return next;
}
