// 버튼 자리 커스텀 — 저장값이 이상해도 버튼이 화면 밖으로 나가면 안 된다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampSpot,
  clampScale,
  marginsFor,
  layoutMode,
  sanitize,
  MIN_SCALE,
  MAX_SCALE,
} from '../src/ui/touchLayout.js';

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
  for (const junk of [null, undefined, 42, 'nope', [], { landscape: 'x' }]) {
    const out = sanitize(junk);
    assert.deepEqual(out, { landscape: {}, rotated: {}, scale: { landscape: 1, rotated: 1 } });
  }
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
  assert.deepEqual(Object.keys(out).sort(), ['landscape', 'rotated', 'scale']);
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
