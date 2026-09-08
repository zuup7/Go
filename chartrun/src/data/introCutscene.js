// 시작 컷신 — 왜 달리는가.
//
// 대사는 없다. 방구석에서 만든 노래가 차트 맨 밑바닥에 걸리고, 위를 올려다보니
// 앨범들이 벽처럼 막고 있다. 그래서 달린다. 그게 전부고, 글로 적을 게 없다.
//
// data/bossCutscenes.js 와 똑같은 타임라인 모양이라 헬퍼를 그대로 쓴다.
// at: 컷신 시작으로부터의 초. kind 는 render/scene.js 가 해석한다.
import { lengthOf } from './cutscene.js';

export const INTRO_CUT = [
  { at: 0.0, kind: 'room' }, // 좁은 방. 책상 위에 마이크 하나
  { at: 1.6, kind: 'note' }, // 음표가 하나 떠오른다 — 곡이 나왔다
  { at: 2.6, kind: 'upload' }, // 음표가 위로 빨려 올라간다
  { at: 3.6, kind: 'chart' }, // 차트 순위표가 위에서 내려온다
  { at: 5.0, kind: 'bottom' }, // 맨 아래 #100 칸에 내가 뜬다
  { at: 6.4, kind: 'look' }, // 화면이 위로 훑는다 — 앨범 줄이 끝없다
  { at: 8.0, kind: 'block' }, // 앨범들이 내려다본다. 줄이 벽처럼 닫힌다
  { at: 9.6, kind: 'grab' }, // 마이크를 쥔다
  { at: 10.8, kind: 'run' }, // 달리기 시작
  { at: 12.4, kind: 'end' },
];

/**
 * 단계 이름 → 시작 시각. 그리는 쪽(render/scene.js)이 이걸 읽어서 쓴다.
 * 시각을 그림 코드에 또 적으면 타임라인만 고쳤을 때 조용히 어긋난다.
 */
export const INTRO_AT = Object.fromEntries(INTRO_CUT.map((s) => [s.kind, s.at]));

export const introLength = () => lengthOf(INTRO_CUT);
