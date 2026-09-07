// 보스전 중간에 끼어드는 컷신들.
// data/cutscene.js 의 합체 컷신과 똑같은 타임라인 모양이라 헬퍼를 그대로 쓴다.
//
// at: 컷신 시작으로부터의 초.  kind 는 컷신마다 다르고 render/scene.js 가 해석한다.
// 'line' 은 공통 — 화면 아래 대사창에 뜬다.
import { lengthOf } from './cutscene.js';
import { BOSS_NAME, PHASE_LINES, BOSS_DEFEAT_LINES } from './bossData.js';

/** 2페이즈 — 하나였던 보스가 네 조각으로 갈라진다 */
export const PHASE2_CUT = [
  { at: 0.0, kind: 'shake' },
  { at: 0.2, kind: 'line', speaker: BOSS_NAME, text: PHASE_LINES[2][0] },
  { at: 1.2, kind: 'crack' },
  { at: 1.9, kind: 'split' },
  { at: 2.2, kind: 'line', speaker: BOSS_NAME, text: PHASE_LINES[2][1] },
  { at: 3.4, kind: 'title' },
  { at: 3.4, kind: 'line', speaker: 'PHASE 2', text: '분열 — 네 조각이 화면을 가로지른다' },
  { at: 4.6, kind: 'end' },
];

/** 3페이즈 — 실시간 차트를 대놓고 조작한다 */
export const PHASE3_CUT = [
  { at: 0.0, kind: 'shake' },
  { at: 0.2, kind: 'line', speaker: BOSS_NAME, text: PHASE_LINES[3][0] },
  { at: 1.1, kind: 'chart' },
  { at: 1.6, kind: 'line', speaker: BOSS_NAME, text: PHASE_LINES[3][1] },
  { at: 2.6, kind: 'rig' },
  { at: 3.2, kind: 'line', speaker: BOSS_NAME, text: '봐라, 1위는 원래 내 자리였어.' },
  { at: 4.0, kind: 'title' },
  { at: 4.0, kind: 'line', speaker: 'PHASE 3', text: '사재기 — 잡몹을 부르며 총력전' },
  { at: 5.2, kind: 'end' },
];

/** 엔딩 — 보스가 터지고, 흩어진 앨범이 차트가 되고, 그 꼭대기에 내가 선다 */
export const ENDING_CUT = [
  { at: 0.0, kind: 'crack' },
  { at: 0.4, kind: 'line', speaker: BOSS_NAME, text: BOSS_DEFEAT_LINES[0] },
  { at: 1.2, kind: 'line', speaker: BOSS_NAME, text: BOSS_DEFEAT_LINES[1] },
  { at: 1.8, kind: 'burst' },
  { at: 2.6, kind: 'scatter' },
  { at: 3.0, kind: 'line', speaker: '나', text: '열일곱 장이 흩어졌다.' },
  { at: 4.4, kind: 'chartline' },
  { at: 5.2, kind: 'line', speaker: '실시간 차트', text: '2위부터 자리가 다시 채워진다…' },
  { at: 6.6, kind: 'empty' },
  { at: 7.0, kind: 'line', speaker: '실시간 차트', text: '1위 — 아직 비어 있습니다.' },
  { at: 8.4, kind: 'climb' },
  { at: 9.4, kind: 'crown' },
  { at: 9.8, kind: 'line', speaker: '나', text: '거기, 내 자리인데요.' },
  { at: 10.6, kind: 'line', speaker: '실시간 차트', text: '1위 — 당신의 노래.' },
  { at: 11.4, kind: 'end' },
];

export const BOSS_CUTS = {
  phase2: { timeline: PHASE2_CUT, title: 'PHASE 2', subtitle: '분열 · 4중 돌진' },
  phase3: { timeline: PHASE3_CUT, title: 'PHASE 3', subtitle: '사재기 · 총력전' },
  ending: { timeline: ENDING_CUT, title: '#1', subtitle: '당신의 노래' },
};

export const bossCutLength = (id) => lengthOf(BOSS_CUTS[id].timeline);

/** 페이즈가 바뀔 때 틀 컷신 id (1페이즈는 시작이라 없다) */
export const cutForPhase = (phaseId) => (phaseId === 2 ? 'phase2' : phaseId === 3 ? 'phase3' : null);
