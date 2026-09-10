// 버튼 자리 커스텀 — 저장값이 이상해도 버튼이 화면 밖으로 나가면 안 된다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  clampSpot,
  clampScale,
  marginsFor,
  layoutMode,
  sanitize,
  MIN_SCALE,
  MAX_SCALE,
  ALPHA_STEPS,
  DEFAULT_ALPHA,
  ROTATED_SIDE,
  nextAlpha,
} from '../src/ui/touchLayout.js';
import { VIEW, SELECT_ITEMS } from '../src/core/game.js';

const box = { w: 800, h: 400 };
const size = { w: 60, h: 50 };

test('가로/세로는 좌표계가 달라서 따로 기억한다', () => {
  assert.equal(layoutMode(false), 'landscape');
  assert.equal(layoutMode(true), 'rotated');
});

test('눕힌 화면은 좌우(=화면 위아래)를 더 비워둔다', () => {
  // 그쪽은 앱의 닫기 버튼과 내비게이션 바가 깔리는 자리다
  assert.ok(marginsFor('rotated').x > marginsFor('landscape').x);
  assert.equal(marginsFor('rotated').y, marginsFor('landscape').y);
});

test('버튼은 상자 밖으로 못 나간다', () => {
  for (const mode of ['landscape', 'rotated']) {
    const m = marginsFor(mode);
    for (const [x, y] of [
      [-500, -500],
      [5000, 5000],
      [0, 200],
      [800, 200],
    ]) {
      const spot = clampSpot(x, y, { box, size, mode });
      const cx = spot.x * box.w;
      const cy = spot.y * box.h;
      assert.ok(cx - size.w / 2 >= m.x - 0.001, `${mode}: 왼쪽으로 삐져나감 (${cx})`);
      assert.ok(cx + size.w / 2 <= box.w - m.x + 0.001, `${mode}: 오른쪽으로 삐져나감 (${cx})`);
      assert.ok(cy - size.h / 2 >= m.y - 0.001, `${mode}: 위로 삐져나감 (${cy})`);
      assert.ok(cy + size.h / 2 <= box.h - m.y + 0.001, `${mode}: 아래로 삐져나감 (${cy})`);
    }
  }
});

test('상자 안이면 그 자리 그대로 둔다', () => {
  const spot = clampSpot(400, 200, { box, size, mode: 'landscape' });
  assert.equal(spot.x, 0.5);
  assert.equal(spot.y, 0.5);
});

test('상자가 버튼보다 좁으면 가운데에 둔다 — 그래야 안 사라진다', () => {
  const spot = clampSpot(0, 0, { box: { w: 40, h: 30 }, size, mode: 'landscape' });
  assert.ok(spot.x > 0 && spot.x < 1);
  assert.ok(spot.y > 0 && spot.y < 1);
});

// ── 저장값 걸러내기 ─────────────────────────────────────────
test('저장된 값이 망가져 있어도 버티고 빈 자리로 돌아간다', () => {
  // 칸이 늘어도 이 규칙은 그대로여야 하므로 모양을 통째로 비교하지 않는다 —
  // 통째로 적어두면 칸 하나 늘릴 때마다 뜻과 상관없이 테스트가 깨진다.
  const empty = sanitize(null);
  for (const junk of [undefined, 42, 'nope', [], { landscape: 'x' }]) {
    assert.deepEqual(sanitize(junk), empty, `${JSON.stringify(junk)} 에서 빈 자리로 안 돌아갔다`);
  }
  assert.deepEqual(empty.landscape, {});
  assert.deepEqual(empty.rotated, {});
  assert.deepEqual(empty.scale, { landscape: 1, rotated: 1 });
});

test('0~1 을 벗어난 좌표는 버린다', () => {
  const out = sanitize({
    landscape: {
      jump: { x: 0.9, y: 0.8 },
      left: { x: 5, y: 0.5 },
      right: { x: 0.5, y: -1 },
      throw: { x: 'a', y: 0.5 },
    },
    rotated: { jump: { x: 0, y: 1 } },
  });
  assert.deepEqual(out.landscape, { jump: { x: 0.9, y: 0.8 } });
  assert.deepEqual(out.rotated, { jump: { x: 0, y: 1 } });
});

test('모르는 모드는 안 들인다', () => {
  const out = sanitize({ landscape: {}, rotated: {}, 이상한모드: { jump: { x: 0.5, y: 0.5 } } });
  assert.ok(!('이상한모드' in out), '모르는 모드가 그대로 들어왔다');
  assert.ok('landscape' in out && 'rotated' in out);
});

// ── 버튼별 크기 · 투명도 ────────────────────────────────────
test('버튼별 크기도 범위 안으로 가둔다', () => {
  const out = sanitize({ size: { landscape: { jump: 9, left: 0.1, right: 1.2, throw: 'x' } } });
  assert.equal(out.size.landscape.jump, MAX_SCALE);
  assert.equal(out.size.landscape.left, MIN_SCALE);
  assert.equal(out.size.landscape.right, 1.2);
  assert.ok(!('throw' in out.size.landscape), '숫자가 아닌 값이 들어왔다');
});

test('투명도는 정해진 칸 중 하나이고, 모르는 값이면 기본값으로 떨어진다', () => {
  assert.equal(sanitize({ alpha: { landscape: 0.8 } }).alpha.landscape, 0.8);
  // 0.05 가 그대로 들어오면 버튼이 안 보여서 게임을 못 한다
  assert.equal(sanitize({ alpha: { landscape: 0.05 } }).alpha.landscape, DEFAULT_ALPHA);
  assert.equal(sanitize(null).alpha.rotated, DEFAULT_ALPHA);
});

test('투명도가 버튼 하나로 한 바퀴 돈다', () => {
  let a = ALPHA_STEPS[0];
  const seen = [a];
  for (let i = 0; i < ALPHA_STEPS.length; i++) {
    a = nextAlpha(a);
    seen.push(a);
  }
  assert.deepEqual(seen.slice(0, ALPHA_STEPS.length), ALPHA_STEPS);
  assert.equal(seen[seen.length - 1], ALPHA_STEPS[0], '끝에서 처음으로 돌아와야 한다');
  assert.ok(ALPHA_STEPS.includes(nextAlpha(0.123)), '모르는 값이 들어와도 칸 안에서 나와야 한다');
});

test('아무리 흐려도 아예 안 보이지는 않는다', () => {
  // 0 이 끼면 버튼이 사라져서 폰에서 조작이 불가능해진다
  assert.ok(Math.min(...ALPHA_STEPS) > 0.2, '너무 흐린 칸이 있다');
});

// ── 버튼 크기 ───────────────────────────────────────────────
test('크기 배율은 정해진 범위 밖으로 안 나간다', () => {
  assert.equal(clampScale(0.1), MIN_SCALE);
  assert.equal(clampScale(5), MAX_SCALE);
  assert.equal(clampScale(1.2), 1.2);
  // 더하다 보면 0.7000000000000001 같은 게 나온다 — 0.1 단위로 떨군다
  assert.equal(clampScale(0.7 + 0.1 + 0.1), 0.9);
});

test('크기 배율이 숫자가 아니면 1 로 돌아간다', () => {
  // null 이 0 으로 바뀌어 "제일 작게"가 되면, 값이 없는 것과 작게 한 것이 구별이 안 된다
  for (const junk of [null, undefined, 'big', '1.2', NaN, Infinity, {}]) {
    assert.equal(clampScale(junk), 1, `${String(junk)} 이 1 이 아니다`);
  }
});

test('크기 칸이 없는 옛 저장값도 그대로 읽힌다', () => {
  const out = sanitize({ landscape: { jump: { x: 0.5, y: 0.5 } }, rotated: {} });
  assert.deepEqual(out.scale, { landscape: 1, rotated: 1 });
  assert.deepEqual(out.landscape, { jump: { x: 0.5, y: 0.5 } });
});

test('저장된 크기는 범위 안으로 잘라서 읽는다', () => {
  const out = sanitize({ landscape: {}, rotated: {}, scale: { landscape: 9, rotated: 0 } });
  assert.equal(out.scale.landscape, MAX_SCALE);
  assert.equal(out.scale.rotated, MIN_SCALE);
});

test('버튼을 키우면 가장자리 자리가 안쪽으로 밀려 들어온다', () => {
  // 오른쪽 끝에 붙여둔 버튼을 1.8배로 키우면 그만큼 안으로 들어와야 누를 수 있다
  const mode = 'landscape';
  const at = clampSpot(9999, 200, { box, size, mode });
  const bigger = { w: size.w * MAX_SCALE, h: size.h * MAX_SCALE };
  const after = clampSpot(at.x * box.w, at.y * box.h, { box, size: bigger, mode });

  assert.ok(after.x < at.x, '커졌는데 자리가 그대로면 화면 밖으로 나간다');
  const right = after.x * box.w + bigger.w / 2;
  assert.ok(right <= box.w - marginsFor(mode).x + 0.001, `오른쪽으로 삐져나감 (${right})`);
});

// ── 폰에서 버튼이 게임 화면을 덮던 문제 ──────────────────────
//
// 눕힌 화면에서 좌우로 비워두는 폭(ROTATED_SIDE)이 너무 크면 **두 가지가 한꺼번에**
// 망가진다. 여백에 붙어 있는 ◀▶ 가 한계선에 걸려 왼쪽으로 안 움직이고, 갈 데가 없는
// 버튼이 게임 화면 위로 밀려난다. 실제로 84 였고, 여백이 88 이었다.

/** 폰에서 게임 화면 옆에 실제로 남는 여백. resize() 와 같은 식으로 잰다. */
const gutterOf = (viewW, viewH) => (viewW - VIEW.w * Math.min(viewW / VIEW.w, viewH / VIEW.h)) / 2;

test('눕힌 화면에서 버튼이 여백 안에 앉는다 — 게임 화면 위로 안 밀려난다', () => {
  // 위아래 여백은 어느 폰에서도 0 이다. 남는 자리는 좌우뿐이고, 비워두는 폭이 그걸
  // 통째로 먹으면 버튼이 갈 데가 없어서 게임 화면을 덮는다 (실제로 84 대 88 이었다).
  const css = readFileSync(new URL('../assets/style.css', import.meta.url), 'utf8');
  const padW = Number(css.match(/--pad-w:\s*(\d+)px/)?.[1]);
  assert.ok(padW > 0, 'CSS 에 --pad-w 가 없다');

  const phones = [
    [844, 390, 'iPhone 12~14'],
    [852, 393, 'iPhone 15'],
    [800, 360, 'Galaxy A'],
    [915, 412, 'Pixel 7'],
  ];
  for (const [w, h, name] of phones) {
    const room = gutterOf(w, h) - marginsFor('rotated').x;
    assert.ok(
      room >= padW / 2,
      `${name}: 비워둔 폭(${marginsFor('rotated').x}) 뒤에 ${room.toFixed(0)}px 남는다 — 버튼(${padW}px)이 반도 못 들어간다`,
    );
  }
});

test('여백 상수는 CSS 와 JS 에 따로 적혀 있지 않다', () => {
  const css = readFileSync(new URL('../assets/style.css', import.meta.url), 'utf8');
  const found = css.match(/--rotated-side:\s*(\d+)px/);
  assert.ok(found, 'CSS 에 --rotated-side 가 없다');
  assert.equal(Number(found[1]), ROTATED_SIDE, 'CSS 와 JS 의 여백이 어긋났다');
});

test('버튼은 처음부터 비쳐 보인다 — 불투명하면 게임 화면을 가린다', () => {
  assert.ok(DEFAULT_ALPHA < 1);
  assert.ok(ALPHA_STEPS.includes(DEFAULT_ALPHA), '고를 수 있는 단계 중 하나여야 한다');
  // 옛 저장값에는 이 칸이 아예 없다 — 없으면 기본값으로 읽혀야 한다
  assert.equal(sanitize({ landscape: {}, rotated: {} }).alpha.landscape, DEFAULT_ALPHA);
});

// ── 스테이지 선택이 화면에 안 들어가던 문제 ──────────────────
//
// 하드모드가 붙으면서 목록이 12줄이 됐다. 한 칸으로 늘어놓으면 479px 이고 폰의
// 게임 화면은 390px 이라 위아래가 잘려나갔다. 세로로 채우고 넘치면 옆 칸으로 간다.

test('고르는 목록이 두 칸 안에 들어간다', () => {
  const css = readFileSync(new URL('../assets/style.css', import.meta.url), 'utf8');
  const rows = Number(css.match(/--slot-rows:\s*(\d+)/)?.[1]);
  assert.ok(rows > 0, 'CSS 에 --slot-rows 가 없다');
  assert.ok(
    SELECT_ITEMS.length <= rows * 2,
    `고를 게 ${SELECT_ITEMS.length}개면 칸이 셋으로 늘어 패널이 화면보다 넓어진다`,
  );
});
