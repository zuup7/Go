import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/rng.js';
import { createFounder, createCandidate, createChild, ageOneYear, updateEducation, deathChance, fullName, growthRate } from '../src/core/person.js';
import { STAT_KEYS } from '../src/core/util.js';

test('시조는 18세, 이름과 특성을 갖는다', () => {
  const rng = createRng(1);
  const founder = createFounder(rng, { year: 2000, gender: 'female', familyName: '박', givenName: '서연' });
  assert.equal(founder.age, 18);
  assert.equal(fullName(founder), '박서연');
  assert.equal(founder.generation, 1);
  assert.ok(founder.traits.length >= 1);
  assert.ok(founder.bloodline);
});

test('연애 상대는 핏줄이 아니고 성별이 반대다', () => {
  const rng = createRng(2);
  const player = createFounder(rng, { year: 2000, gender: 'male' });
  const candidate = createCandidate(rng, player, 2000);
  assert.equal(candidate.gender, 'female');
  assert.equal(candidate.bloodline, false);
  assert.equal(candidate.inFamily, false);
});

test('아이는 부모를 기록하고 세대가 하나 늘어난다', () => {
  const rng = createRng(3);
  const mother = createFounder(rng, { year: 2000, gender: 'female' });
  const father = createFounder(rng, { year: 2000, gender: 'male' });
  const child = createChild(rng, mother, father, 2025);
  assert.equal(child.age, 0);
  assert.equal(child.birthYear, 2025);
  assert.deepEqual(child.parents, [mother.id, father.id]);
  assert.equal(child.generation, 2);
  assert.ok(child.bloodline);
});

test('아이는 자라며 능력치가 오르고 잠재력을 넘지 않는다', () => {
  const rng = createRng(4);
  const mother = createFounder(rng, { year: 2000, gender: 'female' });
  const father = createFounder(rng, { year: 2000, gender: 'male' });
  const child = createChild(rng, mother, father, 2000);
  const start = { ...child.stats };
  for (let i = 0; i < 20; i++) ageOneYear(child, { rng });
  assert.equal(child.age, 20);
  for (const key of STAT_KEYS) {
    assert.ok(child.stats[key] > start[key], `${key} 는 자라며 올라야 한다`);
    assert.ok(child.stats[key] <= 100);
  }
});

test('어릴수록 빨리 자란다', () => {
  assert.ok(growthRate(5) > growthRate(25));
  assert.ok(growthRate(25) > growthRate(70));
});

test('학업이 쌓이면 학력이 오른다', () => {
  const person = { age: 19, eduPoints: 60, education: 0 };
  assert.equal(updateEducation(person), 2);
  person.age = 23; person.eduPoints = 100;
  assert.equal(updateEducation(person), 3);
});

test('학력은 내려가지 않는다', () => {
  const person = { age: 30, eduPoints: 0, education: 3 };
  assert.equal(updateEducation(person), 3);
});

test('나이가 수명을 넘으면 사망 확률이 크게 오른다', () => {
  const young = { age: 30, lifespan: 80, stats: { health: 70 } };
  const old = { age: 90, lifespan: 80, stats: { health: 70 } };
  assert.ok(deathChance(young) < 0.02);
  assert.ok(deathChance(old) > 0.5);
  assert.ok(deathChance(old, 10) < deathChance(old), '보건소는 수명을 늘린다');
});

test('아이는 좀처럼 죽지 않는다', () => {
  assert.ok(deathChance({ age: 8, lifespan: 80, stats: { health: 5 } }) <= 0.001);
});
