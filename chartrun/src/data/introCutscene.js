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
// **하드모드는 내 이야기가 아니라 저들 이야기다.** 1회차에서 내가 밟아 부순
// 앨범 열일곱 장이 조각난 채로 되살아나, 진화해서 복수하러 온다.
//
// 그래서 이 컷신에는 **내가 안 나온다.** 화면에 있는 건 저들뿐이고,
// 내가 나오는 건 저들이 부수는 왕관과 저들이 들어 올리는 새장뿐이다.
// 1회차 오프닝(방구석 → 차트)도, 엔딩(결혼식)도 여기서는 다시 안 쓴다 —
// 다시 쓰면 전에 본 장면이 되고, 2회차가 새로 시작하는 느낌이 안 난다.
//
// 대사는 없다. 순서가 곧 이야기다 —
// 조각이 남아 있고(grave) → 떨린다(stir) → 도로 붙는다(mend) →
// 진화한다(evolve) → 표적을 정하고(smash) → 인질을 잡고(cage) → 몰려온다(march).

export const HARD_OPEN_CUT = [
  { at: 0.0, kind: 'grave' }, // 내가 밟아 부순 앨범 조각들이 바닥에 흩어져 있다
  { at: 1.6, kind: 'stir' }, // 조각이 떨리고 그 밑에서 붉은 빛이 샌다
  { at: 3.0, kind: 'mend' }, // 조각이 서로 달라붙어 도로 앨범이 된다 — 금이 간 채로
  { at: 4.6, kind: 'evolve' }, // 껍질이 두꺼워지고 가시가 돋는다. 눈이 붉게 뜬다
  { at: 6.4, kind: 'smash' }, // 앞으로 나선 하나가 내 왕관을 집어 부순다 — 표적은 나다
  { at: 7.8, kind: 'cage' }, // 또 하나가 그녀를 새장에 가둬 들어 올린다
  { at: 9.2, kind: 'march' }, // 열일곱이 줄지어 이쪽으로 몰려온다
  { at: 11.2, kind: 'end' },
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
