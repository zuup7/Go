// 스테이지 1 의 NPC. 2회차로 가는 문 옆에 서 있다.
//
// **대사는 없다.** 이 게임은 오프닝부터 엔딩까지 글자 한 줄 없이 굴러왔다.
// 말풍선 안에 그림을 차례로 띄워서, 무슨 말인지는 그림이 하게 둔다.
//
// 컷신과 **같은 타임라인 모양**이라 (`{at, kind}`) 이미 있는 beatsCrossed 와
// 소리 표를 그대로 탄다. 시각은 여기에만 적는다 — 그리는 쪽이 따로 적어두면
// 타임라인만 고쳤을 때 둘이 어긋난다.
//
// 세 가지를 말한다. **뭘 말할지는 이 사람이 아니라 상황이 정한다.**
//   talkLocked  아직 1위를 못 했다 — 「여기는 아직 아니다」
//   talk        막 깨고 왔다 — 문을 열어준다 (이 셋 중 이것만 판을 멈춘다)
//   talkAgain   이미 열어줬다 — 「저기다」
import { lengthOf } from './cutscene.js';

/** 문을 열어주는 이야기. 한 바퀴 돌고 온 사람에게 **딱 한 번** */
export const NPC_TALK = [
  { at: 0.0, kind: 'trophy' }, // 트로피 — 1등은 했다
  { at: 1.3, kind: 'crack' }, // 그 트로피에 금이 가고, 차트가 위로 더 뻗는다
  { at: 2.6, kind: 'portal' }, // 지팡이를 들면 옆에 문이 열린다
  { at: 3.9, kind: 'end' },
];

/**
 * 아직 못 깬 사람이 지나갈 때. **판을 안 멈춘다** — 튜토리얼 판에서 점프할 때마다
 * 2초씩 멈추면 그게 함정이다. 지나가면 저 혼자 떴다가 진다.
 * 그래서 짧다: 받침이 비어 있고(가져올 게 있다), 문은 잠겨 있다(아직 아니다).
 */
export const NPC_LOCKED = [
  { at: 0.0, kind: 'empty' }, // 트로피 받침이 비어 있다
  { at: 1.2, kind: 'shut' }, // 문에 빗장이 걸려 있다
  { at: 2.4, kind: 'end' },
];

/**
 * 이미 문을 열어준 뒤 또 지나갈 때. 아는 이야기를 3.9초 동안 다시 볼 이유가 없으니
 * 문만 가리킨다. `portal` 은 위와 **같은 그림**이다 — 같은 말을 두 번 그리지 않는다.
 */
export const NPC_AGAIN = [
  { at: 0.0, kind: 'portal' },
  { at: 1.4, kind: 'end' },
];

/**
 * 좌판 아줌마가 지나가는 사람에게. **판을 안 멈춘다** — 스테이지 1 시작 줄이라
 * 여기서 멈추면 매 판 첫 5초가 말풍선이 된다.
 *
 * 동전 → 보따리. 「돈을 내면 물건을 준다」 두 장이면 다 말한 것이고,
 * 눌러서 열어보면 나머지는 상점 화면이 알아서 말한다.
 */
export const NPC_SHOP = [
  { at: 0.0, kind: 'coin' }, // 동전이 뒤집힌다
  { at: 1.2, kind: 'goods' }, // 보따리가 열리고 반짝인다
  { at: 2.4, kind: 'end' },
];

/** 이야기 id → 타임라인. 소리 표(CUT_SOUND)의 키와 **같은 이름**이어야 한다 */
export const TALKS = {
  talk: NPC_TALK,
  talkLocked: NPC_LOCKED,
  talkAgain: NPC_AGAIN,
  talkShop: NPC_SHOP,
};

/** 저 혼자 떴다 지는 것들 — 판을 안 멈춘다 */
export const HINT_TALKS = ['talkLocked', 'talkAgain', 'talkShop'];

export const talkTimeline = (id) => TALKS[id] ?? NPC_TALK;
export const talkLength = (id) => lengthOf(talkTimeline(id));
export const npcTalkLength = () => talkLength('talk');

/** 단계 이름 → 시작 시각. 그리는 쪽이 이걸 읽는다 */
export const TALK_AT = Object.fromEntries(NPC_TALK.map((s) => [s.kind, s.at]));
