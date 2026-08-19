import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/rng.js';
import { randomGenes, inheritGenes, inheritStats, inheritTraits, traitEffects, GENE_KEYS, GENE_POOL } from '../src/core/genetics.js';
import { STAT_KEYS } from '../src/core/util.js';

const parent = (rng, traits) => ({
  genes: randomGenes(rng),
  traits,
  potential: Object.fromEntries(STAT_KEYS.map((k) => [k, 70])),
});

test('아이의 외모는 대부분 부모에게서 온다', () => {
  const rng = createRng(2024);
  let fromParents = 0;
  let total = 0;
  for (let i = 0; i < 200; i++) {
    const mother = parent(rng, []);
    const father = parent(rng, []);
    const child = inheritGenes(rng, mother.genes, father.genes);
    for (const key of GENE_KEYS) {
      total++;
      if (child[key] === mother.genes[key] || child[key] === father.genes[key]) fromParents++;
    }
  }
  assert.ok(fromParents / total > 0.85, `부모 유래 비율 ${(fromParents / total).toFixed(2)}`);
});

test('돌연변이도 실제로 일어난다', () => {
  const rng = createRng(11);
  const mother = { genes: { ...randomGenes(rng), hairColor: GENE_POOL.hairColor[0] } };
  const father = { genes: { ...randomGenes(rng), hairColor: GENE_POOL.hairColor[0] } };
  let mutated = 0;
  for (let i = 0; i < 300; i++) {
    if (inheritGenes(rng, mother.genes, father.genes).hairColor !== GENE_POOL.hairColor[0]) mutated++;
  }
  assert.ok(mutated > 5, `돌연변이 ${mutated}회`);
});

test('아이는 부모 잠재력을 물려받고, 시작 능력치는 낮다', () => {
  const rng = createRng(5);
  const mother = parent(rng, []);
  const father = parent(rng, []);
  for (let i = 0; i < 50; i++) {
    const { stats, potential } = inheritStats(rng, mother, father);
    for (const key of STAT_KEYS) {
      assert.ok(potential[key] >= 55 && potential[key] <= 85, `잠재력 ${key}=${potential[key]}`);
      assert.ok(stats[key] < potential[key], '아기 능력치는 잠재력보다 낮아야 한다');
      assert.ok(stats[key] >= 5, '능력치 하한');
    }
  }
});

test('특성은 부모 것 위주로 이어지고 최대 3개다', () => {
  const rng = createRng(77);
  const mother = parent(rng, ['genius', 'kind']);
  const father = parent(rng, ['athletic']);
  let inheritedCount = 0;
  for (let i = 0; i < 200; i++) {
    const traits = inheritTraits(rng, mother, father);
    assert.ok(traits.length >= 1 && traits.length <= 3, `특성 수 ${traits.length}`);
    assert.equal(new Set(traits).size, traits.length, '특성 중복 없음');
    if (traits.some((t) => ['genius', 'kind', 'athletic'].includes(t))) inheritedCount++;
  }
  assert.ok(inheritedCount > 100, `부모 특성 계승 ${inheritedCount}/200`);
});

test('특성 효과가 합산된다', () => {
  const effects = traitEffects(['genius', 'frugal', 'optimist']);
  assert.equal(effects.grow.intellect, 2);
  assert.ok(effects.income > 0);
  assert.ok(effects.expense < 0);
  assert.equal(effects.happiness, 2);
});
