// 게임 엔진: 상태 하나(state)에 모든 것이 담기고, 함수들이 그 상태를 나아가게 한다.
import { createRng } from './rng.js';
import { clamp, STAT_KEYS, average, EDUCATION_LABELS } from './util.js';
import {
  makePerson, createFounder, createCandidate, createChild, ageOneYear,
  updateEducation, deathChance, fullName, nextId, resetIdCounter, currentIdCounter,
} from './person.js';
import { createVillage, villageBonuses, villageLevel, villageMaintenance, build as buildInVillage } from './village.js';
import { householdIncome, householdExpense, promotionChance, salaryOf, MAX_JOB_LEVEL } from './economy.js';
import { JOB_BY_ID, canApply } from '../data/jobs.js';
import { EVENTS } from '../data/events.js';
import { TRAIT_BY_ID } from '../data/traits.js';
import { VILLAGE_NAMES } from '../data/names.js';

export const START_YEAR = 2000;
export const MARRIAGE_COST = 1500;
export const CHILD_COST_ONCE = 400;
export const MEET_COST = 80;
export const DATE_COST = 60;

/** 매년 고르는 한 가지 활동 */
export const ACTIVITIES = [
  { id: 'study', label: '공부', icon: '📚', desc: '지능이 오르고 학업이 쌓입니다.', minAge: 6 },
  { id: 'exercise', label: '운동', icon: '🏃', desc: '체력과 건강이 오릅니다.', minAge: 5 },
  { id: 'art', label: '예술 활동', icon: '🎨', desc: '창의력이 오릅니다.', minAge: 5 },
  { id: 'social', label: '사교 활동', icon: '💬', desc: '매력이 오르고 인연이 가까워집니다.', minAge: 10 },
  { id: 'work', label: '일에 집중', icon: '💼', desc: '승진 확률과 수입이 오릅니다.', minAge: 19, needsJob: true },
  { id: 'family', label: '가족과 시간', icon: '🏡', desc: '가족 모두의 행복이 오릅니다.', minAge: 0 },
  { id: 'rest', label: '휴식', icon: '🌿', desc: '건강과 행복을 회복합니다.', minAge: 0 },
];

export const ACTIVITY_BY_ID = Object.fromEntries(ACTIVITIES.map((a) => [a.id, a]));

// ── 상태 만들기 ────────────────────────────────────────────

export function newGame({ seed = Date.now(), familyName, givenName, gender, traitId, villageName } = {}) {
  resetIdCounter(1);
  const rng = createRng(seed);
  const founder = createFounder(rng, { gender, familyName, givenName, year: START_YEAR, traitId });
  const state = {
    seed,
    rngState: rng.state,
    idCounter: currentIdCounter(),
    year: START_YEAR,
    generation: 1,
    playerId: founder.id,
    people: { [founder.id]: founder },
    money: 2600,
    upkeep: 0,
    village: createVillage(villageName || rng.pick(VILLAGE_NAMES)),
    log: [],
    pending: null,
    seenEvents: [],
    turnFlags: { romanceUsed: false, metThisYear: false },
    activity: 'study',
    succession: null,
    ended: null,
    stats: { yearsPlayed: 0, born: 0, married: 0, buildingsBuilt: 0, peakMoney: 2600 },
  };
  pushLog(state, '🌱', `${fullName(founder)}의 이야기가 ${state.village.name}에서 시작됩니다.`, 'good');
  return state;
}

/** 저장된 상태를 이어받을 때 id 카운터를 복구한다 */
export function rehydrate(state) {
  resetIdCounter(state.idCounter ?? Object.keys(state.people).length + 1);
  return state;
}

const rngFor = (state) => {
  const rng = createRng(state.seed);
  rng.state = state.rngState;
  return rng;
};
const syncRng = (state, rng) => {
  state.rngState = rng.state;
  state.idCounter = currentIdCounter();
};

// ── 조회 헬퍼 ──────────────────────────────────────────────

export const player = (state) => state.people[state.playerId];
export const personOf = (state, id) => (id ? state.people[id] : null);
export const partnerOf = (state) => personOf(state, player(state)?.partnerId);
export const allPeople = (state) => Object.values(state.people);

/** 같이 사는 가족: 나 + 배우자 + 미성년 자녀 + 모시는 부모님 */
export function household(state) {
  const me = player(state);
  if (!me) return [];
  const members = [me];
  const partner = partnerOf(state);
  if (partner?.alive) members.push(partner);
  for (const childId of me.children) {
    const child = state.people[childId];
    if (child?.alive && child.age < 19) members.push(child);
  }
  for (const elder of eldersOf(state)) members.push(elder);
  return members;
}

/** 함께 사는 부모님(전 세대 플레이어와 그 배우자) */
export function eldersOf(state) {
  const me = player(state);
  if (!me) return [];
  return me.parents
    .map((id) => state.people[id])
    .filter((p) => p?.alive && p.inFamily);
}

/** 화면에 보여줄 가족 구성원 (생존자 전원) */
export function familyMembers(state) {
  return allPeople(state).filter((p) => p.alive && p.inFamily);
}

export const childrenOf = (state, person) => person.children.map((id) => state.people[id]).filter(Boolean);

export function candidates(state) {
  return allPeople(state).filter((p) => p.isCandidate && p.alive && !p.partnerId);
}

export function pushLog(state, icon, text, tone = 'normal') {
  state.log.unshift({ year: state.year, icon, text, tone });
  if (state.log.length > 300) state.log.length = 300;
}

/** 텍스트의 {me} {partner} {child} {village} 치환 */
export function fillText(state, text) {
  const me = player(state);
  const partner = partnerOf(state);
  const kids = me ? childrenOf(state, me).filter((c) => c.alive) : [];
  return String(text)
    .replaceAll('{me}', me ? fullName(me) : '주인공')
    .replaceAll('{partner}', partner ? fullName(partner) : '배우자')
    .replaceAll('{child}', kids.length ? fullName(kids[0]) : '아이')
    .replaceAll('{village}', state.village.name);
}

// ── 효과 적용 ──────────────────────────────────────────────

export function applyEffects(state, effects = {}) {
  const me = player(state);
  const rng = rngFor(state);
  if (effects.money) state.money += effects.money;
  if (effects.happiness) me.happiness = clamp(me.happiness + effects.happiness);
  if (effects.stats) {
    for (const [key, value] of Object.entries(effects.stats)) {
      if (STAT_KEYS.includes(key)) me.stats[key] = clamp(me.stats[key] + value);
    }
  }
  if (effects.education) me.eduPoints = Math.max(0, me.eduPoints + effects.education * 8);
  if (effects.lifespan) me.lifespan += effects.lifespan;
  if (effects.affection) {
    const partner = partnerOf(state);
    if (partner) partner.affection = clamp(partner.affection + effects.affection);
  }
  if (effects.addTrait && !me.traits.includes(effects.addTrait) && TRAIT_BY_ID[effects.addTrait]) {
    me.traits.push(effects.addTrait);
    pushLog(state, '✨', `${fullName(me)}에게 새로운 특성 "${TRAIT_BY_ID[effects.addTrait].label}"이(가) 생겼습니다.`, 'good');
  }
  if (effects.promote && me.jobId && me.jobLevel < MAX_JOB_LEVEL) {
    me.jobLevel = Math.min(MAX_JOB_LEVEL, me.jobLevel + effects.promote);
    pushLog(state, '📈', `${fullName(me)}이(가) 승진했습니다. (${me.jobLevel}호봉)`, 'good');
  }
  if (effects.villageFame) state.village.fame = (state.village.fame ?? 0) + effects.villageFame;
  if (effects.expenseUp) state.upkeep += effects.expenseUp;
  if (effects.inheritBonus) state.inheritBonus = (state.inheritBonus ?? 0) + effects.inheritBonus;

  const kids = childrenOf(state, me).filter((c) => c.alive);
  if (effects.childHappiness) {
    for (const kid of kids) kid.happiness = clamp(kid.happiness + effects.childHappiness);
  }
  if (effects.childStats && kids.length) {
    const target = kids[0];
    for (const [key, value] of Object.entries(effects.childStats)) {
      if (STAT_KEYS.includes(key)) {
        target.stats[key] = clamp(target.stats[key] + value);
        target.potential[key] = clamp(target.potential[key] + value / 2);
      }
    }
  }
  syncRng(state, rng);
}

// ── 연간 활동 ──────────────────────────────────────────────

function applyActivity(state, activityId) {
  const me = player(state);
  const rng = rngFor(state);
  const gain = (key, amount) => { me.stats[key] = clamp(me.stats[key] + amount); };
  switch (activityId) {
    case 'study':
      gain('intellect', 3 + rng.int(0, 2));
      me.eduPoints += 10;
      me.happiness = clamp(me.happiness - 1);
      break;
    case 'exercise':
      gain('fitness', 3 + rng.int(0, 2));
      gain('health', 2);
      break;
    case 'art':
      gain('creativity', 3 + rng.int(0, 2));
      me.happiness = clamp(me.happiness + 1);
      break;
    case 'social': {
      gain('charm', 3 + rng.int(0, 2));
      const partner = partnerOf(state);
      if (partner) partner.affection = clamp(partner.affection + 4);
      break;
    }
    case 'work': {
      if (me.jobId && rng.chance(promotionChance(me, true))) {
        me.jobLevel += 1;
        pushLog(state, '📈', `${fullName(me)}이(가) 승진했습니다. (${me.jobLevel}호봉)`, 'good');
      }
      const job = JOB_BY_ID[me.jobId];
      if (job) gain(job.stat, 2);
      me.happiness = clamp(me.happiness - 2);
      break;
    }
    case 'family': {
      me.happiness = clamp(me.happiness + 4);
      const partner = partnerOf(state);
      if (partner) {
        partner.affection = clamp(partner.affection + 5);
        partner.happiness = clamp(partner.happiness + 3);
      }
      for (const kid of childrenOf(state, me)) {
        if (kid.alive) {
          kid.happiness = clamp(kid.happiness + 5);
          kid.potential.charm = clamp(kid.potential.charm + 0.5);
        }
      }
      break;
    }
    case 'rest':
    default:
      gain('health', 3);
      me.happiness = clamp(me.happiness + 3);
      break;
  }
  syncRng(state, rng);
}

export function availableActivities(state) {
  const me = player(state);
  return ACTIVITIES.filter((a) => me.age >= a.minAge && (!a.needsJob || me.jobId));
}

// ── 이벤트 ────────────────────────────────────────────────

export function eligibleEvents(state) {
  const me = player(state);
  const partner = partnerOf(state);
  const kids = childrenOf(state, me).filter((c) => c.alive);
  const grandkids = kids.some((kid) => kid.children.length > 0);
  return EVENTS.filter((event) => {
    if (event.once && state.seenEvents.includes(event.id)) return false;
    if (event.minAge != null && me.age < event.minAge) return false;
    if (event.maxAge != null && me.age > event.maxAge) return false;
    if (event.needsJob && !me.jobId) return false;
    if (event.needsPartner && !partner) return false;
    if (event.needsChild && kids.length === 0) return false;
    if (event.needsGrandchild && !grandkids) return false;
    return true;
  });
}

function rollEvent(state) {
  const pool = eligibleEvents(state);
  if (!pool.length) return;
  const rng = rngFor(state);
  const event = rng.weighted(pool, (e) => e.weight ?? 1);
  syncRng(state, rng);
  state.pending = { eventId: event.id, resolved: null };
  if (event.once) state.seenEvents.push(event.id);
}

/** 판정 성공 확률 */
export function checkChance(person, check) {
  const stat = person.stats[check.stat] ?? 0;
  return clamp(0.5 + (stat - check.difficulty) / 80, 0.05, 0.95);
}

export function pendingEvent(state) {
  if (!state.pending) return null;
  const event = EVENTS.find((e) => e.id === state.pending.eventId);
  if (!event) return null;
  const me = player(state);
  return {
    ...event,
    title: fillText(state, event.title),
    text: fillText(state, event.text),
    choices: event.choices.map((choice, index) => ({
      index,
      label: fillText(state, choice.label),
      cost: choice.cost ?? 0,
      affordable: (choice.cost ?? 0) <= state.money,
      odds: choice.check ? Math.round(checkChance(me, choice.check) * 100) : null,
      checkLabel: choice.check ? choice.check.stat : null,
    })),
    resolved: state.pending.resolved,
  };
}

export function resolveEvent(state, choiceIndex) {
  if (!state.pending || state.pending.resolved) return null;
  const event = EVENTS.find((e) => e.id === state.pending.eventId);
  const choice = event?.choices[choiceIndex];
  if (!choice) return null;
  if ((choice.cost ?? 0) > state.money) return null;

  const me = player(state);
  const rng = rngFor(state);
  if (choice.cost) state.money -= choice.cost;

  let outcomeText;
  let effects;
  if (choice.check) {
    const success = rng.chance(checkChance(me, choice.check));
    const branch = success ? choice.success : choice.fail;
    outcomeText = branch.text;
    effects = branch.effects ?? {};
  } else {
    outcomeText = choice.result;
    effects = choice.effects ?? {};
  }
  syncRng(state, rng);
  applyEffects(state, effects);

  const text = fillText(state, outcomeText);
  state.pending.resolved = { text, label: fillText(state, choice.label) };
  pushLog(state, event.icon ?? '❔', `${fillText(state, event.title)} — ${text}`);
  return state.pending.resolved;
}

export function dismissEvent(state) {
  state.pending = null;
}

// ── 한 해 보내기 ───────────────────────────────────────────

export function canAdvance(state) {
  if (state.ended) return false;
  if (state.succession) return false;
  if (state.pending && !state.pending.resolved) return false;
  return true;
}

export function advanceYear(state, activityId = state.activity) {
  if (!canAdvance(state)) return state;
  state.pending = null;
  state.activity = activityId;
  const bonuses = villageBonuses(state.village);
  const rng = rngFor(state);

  applyActivity(state, activityId);

  // 1) 모두 한 살 더
  state.year += 1;
  for (const person of allPeople(state)) {
    if (!person.alive) continue;
    const inHouse = person.inFamily;
    ageOneYear(person, { rng, villageGrow: inHouse ? bonuses.grow : {} });
    updateEducation(person);
  }
  syncRng(state, rng);

  const me = player(state);

  // 2) 살림
  const members = household(state);
  const income = householdIncome(members, bonuses);
  const expense = householdExpense(members, bonuses, state.upkeep) + villageMaintenance(state.village);
  state.money += income - expense;
  state.stats.peakMoney = Math.max(state.stats.peakMoney, state.money);
  if (state.money < 0) {
    const debt = -state.money;
    state.money = 0;
    me.happiness = clamp(me.happiness - Math.min(12, 3 + debt / 400));
    pushLog(state, '💸', `살림이 빠듯합니다. 빚을 메우느라 가족이 힘든 한 해였습니다.`, 'bad');
  }

  // 3) 행복 자연 변화
  const familyHappiness = bonuses.happiness + (me.jobId ? (JOB_BY_ID[me.jobId].happiness ?? 0) : me.age >= 22 ? -1.5 : 0);
  for (const person of familyMembers(state)) {
    person.happiness = clamp(person.happiness + familyHappiness * (person.id === me.id ? 1 : 0.7) - 0.5);
  }

  // 4) 배우자 커리어 (자동)
  autoCareerForPartner(state);

  // 4-1) 조부모가 함께 살면 아이들이 더 행복하게 자란다
  const elders = eldersOf(state);
  if (elders.length) {
    for (const kid of childrenOf(state, me)) {
      if (kid.alive && kid.age < 19) {
        kid.happiness = clamp(kid.happiness + 1.5);
        kid.potential.charm = clamp(kid.potential.charm + 0.3);
      }
    }
  }

  // 4-2) 가족들도 저마다의 인생을 산다 (결혼하고 아이를 낳는다)
  npcLife(state);

  // 4-3) 성인이 되면 일할 수 있다고 알려준다
  if (me.age === 19 && !me.jobId) {
    pushLog(state, '💼', '이제 일을 구할 수 있습니다. [직업] 탭에서 자격에 맞는 일을 찾아보세요.');
  }
  if (me.age > 19 && !me.jobId && !me.retired && state.money < 500) {
    pushLog(state, '⚠️', '통장이 비어갑니다. 일자리를 구하지 않으면 가족이 어려워집니다.', 'bad');
  }

  // 5) 아이 독립 / 성장 알림
  for (const kid of childrenOf(state, me)) {
    if (kid.alive && kid.age === 19) {
      pushLog(state, '🎓', `${fullName(kid)}이(가) 성인이 되었습니다. (${EDUCATION_LABELS[kid.education]})`, 'good');
      autoCareerFor(state, kid);
    }
  }

  // 6) 사망 판정
  processDeaths(state, bonuses);

  state.stats.yearsPlayed += 1;
  state.turnFlags = { romanceUsed: false, metThisYear: false };

  // 7) 새해 이벤트
  if (!state.ended && !state.succession) rollEvent(state);
  return state;
}

function autoCareerFor(state, person) {
  if (person.jobId || person.age < 19 || !person.alive) return;
  const rng = rngFor(state);
  const options = Object.values(JOB_BY_ID).filter((job) => canApply(person, job));
  if (options.length) {
    const job = rng.weighted(options, (j) => j.salary / 1000);
    person.jobId = job.id;
    pushLog(state, job.icon, `${fullName(person)}이(가) ${job.label} 일을 시작했습니다.`);
  }
  syncRng(state, rng);
}

function autoCareerForPartner(state) {
  const partner = partnerOf(state);
  if (!partner?.alive) return;
  if (!partner.jobId && partner.age >= 19 && partner.age < 65) autoCareerFor(state, partner);
  if (partner.jobId && partner.age >= 65) {
    pushLog(state, '🌇', `${fullName(partner)}이(가) 은퇴했습니다.`);
    partner.jobId = null;
  }
  const rng = rngFor(state);
  if (partner.jobId && rng.chance(promotionChance(partner, false))) partner.jobLevel += 1;
  partner.affection = clamp(partner.affection - 1);
  syncRng(state, rng);
}

function processDeaths(state, bonuses) {
  const rng = rngFor(state);
  for (const person of allPeople(state)) {
    if (!person.alive) continue;
    const bonus = person.inFamily ? bonuses.lifespan : 0;
    if (rng.chance(deathChance(person, bonus))) {
      person.alive = false;
      person.deathYear = state.year;
      person.deathCause = person.age >= person.lifespan ? '천수를 누리고' : '갑작스럽게';
      const isPlayer = person.id === state.playerId;
      pushLog(state, '🕯️', `${fullName(person)}이(가) ${person.age}세에 ${person.deathCause} 세상을 떠났습니다.`, 'bad');
      if (!isPlayer && person.inFamily) {
        const me = player(state);
        if (me?.alive) me.happiness = clamp(me.happiness - 12);
      }
      if (isPlayer) {
        syncRng(state, rng);
        beginSuccession(state);
        return;
      }
    }
  }
  syncRng(state, rng);
}

/**
 * 플레이어가 아닌 가족들도 나이를 먹으며 짝을 만나고 아이를 낳는다.
 * 덕분에 손주가 태어나고, 가문의 대가 끊기지 않는다.
 */
export const MAX_POPULATION = 36;   // 동시에 살아 있는 가족 수 상한

function npcLife(state) {
  const rng = rngFor(state);
  const me = player(state);
  const living = allPeople(state).filter((p) => p.alive && p.inFamily);
  for (const person of living) {
    if (person.id === me.id || person.id === me.partnerId) continue;
    if (person.isCandidate || person.age < 22) continue;
    // 플레이어와 가까운 세대만 이야기가 이어진다 (가족이 무한히 불어나지 않도록)
    if (person.generation < state.generation - 1) continue;

    // 결혼
    if (!person.partnerId && person.age <= 45 && living.length < MAX_POPULATION && rng.chance(0.22)) {
      const spouse = createCandidate(rng, person, state.year);
      spouse.isCandidate = false;
      spouse.inFamily = true;
      spouse.bloodline = false;
      spouse.partnerId = person.id;
      spouse.affection = 75;
      person.partnerId = spouse.id;
      state.people[spouse.id] = spouse;
      pushLog(state, '💍', `${fullName(person)}이(가) ${fullName(spouse)}와(과) 가정을 이루었습니다.`, 'good');
      continue;
    }

    // 출산
    const spouse = state.people[person.partnerId];
    if (!spouse?.alive || person.children.length >= 3) continue;
    if (living.length >= MAX_POPULATION) continue;
    const mother = person.gender === 'female' ? person : spouse;
    if (mother.age > 44) continue;
    if (!rng.chance(0.22 * birthChance(mother))) continue;

    const father = person.gender === 'female' ? spouse : person;
    const baby = createChild(rng, mother, father, state.year);
    baby.familyName = (person.bloodline ? person : spouse).familyName;
    baby.inFamily = true;
    baby.bloodline = true;
    state.people[baby.id] = baby;
    person.children.push(baby.id);
    spouse.children.push(baby.id);
    state.stats.born += 1;
    const relation = me.children.includes(person.id) ? '손주' : '가족';
    pushLog(state, '👶', `${fullName(person)}의 아이 ${fullName(baby)}이(가) 태어났습니다. (${relation})`, 'good');
  }
  syncRng(state, rng);
}

// ── 세대 계승 ─────────────────────────────────────────────

/**
 * 대를 이을 사람 찾기.
 * 직계 자녀 → 손주 → 그 외 핏줄 순으로, 한창 나이(19~45)를 앞세운다.
 */
export function heirCandidates(state) {
  const me = player(state);
  if (!me) return [];
  const childIds = new Set(me.children);
  const grandchildIds = new Set(
    childrenOf(state, me).flatMap((child) => child.children),
  );
  const rank = (person) => {
    if (childIds.has(person.id)) return 0;
    if (grandchildIds.has(person.id)) return 1;
    return 2;
  };
  const prime = (person) => (person.age >= 19 && person.age <= 45 ? 0 : 1);
  return allPeople(state)
    .filter((p) => p.alive && p.inFamily && p.bloodline && p.id !== me.id)
    .sort((a, b) => rank(a) - rank(b) || prime(a) - prime(b) || b.age - a.age)
    .slice(0, 8);
}

/** 살아 있는 동안 스스로 대를 넘길 수 있는가 */
export function canSucceed(state) {
  const me = player(state);
  if (!me?.alive || state.ended) return { ok: false, reason: '지금은 할 수 없습니다.' };
  const heirs = heirCandidates(state).filter((h) => h.age >= 19);
  if (!heirs.length) return { ok: false, reason: '성인이 된 자손이 있어야 합니다.' };
  return { ok: true, heirs };
}

/** 자발적 계승: 부모는 어르신으로 남아 가족과 함께 지낸다 */
export function succeedTo(state, heirId) {
  const check = canSucceed(state);
  if (!check.ok) return check;
  if (!check.heirs.some((h) => h.id === heirId)) return { ok: false, reason: '대를 이을 수 없는 사람입니다.' };
  const previous = player(state);
  handOver(state, heirId, 0.9);
  previous.retired = true;
  previous.jobId = null;
  previous.happiness = clamp(previous.happiness + 8);
  pushLog(state, '🤝', `${fullName(previous)}이(가) 가문을 다음 세대에 맡기고 물러났습니다.`, 'good');
  return { ok: true };
}

function beginSuccession(state) {
  const heirs = heirCandidates(state);
  if (!heirs.length) {
    endGame(state, '가문의 이야기가 여기서 멈췄습니다. 뒤를 이을 사람이 없었습니다.');
    return;
  }
  state.succession = { heirIds: heirs.map((h) => h.id) };
}

/** 실제 계승 처리 (사망 시 / 자발적 계승 공통) */
function handOver(state, heirId, baseRate) {
  const previous = player(state);
  const heir = state.people[heirId];
  const rate = Math.min(1, baseRate + (state.inheritBonus ?? 0));
  const inherited = Math.round(state.money * rate);
  state.money = inherited;
  state.playerId = heir.id;
  heir.isPlayer = true;
  heir.independent = false;
  previous.isPlayer = false;
  state.generation = heir.generation;
  state.pending = null;
  state.succession = null;
  state.turnFlags = { romanceUsed: false, metThisYear: false };
  state.activity = heir.age >= 6 ? 'study' : 'rest';

  // 대를 잇지 않은 형제자매는 각자의 삶을 살아간다
  for (const sibling of childrenOf(state, previous)) {
    if (sibling.id !== heir.id && sibling.alive && sibling.age >= 19) sibling.independent = true;
  }
  pushLog(
    state, '🌳',
    `${state.generation}대 ${fullName(heir)}이(가) 가문을 잇습니다. (상속 ${inherited.toLocaleString('ko-KR')}만원)`,
    'good',
  );
  if (heir.age >= 19 && !heir.jobId) autoCareerFor(state, heir);
  rollEvent(state);
  return state;
}

/** 사망 후 상속자 선택 */
export function chooseHeir(state, heirId) {
  if (!state.succession?.heirIds.includes(heirId)) return state;
  return handOver(state, heirId, 0.7);
}

export function legacyScore(state) {
  const people = allPeople(state);
  const descendants = people.filter((p) => p.generation > 1).length;
  const happy = average(people.filter((p) => p.alive).map((p) => p.happiness), 50);
  const buildings = Object.values(state.village.buildings).reduce((a, b) => a + b, 0);
  return Math.round(
    state.generation * 1200 +
    descendants * 200 +
    buildings * 180 +
    villageLevel(state.village) * 400 +
    Math.sqrt(Math.max(0, state.stats.peakMoney)) * 6 +
    happy * 8,
  );
}

export function endGame(state, reason) {
  state.ended = { reason, score: legacyScore(state), year: state.year };
  pushLog(state, '📜', `${reason} 최종 유산 점수 ${state.ended.score.toLocaleString('ko-KR')}점.`, 'good');
}

// ── 연애 / 결혼 / 출산 ─────────────────────────────────────

export function meetPeople(state) {
  const me = player(state);
  if (me.age < 18 || me.partnerId) return { ok: false, reason: '지금은 만남을 가질 때가 아닙니다.' };
  if (state.turnFlags.metThisYear) return { ok: false, reason: '올해는 이미 새로운 사람을 만났습니다.' };
  if (state.money < MEET_COST) return { ok: false, reason: '자금이 부족합니다.' };
  const rng = rngFor(state);
  state.money -= MEET_COST;
  const bonuses = villageBonuses(state.village);
  const count = 1 + (rng.chance(0.35 + bonuses.romance) ? 1 : 0);
  const made = [];
  for (let i = 0; i < count; i++) {
    const candidate = createCandidate(rng, me, state.year);
    candidate.isCandidate = true;
    candidate.inFamily = false;
    candidate.affection = clamp(candidate.affection + me.stats.charm / 10 + bonuses.romance * 20);
    state.people[candidate.id] = candidate;
    made.push(candidate);
  }
  syncRng(state, rng);
  state.turnFlags.metThisYear = true;
  pushLog(state, '💫', `${made.map(fullName).join(', ')}와(과) 인연이 닿았습니다.`);
  return { ok: true, candidates: made };
}

export function date(state, candidateId) {
  const me = player(state);
  const candidate = state.people[candidateId];
  if (!candidate || !candidate.isCandidate) return { ok: false, reason: '만날 수 없는 상대입니다.' };
  if (state.turnFlags.romanceUsed) return { ok: false, reason: '올해의 데이트는 이미 했습니다.' };
  if (state.money < DATE_COST) return { ok: false, reason: '자금이 부족합니다.' };
  const rng = rngFor(state);
  state.money -= DATE_COST;
  const bonuses = villageBonuses(state.village);
  const gain = 6 + me.stats.charm / 12 + rng.int(0, 6) + bonuses.romance * 30;
  candidate.affection = clamp(candidate.affection + gain);
  me.happiness = clamp(me.happiness + 2);
  syncRng(state, rng);
  state.turnFlags.romanceUsed = true;
  pushLog(state, '💗', `${fullName(candidate)}와(과) 시간을 보냈습니다. (호감도 ${Math.round(candidate.affection)})`);
  return { ok: true, affection: candidate.affection };
}

export function propose(state, candidateId) {
  const me = player(state);
  const candidate = state.people[candidateId];
  if (!candidate) return { ok: false, reason: '상대를 찾을 수 없습니다.' };
  if (me.age < 20) return { ok: false, reason: '아직 결혼할 나이가 아닙니다.' };
  if (candidate.affection < 70) return { ok: false, reason: '호감도가 70 이상이어야 합니다.' };
  if (state.money < MARRIAGE_COST) return { ok: false, reason: `결혼 준비에 ${MARRIAGE_COST}만원이 필요합니다.` };
  state.money -= MARRIAGE_COST;
  me.partnerId = candidate.id;
  candidate.partnerId = me.id;
  candidate.isCandidate = false;
  candidate.inFamily = true;
  candidate.happiness = clamp(candidate.happiness + 15);
  me.happiness = clamp(me.happiness + 15);
  state.stats.married += 1;
  // 다른 후보들은 떠난다
  for (const other of candidates(state)) delete state.people[other.id];
  pushLog(state, '💍', `${fullName(me)}와(과) ${fullName(candidate)}이(가) 결혼했습니다!`, 'good');
  return { ok: true };
}

/** 출산 성공 확률: 나이가 들수록 낮아진다 */
export function birthChance(mother) {
  return clamp(0.95 - Math.max(0, mother.age - 32) * 0.05, 0.15, 0.95);
}

export function canHaveChild(state) {
  const me = player(state);
  const partner = partnerOf(state);
  if (!partner?.alive) return { ok: false, reason: '배우자가 필요합니다.' };
  const mother = me.gender === 'female' ? me : partner;
  if (mother.age > 45) return { ok: false, reason: '아이를 갖기 어려운 나이입니다.' };
  if (me.age < 20) return { ok: false, reason: '아직 이릅니다.' };
  if (state.money < CHILD_COST_ONCE) return { ok: false, reason: `준비 비용 ${CHILD_COST_ONCE}만원이 필요합니다.` };
  if (state.turnFlags.childThisYear) return { ok: false, reason: '올해는 이미 아이를 맞이했습니다.' };
  return { ok: true };
}

export function haveChild(state) {
  const check = canHaveChild(state);
  if (!check.ok) return check;
  const me = player(state);
  const partner = partnerOf(state);
  const rng = rngFor(state);
  state.money -= CHILD_COST_ONCE;

  const mother = me.gender === 'female' ? me : partner;
  const father = me.gender === 'female' ? partner : me;
  const chance = birthChance(mother);
  if (!rng.chance(chance)) {
    syncRng(state, rng);
    state.turnFlags.childThisYear = true;
    pushLog(state, '🍀', '올해는 좋은 소식이 없었습니다.');
    return { ok: false, reason: '올해는 아이가 찾아오지 않았습니다.' };
  }
  const bloodParent = me;
  const child = createChild(rng, mother, father, state.year);
  child.familyName = bloodParent.familyName;
  child.inFamily = true;
  state.people[child.id] = child;
  me.children.push(child.id);
  partner.children.push(child.id);
  me.happiness = clamp(me.happiness + 10);
  partner.happiness = clamp(partner.happiness + 10);
  state.stats.born += 1;
  state.turnFlags.childThisYear = true;
  syncRng(state, rng);
  pushLog(state, '👶', `${fullName(child)}이(가) 태어났습니다! (${state.generation + 1}대)`, 'good');
  return { ok: true, child, chance };
}

// ── 직업 / 마을 ────────────────────────────────────────────

export function jobOptions(state) {
  const me = player(state);
  return Object.values(JOB_BY_ID).map((job) => ({
    ...job,
    eligible: canApply(me, job),
    current: me.jobId === job.id,
    expected: salaryOf({ ...me, jobId: job.id, jobLevel: 0 }, villageBonuses(state.village)),
  }));
}

export function takeJob(state, jobId) {
  const me = player(state);
  const job = JOB_BY_ID[jobId];
  if (!job) return { ok: false, reason: '없는 직업입니다.' };
  if (me.age < 19) return { ok: false, reason: '19세부터 일할 수 있습니다.' };
  if (!canApply(me, job)) return { ok: false, reason: '자격을 갖추지 못했습니다.' };
  if (me.jobId === jobId) return { ok: false, reason: '이미 하고 있는 일입니다.' };
  const changing = Boolean(me.jobId);
  me.jobId = jobId;
  me.jobLevel = changing ? Math.floor(me.jobLevel / 2) : 0;
  pushLog(state, job.icon, `${fullName(me)}이(가) ${job.label}${changing ? '(으)로 이직했습니다.' : ' 일을 시작했습니다.'}`, 'good');
  return { ok: true };
}

export function retire(state) {
  const me = player(state);
  if (!me.jobId) return { ok: false, reason: '이미 일하지 않습니다.' };
  if (me.age < 55) return { ok: false, reason: '55세부터 은퇴할 수 있습니다.' };
  me.jobId = null;
  me.happiness = clamp(me.happiness + 8);
  pushLog(state, '🌇', `${fullName(me)}이(가) 은퇴했습니다. 이제 가족과의 시간입니다.`, 'good');
  return { ok: true };
}

export function buildBuilding(state, buildingId) {
  const result = buildInVillage(state.village, buildingId, state.money);
  if (!result.ok) return result;
  state.money -= result.spent;
  state.stats.buildingsBuilt += 1;
  const me = player(state);
  me.happiness = clamp(me.happiness + 3);
  pushLog(state, '🏗️', `${state.village.name}에 건물을 올렸습니다. (Lv.${result.level})`, 'good');
  return result;
}

export function financeSummary(state) {
  const bonuses = villageBonuses(state.village);
  const members = household(state);
  const income = householdIncome(members, bonuses);
  const maintenance = villageMaintenance(state.village);
  const expense = householdExpense(members, bonuses, state.upkeep) + maintenance;
  return { income, expense, maintenance, net: income - expense, bonuses };
}
