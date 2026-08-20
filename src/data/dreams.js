// 인물의 꿈. 열 살 무렵 하나씩 품고, 이루면 인생이 달라진다.
import { villageLevel } from '../core/village.js';

export const DREAMS = [
  {
    id: 'doctor', icon: '🩺', title: '의사가 되기', hint: '의사가 되면 이루어집니다.',
    fits: (p) => p.potential.intellect >= 70,
    check: (state, p) => p.jobId === 'doctor',
    reward: { money: 3000, happiness: 25, stats: { intellect: 8 } },
  },
  {
    id: 'stage', icon: '🎤', title: '무대에 서기', hint: '아이돌이나 화가가 되면 이루어집니다.',
    fits: (p) => p.potential.charm >= 65 || p.potential.creativity >= 65,
    check: (state, p) => ['idol', 'artist', 'designer'].includes(p.jobId),
    reward: { money: 2200, happiness: 25, villageFame: 12 },
  },
  {
    id: 'athlete', icon: '🏅', title: '운동선수 되기', hint: '운동선수가 되면 이루어집니다.',
    fits: (p) => p.potential.fitness >= 65,
    check: (state, p) => p.jobId === 'athlete',
    reward: { money: 2400, happiness: 25, stats: { fitness: 10 } },
  },
  {
    id: 'teacher', icon: '🏫', title: '아이들을 가르치기', hint: '교사나 교수가 되면 이루어집니다.',
    fits: (p) => p.potential.intellect >= 55,
    check: (state, p) => ['teacher', 'professor'].includes(p.jobId),
    reward: { money: 1600, happiness: 22, familyHappiness: 8 },
  },
  {
    id: 'rich', icon: '💰', title: '큰 부자 되기', hint: '집안 자금 60,000만원을 모으면 이루어집니다.',
    fits: () => true,
    check: (state) => state.money >= 60000,
    reward: { money: 4000, happiness: 22 },
  },
  {
    id: 'ownShop', icon: '🏪', title: '내 가게 갖기', hint: '사업을 시작하면 이루어집니다.',
    fits: () => true,
    check: (state, p) => (p.flags ?? []).includes('business') || (state.village.buildings.shop ?? 0) >= 3,
    reward: { money: 2600, happiness: 20, villageFame: 8 },
  },
  {
    id: 'threeKids', icon: '👨‍👩‍👧‍👦', title: '아이 셋 키우기', hint: '자녀 셋을 두면 이루어집니다.',
    fits: () => true,
    check: (state, p) => p.children.filter((id) => state.people[id]).length >= 3,
    reward: { happiness: 28, familyHappiness: 10, money: 1200 },
  },
  {
    id: 'cityMaker', icon: '🏙️', title: '마을을 도시로', hint: '마을 등급 5에 이르면 이루어집니다.',
    fits: () => true,
    check: (state) => villageLevel(state.village) >= 5,
    reward: { money: 3000, happiness: 24, villageFame: 20 },
  },
  {
    id: 'scholar', icon: '🎓', title: '끝까지 배우기', hint: '대학원을 졸업하면 이루어집니다.',
    fits: (p) => p.potential.intellect >= 60,
    check: (state, p) => p.education >= 4,
    reward: { money: 1800, happiness: 20, stats: { intellect: 10 } },
  },
  {
    id: 'trueLove', icon: '💞', title: '평생의 사랑 만나기', hint: '배우자와 애정 90을 넘기면 이루어집니다.',
    fits: () => true,
    check: (state, p) => {
      const partner = state.people[p.partnerId];
      return Boolean(partner?.alive && partner.affection >= 90);
    },
    reward: { happiness: 26, affection: 10, familyHappiness: 8 },
  },
  {
    id: 'longevity', icon: '🕰️', title: '아흔까지 살기', hint: '90세를 넘기면 이루어집니다.',
    fits: () => true,
    check: (state, p) => p.age >= 90,
    reward: { happiness: 30, familyHappiness: 12, money: 1500 },
  },
  {
    id: 'grandkids', icon: '🧸', title: '손주 안아보기', hint: '손주가 태어나면 이루어집니다.',
    fits: () => true,
    check: (state, p) => p.children.some((id) => (state.people[id]?.children ?? []).length > 0),
    reward: { happiness: 26, familyHappiness: 10 },
  },
  {
    id: 'famous', icon: '📣', title: '마을의 자랑 되기', hint: '마을 명성 70을 넘기면 이루어집니다.',
    fits: () => true,
    check: (state) => (state.village.fame ?? 0) >= 70,
    reward: { money: 2000, happiness: 22, villageFame: 10 },
  },
  {
    id: 'perfect', icon: '🌟', title: '무엇이든 잘하기', hint: '모든 능력치가 75를 넘으면 이루어집니다.',
    fits: (p) => Object.values(p.potential).every((v) => v >= 70),
    check: (state, p) => Object.values(p.stats).every((v) => v >= 75),
    reward: { money: 2400, happiness: 25, stats: { health: 6 } },
  },
];

export const DREAM_BY_ID = Object.fromEntries(DREAMS.map((d) => [d.id, d]));
