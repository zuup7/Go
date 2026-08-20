// 위기. 기한 안에 해결하지 못하면 가문이 실제로 손해를 본다.
//   need   : 해결에 드는 돈 (없으면 판정형)
//   check  : 돈 대신 능력치로 넘길 수 있는 경우
//   years  : 남은 기한
//   penalty(state, ctx): 실패했을 때 벌어지는 일. 로그 문구를 돌려준다.
export const CRISES = [
  {
    id: 'debt', icon: '💸', title: '빚더미',
    desc: '갚아야 할 돈이 쌓였습니다. 기한을 넘기면 집과 마을 재산이 넘어갑니다.',
    years: 3,
    need: (state) => Math.max(2500, Math.round(Math.min(state.money * 0.55, state.stats.peakMoney * 0.3))),
    penalty: (state, ctx) => {
      const ids = Object.keys(state.village.buildings).filter((id) => state.village.buildings[id] > 0);
      let taken = 0;
      for (const id of ctx.rng.shuffle(ids)) {
        if (taken >= 3) break;
        state.village.buildings[id] -= 1;
        taken += 1;
      }
      state.money = Math.round(state.money * 0.5);
      for (const person of ctx.family) person.happiness = Math.max(0, person.happiness - 18);
      return '빚쟁이들이 집과 건물을 가져갔습니다. 가족 모두가 힘든 시간을 보냅니다.';
    },
  },
  {
    id: 'illness', icon: '🏥', title: '큰 병',
    desc: '{actor}이(가) 큰 병을 얻었습니다. 치료비를 마련하지 못하면 오래 버티지 못합니다.',
    years: 2,
    targeted: true,
    need: (state) => Math.max(1800, Math.round(Math.min(state.money * 0.4, state.stats.peakMoney * 0.2))),
    check: { stat: 'health', difficulty: 75 },
    penalty: (state, ctx) => {
      const person = ctx.target;
      if (!person) return '병이 집안을 훑고 지나갔습니다.';
      person.lifespan -= 12;
      person.stats.health = Math.max(5, person.stats.health - 30);
      person.happiness = Math.max(0, person.happiness - 15);
      return `${ctx.name}의 병을 잡지 못했습니다. 몸이 크게 상했습니다.`;
    },
  },
  {
    id: 'disaster', icon: '🌊', title: '마을 재난',
    desc: '{village}에 큰물이 들었습니다. 복구를 미루면 마을이 주저앉습니다.',
    years: 2,
    need: (state) => Math.max(2000, Math.round(Math.min(state.money * 0.45, state.stats.peakMoney * 0.25))),
    penalty: (state, ctx) => {
      const ids = Object.keys(state.village.buildings).filter((id) => state.village.buildings[id] > 0);
      let broken = 0;
      for (const id of ctx.rng.shuffle(ids)) {
        if (broken >= 4) break;
        state.village.buildings[id] -= 1;
        broken += 1;
      }
      state.village.fame = Math.max(0, (state.village.fame ?? 0) - 20);
      return '복구하지 못한 건물들이 무너졌습니다. 마을이 한참 뒤로 물러났습니다.';
    },
  },
  {
    id: 'runaway', icon: '🚪', title: '집을 나간 가족',
    desc: '{actor}이(가) 집을 나갔습니다. 붙잡지 못하면 영영 돌아오지 않을지도 모릅니다.',
    years: 3,
    targeted: true,
    targetAge: [12, 30],
    need: (state) => Math.max(900, Math.round(Math.min(state.money * 0.25, state.stats.peakMoney * 0.12))),
    check: { stat: 'charm', difficulty: 60 },
    penalty: (state, ctx) => {
      const person = ctx.target;
      if (!person) return '떠난 사람은 돌아오지 않았습니다.';
      person.inFamily = false;
      person.independent = true;
      for (const member of ctx.family) member.happiness = Math.max(0, member.happiness - 12);
      return `${ctx.name}은(는) 끝내 돌아오지 않았습니다. 가족의 마음에 빈자리가 남았습니다.`;
    },
  },
  {
    id: 'lawsuit', icon: '⚖️', title: '소송에 휘말리다',
    desc: '집안이 억울한 송사에 걸렸습니다. 이기지 못하면 재산의 절반이 날아갑니다.',
    years: 2,
    need: (state) => Math.max(1500, Math.round(Math.min(state.money * 0.5, state.stats.peakMoney * 0.22))),
    check: { stat: 'intellect', difficulty: 70 },
    penalty: (state, ctx) => {
      state.money = Math.round(state.money * 0.5);
      for (const person of ctx.family) person.happiness = Math.max(0, person.happiness - 10);
      return '재판에서 졌습니다. 재산의 절반이 사라졌습니다.';
    },
  },
];

export const CRISIS_BY_ID = Object.fromEntries(CRISES.map((c) => [c.id, c]));
