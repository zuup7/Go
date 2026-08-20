// 출신 가문. 어디서 시작하느냐에 따라 완전히 다른 판이 된다.
// apply(state, ctx) 로 시작 상태를 손본다.
export const ORIGINS = [
  {
    id: 'common', icon: '🏘️', title: '평범한 집',
    desc: '특별할 것도 부족할 것도 없는 출발.',
    detail: '자금 2,600만원 · 무난한 능력치',
    money: 2600,
    apply: () => {},
  },
  {
    id: 'farm', icon: '🌾', title: '시골 농가',
    desc: '몸은 튼튼하고 땅은 있지만, 현금이 없다.',
    detail: '자금 1,200만원 · 건강·체력 +12 · 텃밭 Lv.2 · 학력 낮음',
    money: 1200,
    apply: (state, { founder }) => {
      founder.stats.health += 12;
      founder.stats.fitness += 12;
      founder.potential.health += 8;
      founder.potential.fitness += 8;
      founder.education = 1;
      founder.eduPoints = 20;
      state.village.buildings.garden = 2;
    },
  },
  {
    id: 'fallen', icon: '🏚️', title: '몰락한 명문가',
    desc: '큰 집과 큰 빚을 함께 물려받았다. 시작부터 시간이 없다.',
    detail: '빚 4,000만원(3년 내 상환) · 저택 Lv.3 · 지능·매력 +10 · 명성 25',
    money: 600,
    hard: true,
    apply: (state, { founder }) => {
      founder.stats.intellect += 10;
      founder.stats.charm += 10;
      founder.potential.intellect += 6;
      founder.potential.charm += 6;
      founder.education = 3;
      founder.eduPoints = 100;
      state.village.buildings.house = 3;
      state.village.fame = 25;
      state.startingDebt = 4000;
    },
  },
  {
    id: 'merchant', icon: '💼', title: '상인 집안',
    desc: '돈은 돌지만 식구들 얼굴 볼 시간이 없었다.',
    detail: '자금 6,000만원 · 가게 Lv.2 · 소득 +10% · 행복 -12',
    money: 6000,
    apply: (state, { founder }) => {
      founder.happiness -= 12;
      founder.stats.charm += 6;
      state.village.buildings.shop = 2;
      state.incomeBonus = 0.1;
    },
  },
  {
    id: 'artist', icon: '🎨', title: '예술가 집안',
    desc: '가난하지만 이름은 알려져 있다.',
    detail: '자금 900만원 · 창의 +18 · 공방 Lv.1 · 명성 20 · 특성 예술혼',
    money: 900,
    apply: (state, { founder }) => {
      founder.stats.creativity += 18;
      founder.potential.creativity += 10;
      if (!founder.traits.includes('artistic')) founder.traits.push('artistic');
      state.village.buildings.studio = 1;
      state.village.fame = 20;
    },
  },
  {
    id: 'orphan', icon: '🕯️', title: '홀로 남은 아이',
    desc: '가진 것도 물려받을 것도 없다. 대신 아무도 기대하지 않는다.',
    detail: '자금 300만원 · 모든 잠재력 +8 · 강골 특성 · 어려운 시작',
    money: 300,
    hard: true,
    apply: (state, { founder }) => {
      for (const key of Object.keys(founder.potential)) founder.potential[key] += 8;
      if (!founder.traits.includes('ironBody')) founder.traits.push('ironBody');
      founder.happiness -= 6;
      founder.education = 1;
      founder.eduPoints = 25;
    },
  },
];

export const ORIGIN_BY_ID = Object.fromEntries(ORIGINS.map((o) => [o.id, o]));
