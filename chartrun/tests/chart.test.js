import test from 'node:test';
import assert from 'node:assert/strict';
import { rankAt, CHART_SEGMENTS, TOP_RANK } from '../src/core/chart.js';

test('첫 스테이지는 100위에서 시작한다', () => {
  assert.equal(rankAt(0, 0), 100);
});

test('스테이지 4를 끝내면 정확히 2위', () => {
  assert.equal(rankAt(3, 1), 2);
});

test('진행할수록 순위가 절대 올라가지 않는다', () => {
  for (let stage = 0; stage < CHART_SEGMENTS.length; stage++) {
    let prev = Infinity;
    for (let i = 0; i <= 100; i++) {
      const rank = rankAt(stage, i / 100);
      assert.ok(rank <= prev, `스테이지 ${stage} 에서 순위가 되돌아갔다`);
      prev = rank;
    }
  }
});

test('스테이지 사이가 끊기지 않는다', () => {
  for (let stage = 0; stage < CHART_SEGMENTS.length - 1; stage++) {
    assert.equal(rankAt(stage, 1), rankAt(stage + 1, 0), `스테이지 ${stage} → ${stage + 1} 이 안 이어진다`);
  }
});

test('진행률이 범위를 벗어나도 안전하다', () => {
  assert.equal(rankAt(0, -5), 100);
  assert.equal(rankAt(0, 99), 50);
  assert.equal(rankAt(99, 1), 2);
  assert.equal(rankAt(-3, 0), 100);
});

