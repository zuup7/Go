// 추격 판에서 보스에게 잡혔을 때. **대사는 없다.**
//
// 컷신과 같은 타임라인 모양이라 (`{at, kind}`) 이미 있는 beatsCrossed 와 소리 표를
// 그대로 탄다. 시각은 여기에만 적는다 — 그리는 쪽이 따로 적어두면 어긋난다.
import { lengthOf } from './cutscene.js';

export const CAUGHT_CUT = [
  { at: 0.0, kind: 'shadow' }, // 왼쪽부터 그림자가 덮인다
  { at: 0.7, kind: 'grab' }, // 거대한 손이 내려와 붙잡는다
  { at: 1.6, kind: 'black' }, // 암전
  { at: 2.4, kind: 'end' },
];

export const caughtLength = () => lengthOf(CAUGHT_CUT);

/** 단계 이름 → 시작 시각. 그리는 쪽이 이걸 읽는다 */
export const CAUGHT_AT = Object.fromEntries(CAUGHT_CUT.map((s) => [s.kind, s.at]));
