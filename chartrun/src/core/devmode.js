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

// ── 숫자판을 여는 길 ────────────────────────────────────────
//
// 배포되는 빌드(--pwa)는 KIOSK 로 쳐서 `.dev-open { display: none }` 을 얹는다.
// **버튼이 아예 없다.** 앱으로 깔았을 때 받는 사람한테 DEV 버튼이 보이면 안 되니까
// 일부러 그런 건데, 그러면 만든 사람도 폰에서는 들어갈 길이 없었다
// (데스크톱은 ` 키가 있다 — ui/app.js).
//
// 그래서 제목을 두드려 연다. 숨긴 건 그대로 두고 문만 낸다.

/** 제목을 몇 번 두드려야 열리나, 그리고 그 안에 다 쳐야 하는 시간(초) */
export const TAP_OPEN = 5;
export const TAP_WINDOW = 2.5;

/**
 * 두드린 시각들. **창 밖으로 나간 건 저절로 밀려난다** — 위 pushDigit 과 같은 수법이라
 * 「몇 번 남았나」를 따로 세지 않아도 배열 길이가 그대로 답이다.
 * 그래서 화면이 이걸 보고 「세고 있다」는 티를 낼 수 있다.
 */
export const pushTap = (taps, now) =>
  [...(taps ?? []), now].filter((t) => now - t < TAP_WINDOW).slice(-TAP_OPEN);

export const tapOpens = (taps) => (taps?.length ?? 0) >= TAP_OPEN;
