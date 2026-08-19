// 인물 생성과 한 살 나이 먹기.
import { FAMILY_NAMES, GIVEN_NAMES_MALE, GIVEN_NAMES_FEMALE } from '../data/names.js';
import { randomGenes, inheritGenes, inheritStats, inheritTraits, traitEffects } from './genetics.js';
import { commonTraits, TRAITS } from '../data/traits.js';
import { clamp, STAT_KEYS, stageOf } from './util.js';

let idCounter = 1;
export const nextId = () => `p${idCounter++}`;
export const resetIdCounter = (value = 1) => { idCounter = value; };
export const currentIdCounter = () => idCounter;

export function givenNamePool(gender) {
  return gender === 'male' ? GIVEN_NAMES_MALE : GIVEN_NAMES_FEMALE;
}

export function makePerson(overrides = {}) {
  const base = {
    id: nextId(),
    familyName: '김',
    givenName: '아이',
    gender: 'female',
    birthYear: 0,
    age: 0,
    alive: true,
    deathYear: null,
    deathCause: null,
    genes: {},
    traits: [],
    stats: { health: 50, intellect: 50, charm: 50, creativity: 50, fitness: 50 },
    potential: { health: 70, intellect: 70, charm: 70, creativity: 70, fitness: 70 },
    happiness: 60,
    education: 0,
    eduPoints: 0,
    jobId: null,
    jobLevel: 0,
    partnerId: null,
    affection: 0,
    parents: [],
    children: [],
    generation: 1,
    isPlayer: false,
    lifespan: 78,
    inFamily: true,
    bloodline: true,   // 가문의 핏줄인지 (결혼으로 들어온 사람은 false)
    independent: false,
  };
  return { ...base, ...overrides };
}

export const fullName = (person) => `${person.familyName}${person.givenName}`;

/** 1대 시조 캐릭터 */
export function createFounder(rng, { gender, familyName, givenName, year, traitId } = {}) {
  const g = gender ?? (rng.chance(0.5) ? 'male' : 'female');
  const traits = [traitId ?? rng.pick(commonTraits()).id];
  if (rng.chance(0.4)) {
    const extra = rng.pick(commonTraits()).id;
    if (!traits.includes(extra)) traits.push(extra);
  }
  const potential = {};
  const stats = {};
  for (const key of STAT_KEYS) {
    potential[key] = rng.int(55, 88);
    stats[key] = rng.int(35, 55);
  }
  return makePerson({
    familyName: familyName ?? rng.pick(FAMILY_NAMES),
    givenName: givenName ?? rng.pick(givenNamePool(g)),
    gender: g,
    birthYear: year - 18,
    age: 18,
    genes: randomGenes(rng),
    traits,
    stats,
    potential,
    happiness: 65,
    education: 2,
    eduPoints: 40,
    generation: 1,
    isPlayer: true,
    lifespan: rng.int(74, 88),
  });
}

/** 연애 상대 후보 (외부에서 마을로 들어온 사람) */
export function createCandidate(rng, player, year) {
  const gender = player.gender === 'male' ? 'female' : 'male';
  const potential = {};
  const stats = {};
  for (const key of STAT_KEYS) {
    potential[key] = rng.int(50, 92);
    stats[key] = clamp(rng.int(40, 78));
  }
  const traits = rng.shuffle(commonTraits()).slice(0, rng.int(1, 2)).map((t) => t.id);
  if (rng.chance(0.08)) traits.push(rng.pick(TRAITS.filter((t) => t.rare)).id);
  const age = clamp(player.age + rng.int(-4, 4), 19, 60);
  return makePerson({
    familyName: rng.pick(FAMILY_NAMES),
    givenName: rng.pick(givenNamePool(gender)),
    gender,
    birthYear: year - age,
    age,
    genes: randomGenes(rng),
    traits: [...new Set(traits)],
    stats,
    potential,
    happiness: rng.int(50, 75),
    education: rng.int(1, 4),
    affection: rng.int(5, 25),
    generation: player.generation,
    inFamily: false,
    bloodline: false,
    lifespan: rng.int(74, 90),
  });
}

/** 아이 태어남 */
export function createChild(rng, mother, father, year) {
  const gender = rng.chance(0.5) ? 'male' : 'female';
  const { stats, potential } = inheritStats(rng, mother, father);
  const familyParent = mother.inFamily && mother.isBloodline !== false ? mother : father;
  const child = makePerson({
    familyName: familyParent.familyName,
    givenName: rng.pick(givenNamePool(gender)),
    gender,
    birthYear: year,
    age: 0,
    genes: inheritGenes(rng, mother.genes, father.genes),
    traits: inheritTraits(rng, mother, father),
    stats,
    potential,
    happiness: 70,
    parents: [mother.id, father.id],
    generation: Math.max(mother.generation, father.generation) + 1,
    lifespan: Math.round((mother.lifespan + father.lifespan) / 2) + rng.int(-5, 6),
  });
  return child;
}

/** 나이에 따른 자연 성장 배수 (아이일수록 빨리 큰다) */
export function growthRate(age) {
  if (age <= 4) return 1.6;
  if (age <= 12) return 1.4;
  if (age <= 18) return 1.2;
  if (age <= 34) return 0.8;
  if (age <= 49) return 0.45;
  if (age <= 64) return 0.2;
  return 0.05;
}

/**
 * 한 살 먹기. villageGrow 는 마을 건물이 주는 스탯 보정.
 * 잠재력에 가까울수록 성장이 느려지고, 나이가 들면 건강/체력은 자연히 준다.
 */
export function ageOneYear(person, { villageGrow = {}, rng } = {}) {
  person.age += 1;
  const effects = traitEffects(person.traits);
  const rate = growthRate(person.age);

  for (const key of STAT_KEYS) {
    const room = person.potential[key] - person.stats[key];
    let delta = room > 0 ? (room / 18) * rate : 0;
    delta += (effects.grow[key] ?? 0) * rate * 0.6;
    delta += (villageGrow[key] ?? 0) * rate * 0.5;
    if (rng) delta += rng.float() * 0.8 - 0.3;

    if (person.age > 45 && (key === 'health' || key === 'fitness')) {
      delta -= (person.age - 45) * 0.09;
    }
    person.stats[key] = clamp(Math.round((person.stats[key] + delta) * 10) / 10, 1, 100);
  }

  // 아이는 배우며 자란다
  if (person.age >= 6 && person.age <= 18) {
    person.eduPoints += 3 + person.stats.intellect / 25;
  }
  person.happiness = clamp(person.happiness + effects.happiness);
  return person;
}

/** 학력 갱신 (졸업 시점마다) */
export function updateEducation(person) {
  const p = person.eduPoints;
  let level = 0;
  if (person.age >= 15 && p >= 25) level = 1;
  if (person.age >= 19 && p >= 55) level = 2;
  if (person.age >= 23 && p >= 95) level = 3;
  if (person.age >= 26 && p >= 140) level = 4;
  person.education = Math.max(person.education, level);
  return person.education;
}

/** 사망 확률: 수명을 넘길수록, 건강이 나쁠수록 높아진다 */
export function deathChance(person, lifespanBonus = 0) {
  const limit = person.lifespan + lifespanBonus;
  const over = person.age - limit;
  let chance = over >= 0 ? 0.12 + over * 0.06 : Math.max(0, (person.age - 55) * 0.0012);
  if (person.stats.health < 25) chance += (25 - person.stats.health) * 0.006;
  if (person.age < 15) chance = Math.min(chance, 0.001);
  return clamp(chance, 0, 0.95) ;
}

export const lifeStage = (person) => stageOf(person.age);
