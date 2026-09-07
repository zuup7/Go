// 최종 보스 직전 합체 컷신. 코드가 아니라 타임라인 데이터라 고치기 쉽다.
//
// at: 컷신 시작으로부터의 초.  kind:
//   gather  앨범들이 화면 중앙으로 빨려 들어온다
//   swirl   중앙에서 소용돌이친다
//   merge   하나로 뭉친다
//   flash   화면이 하얗게 터진다
//   reveal  보스가 드러난다
//   line    대사창
//   end     컷신 종료

export const CUTSCENE = [
  { at: 0.0, kind: 'gather' },
  { at: 0.8, kind: 'line', speaker: '앨범들', text: '…잠깐.' },
  { at: 2.4, kind: 'line', speaker: '앨범들', text: '혼자서는 저 신인을 못 막겠는데.' },
  { at: 4.2, kind: 'swirl' },
  { at: 4.4, kind: 'line', speaker: '앨범들', text: '그럼… 뭉치면 되잖아?' },
  { at: 6.2, kind: 'merge' },
  { at: 6.4, kind: 'line', speaker: '앨범들', text: '전곡 스밍 총공, 지금부터 하나로 간다!' },
  { at: 8.6, kind: 'flash' },
  { at: 9.0, kind: 'reveal' },
  { at: 9.3, kind: 'line', speaker: '???', text: '초합체 정규앨범 —' },
  { at: 10.8, kind: 'line', speaker: '명반', text: '《명 반》. 17장이 한 장이 되었다.' },
  { at: 13.0, kind: 'line', speaker: '나', text: '…그래도 1위는 내가 할 건데요.' },
  { at: 15.4, kind: 'end' },
];

// ── 타임라인 도우미 ─────────────────────────────────────────
// 보스 페이즈 전환·엔딩 컷신도 같은 모양의 타임라인을 쓴다 (data/bossCutscenes.js).

/** 타임라인 전체 길이 */
export const lengthOf = (timeline) => timeline[timeline.length - 1].at;

/** t 시점에 화면에 떠 있어야 할 대사 (다음 대사가 나오기 전까지 유지) */
export function lineAtIn(timeline, t) {
  const lines = timeline.filter((s) => s.kind === 'line' && s.at <= t);
  return lines.length ? lines[lines.length - 1] : null;
}

/** t 시점의 연출 단계 이름 */
export function phaseAtIn(timeline, t, fallback) {
  const stages = timeline.filter((s) => s.kind !== 'line' && s.at <= t);
  return stages.length ? stages[stages.length - 1].kind : fallback;
}

export const CUTSCENE_LENGTH = lengthOf(CUTSCENE);

/** t(초)까지 이미 지나간 단계들 */
export const stepsUntil = (t) => CUTSCENE.filter((s) => s.at <= t);

export const lineAt = (t) => lineAtIn(CUTSCENE, t);
export const phaseAt = (t) => phaseAtIn(CUTSCENE, t, 'gather');
