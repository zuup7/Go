// 업적 판정과 보상 지급.
// game.js 와 순환 참조가 생기지 않도록, 필요한 조회 함수는 deps 로 받는다.
import { ACHIEVEMENTS, ACHIEVEMENT_BY_ID, REWARD_BY_ID, rewardPoolFor } from '../data/achievements.js';
import { TRAITS, commonTraits } from '../data/traits.js';
import { BUILDING_BY_ID } from '../data/buildings.js';
import { villageLevel } from './village.js';
import { clamp } from './util.js';

export const REWARD_CHOICES = 3;

/** 업적 조건을 볼 때 쓰는 요약 정보 */
export function achievementHelpers(state, deps) {
  const me = deps.player(state);
  return {
    me,
    partner: me?.partnerId ? state.people[me.partnerId] : null,
    children: me ? deps.childrenOf(state, me).filter((c) => c) : [],
    livingFamily: Object.values(state.people).filter((p) => p.alive && p.inFamily).length,
  };
}

/** 보상의 위력은 세대와 마을 규모를 따라간다 */
function scaleFor(state, tier) {
  const growth = 1 + villageLevel(state.village) * 0.35 + (state.generation - 1) * 0.3;
  const tierMul = tier >= 3 ? 3.5 : tier === 2 ? 2 : 1;
  return (base) => Math.round(base * growth * tierMul);
}

/**
 * 새로 달성한 업적을 찾아 보상 선택을 대기열에 넣는다.
 * @returns 새로 달성한 업적 목록
 */
export function checkAchievements(state, deps) {
  if (!state.achievements) state.achievements = [];
  if (!state.rewardQueue) state.rewardQueue = [];
  const helpers = achievementHelpers(state, deps);
  if (!helpers.me) return [];

  const unlocked = [];
  for (const achievement of ACHIEVEMENTS) {
    if (state.achievements.includes(achievement.id)) continue;
    let done = false;
    try {
      done = Boolean(achievement.check(state, helpers));
    } catch {
      done = false;
    }
    if (!done) continue;
    state.achievements.push(achievement.id);
    queueRewardChoice(state, {
      icon: achievement.icon,
      title: achievement.title,
      desc: achievement.desc,
      tier: achievement.tier,
      kind: 'achievement',
    }, deps.rng(state));
    unlocked.push(achievement);
  }
  return unlocked;
}

/**
 * 보상 선택을 대기열에 넣는다. 업적뿐 아니라 숙원 달성 등에도 쓴다.
 * source: { icon, title, desc, tier, kind }
 */
export function queueRewardChoice(state, source, rng) {
  if (!state.rewardQueue) state.rewardQueue = [];
  state.rewardQueue.push({ source, options: pickRewards(source.tier ?? 1, rng) });
}

/** 보상 카드 3장 뽑기 (종류가 겹치지 않게) */
function pickRewards(tier, rng) {
  const pool = rng.shuffle(rewardPoolFor(tier));
  const picked = [];
  const kinds = new Set();
  for (const reward of pool) {
    if (picked.length >= REWARD_CHOICES) break;
    if (kinds.has(reward.kind)) continue;
    kinds.add(reward.kind);
    picked.push(reward.id);
  }
  for (const reward of pool) {
    if (picked.length >= REWARD_CHOICES) break;
    if (!picked.includes(reward.id)) picked.push(reward.id);
  }
  return picked;
}

/** 지금 골라야 할 보상 (없으면 null) */
export function pendingRewardChoice(state, deps) {
  const entry = state.rewardQueue?.[0];
  if (!entry) return null;
  const source = entry.source;
  if (!source) {
    state.rewardQueue.shift();
    return null;
  }
  const ctx = rewardContext(state, deps, source.tier ?? 1);
  return {
    achievement: source,
    remaining: state.rewardQueue.length,
    options: entry.options.map((id) => REWARD_BY_ID[id]).filter(Boolean).map((reward) => ({
      id: reward.id,
      icon: reward.icon,
      title: reward.title,
      kind: reward.kind,
      label: reward.label(ctx),
    })),
  };
}

function rewardContext(state, deps, tier) {
  const me = deps.player(state);
  return {
    rng: deps.rng(state),
    tier,
    scale: scaleFor(state, tier),
    player: me,
    partner: me?.partnerId ? state.people[me.partnerId] : null,
    children: me ? deps.childrenOf(state, me).filter((c) => c.alive) : [],
    people: Object.values(state.people).filter((p) => p.alive && p.inFamily),
    traits: state.generation >= 2 ? TRAITS : commonTraits(),
    buildingName: (id) => BUILDING_BY_ID[id]?.label ?? '건물',
  };
}

/** 보상 하나를 고른다 */
export function claimReward(state, rewardId, deps) {
  const entry = state.rewardQueue?.[0];
  if (!entry) return { ok: false, reason: '고를 보상이 없습니다.' };
  if (!entry.options.includes(rewardId)) return { ok: false, reason: '선택할 수 없는 보상입니다.' };
  const source = entry.source ?? {};
  const reward = REWARD_BY_ID[rewardId];
  const ctx = rewardContext(state, deps, source.tier ?? 1);

  const text = reward.apply(state, ctx);
  deps.syncRng(state, ctx.rng);
  state.rewardQueue.shift();

  const me = deps.player(state);
  if (me) me.happiness = clamp(me.happiness + 4);
  state.stats.rewardsTaken = (state.stats.rewardsTaken ?? 0) + 1;
  return { ok: true, text, reward, achievement: source };
}

/** 화면에 뿌릴 업적 목록 (달성 여부와 진행도 포함) */
export function achievementList(state, deps) {
  const helpers = achievementHelpers(state, deps);
  return ACHIEVEMENTS.map((achievement) => {
    let progress = null;
    if (achievement.progress && helpers.me) {
      try {
        progress = achievement.progress(state, helpers);
      } catch {
        progress = null;
      }
    }
    return {
      ...achievement,
      done: state.achievements?.includes(achievement.id) ?? false,
      progress,
    };
  }).sort((a, b) => Number(a.done) - Number(b.done) || a.tier - b.tier);
}
