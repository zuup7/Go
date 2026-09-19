// 개발자 모드. 비밀번호를 넣으면 스테이지를 골라 들어갈 수 있다.
//
// 평소 진행(1스테이지부터 쭉)은 이것과 아무 상관이 없다 — 켜야만 선택이 열린다.
// 숨기려고 만든 게 아니라 실수로 눌리지 않게 하려고 만든 것이므로 암호랄 것도 없다.

export const DEV_CODE = '1234';

/** 마지막 네 자리만 남긴다. 앞에서 헛손질한 건 저절로 밀려난다. */
export const pushDigit = (buf, digit) => (String(buf ?? '') + String(digit)).slice(-DEV_CODE.length);

export const codeMatches = (buf) => buf === DEV_CODE;

/** 숫자판에 놓을 키들 (그리는 순서 그대로) */
export const KEYPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'close'];
