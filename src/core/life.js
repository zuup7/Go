// 꿈 · 위기 · 가문의 숙원. 게임에 긴장과 목표를 만드는 부분.
// game.js 와 순환 참조를 피하려고 조회 함수는 deps 로 받는다.
import { DREAMS, DREAM_BY_ID } from '../data/dreams.js';
import { CRISES, CRISIS_BY_ID } from '../data/crises.js';
import { QUESTS, QUEST_BY_ID } from '../data/quests.js';
import { queueRewardChoice } from './achievements.js';
import { clamp } from './util.js';

// ── 꿈 ───────────────────────────────────────────────────

export const DREAM_AGE = 9;

/** 아이가 자라면 꿈을 하나 품는다 (성향에 맞는 것 위주로) */
export function assignDream(state, person, rng) {
  if (person.dreamId || person.age < DREAM_AGE) return null;
  const pool = DREAMS.filter((dream) => {
    if (dream.check(state, person)) return false;       // 이미 이룬 것은 꿈이 아니다
    return dream.fits(person);
  });
  const dream = rng.weighted(pool.length ? pool : DREAMS, () => 1);
  person.dreamId = dream.id;
  person.dreamDone = false;
  return dream;
}

/** 이번 해에 이루어진 꿈들 */
export function checkDreams(state, deps) {
  const fulfilled = [];
  for (const person of deps.familyMembers(state)) {
    if (!person.dreamId || person.dreamDone) continue;
    const dream = DREAM_BY_ID[person.dreamId];
    if (!dream) continue;
    let done = false;
    try {
      done = Boolean(dream.check(state, person));
    } catch {
      done = false;
    }
    if (!done) continue;
    person.dreamDone = true;
    person.dreamYear = state.year;
    state.stats.dreamsFulfilled = (state.stats.dreamsFulfilled ?? 0) + 1;
    deps.applyEffects(state, dream.reward, person);
    fulfilled.push({ person, dream });
  }
  return fulfilled;
}

export const dreamOf = (person) => (person?.dreamId ? DREAM_BY_ID[person.dreamId] : null);

// ── 위기 ─────────────────────────────────────────────────

export const CRISIS_COOLDOWN = 6;      // 위기 사이 최소 간격
export const CRISIS_BASE_CHANCE = 0.09;

/** 지금 어떤 위기가 닥칠 만한가 */
function crisisCandidates(state, deps) {
  const me = deps.player(state);
  const family = deps.familyMembers(state);
  const finance = deps.financeSummary(state);
  const list = [];

  const sick = family.find((p) => p.stats.health < 32 || (p.age >= 62 && p.stats.health < 48));
  if (sick) list.push({ id: 'illness', weight: 3, target: sick });

  if (state.money < 1200 || finance.net < 0) list.push({ id: 'debt', weight: 3 });

  const totalBuildings = Object.values(state.village.buildings).reduce((a, b) => a + b, 0);
  if (totalBuildings >= 6) list.push({ id: 'disaster', weight: 2 });

  const restless = family.find((p) => p.age >= 12 && p.age <= 30 && p.happiness < 45 && p.id !== me.id);
  if (restless) list.push({ id: 'runaway', weight: 2, target: restless });

  if (state.money > 6000) list.push({ id: 'lawsuit', weight: 2 });

  return list;
}

/** 해마다 위기가 찾아올지 굴린다 */
export function maybeStartCrisis(state, deps) {
  if (state.crisis) return null;
  if (state.year - (state.lastCrisisYear ?? -99) < CRISIS_COOLDOWN) return null;
  const rng = deps.rng(state);
  const candidates = crisisCandidates(state, deps);
  if (!candidates.length) {
    deps.syncRng(state, rng);
    return null;
  }
  // 형편이 어려울수록 더 자주 흔들린다
  const chance = CRISIS_BASE_CHANCE + Math.min(0.12, candidates.length * 0.02);
  if (!rng.chance(chance)) {
    deps.syncRng(state, rng);
    return null;
  }
  const pick = rng.weighted(candidates, (c) => c.weight);
  deps.syncRng(state, rng);
  return startCrisis(state, deps, pick.id, pick.target);
}

/** 위기를 실제로 시작한다 (이벤트에서 직접 부를 수도 있다) */
export function startCrisis(state, deps, crisisId, target = null) {
  const template = CRISIS_BY_ID[crisisId];
  if (!template || state.crisis) return null;
  const person = template.targeted ? (target ?? deps.player(state)) : null;
  state.crisis = {
    id: template.id,
    startYear: state.year,
    dueYear: state.year + template.years,
    need: template.need(state),
    paid: 0,
    targetId: person?.id ?? null,
    triedThisYear: false,
  };
  return state.crisis;
}

/** 화면에 보여줄 위기 정보 */
export function crisisStatus(state, deps) {
  const active = state.crisis;
  if (!active) return null;
  const template = CRISIS_BY_ID[active.id];
  if (!template) return null;
  const target = active.targetId ? state.people[active.targetId] : null;
  const remaining = Math.max(0, active.need - active.paid);
  const chance = template.check
    ? deps.checkChance(target ?? deps.player(state), template.check)
    : null;
  return {
    id: active.id,
    icon: template.icon,
    title: template.title,
    desc: deps.fillText(state, template.desc, target),
    target,
    need: active.need,
    paid: active.paid,
    remaining,
    yearsLeft: Math.max(0, active.dueYear - state.year),
    canPay: state.money > 0 && remaining > 0,
    payAmount: Math.min(state.money, remaining),
    canTry: Boolean(template.check) && !active.triedThisYear,
    tried: active.triedThisYear,
    odds: chance != null ? Math.round(chance * 100) : null,
    checkStat: template.check?.stat ?? null,
  };
}

/** 돈으로 위기를 밀어낸다 (부분 상환도 된다) */
export function payCrisis(state, deps, amount = null) {
  const status = crisisStatus(state, deps);
  if (!status) return { ok: false, reason: '지금은 해결할 위기가 없습니다.' };
  const pay = Math.min(state.money, amount ?? status.remaining);
  if (pay <= 0) return { ok: false, reason: '낼 수 있는 돈이 없습니다.' };
  state.money -= pay;
  state.crisis.paid += pay;
  if (state.crisis.paid >= state.crisis.need) return resolveCrisis(state, deps, '돈으로 막아냈습니다.');
  return { ok: true, resolved: false, paid: pay, remaining: state.crisis.need - state.crisis.paid };
}

/** 돈 대신 몸으로 부딪힌다 */
export function tryCrisis(state, deps) {
  const status = crisisStatus(state, deps);
  if (!status) return { ok: false, reason: '지금은 해결할 위기가 없습니다.' };
  if (!status.canTry) return { ok: false, reason: '올해는 이미 부딪혀 봤습니다.' };
  const template = CRISIS_BY_ID[state.crisis.id];
  const actor = status.target ?? deps.player(state);
  const rng = deps.rng(state);
  const success = rng.chance(deps.checkChance(actor, template.check));
  deps.syncRng(state, rng);
  state.crisis.triedThisYear = true;
  if (success) return resolveCrisis(state, deps, `${actor.givenName}이(가) 직접 부딪혀 넘겼습니다.`);
  actor.happiness = clamp(actor.happiness - 6);
  return { ok: true, resolved: false, failed: true };
}

function resolveCrisis(state, deps, how) {
  const template = CRISIS_BY_ID[state.crisis.id];
  const me = deps.player(state);
  state.crisis = null;
  state.lastCrisisYear = state.year;
  state.stats.crisesSurvived = (state.stats.crisesSurvived ?? 0) + 1;
  if (me) me.happiness = clamp(me.happiness + 10);
  for (const person of deps.familyMembers(state)) person.happiness = clamp(person.happiness + 4);
  deps.pushLog(state, '✅', `${template.title} — ${how} 가족이 한숨 돌렸습니다.`, 'good');
  return { ok: true, resolved: true, text: how };
}

/** 해가 바뀔 때 위기의 시계를 돌린다 */
export function tickCrisis(state, deps) {
  if (!state.crisis) return null;
  state.crisis.triedThisYear = false;
  if (state.year < state.crisis.dueYear) return null;

  const template = CRISIS_BY_ID[state.crisis.id];
  const target = state.crisis.targetId ? state.people[state.crisis.targetId] : null;
  const rng = deps.rng(state);
  const ctx = {
    rng,
    target,
    name: target ? `${target.familyName}${target.givenName}` : '가족',
    family: deps.familyMembers(state),
  };
  const text = template.penalty(state, ctx);
  deps.syncRng(state, rng);

  state.crisis = null;
  state.lastCrisisYear = state.year;
  state.stats.crisesFailed = (state.stats.crisesFailed ?? 0) + 1;
  deps.pushLog(state, template.icon, `${template.title} — ${text}`, 'bad');
  return { failed: true, icon: template.icon, title: template.title, text };
}

// ── 가문의 숙원 ───────────────────────────────────────────

/** 새 숙원을 하나 받는다 */
export function assignQuest(state, deps) {
  const rng = deps.rng(state);
  const done = state.questsDone ?? [];
  const pool = QUESTS.filter((quest) => !done.includes(quest.id));
  const quest = rng.pick(pool.length ? pool : QUESTS);
  deps.syncRng(state, rng);
  state.quest = { id: quest.id, startYear: state.year, dueYear: state.year + quest.years };
  return quest;
}

export function questStatus(state, deps) {
  const active = state.quest;
  if (!active) return null;
  const quest = QUEST_BY_ID[active.id];
  if (!quest) return null;
  const helpers = questHelpers(state, deps);
  let progress = { current: 0, goal: 1 };
  try {
    progress = quest.progress(state, helpers);
  } catch {
    progress = { current: 0, goal: 1 };
  }
  return {
    id: quest.id,
    icon: quest.icon,
    title: quest.title,
    desc: quest.desc,
    current: progress.current,
    goal: progress.goal,
    ratio: Math.min(1, progress.current / progress.goal),
    yearsLeft: Math.max(0, active.dueYear - state.year),
    done: progress.current >= progress.goal,
  };
}

function questHelpers(state, deps) {
  const family = deps.familyMembers(state);
  return {
    me: deps.player(state),
    livingFamily: family.length,
    workers: family.filter((p) => p.jobId).length,
  };
}

/** 숙원 달성/기한 확인 */
export function tickQuest(state, deps) {
  if (!state.quest) {
    assignQuest(state, deps);
    return null;
  }
  const status = questStatus(state, deps);
  if (!status) return null;

  if (status.done) {
    state.questsDone = [...(state.questsDone ?? []), status.id];
    state.stats.questsDone = (state.stats.questsDone ?? 0) + 1;
    state.quest = null;
    queueRewardChoice(state, {
      icon: status.icon,
      title: `숙원 달성 — ${status.title}`,
      desc: status.desc,
      tier: 3,
      kind: 'quest',
    }, deps.rng(state));
    deps.pushLog(state, status.icon, `가문의 숙원을 이뤘습니다 — ${status.title}`, 'good');
    assignQuest(state, deps);
    return { done: true, title: status.title };
  }

  if (status.yearsLeft <= 0) {
    state.quest = null;
    deps.pushLog(state, '⏳', `숙원 "${status.title}"의 시한이 지났습니다. 다음 목표를 세웁니다.`, 'bad');
    assignQuest(state, deps);
    return { expired: true, title: status.title };
  }
  return null;
}
