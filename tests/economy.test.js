import test from 'node:test';
import assert from 'node:assert/strict';
import { salaryOf, householdIncome, householdExpense, promotionChance, MAX_JOB_LEVEL, BASE_LIVING_COST, CHILD_COST } from '../src/core/economy.js';

const worker = (over = {}) => ({
  alive: true, age: 30, jobId: 'engineer', jobLevel: 0, traits: [],
  stats: { health: 60, intellect: 70, charm: 50, creativity: 50, fitness: 50 },
  ...over,
});

test('직업이 없으면 소득이 없다', () => {
  assert.equal(salaryOf(worker({ jobId: null })), 0);
  assert.equal(salaryOf(worker({ alive: false })), 0);
});

test('호봉과 실력이 오르면 연봉이 오른다', () => {
  const base = salaryOf(worker());
  assert.ok(salaryOf(worker({ jobLevel: 5 })) > base);
  assert.ok(salaryOf(worker({ stats: { ...worker().stats, intellect: 95 } })) > base);
});

test('호봉은 상한을 넘어도 연봉에 반영되지 않는다', () => {
  const capped = salaryOf(worker({ jobLevel: MAX_JOB_LEVEL }));
  const beyond = salaryOf(worker({ jobLevel: MAX_JOB_LEVEL + 20 }));
  assert.equal(capped, beyond);
});

test('특성과 마을 보너스가 소득에 반영된다', () => {
  const plain = salaryOf(worker());
  assert.ok(salaryOf(worker({ traits: ['diligent'] })) > plain);
  assert.ok(salaryOf(worker(), { incomeRate: 0.5 }) > plain);
});

test('가구 지출은 성인/아이 수를 따른다', () => {
  const adult = { age: 30, traits: [] };
  const kid = { age: 5, traits: [] };
  const one = householdExpense([adult], {});
  const withKid = householdExpense([adult, kid], {});
  assert.equal(one, BASE_LIVING_COST);
  assert.equal(withKid - one, CHILD_COST);
});

test('알뜰함과 마을 효과는 지출을 줄인다', () => {
  const plain = householdExpense([{ age: 30, traits: [] }], {});
  assert.ok(householdExpense([{ age: 30, traits: ['frugal'] }], {}) < plain);
  assert.ok(householdExpense([{ age: 30, traits: [] }], { expenseRate: -0.3 }) < plain);
});

test('가구 수입은 구성원 급여와 마을 수입의 합이다', () => {
  const a = worker();
  const b = worker({ jobId: 'teacher' });
  assert.equal(
    householdIncome([a, b], { income: 500 }),
    salaryOf(a, { income: 500 }) + salaryOf(b, { income: 500 }) + 500,
  );
});

test('승진 확률은 상한에서 0이 되고, 집중하면 오른다', () => {
  assert.equal(promotionChance(worker({ jobLevel: MAX_JOB_LEVEL }), true), 0);
  assert.ok(promotionChance(worker(), true) > promotionChance(worker(), false));
  assert.ok(promotionChance(worker(), false) > 0);
});
