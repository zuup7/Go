// 시작 컷신 — 왜 달리는가.
//
// 대사는 없다. 방구석에서 만든 노래가 차트 맨 밑바닥에 걸리고, 위를 올려다보니
// 앨범들이 벽처럼 막고 있다. 그중 하나가 방까지 내려와 옆에 있던 강아지 공주를
// 채간다. 그래서 달린다. 그게 전부고, 글로 적을 게 없다.
//
// 이 납치가 엔딩의 결혼식을 지탱한다 — 1위로 가는 길이 곧 그녀를 되찾는 길이라,
// 마지막에 처음 보는 강아지와 갑자기 결혼하는 그림이 안 된다.
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
  { at: 9.4, kind: 'snatch' }, // 차트에서 앨범 하나가 내려와 강아지 공주를 채간다
  { at: 10.6, kind: 'reach' }, // 손을 뻗지만 놓친다. 위로 끌려 올라간다
  { at: 11.8, kind: 'grab' }, // 마이크를 쥔다 — 이제 달릴 이유가 생겼다
  { at: 13.0, kind: 'run' }, // 달리기 시작
  { at: 14.6, kind: 'end' },
];

/**
 * 단계 이름 → 시작 시각. 그리는 쪽(render/scene.js)이 이걸 읽어서 쓴다.
 * 시각을 그림 코드에 또 적으면 타임라인만 고쳤을 때 조용히 어긋난다.
 */
export const INTRO_AT = Object.fromEntries(INTRO_CUT.map((s) => [s.kind, s.at]));

export const introLength = () => lengthOf(INTRO_CUT);

// ── 2회차 시작 컷신 ─────────────────────────────────────────
//
// **왜 또 달리는가.** 1회차 오프닝과 짝이 맞아야 한다 —
// 그때는 방구석에서 시작해 차트에 막히고 그녀를 빼앗겼다.
// 이번엔 **다 이룬 자리에서** 빼앗긴다. 결혼식이 끝난 그 바닥이 갈라지고,
// 내가 밟아 없앴던 앨범들이 거기서 떠오른다.
//
// 대사는 없다. 순서가 곧 이야기다 —
// 이룬 것(after) → 금이 간다(crack) → 죽은 것들이 돌아온다(graves) →
// 진화한다(evolve) → 다시 빼앗긴다(snatch) → 바닥까지 떨어진다(drop) →
// 마이크를 다시 쥔다(stand).

export const HARD_OPEN_CUT = [
  { at: 0.0, kind: 'after' }, // 결혼식이 끝난 자리. 둘이 나란히 서 있다
  { at: 1.5, kind: 'crack' }, // 발밑 차트 바닥에 금이 간다
  { at: 2.8, kind: 'graves' }, // 밟아 없앴던 앨범들이 바닥에서 떠오른다
  { at: 4.4, kind: 'evolve' }, // 가시와 뿔이 돋는다 — 진화한 것들이다
  { at: 6.0, kind: 'taken' }, // 다시 그녀를 채간다
  { at: 7.3, kind: 'drop' }, // 바닥이 꺼지고 차트가 통째로 위로 달아난다
  { at: 8.7, kind: 'stand' }, // 맨 밑에서 마이크를 다시 쥔다
  { at: 10.2, kind: 'end' },
];

export const HARD_OPEN_AT = Object.fromEntries(HARD_OPEN_CUT.map((s) => [s.kind, s.at]));

export const hardOpenLength = () => lengthOf(HARD_OPEN_CUT);

/**
 * 'intro' 장면이 틀 수 있는 컷신 한 벌.
 *
 * 1회차 오프닝과 2회차 시작이 **같은 장면 기계**를 탄다 — 둘 다 판 앞에 끼어들고,
 * 건너뛸 수 있고, 끝나면 스테이지 1 로 이어진다. 장면을 따로 만들면 건너뛰기·소리·
 * 시간 안 흐르기를 두 벌 적게 되고, 한쪽만 고치는 날이 온다.
 */
export const INTRO_CUTS = {
  intro: { timeline: INTRO_CUT, length: introLength },
  hardopen: { timeline: HARD_OPEN_CUT, length: hardOpenLength },
};

/** 그 컷신의 길이(초). 모르는 이름이면 오프닝으로 본다 */
export const introCutLength = (id) => (INTRO_CUTS[id] ?? INTRO_CUTS.intro).length();
/** 그 컷신의 타임라인 */
export const introTimeline = (id) => (INTRO_CUTS[id] ?? INTRO_CUTS.intro).timeline;
