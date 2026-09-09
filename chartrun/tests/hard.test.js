// 2회차(하드모드). 여기서 틀어지면 **1회차 사람의 저장이 망가지거나**
// 하드모드에 들어갈 길이 막히는데, 둘 다 화면만 봐서는 한참 뒤에나 안다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  loadStage,
  loadBoss,
  updateGame,
  startRun,
  stageTable,
  npcInReach,
  SELECT_HARD,
  SELECT_OPENING,
  SELECT_DEV_OFF,
  SELECT_SLOTS,
} from '../src/core/game.js';
import { STAGES, HARD_STAGES } from '../src/data/stages.js';
import { emptySave, mergeRun, beatRecord, deserialize, serialize } from '../src/core/save.js';
import { trapKey } from '../src/data/traps.js';
import { createWorld } from '../src/core/world.js';
import { HARD_PHASES, HARD_MAX_HP, phaseFor } from '../src/data/bossData.js';
import { createBoss, syncPhase } from '../src/core/boss.js';

const DT = 1 / 60;
const idle = (over = {}) => ({
  left: false,
  right: false,
  jump: false,
  jumpPressed: false,
  leftPressed: false,
  rightPressed: false,
  throwPressed: false,
  dashPressed: false,
  confirmPressed: false,
  restartPressed: false,
  pausePressed: false,
  mutePressed: false,
  anyPressed: false,
  ...over,
});
const step = (game, input = idle(), n = 1) => {
  for (let i = 0; i < n; i++) updateGame(game, input, DT);
};

/** 스테이지 1 에서 굴러가는 상태로 */
function inStage1(save) {
  const game = createGame({ seed: 5, save: { ...emptySave(), seenOpening: true, ...save } });
  loadStage(game, 0);
  step(game, idle(), 200);
  assert.equal(game.scene, 'play');
  return game;
}

// ── 처음 하는 사람 판을 건드리지 않는다 ──────────────────────
test('한 바퀴 돌기 전에는 NPC 도 포탈도 없는 셈이다', () => {
  // 튜토리얼 판에 낯선 사람이 서 있으면 그냥 헷갈리기만 한다
  const game = inStage1({ clearedOnce: false });
  assert.ok(game.world.npcs.length > 0, '판에는 박혀 있다');

  const npc = game.world.npcs[0];
  game.player.x = npc.x;
  game.player.y = npc.y;
  step(game, idle({ confirmPressed: true }), 3);
  assert.equal(npcInReach(game), null, '깨기 전인데 말을 걸 수 있다');
  assert.equal(game.npcTalk, null, '깨기 전인데 대화가 시작됐다');
  assert.equal(game.world.portals[0].open, false, '깨기 전인데 문이 열렸다');
});

test('깬 사람에게는 말을 걸 수 있고, 말을 걸어야 문이 열린다', () => {
  const game = inStage1({ clearedOnce: true });
  const npc = game.world.npcs[0];
  game.player.x = npc.x;
  game.player.y = npc.y;

  step(game, idle(), 1);
  assert.ok(npcInReach(game), '가까이 있는데 말을 못 건다');
  assert.equal(game.world.portals[0].open, false, '말을 걸기 전인데 문이 열려 있다');

  step(game, idle({ confirmPressed: true }), 1);
  assert.ok(game.npcTalk, '말을 걸었는데 대화가 안 시작됐다');

  // 대화 중에는 판이 멈춘다 (보스 컷신과 같은 규칙)
  const px = game.player.x;
  step(game, idle({ right: true }), 10);
  assert.equal(game.player.x, px, '대화 중인데 움직였다');

  step(game, idle(), 60 * 5);
  assert.equal(game.npcTalk, null, '대화가 안 끝난다');
  assert.equal(game.world.portals[0].open, true, '말을 걸었는데 문이 안 열렸다');
});

test('열린 문에 들어가면 하드모드가 시작된다', () => {
  const game = inStage1({ clearedOnce: true });
  const npc = game.world.npcs[0];
  game.player.x = npc.x;
  game.player.y = npc.y;
  step(game, idle({ confirmPressed: true }), 1);
  step(game, idle(), 60 * 5);

  const portal = game.world.portals[0];
  game.player.x = portal.x;
  game.player.y = portal.y;
  step(game, idle(), 2);

  assert.equal(game.hard, true, '문에 들어갔는데 하드모드가 아니다');
  assert.equal(stageTable(game), HARD_STAGES, '스테이지 표가 안 바뀌었다');
  assert.equal(game.world.stage.id, HARD_STAGES[0].id);
  // 새 판이라 기록이 처음부터 센다
  assert.equal(game.chartOuts, 0);
  assert.equal(game.elapsedMs, 0);
});

test('개발자 선택에 하드모드 입구가 있다', () => {
  // 없으면 하드모드를 확인하려면 매번 한 바퀴를 다 돌아야 한다
  const game = createGame({ seed: 9, save: { ...emptySave(), seenOpening: true, dev: true } });
  game.scene = 'select';
  game.selectIndex = SELECT_HARD;
  step(game, idle({ confirmPressed: true }), 1);
  assert.equal(game.hard, true, '하드 칸을 골랐는데 하드모드가 아니다');
  assert.equal(game.world.stage.id, HARD_STAGES[0].id);
  // 칸들이 서로 안 겹친다
  assert.equal(new Set([SELECT_HARD, SELECT_OPENING, SELECT_DEV_OFF]).size, 3);
  assert.ok(SELECT_DEV_OFF < SELECT_SLOTS);
});

// ── 엔딩에서 어디로 가나 ────────────────────────────────────
function atEnding(save) {
  const game = createGame({ seed: 6, save: { ...emptySave(), seenOpening: true, ...save } });
  loadBoss(game);
  game.scene = 'ending';
  game.sceneTime = 9;
  game.ending = { timeMs: 12345, rank: 1 };
  return game;
}

test('깬 사람은 판으로 돌아오고, 안 깬 사람은 타이틀로 간다', () => {
  const first = atEnding({ clearedOnce: false });
  step(first, idle({ confirmPressed: true }), 1);
  assert.equal(first.scene, 'title', '처음 깬 사람은 타이틀로 가야 한다');

  const again = atEnding({ clearedOnce: true });
  step(again, idle({ confirmPressed: true }), 1);
  assert.notEqual(again.scene, 'title', '깬 사람이 타이틀로 갔다');
  assert.equal(again.world.stage.id, STAGES[0].id, '스테이지 1 로 안 돌아왔다');
  assert.ok(again.world.npcs.length > 0, '돌아온 판에 NPC 가 없다');
});

test('돌아온 판은 최고 기록을 건드리지 않는다', () => {
  // 1회차 시간을 그대로 안고 판을 도므로, 그 시간이 기록에 올라가면 거짓말이 된다
  const game = atEnding({ clearedOnce: true });
  step(game, idle({ confirmPressed: true }), 1);
  assert.equal(game.partial, true, '돌아온 판이 partial 이 아니다');
  assert.equal(game.hard, false, '돌아온 판은 하드모드가 아니어야 한다');
});

// ── 기록이 섞이지 않는다 ────────────────────────────────────
test('하드 기록은 하드 칸으로 가고 보통 기록을 안 덮는다', () => {
  let save = { ...emptySave(), bestTimeMs: 60_000 };
  save = mergeRun(save, { timeMs: 30_000, partial: false, hard: true });
  assert.equal(save.bestTimeMs, 60_000, '하드 기록이 보통 기록을 덮었다');
  assert.equal(save.bestHardTimeMs, 30_000);

  save = mergeRun(save, { timeMs: 50_000, partial: false, hard: false });
  assert.equal(save.bestTimeMs, 50_000);
  assert.equal(save.bestHardTimeMs, 30_000, '보통 기록이 하드 기록을 덮었다');
});

test('신기록 판정도 모드를 가린다', () => {
  const save = { ...emptySave(), bestTimeMs: 10_000, bestHardTimeMs: 90_000 };
  assert.equal(beatRecord(save, 50_000, false), false);
  assert.equal(beatRecord(save, 50_000, true), true, '하드는 하드 기록과 견줘야 한다');
});

test('한 바퀴 돌았다는 표시는 한 번 켜지면 안 꺼진다', () => {
  let save = emptySave();
  assert.equal(save.clearedOnce, false);
  save = mergeRun(save, { clearedOnce: true, partial: false });
  assert.equal(save.clearedOnce, true);
  save = mergeRun(save, { partial: true });
  assert.equal(save.clearedOnce, true, '다음 판에서 꺼졌다');
});

test('칸이 없는 옛 저장도 그대로 열린다', () => {
  // 저장 버전을 올리면 기존 사람의 기록이 통째로 날아간다. 칸만 더한다.
  const old = JSON.stringify({
    version: 1,
    savedAt: 0,
    data: { bestRank: 3, bestTimeMs: 42_000, revealedTraps: ['1,2'] },
  });
  const save = deserialize(old);
  assert.equal(save.bestRank, 3, '옛 기록이 사라졌다');
  assert.equal(save.bestTimeMs, 42_000);
  assert.equal(save.clearedOnce, false, '새 칸이 기본값으로 안 채워졌다');
  assert.equal(save.bestHardTimeMs, null);
  // 다시 저장해도 열린다
  assert.equal(deserialize(serialize(save)).bestRank, 3);
});

// ── 함정 표시가 스테이지를 넘나들지 않는다 ──────────────────
test('하드모드 함정 표시가 보통 판 표시를 물려받지 않는다', () => {
  // 열쇠에 스테이지 이름이 없으면 같은 칸이면 같은 열쇠라, 하드 (12,9) 가
  // 스테이지 1 에서 당한 표시를 물려받아 처음부터 붉게 뜬다
  assert.notEqual(trapKey(12, 9, 'hard1'), trapKey(12, 9));
  assert.notEqual(trapKey(12, 9, 'hard1'), trapKey(12, 9, 'hard2'));
  // 보통 판은 형식이 그대로여야 이미 저장된 표시가 계속 맞는다
  assert.equal(trapKey(12, 9), '12,9');
});

// ── 하드 판이 실제로 새 함정을 쓰는가 ───────────────────────
test('새 함정이 하드모드 어딘가에는 다 나온다', () => {
  const seen = { blink: 0, fakeCheck: 0, ice: 0, spring: 0, ceil: 0, chase: 0 };
  for (const stage of HARD_STAGES) {
    const w = createWorld(stage);
    seen.blink += w.blinkers.length;
    seen.fakeCheck += w.fakeChecks.length;
    seen.ceil += w.ceilSpikes.length;
    seen.chase += w.zones.filter((z) => z.kind === 'chased').length;
    for (const row of stage.rows) {
      seen.ice += (row.match(/_/g) ?? []).length;
      seen.spring += (row.match(/!/g) ?? []).length;
    }
  }
  for (const [name, n] of Object.entries(seen)) {
    assert.ok(n > 0, `새 함정 ${name} 이 하드모드에 한 번도 안 나온다`);
  }
});

// ── 보스 4페이즈 ────────────────────────────────────────────
test('하드는 페이즈가 넷, 보통은 셋', () => {
  assert.equal(HARD_PHASES.length, 4);
  assert.equal(HARD_MAX_HP, 12, '페이즈당 세 대여야 넷이 고르게 나온다');
  const seen = new Set();
  for (let hp = HARD_MAX_HP; hp >= 0; hp--) seen.add(phaseFor(hp, HARD_MAX_HP, HARD_PHASES).id);
  assert.deepEqual([...seen].sort(), [1, 2, 3, 4]);
});

test('하드 보스는 페이즈 넷을 다 지나간다 — 뒤로는 안 간다', () => {
  const boss = createBoss(640, 192, true);
  assert.equal(boss.maxHp, HARD_MAX_HP);
  const seen = [boss.phaseId];
  for (let i = 0; i < HARD_MAX_HP; i++) {
    boss.hp -= 1;
    syncPhase(boss);
    if (boss.phaseId !== seen[seen.length - 1]) seen.push(boss.phaseId);
  }
  assert.deepEqual(seen, [1, 2, 3, 4], `본 페이즈: ${seen.join(',')}`);
});
