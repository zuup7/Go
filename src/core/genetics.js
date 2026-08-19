// 유전: 외모 / 능력 / 성격이 부모에게서 자식에게 이어진다.
import { TRAITS, commonTraits, TRAIT_BY_ID } from '../data/traits.js';
import { clamp, STAT_KEYS } from './util.js';

export const GENE_POOL = {
  skin: ['#ffe0c8', '#f7cfa8', '#e8b48a', '#c98d63', '#9c6242', '#6f4530'],
  hairColor: ['#2b2118', '#4a2f1d', '#7b4a24', '#b57b3a', '#d8b06a', '#8a8a8a', '#c8546b', '#5a7fb5'],
  hairStyle: ['short', 'bob', 'long', 'curly', 'ponytail', 'bald', 'buzz', 'wave', 'twintail', 'afro', 'bun'],
  eyeColor: ['#3a2a1c', '#5b3b22', '#2f5d3f', '#2f4f7a', '#6b4a7a'],
  face: ['round', 'oval', 'square', 'heart'],
  freckles: [false, false, false, true],
  blush: ['#f2a3a3', '#e8918f', '#d98b7a', '#f0b0c0'],
};

export const GENE_KEYS = Object.keys(GENE_POOL);

/** 완전히 새로운 외모 */
export function randomGenes(rng) {
  const genes = {};
  for (const key of GENE_KEYS) genes[key] = rng.pick(GENE_POOL[key]);
  return genes;
}

/**
 * 부모의 외모를 섞는다. 각 유전자는 부모 중 한쪽에서 오고,
 * MUTATION_RATE 확률로 조상에게 없던 특징이 나타난다.
 */
export const MUTATION_RATE = 0.08;

export function inheritGenes(rng, motherGenes, fatherGenes) {
  const genes = {};
  for (const key of GENE_KEYS) {
    if (rng.chance(MUTATION_RATE)) {
      genes[key] = rng.pick(GENE_POOL[key]);
    } else {
      genes[key] = rng.chance(0.5) ? motherGenes[key] : fatherGenes[key];
      if (genes[key] === undefined) genes[key] = rng.pick(GENE_POOL[key]);
    }
  }
  return genes;
}

/**
 * 능력치 유전.
 * potential(잠재력)은 부모 평균을 따라가고, 실제 stats 는 아기답게 낮게 시작한다.
 */
export function inheritStats(rng, mother, father) {
  const stats = {};
  const potential = {};
  for (const key of STAT_KEYS) {
    const parentAvg = (mother.potential[key] + father.potential[key]) / 2;
    potential[key] = clamp(Math.round(parentAvg + rng.int(-10, 10)), 20, 100);
    stats[key] = clamp(Math.round(potential[key] * 0.3 + rng.int(0, 8)), 5, 60);
  }
  return { stats, potential };
}

/** 특성 유전: 부모 특성 우선, 가끔 새로운 기질이 나타난다. */
export function inheritTraits(rng, mother, father) {
  const inherited = [];
  const pool = rng.shuffle([...new Set([...mother.traits, ...father.traits])]);
  for (const traitId of pool) {
    if (inherited.length >= 2) break;
    if (rng.chance(0.45)) inherited.push(traitId);
  }
  if (inherited.length === 0 || rng.chance(0.35)) {
    const fresh = rng.chance(0.06) ? rng.pick(TRAITS) : rng.pick(commonTraits());
    if (!inherited.includes(fresh.id)) inherited.push(fresh.id);
  }
  return inherited.filter((id) => TRAIT_BY_ID[id]).slice(0, 3);
}

/** 특성 목록의 효과를 합산 */
export function traitEffects(traitIds) {
  const total = { income: 0, expense: 0, happiness: 0, grow: {} };
  for (const id of traitIds) {
    const trait = TRAIT_BY_ID[id];
    if (!trait) continue;
    total.income += trait.income ?? 0;
    total.expense += trait.expense ?? 0;
    total.happiness += trait.happiness ?? 0;
    for (const [key, value] of Object.entries(trait.bonus ?? {})) {
      total.grow[key] = (total.grow[key] ?? 0) + value;
    }
  }
  return total;
}
