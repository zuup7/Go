// 최종 보스 직전 합체 컷신. 코드가 아니라 타임라인 데이터라 고치기 쉽다.
//
// 대사는 없다. 앨범 열일곱 장이 빨려 들어와 하나로 뭉치는 걸 보면 그만이다.
//
// at: 컷신 시작으로부터의 초.  kind:
//   gather  앨범들이 화면 중앙으로 빨려 들어온다
//   swirl   중앙에서 소용돌이친다
//   merge   하나로 뭉친다
//   flash   화면이 하얗게 터진다
//   reveal  보스가 드러난다
//   end     컷신 종료

/** 각 단계가 시작하는 시각. render/scene.js 가 같은 값을 써서 그린다. */
export const CUT_AT = {
  gather: 0.0,
  swirl: 2.4,
  merge: 4.2,
  flash: 5.8,
  reveal: 6.2,
  end: 8.6,
};

export const CUTSCENE = Object.entries(CUT_AT).map(([kind, at]) => ({ at, kind }));

// ── 타임라인 도우미 ─────────────────────────────────────────
// 보스 페이즈 전환·엔딩 컷신도 같은 모양의 타임라인을 쓴다 (data/bossCutscenes.js).

/** 타임라인 전체 길이 */
export const lengthOf = (timeline) => timeline[timeline.length - 1].at;

/**
 * from 다음부터 to 까지 사이에 새로 지나간 단계들 (from < at <= to).
 *
 * 컷신에 소리를 붙일 때 쓴다. 시각을 소리 쪽에 다시 적어두면 타임라인만 고쳤을 때
 * 조용히 어긋나므로, 단계를 넘어가는 순간은 여기서 한 번만 판정한다.
 */
export const beatsCrossed = (timeline, from, to) =>
  timeline.filter((s) => s.at > from && s.at <= to);

/** t 시점의 연출 단계 이름 */
export function phaseAtIn(timeline, t, fallback) {
  const stages = timeline.filter((s) => s.at <= t);
  return stages.length ? stages[stages.length - 1].kind : fallback;
}

export const CUTSCENE_LENGTH = lengthOf(CUTSCENE);

/** t(초)까지 이미 지나간 단계들 */
export const stepsUntil = (t) => CUTSCENE.filter((s) => s.at <= t);

export const phaseAt = (t) => phaseAtIn(CUTSCENE, t, 'gather');
