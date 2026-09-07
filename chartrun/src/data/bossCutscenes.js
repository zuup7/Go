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

/** 3페이즈 — 실시간 차트를 대놓고 조작한다 */
export const PHASE3_CUT = [
  { at: 0.0, kind: 'shake' },
  { at: 0.9, kind: 'chart' },
  { at: 2.2, kind: 'rig' },
  { at: 3.8, kind: 'title' },
  { at: 5.0, kind: 'end' },
];

/** 엔딩 — 보스가 터지고, 흩어진 앨범이 차트가 되고, 그 꼭대기에 내가 선다 */
export const ENDING_CUT = [
  { at: 0.0, kind: 'crack' },
  { at: 1.6, kind: 'burst' },
  { at: 2.4, kind: 'scatter' },
  { at: 4.0, kind: 'chartline' },
  { at: 6.0, kind: 'empty' },
  { at: 7.6, kind: 'climb' },
  { at: 8.8, kind: 'crown' },
  { at: 11.0, kind: 'end' },
];

export const BOSS_CUTS = {
  phase2: { timeline: PHASE2_CUT, title: 'PHASE 2' },
  phase3: { timeline: PHASE3_CUT, title: 'PHASE 3' },
  ending: { timeline: ENDING_CUT, title: '#1' },
};

export const bossCutLength = (id) => lengthOf(BOSS_CUTS[id].timeline);

/** 페이즈가 바뀔 때 틀 컷신 id (1페이즈는 시작이라 없다) */
export const cutForPhase = (phaseId) => (phaseId === 2 ? 'phase2' : phaseId === 3 ? 'phase3' : null);
