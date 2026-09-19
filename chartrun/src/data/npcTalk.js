// 스테이지 1 의 NPC. 한 바퀴를 돌고 온 사람에게만 보인다.
//
// **대사는 없다.** 이 게임은 오프닝부터 엔딩까지 글자 한 줄 없이 굴러왔다.
// 말풍선 안에 그림 세 장을 차례로 띄워서, 무슨 말인지는 그림이 하게 둔다.
//
// 컷신과 **같은 타임라인 모양**이라 (`{at, kind}`) 이미 있는 beatsCrossed 와
// 소리 표를 그대로 탄다. 시각은 여기에만 적는다 — 그리는 쪽이 따로 적어두면
// 타임라인만 고쳤을 때 둘이 어긋난다.
import { lengthOf } from './cutscene.js';

export const NPC_TALK = [
  { at: 0.0, kind: 'trophy' }, // 트로피 — 1등은 했다
  { at: 1.3, kind: 'crack' }, // 그 트로피에 금이 가고, 차트가 위로 더 뻗는다
  { at: 2.6, kind: 'portal' }, // 지팡이를 들면 옆에 문이 열린다
  { at: 3.9, kind: 'end' },
];

export const npcTalkLength = () => lengthOf(NPC_TALK);

/** 단계 이름 → 시작 시각. 그리는 쪽이 이걸 읽는다 */
export const TALK_AT = Object.fromEntries(NPC_TALK.map((s) => [s.kind, s.at]));
