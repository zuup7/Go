// 업적과 보상. 조건을 채우면 보상 카드 3장 중 하나를 고른다.
import { villageLevel } from '../core/village.js';

// ── 보상 ─────────────────────────────────────────────────
// apply(state, ctx) 가 실제 효과를 주고, 화면에 보여줄 설명을 돌려준다.
// ctx: { rng, tier, people, player, scale }

const totalBuildings = (state) => Object.values(state.village.buildings).reduce((a, b) => a + b, 0);

export const REWARDS = [
  {
    id: 'cash', icon: '💰', title: '두둑한 축하금', kind: 'gold',
    label: (ctx) => `자금 +${ctx.scale(900).toLocaleString('ko-KR')}만원`,
    apply: (state, ctx) => {
      const amount = ctx.scale(900);
      state.money += amount;
      return `자금이 ${amount.toLocaleString('ko-KR')}만원 늘었습니다.`;
    },
  },
  {
    id: 'jackpot', icon: '🎰', title: '무작위 자산 획득', kind: 'gold',
    label: () => '자금이 크게 늘 수도, 조금 늘 수도',
    apply: (state, ctx) => {
      const amount = ctx.scale(400) * ctx.rng.int(1, 6);
      state.money += amount;
      return `${amount.toLocaleString('ko-KR')}만원을 얻었습니다!`;
    },
  },
  {
    id: 'moodAll', icon: '😊', title: '가족 전체 기분 +20', kind: 'family',
    label: () => '살아 있는 가족 모두의 행복이 오릅니다',
    apply: (state, ctx) => {
      for (const person of ctx.people) person.happiness = Math.min(100, person.happiness + 20);
      return `가족 ${ctx.people.length}명의 마음이 환해졌습니다.`;
    },
  },
  {
    id: 'healthAll', icon: '❤️', title: '가족 전체 건강 +20', kind: 'family',
    label: () => '살아 있는 가족 모두의 건강이 오릅니다',
    apply: (state, ctx) => {
      for (const person of ctx.people) person.stats.health = Math.min(100, person.stats.health + 20);
      return `가족 ${ctx.people.length}명이 건강해졌습니다.`;
    },
  },
  {
    id: 'statBoost', icon: '📈', title: '주인공 전 능력치 +8', kind: 'self',
    label: () => '다섯 가지 능력치가 한 번에 오릅니다',
    apply: (state, ctx) => {
      for (const key of Object.keys(ctx.player.stats)) {
        ctx.player.stats[key] = Math.min(100, ctx.player.stats[key] + 8);
        ctx.player.potential[key] = Math.min(100, ctx.player.potential[key] + 4);
      }
      return '몸도 머리도 한 단계 올라섰습니다.';
    },
  },
  {
    id: 'lifespan', icon: '🌿', title: '수명 +6년', kind: 'self',
    label: () => '더 오래 가족과 지낼 수 있습니다',
    apply: (state, ctx) => {
      ctx.player.lifespan += 6;
      ctx.player.stats.health = Math.min(100, ctx.player.stats.health + 10);
      return '앞으로의 시간이 길어졌습니다.';
    },
  },
  {
    id: 'talent', icon: '✨', title: '새로운 재능 각성', kind: 'self',
    label: () => '주인공에게 특성이 하나 생깁니다',
    apply: (state, ctx) => {
      const pool = ctx.traits.filter((t) => !ctx.player.traits.includes(t.id));
      if (!pool.length) {
        state.money += ctx.scale(500);
        return '더 얻을 재능이 없어 축하금으로 대신했습니다.';
      }
      const trait = ctx.rng.pick(pool);
      ctx.player.traits.push(trait.id);
      return `"${trait.label}" 특성을 얻었습니다!`;
    },
  },
  {
    id: 'freeBuild', icon: '🏗️', title: '건물 무료 증축', kind: 'village',
    label: () => '이미 지은 건물 하나가 한 단계 올라갑니다',
    apply: (state, ctx) => {
      const built = Object.keys(state.village.buildings).filter((id) => state.village.buildings[id] > 0);
      if (!built.length) {
        state.money += ctx.scale(600);
        return '올릴 건물이 없어 자금으로 대신했습니다.';
      }
      const target = ctx.rng.pick(built);
      state.village.buildings[target] += 1;
      return `${ctx.buildingName(target)}이(가) Lv.${state.village.buildings[target]}이 되었습니다.`;
    },
  },
  {
    id: 'fame', icon: '📣', title: '마을 명성 +20', kind: 'village',
    label: () => '마을에서의 평판이 크게 오릅니다',
    apply: (state) => {
      state.village.fame = (state.village.fame ?? 0) + 20;
      return '마을 사람들이 우리 가문을 다시 봅니다.';
    },
  },
  {
    id: 'schooling', icon: '🎓', title: '학업 점수 +50', kind: 'self',
    label: () => '학력이 오를 발판이 됩니다',
    apply: (state, ctx) => {
      ctx.player.eduPoints += 50;
      ctx.player.stats.intellect = Math.min(100, ctx.player.stats.intellect + 6);
      return '공부한 시간이 통째로 쌓였습니다.';
    },
  },
  {
    id: 'affection', icon: '💞', title: '배우자 애정 +30', kind: 'family',
    label: () => '배우자와의 사이가 깊어집니다',
    apply: (state, ctx) => {
      const partner = ctx.partner;
      if (!partner) {
        for (const person of ctx.people) person.happiness = Math.min(100, person.happiness + 12);
        return '배우자가 없어 가족 모두의 행복으로 바뀌었습니다.';
      }
      partner.affection = Math.min(100, partner.affection + 30);
      partner.happiness = Math.min(100, partner.happiness + 10);
      return `${partner.givenName}와(과) 한층 가까워졌습니다.`;
    },
  },
  {
    id: 'childPotential', icon: '🧒', title: '자녀 잠재력 +8', kind: 'family',
    label: () => '아이들이 더 크게 자랄 수 있게 됩니다',
    apply: (state, ctx) => {
      const kids = ctx.children;
      if (!kids.length) {
        ctx.player.happiness = Math.min(100, ctx.player.happiness + 15);
        return '아이가 없어 주인공의 행복으로 바뀌었습니다.';
      }
      for (const kid of kids) {
        for (const key of Object.keys(kid.potential)) kid.potential[key] = Math.min(100, kid.potential[key] + 8);
        kid.happiness = Math.min(100, kid.happiness + 8);
      }
      return `아이 ${kids.length}명의 앞날이 넓어졌습니다.`;
    },
  },
];

export const REWARD_BY_ID = Object.fromEntries(REWARDS.map((r) => [r.id, r]));

// ── 업적 ─────────────────────────────────────────────────
// check(state, helpers) 가 true 가 되는 순간 보상 선택이 열린다.
// progress 는 화면에 진행도를 보여주기 위한 것(선택).
export const ACHIEVEMENTS = [
  // 삶의 이정표
  { id: 'firstJob', icon: '💼', title: '첫 출근', desc: '처음으로 직업을 갖는다', tier: 1,
    check: (s, h) => Boolean(h.me.jobId) },
  { id: 'promoted', icon: '🪜', title: '인정받는 사람', desc: '호봉 5에 도달한다', tier: 2,
    progress: (s, h) => ({ current: h.me.jobLevel, goal: 5 }),
    check: (s, h) => h.me.jobLevel >= 5 },
  { id: 'married', icon: '💍', title: '평생의 인연', desc: '결혼한다', tier: 1,
    check: (s, h) => Boolean(h.me.partnerId) },
  { id: 'firstChild', icon: '👶', title: '부모가 되다', desc: '첫 아이를 맞이한다', tier: 1,
    check: (s, h) => h.children.length >= 1 },
  { id: 'threeChildren', icon: '👨‍👩‍👧‍👦', title: '북적이는 집', desc: '자녀 3명을 둔다', tier: 2,
    progress: (s, h) => ({ current: h.children.length, goal: 3 }),
    check: (s, h) => h.children.length >= 3 },
  { id: 'grandparent', icon: '🧓', title: '할머니 할아버지', desc: '손주를 본다', tier: 2,
    check: (s, h) => h.children.some((c) => c.children.length > 0) },
  { id: 'longLife', icon: '🕰️', title: '장수 가문', desc: '85세까지 산다', tier: 3,
    progress: (s, h) => ({ current: h.me.age, goal: 85 }),
    check: (s, h) => h.me.age >= 85 },

  // 배움과 재능
  { id: 'college', icon: '🎓', title: '배움의 길', desc: '대졸 학력을 얻는다', tier: 1,
    check: (s, h) => h.me.education >= 3 },
  { id: 'master', icon: '🧑‍🔬', title: '학문의 끝', desc: '대학원을 졸업한다', tier: 2,
    check: (s, h) => h.me.education >= 4 },
  { id: 'maxStat', icon: '🌟', title: '경지에 오르다', desc: '능력치 하나를 100까지 올린다', tier: 2,
    progress: (s, h) => ({ current: Math.round(Math.max(...Object.values(h.me.stats))), goal: 100 }),
    check: (s, h) => Object.values(h.me.stats).some((v) => v >= 100) },
  { id: 'allRounder', icon: '🎯', title: '만능인', desc: '모든 능력치를 70 이상으로', tier: 3,
    progress: (s, h) => ({ current: Math.round(Math.min(...Object.values(h.me.stats))), goal: 70 }),
    check: (s, h) => Object.values(h.me.stats).every((v) => v >= 70) },
  { id: 'threeTraits', icon: '✨', title: '타고난 사람', desc: '특성 3개를 지닌다', tier: 2,
    progress: (s, h) => ({ current: h.me.traits.length, goal: 3 }),
    check: (s, h) => h.me.traits.length >= 3 },

  // 살림과 마을
  { id: 'rich1', icon: '💰', title: '첫 목돈', desc: '자금 10,000만원을 모은다', tier: 1,
    progress: (s) => ({ current: Math.round(s.money), goal: 10000 }),
    check: (s) => s.money >= 10000 },
  { id: 'rich2', icon: '🏦', title: '든든한 곳간', desc: '자금 50,000만원을 모은다', tier: 2,
    progress: (s) => ({ current: Math.round(s.money), goal: 50000 }),
    check: (s) => s.money >= 50000 },
  { id: 'rich3', icon: '👑', title: '가문의 재산', desc: '자금 150,000만원을 모은다', tier: 3,
    progress: (s) => ({ current: Math.round(s.money), goal: 150000 }),
    check: (s) => s.money >= 150000 },
  { id: 'builder1', icon: '🏠', title: '터를 닦다', desc: '건물 레벨 합계 5', tier: 1,
    progress: (s) => ({ current: totalBuildings(s), goal: 5 }),
    check: (s) => totalBuildings(s) >= 5 },
  { id: 'builder2', icon: '🏙️', title: '마을이 커진다', desc: '마을 등급 4 달성', tier: 2,
    progress: (s) => ({ current: villageLevel(s.village), goal: 4 }),
    check: (s) => villageLevel(s.village) >= 4 },
  { id: 'builder3', icon: '🌆', title: '작은 도시', desc: '마을 등급 6 달성', tier: 3,
    progress: (s) => ({ current: villageLevel(s.village), goal: 6 }),
    check: (s) => villageLevel(s.village) >= 6 },
  { id: 'famous', icon: '📣', title: '마을의 자랑', desc: '마을 명성 50', tier: 2,
    progress: (s) => ({ current: Math.round(s.village.fame ?? 0), goal: 50 }),
    check: (s) => (s.village.fame ?? 0) >= 50 },

  // 세대
  { id: 'gen2', icon: '🌳', title: '대를 잇다', desc: '2대로 이어간다', tier: 1,
    check: (s) => s.generation >= 2 },
  { id: 'gen3', icon: '🌲', title: '삼대의 이야기', desc: '3대로 이어간다', tier: 2,
    progress: (s) => ({ current: s.generation, goal: 3 }),
    check: (s) => s.generation >= 3 },
  { id: 'gen5', icon: '🏛️', title: '유서 깊은 가문', desc: '5대로 이어간다', tier: 3,
    progress: (s) => ({ current: s.generation, goal: 5 }),
    check: (s) => s.generation >= 5 },
  { id: 'bigFamily', icon: '🫂', title: '대가족', desc: '살아 있는 가족 12명', tier: 3,
    progress: (s, h) => ({ current: h.livingFamily, goal: 12 }),
    check: (s, h) => h.livingFamily >= 12 },

  // 경험
  { id: 'events20', icon: '📚', title: '파란만장', desc: '인생 이벤트 20번을 겪는다', tier: 1,
    progress: (s) => ({ current: s.stats.eventsResolved ?? 0, goal: 20 }),
    check: (s) => (s.stats.eventsResolved ?? 0) >= 20 },
  { id: 'events60', icon: '📖', title: '한 권의 인생', desc: '인생 이벤트 60번을 겪는다', tier: 2,
    progress: (s) => ({ current: s.stats.eventsResolved ?? 0, goal: 60 }),
    check: (s) => (s.stats.eventsResolved ?? 0) >= 60 },
  { id: 'absurd5', icon: '🤪', title: '이상한 일만 생긴다', desc: '병맛 이벤트 5번을 겪는다', tier: 2,
    progress: (s) => ({ current: s.stats.absurdSeen ?? 0, goal: 5 }),
    check: (s) => (s.stats.absurdSeen ?? 0) >= 5 },
  { id: 'absurd12', icon: '🛸', title: '{village}의 이상한 사람', desc: '병맛 이벤트 12번을 겪는다', tier: 3,
    progress: (s) => ({ current: s.stats.absurdSeen ?? 0, goal: 12 }),
    check: (s) => (s.stats.absurdSeen ?? 0) >= 12 },
];

export const ACHIEVEMENT_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

/** 등급별로 어울리는 보상 후보 */
export function rewardPoolFor(tier) {
  if (tier >= 3) return REWARDS;
  if (tier === 2) return REWARDS.filter((r) => r.id !== 'jackpot');
  return REWARDS.filter((r) => !['jackpot', 'freeBuild', 'lifespan'].includes(r.id));
}
