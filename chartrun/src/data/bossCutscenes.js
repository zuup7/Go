// 보스전 중간에 끼어드는 컷신들.
// data/cutscene.js 의 합체 컷신과 똑같은 타임라인 모양이라 헬퍼를 그대로 쓴다.
//
// 대사는 없다. 무슨 일이 벌어지는지는 화면이 말한다.
// at: 컷신 시작으로부터의 초.  kind 는 컷신마다 다르고 render/scene.js 가 해석한다.
import { lengthOf } from './cutscene.js';

/** 2페이즈 — 하나였던 보스가 네 조각으로 갈라진다 */
export const PHASE2_CUT = [
  { at: 0.0, kind: 'shake' },
  { at: 1.0, kind: 'crack' },
  { at: 1.8, kind: 'split' },
  { at: 3.2, kind: 'title' },
  { at: 4.4, kind: 'end' },
];

/**
 * 3페이즈 — 차트를 조작해 1위를 빼앗고, 그 힘으로 합체한다.
 *
 * 2페이즈에서 넷으로 쪼개졌던 조각이 도로 불려와 로봇으로 조립된다.
 * 조작(chart·rig)이 합체의 이유다 — 순서를 바꾸면 왜 갑자기 합체하는지가 사라진다.
 */
export const PHASE3_CUT = [
  { at: 0.0, kind: 'shake' },
  { at: 0.7, kind: 'chart' }, // 가짜 실시간 차트가 뜬다
  { at: 1.6, kind: 'rig' }, // 꼴찌였던 보스가 1위로 솟는다
  { at: 2.8, kind: 'call' }, // 흩어진 조각들이 사방에서 불려온다
  { at: 4.0, kind: 'assemble' }, // 다리·몸통·견갑·팔이 하나씩 꽂힌다
  { at: 6.0, kind: 'lock' }, // 머리와 크레스트 — 마지막 철컥
  { at: 6.8, kind: 'core' }, // 가슴 코어에 불이 들어오고 바이저가 켜진다
  { at: 7.8, kind: 'title' },
  { at: 9.2, kind: 'end' },
];

/**
 * 4페이즈 (하드모드에만) — 이미 합체한 로봇이 한계를 넘는다.
 *
 * 새 몸을 그리지 않는다. 있는 로봇을 벌겋게 달구고 뒤의 거대 로봇이 일어서는 것으로
 * "한 단계 더"를 보여준다 — 여기서 또 새 형태를 만들면 3페이즈 합체가 시시해진다.
 */
export const PHASE4_CUT = [
  { at: 0.0, kind: 'shake' },
  { at: 0.8, kind: 'overheat' }, // 이음새마다 빛이 새어 나온다
  { at: 2.0, kind: 'rise' }, // 뒤의 거대 로봇이 일어선다
  { at: 3.4, kind: 'core' }, // 코어가 붉게 터진다
  { at: 4.4, kind: 'title' },
  { at: 5.8, kind: 'end' },
];

/**
 * 엔딩 — 보스가 터지고, 흩어진 앨범이 차트가 되고, 그 꼭대기에 내가 선다.
 * 그리고 차트가 결혼식장이 된다. 앨범 열일곱 장이 하객이다.
 */
export const ENDING_CUT = [
  { at: 0.0, kind: 'crack' },
  { at: 1.4, kind: 'burst' },
  { at: 2.0, kind: 'scatter' },
  { at: 3.2, kind: 'chartline' },
  { at: 4.8, kind: 'empty' },
  { at: 5.8, kind: 'climb' },
  { at: 6.8, kind: 'crown' },
  { at: 8.6, kind: 'aisle' }, // 차트 줄이 버진로드로 바뀐다
  { at: 10.0, kind: 'bride' }, // 연갈색 말티푸 공주가 걸어 들어온다
  { at: 12.0, kind: 'vow' }, // 꽃 아치 아래 마주 선다
  { at: 13.6, kind: 'ring' },
  { at: 15.0, kind: 'kiss' },
  { at: 18.0, kind: 'end' },
];

export const BOSS_CUTS = {
  phase2: { timeline: PHASE2_CUT, title: 'PHASE 2' },
  phase3: { timeline: PHASE3_CUT, title: 'PHASE 3' },
  phase4: { timeline: PHASE4_CUT, title: 'FINAL' },
  ending: { timeline: ENDING_CUT, title: '#1' },
};

export const bossCutLength = (id) => lengthOf(BOSS_CUTS[id].timeline);

/**
 * 단계 이름 → 시작 시각. 그리는 쪽(render/scene.js)이 이걸 읽어서 쓴다.
 * 시각을 그림 코드에 또 적어두면, 타임라인만 고쳤을 때 둘이 어긋나서
 * 연출이 엉뚱한 때에 나온다 — 한 곳에서만 정한다.
 */
const atOf = (timeline) => Object.fromEntries(timeline.map((s) => [s.kind, s.at]));

export const PHASE2_AT = atOf(PHASE2_CUT);
export const PHASE3_AT = atOf(PHASE3_CUT);
export const PHASE4_AT = atOf(PHASE4_CUT);
export const ENDING_AT = atOf(ENDING_CUT);

/** 페이즈가 바뀔 때 틀 컷신 id (1페이즈는 시작이라 없다) */
export const cutForPhase = (phaseId) => (phaseId >= 2 && phaseId <= 4 ? `phase${phaseId}` : null);
