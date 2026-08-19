import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/rng.js';

test('같은 시드는 같은 수열을 만든다', () => {
  const a = createRng(1234);
  const b = createRng(1234);
  const seqA = Array.from({ length: 20 }, () => a.int(0, 999));
  const seqB = Array.from({ length: 20 }, () => b.int(0, 999));
  assert.deepEqual(seqA, seqB);
});

test('상태를 옮기면 이어서 같은 수열이 나온다', () => {
  const a = createRng(7);
  a.int(0, 10); a.int(0, 10);
  const b = createRng(7);
  b.state = a.state;
  assert.equal(a.int(0, 1000), b.int(0, 1000));
});

test('int 는 범위를 벗어나지 않는다', () => {
  const rng = createRng(99);
  for (let i = 0; i < 500; i++) {
    const value = rng.int(3, 9);
    assert.ok(value >= 3 && value <= 9, `범위 밖: ${value}`);
  }
});

test('weighted 는 가중치가 큰 쪽을 더 자주 고른다', () => {
  const rng = createRng(5);
  const items = [{ id: 'rare', weight: 1 }, { id: 'common', weight: 9 }];
  let common = 0;
  for (let i = 0; i < 1000; i++) if (rng.weighted(items).id === 'common') common++;
  assert.ok(common > 800, `common 선택 ${common}회`);
});

test('shuffle 은 원본을 바꾸지 않고 같은 원소를 유지한다', () => {
  const rng = createRng(3);
  const source = [1, 2, 3, 4, 5];
  const shuffled = rng.shuffle(source);
  assert.deepEqual(source, [1, 2, 3, 4, 5]);
  assert.deepEqual([...shuffled].sort(), [1, 2, 3, 4, 5]);
});
