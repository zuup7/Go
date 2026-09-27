// 캔버스에 찍는 도트 글자.
//
// 이 파일은 DOM 을 안 타므로 헤드리스로 검사된다. 여기서 못을 박아두는 이유:
// **표에 없는 글자는 조용히 빈 칸으로 흘러간다.** 에러도 안 나고 테스트도 안 깨지고,
// 게임을 실제로 띄워서 그 장면까지 가봐야만 "글자가 안 보이네" 로 알게 된다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HANGUL_GLYPHS, hangulWidth, textWidth } from '../src/render/bigtext.js';

const LABEL = '음원차트';

test('차트 딱지 네 글자가 표에 다 있다', () => {
  for (const ch of LABEL) {
    assert.ok(HANGUL_GLYPHS[ch], `「${ch}」 가 표에 없다 — 화면에서 빈 칸으로 흘러간다`);
  }
});

test('한글 글리프는 전부 같은 칸 크기다', () => {
  // 한 줄만 길거나 짧으면 그 글자부터 뒤가 밀린다
  const rows = Object.values(HANGUL_GLYPHS);
  const H = rows[0].length;
  const W = rows[0][0].length;
  for (const [ch, g] of Object.entries(HANGUL_GLYPHS)) {
    assert.equal(g.length, H, `「${ch}」 의 행 수가 다르다`);
    for (const line of g) assert.equal(line.length, W, `「${ch}」 의 열 수가 다르다`);
  }
});

test('글리프에는 # 과 . 말고 다른 글자가 없다', () => {
  for (const [ch, g] of Object.entries(HANGUL_GLYPHS)) {
    for (const line of g) {
      assert.match(line, /^[#.]+$/, `「${ch}」 에 이상한 글자가 있다: ${line}`);
    }
  }
});

test('폭은 글자 수에 비례한다 — 가운데 정렬이 이걸 믿는다', () => {
  const one = hangulWidth('음', 1);
  assert.ok(one > 0);
  assert.ok(hangulWidth('음원', 1) > one, '두 글자가 한 글자보다 넓어야 한다');
  assert.equal(hangulWidth(LABEL, 2), hangulWidth(LABEL, 1) * 2, '배율이 폭에 그대로 먹어야 한다');
});

test('한글은 영문보다 넓다 — 같은 배율로 섞어 쓰면 안 맞는다', () => {
  // 5×7 과 9×11 은 다른 표다. 같은 줄에 섞을 일이 생기면 이 차이를 알고 써야 한다.
  assert.ok(hangulWidth('음', 1) > textWidth('A', 1));
});

test('빈 글자는 폭이 0 이하다 — 없는 걸 그리려다 좌표가 튀면 안 된다', () => {
  assert.ok(hangulWidth('', 1) <= 0);
});
