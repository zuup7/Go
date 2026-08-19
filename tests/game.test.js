import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/core/game.js';
import { fullName } from '../src/core/person.js';
import { serialize, deserialize } from '../src/core/save.js';

const start = (seed = 1) => G.newGame({ seed, gender: 'female', familyName: '박', givenName: '서연', villageName: '햇살마을' });

/** 출산은 확률이라, 테스트에서는 태어날 때까지 시도한다 */
function bornChild(state) {
  for (let i = 0; i < 20; i++) {
    state.turnFlags.childThisYear = false;
    const result = G.haveChild(state);
    if (result.ok) return result.child;
  }
  throw new Error('아이가 태어나지 않았다');
}

/** 대기 중인 이벤트를 첫 번째 선택지로 넘긴다 */
function clearEvent(state) {
  if (state.pending && !state.pending.resolved) G.resolveEvent(state, 0);
  G.dismissEvent(state);
}

/** 밀린 보상 선택을 전부 첫 번째 카드로 받는다 */
function claimAll(state) {
  let guard = 0;
  while (state.rewardQueue?.length && guard++ < 40) {
    const choice = G.rewardChoice(state);
    if (!choice) break;
    G.takeReward(state, choice.options[0].id);
  }
}

/** 이벤트와 보상을 모두 정리해 다음 해로 갈 수 있게 만든다 */
function settle(state) {
  clearEvent(state);
  claimAll(state);
}

test('새 게임은 1대 18세, 마을과 자금을 갖고 시작한다', () => {
  const state = start();
  const me = G.player(state);
  assert.equal(state.year, G.START_YEAR);
  assert.equal(state.generation, 1);
  assert.equal(me.age, 18);
  assert.equal(fullName(me), '박서연');
  assert.equal(state.village.name, '햇살마을');
  assert.ok(state.money > 0);
  assert.equal(state.log.length, 1);
});

test('한 해를 보내면 연도와 나이가 늘고 이벤트가 준비된다', () => {
  const state = start(2);
  const before = G.player(state).age;
  G.advanceYear(state, 'study');
  assert.equal(state.year, G.START_YEAR + 1);
  assert.equal(G.player(state).age, before + 1);
  assert.ok(state.pending, '새해 이벤트가 있어야 한다');
});

test('이벤트를 해결하기 전에는 다음 해로 갈 수 없다', () => {
  const state = start(3);
  G.advanceYear(state, 'study');
  assert.equal(G.canAdvance(state), false);
  const year = state.year;
  G.advanceYear(state, 'study');
  assert.equal(state.year, year, '이벤트가 남아 있으면 시간이 멈춘다');
  G.resolveEvent(state, 0);
  assert.equal(G.canAdvance(state), true);
});

test('활동에 따라 다른 능력치가 오른다', () => {
  const a = start(4);
  const b = start(4);
  const beforeIntellect = G.player(a).stats.intellect;
  const beforeFitness = G.player(a).stats.fitness;
  G.advanceYear(a, 'study');
  G.advanceYear(b, 'exercise');
  assert.ok(G.player(a).stats.intellect > beforeIntellect);
  assert.ok(G.player(b).stats.fitness > beforeFitness);
  assert.ok(G.player(a).stats.intellect > G.player(b).stats.intellect);
});

test('이벤트 선택은 결과를 남기고 한 번만 적용된다', () => {
  const state = start(5);
  G.advanceYear(state, 'rest');
  const result = G.resolveEvent(state, 0);
  assert.ok(result.text.length > 0);
  assert.equal(state.log[0].text.includes(result.text), true, '기록에 남는다');
  assert.equal(G.resolveEvent(state, 0), null, '한 이벤트는 한 번만 선택한다');
});

test('자금이 모자라면 비용이 드는 선택지를 고를 수 없다', () => {
  // 비용이 있는 선택지가 나올 때까지 해를 넘긴다
  const state = start(5);
  let costly = null;
  for (let i = 0; i < 40 && !costly; i++) {
    if (state.pending && !state.pending.resolved) {
      const event = G.pendingEvent(state);
      costly = event.choices.find((c) => c.cost > 0);
      if (costly) break;
      G.resolveEvent(state, 0);
    }
    G.advanceYear(state, 'rest');
  }
  assert.ok(costly, '비용이 드는 선택지를 찾지 못했다');

  state.money = costly.cost - 1;
  assert.equal(G.pendingEvent(state).choices[costly.index].affordable, false);
  assert.equal(G.resolveEvent(state, costly.index), null, '돈이 없으면 고를 수 없다');

  state.money = costly.cost + 1000;
  const before = state.money;
  assert.ok(G.resolveEvent(state, costly.index));
  assert.ok(state.money !== before, '비용이 정산된다');
});

test('자격을 갖추면 취업하고, 못 갖추면 거절된다', () => {
  const state = start(6);
  const me = G.player(state);
  me.age = 25;
  me.education = 4;
  for (const key of Object.keys(me.stats)) me.stats[key] = 90;
  assert.equal(G.takeJob(state, 'doctor').ok, true);
  assert.equal(me.jobId, 'doctor');
  me.stats.intellect = 10;
  assert.equal(G.takeJob(state, 'professor').ok, false);
});

test('만남 → 데이트 → 결혼이 이어진다', () => {
  const state = start(7);
  const me = G.player(state);
  me.age = 24;
  state.money = 5000;
  const met = G.meetPeople(state);
  assert.equal(met.ok, true);
  assert.ok(G.candidates(state).length >= 1);
  assert.equal(G.meetPeople(state).ok, false, '만남은 한 해에 한 번');

  const candidate = G.candidates(state)[0];
  const before = candidate.affection;
  assert.equal(G.date(state, candidate.id).ok, true);
  assert.ok(candidate.affection > before);
  assert.equal(G.date(state, candidate.id).ok, false, '데이트도 한 해에 한 번');

  assert.equal(G.propose(state, candidate.id).ok, false, '호감도가 낮으면 거절');
  candidate.affection = 85;
  assert.equal(G.propose(state, candidate.id).ok, true);
  assert.equal(me.partnerId, candidate.id);
  assert.equal(G.partnerOf(state).id, candidate.id);
  assert.equal(candidate.inFamily, true);
});

test('아이는 두 부모의 자녀로 등록되고 다음 세대가 된다', () => {
  const state = start(8);
  const me = G.player(state);
  me.age = 28;
  state.money = 9000;
  G.meetPeople(state);
  const candidate = G.candidates(state)[0];
  candidate.affection = 90;
  G.propose(state, candidate.id);

  const child = bornChild(state);
  assert.equal(child.generation, 2);
  assert.ok(me.children.includes(child.id));
  assert.ok(G.partnerOf(state).children.includes(child.id));
  assert.equal(child.familyName, me.familyName, '가문의 성을 잇는다');
  assert.equal(G.canHaveChild(state).ok, false, '한 해에 한 번');
});

test('사망하면 계승 화면으로 넘어가고 자산의 70%가 상속된다', () => {
  const state = start(9);
  const me = G.player(state);
  me.age = 30;
  state.money = 10000;
  G.meetPeople(state);
  const spouse = G.candidates(state)[0];
  spouse.affection = 90;
  G.propose(state, spouse.id);
  const child = bornChild(state);
  child.age = 25;

  state.money = 10000;
  me.alive = true;
  me.lifespan = 1;      // 곧 세상을 떠나도록
  me.age = 120;
  let guard = 0;
  while (!state.succession && guard++ < 30) {
    settle(state);
    G.advanceYear(state, 'rest');
  }
  assert.ok(state.succession, '사망 후 계승이 시작된다');
  assert.ok(state.succession.heirIds.includes(child.id));

  const before = state.money;
  G.chooseHeir(state, child.id);
  assert.equal(state.playerId, child.id);
  assert.equal(state.generation, 2);
  assert.equal(state.money, Math.round(before * 0.7));
});

test('살아 있는 동안 스스로 대를 넘길 수 있다', () => {
  const state = start(10);
  const me = G.player(state);
  me.age = 30;
  state.money = 20000;
  G.meetPeople(state);
  const spouse = G.candidates(state)[0];
  spouse.affection = 90;
  G.propose(state, spouse.id);
  const child = bornChild(state);

  assert.equal(G.canSucceed(state).ok, false, '아이가 어리면 넘길 수 없다');
  child.age = 22;
  const check = G.canSucceed(state);
  assert.equal(check.ok, true);

  const before = state.money;
  assert.equal(G.succeedTo(state, child.id).ok, true);
  assert.equal(state.playerId, child.id);
  assert.equal(state.money, Math.round(before * 0.9), '자발적 계승은 90%가 전해진다');
  assert.equal(me.alive, true, '물러난 부모는 계속 살아간다');
  assert.equal(me.retired, true);
  assert.ok(G.eldersOf(state).some((e) => e.id === me.id), '부모를 모시고 산다');
});

test('뒤를 이을 사람이 없으면 이야기가 끝난다', () => {
  const state = start(11);
  const me = G.player(state);
  me.lifespan = 1;
  me.age = 120;
  let guard = 0;
  while (!state.ended && guard++ < 30) {
    settle(state);
    G.advanceYear(state, 'rest');
  }
  assert.ok(state.ended, '후손이 없으면 게임이 끝난다');
  assert.ok(state.ended.score > 0);
  assert.equal(G.canAdvance(state), false);
});

test('마을에 건물을 지으면 자금이 줄고 효과가 생긴다', () => {
  const state = start(12);
  state.money = 5000;
  const before = state.money;
  const result = G.buildBuilding(state, 'garden');
  assert.equal(result.ok, true);
  assert.equal(state.money, before - result.spent);
  assert.equal(state.village.buildings.garden, 1);
  assert.ok(G.financeSummary(state).bonuses.expenseRate < 0);

  state.money = 0;
  assert.equal(G.buildBuilding(state, 'shop').ok, false, '돈이 없으면 못 짓는다');
});

test('저장하고 불러오면 이야기가 그대로 이어진다', () => {
  const state = start(13);
  state.money = 8000;
  G.player(state).age = 26;
  G.meetPeople(state);
  const spouse = G.candidates(state)[0];
  spouse.affection = 95;
  G.propose(state, spouse.id);
  G.haveChild(state);
  settle(state);
  G.advanceYear(state, 'family');

  const restored = deserialize(serialize(state));
  assert.equal(restored.year, state.year);
  assert.equal(restored.money, state.money);
  assert.equal(Object.keys(restored.people).length, Object.keys(state.people).length);
  assert.equal(fullName(G.player(restored)), fullName(G.player(state)));

  // 이어서 플레이해도 새 인물 id 가 겹치지 않는다
  settle(restored);
  G.advanceYear(restored, 'rest');
  const ids = Object.keys(restored.people);
  assert.equal(new Set(ids).size, ids.length);
});

test('여러 세대를 이어가도 가문이 유지된다', () => {
  const state = start(14);
  let guard = 0;
  while (!state.ended && state.generation < 4 && guard++ < 400) {
    if (state.succession) { G.chooseHeir(state, state.succession.heirIds[0]); continue; }
    settle(state);
    const me = G.player(state);
    if (!me.jobId && me.age >= 19) {
      const best = G.jobOptions(state).filter((j) => j.eligible).sort((a, b) => b.expected - a.expected)[0];
      if (best) G.takeJob(state, best.id);
    }
    if (!me.partnerId && me.age >= 22 && me.age <= 40) {
      const list = G.candidates(state);
      if (!list.length) G.meetPeople(state);
      else {
        const top = list[0];
        if (top.affection >= 70) G.propose(state, top.id);
        else G.date(state, top.id);
      }
    }
    if (me.partnerId && G.childrenOf(state, me).length < 2) G.haveChild(state);
    if (me.age >= 50) {
      const check = G.canSucceed(state);
      if (check.ok) { G.succeedTo(state, check.heirs[0].id); continue; }
    }
    G.advanceYear(state, me.age < 19 ? 'study' : me.jobId ? 'work' : 'social');
  }
  assert.ok(state.generation >= 4, `4대까지 이어져야 한다 (현재 ${state.generation}대)`);
  assert.ok(G.allPeople(state).filter((p) => p.alive).length > 1);
  assert.ok(G.legacyScore(state) > 0);
});


test('업적을 달성하면 보상 카드 3장이 열린다', () => {
  const state = start(20);
  const me = G.player(state);
  me.age = 25;
  me.education = 4;
  for (const key of Object.keys(me.stats)) me.stats[key] = 80;

  assert.equal(state.rewardQueue.length, 0);
  G.takeJob(state, 'engineer');
  assert.ok(state.achievements.includes('firstJob'), '첫 취업 업적이 열린다');
  assert.ok(state.rewardQueue.length >= 1);

  const choice = G.rewardChoice(state);
  assert.equal(choice.options.length, 3);
  assert.equal(new Set(choice.options.map((o) => o.id)).size, 3, '보상이 겹치지 않는다');
  for (const option of choice.options) {
    assert.ok(option.title.length > 0 && option.label.length > 0);
  }
});

test('보상을 고르기 전에는 다음 해로 갈 수 없다', () => {
  const state = start(21);
  G.player(state).age = 25;
  G.takeJob(state, 'farmer');
  assert.ok(state.rewardQueue.length > 0);
  assert.equal(G.canAdvance(state), false);

  const year = state.year;
  G.advanceYear(state, 'rest');
  assert.equal(state.year, year, '보상을 고를 때까지 시간이 멈춘다');

  claimAll(state);
  assert.equal(state.rewardQueue.length, 0);
  assert.equal(G.canAdvance(state), true);
});

test('보상은 실제 효과를 준다', () => {
  const state = start(22);
  const me = G.player(state);
  me.age = 25;
  G.takeJob(state, 'farmer');

  const choice = G.rewardChoice(state);
  const cash = choice.options.find((o) => o.id === 'cash');
  const mood = choice.options.find((o) => o.id === 'moodAll');
  if (cash) {
    const before = state.money;
    G.takeReward(state, 'cash');
    assert.ok(state.money > before, '축하금은 자금을 늘린다');
  } else if (mood) {
    me.happiness = 40;
    G.takeReward(state, 'moodAll');
    assert.ok(me.happiness > 40, '기분 보상은 행복을 올린다');
  } else {
    const result = G.takeReward(state, choice.options[0].id);
    assert.equal(result.ok, true);
  }
  assert.equal(state.stats.rewardsTaken >= 1, true);
});

test('같은 업적은 두 번 열리지 않는다', () => {
  const state = start(23);
  const me = G.player(state);
  me.age = 25;
  G.takeJob(state, 'farmer');
  claimAll(state);
  const count = state.achievements.length;
  G.runAchievementCheck(state);
  G.runAchievementCheck(state);
  assert.equal(state.achievements.length, count);
  assert.equal(state.rewardQueue.length, 0);
});

test('업적 목록은 진행도를 알려준다', () => {
  const state = start(24);
  const list = G.achievements(state);
  assert.ok(list.length >= 20);
  const rich = list.find((a) => a.id === 'rich1');
  assert.equal(rich.done, false);
  assert.equal(rich.progress.goal, 10000);
  state.money = 12000;
  G.runAchievementCheck(state);
  assert.ok(G.achievements(state).find((a) => a.id === 'rich1').done);
});

test('병맛 이벤트도 통계에 쌓인다', () => {
  const state = start(25);
  const before = state.stats.absurdSeen;
  let guard = 0;
  while (state.stats.absurdSeen === before && guard++ < 200) {
    settle(state);
    G.advanceYear(state, 'rest');
    if (state.succession) G.chooseHeir(state, state.succession.heirIds[0]);
    if (state.ended) break;
  }
  assert.ok(state.stats.absurdSeen > before, '병맛 이벤트가 등장한다');
  assert.ok(state.stats.eventsResolved > 0);
});
