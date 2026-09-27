// 일반모드를 깨면 — 2회차(하드모드)로 가는 문이 열린다.
//
// 통계표의 「2회차 열림」 한 줄로는 아무도 못 봤다. 결혼식·크레딧·통계를 다 보고
// 스테이지 1 로 떨어지면, 왜 거기 서 있는지 화면이 말해주지 않았다.
// 그래서 통계 **다음**, 스테이지 1 **앞**에 둔다 — 문이 열리는 걸 보고 나면
// 바로 그 문 옆에 서게 된다.
//
// **대사는 없다.** 마지막 제목(HARD MODE)만 「PHASE 2」와 같은 큰 도트 글자로 박는다.
// 문 옆의 흰수염 노인은 판에서 실제로 문을 열어주는 그 사람이다 — 거기로 가라는 뜻.
import { lengthOf } from './cutscene.js';

export const UNLOCK_CUT = [
  { at: 0.0, kind: 'shut' }, // 밤. 보라색 문에 빗장 둘, 금색 자물쇠
  { at: 0.9, kind: 'rattle' }, // 자물쇠가 덜컥덜컥 떤다
  { at: 1.8, kind: 'crack' }, // 자물쇠가 튀어 오르고 빗장이 양옆으로 날아간다
  { at: 2.4, kind: 'open' }, // 문 안이 소용돌이친다
  { at: 3.2, kind: 'title' }, // HARD MODE — 문 옆에서 노인이 춤춘다
  { at: 5.0, kind: 'end' },
];

/** 마지막에 박히는 제목. 그리는 쪽이 이걸 쓴다 — 글리프 테스트가 이 글자들을 본다 */
export const UNLOCK_TITLE = 'HARD MODE';

export const UNLOCK_AT = Object.fromEntries(UNLOCK_CUT.map((s) => [s.kind, s.at]));

export const unlockLength = () => lengthOf(UNLOCK_CUT);
