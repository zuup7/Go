// 가문의 숙원. 한 시대(기한) 안에 이루면 큰 보상이 온다.
import { villageLevel } from '../core/village.js';

export const QUESTS = [
  {
    id: 'q_village', icon: '🏙️', title: '마을을 키워라',
    desc: '마을 등급을 4까지 올린다',
    years: 30,
    progress: (state) => ({ current: villageLevel(state.village), goal: 4 }),
  },
  {
    id: 'q_wealth', icon: '💰', title: '곳간을 채워라',
    desc: '집안 자금 40,000만원을 모은다',
    years: 30,
    progress: (state) => ({ current: Math.round(state.money), goal: 40000 }),
  },
  {
    id: 'q_family', icon: '🫂', title: '가족을 늘려라',
    desc: '살아 있는 가족 8명을 만든다',
    years: 30,
    progress: (state, h) => ({ current: h.livingFamily, goal: 8 }),
  },
  {
    id: 'q_fame', icon: '📣', title: '이름을 알려라',
    desc: '마을 명성 45에 이른다',
    years: 25,
    progress: (state) => ({ current: Math.round(state.village.fame ?? 0), goal: 45 }),
  },
  {
    id: 'q_master', icon: '🎯', title: '한 분야의 일인자',
    desc: '주인공의 능력치 하나를 90까지 올린다',
    years: 25,
    progress: (state, h) => ({ current: Math.round(Math.max(...Object.values(h.me.stats))), goal: 90 }),
  },
  {
    id: 'q_dreams', icon: '⭐', title: '꿈을 이루는 집안',
    desc: '가족이 꿈 3개를 이룬다',
    years: 35,
    progress: (state) => ({ current: state.stats.dreamsFulfilled ?? 0, goal: 3 }),
  },
  {
    id: 'q_jobs', icon: '💼', title: '모두가 제 몫을',
    desc: '한 해에 일하는 가족 4명을 만든다',
    years: 25,
    progress: (state, h) => ({ current: h.workers, goal: 4 }),
  },
  {
    id: 'q_house', icon: '🏠', title: '큰 집을 짓다',
    desc: '우리 집을 Lv.4까지 올린다',
    years: 25,
    progress: (state) => ({ current: state.village.buildings.house ?? 0, goal: 4 }),
  },
];

export const QUEST_BY_ID = Object.fromEntries(QUESTS.map((q) => [q.id, q]));
