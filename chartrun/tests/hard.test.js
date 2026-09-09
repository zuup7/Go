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
  startIntro,
  runSummary,
  SELECT_HARD,
  SELECT_HUB,
  SELECT_HARD_OPEN,
  SELECT_OPENING,
  SELECT_DEV_OFF,
  SELECT_SLOTS,
  markKey,
  SELECT_ITEMS,
  SELECT_HARD_BOSS,
} from '../src/core/game.js';
import { STAGES, HARD_STAGES } from '../src/data/stages.js';
import { emptySave, mergeRun, beatRecord, deserialize, serialize } from '../src/core/save.js';
import { trapKey } from '../src/data/traps.js';
import { createWorld, tileKind, T } from '../src/core/world.js';
import { SOLID, TILE } from '../src/core/physics.js';
import { HARD_PHASES, HARD_MAX_HP, phaseFor } from '../src/data/bossData.js';
import { createBoss, syncPhase } from '../src/core/boss.js';
import { HARD_OPEN_CUT, hardOpenLength, INTRO_CUT } from '../src/data/introCutscene.js';
import { HARD_END_CUT, ENDING_CUT, endingCut, isEndingCut, BOSS_CUTS, bossCutLength } from '../src/data/bossCutscenes.js';

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

test('열린 문에 들어가면 2회차 시작 컷신을 거쳐 하드모드가 시작된다', () => {
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

  // 판을 바로 열지 않는다 — **왜 또 달리는지**를 먼저 보여준다
  assert.equal(game.scene, 'intro', '문에 들어갔는데 시작 컷신이 안 뜬다');
  assert.equal(game.introCut, 'hardopen', '1회차 오프닝이 떴다');
  step(game, idle(), Math.round((hardOpenLength() + 0.5) / DT));

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

test('함정 표시는 종류를 안 가리고 판 이름이 붙는다', () => {
  // 예전에는 천장 가시와 가짜 체크포인트만 이름이 붙고, 솟는 벽·불쑥 가시·
  // 구간·가짜 골은 맨 열쇠를 썼다. 종류에 따라 갈리면 어떤 함정은 스테이지 1 의
  // 표시를 물려받고 어떤 건 아닌, 설명할 수 없는 상태가 된다.
  const hard = createGame({ seed: 1 });
  hard.hard = true;
  loadStage(hard, 0);
  const plain = createGame({ seed: 1 });
  loadStage(plain, 0);

  assert.equal(markKey(hard, 12, 9), trapKey(12, 9, hard.world.stage.id));
  assert.equal(markKey(plain, 12, 9), trapKey(12, 9));
  assert.notEqual(markKey(hard, 12, 9), markKey(plain, 12, 9));
});

// ── 하드 판이 실제로 새 함정을 쓰는가 ───────────────────────
test('새 함정이 하드모드 어딘가에는 다 나온다', () => {
  const seen = { blink: 0, fakeCheck: 0, ice: 0, spring: 0, ceil: 0, surge: 0 };
  for (const stage of HARD_STAGES) {
    const w = createWorld(stage);
    seen.blink += w.blinkers.length;
    seen.fakeCheck += w.fakeChecks.length;
    seen.ceil += w.ceilSpikes.length;
    seen.surge += w.zones.filter((z) => z.kind === 'surge').length;
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

/**
 * 하드 판이 다시 밋밋해지지 않게 **바닥선**을 그어둔다.
 *
 * 처음 만든 하드모드가 안 어려웠던 이유는 설계가 아니라 밀도였다 —
 * 160칸짜리 판에 앨범이 6마리, 추격 판 셋은 구멍이 아예 없는 통짜 활주로였다.
 * 눈으로는 "판이 있다"로 보여서 아무도 못 알아챈다. 숫자로 잡는다.
 */
test('하드 판은 최소한의 밀도를 지킨다', () => {
  const floorRow = 12;
  for (const stage of HARD_STAGES) {
    const world = createWorld(stage);
    const rows = stage.rows;
    const width = rows[0].length;

    let pits = 0;
    let checks = 0;
    for (let x = 0; x < width; x++) {
      if (tileKind(rows[floorRow][x]) === null && tileKind(rows[floorRow + 1][x]) === null) pits += 1;
      for (let y = 0; y < rows.length; y++) if (rows[y][x] === 'C') checks += 1;
    }

    assert.ok(world.albumSpawns.length >= 10, `${stage.id}: 앨범이 ${world.albumSpawns.length}마리뿐이다`);
    assert.ok(pits >= 20, `${stage.id}: 낭떠러지가 ${pits}칸뿐이라 달리기만 해도 지나간다`);
    // 칼날이 세 칸으로 길어진 뒤로는 하나만 잘 놓아도 충분히 무섭다.
    // 개수보다 **닿는 자리에 있는지**가 중요하고, 그건 stages.test.js 가 본다.
    assert.ok(world.ceilSpikes.length >= 1, `${stage.id}: 천장 가시가 하나도 없다`);
    // 추격 판은 하나, 함정 판은 둘. 되돌아가는 벌이 세야 외우게 된다 —
    // 넷씩 두면 바로 앞에서 다시 시작해서 배우는 게 아니라 밀고 지나가게 된다.
    if (!stage.chase) {
      assert.ok(checks >= 2, `${stage.id}: 체크포인트가 ${checks}개뿐이다`);
    }
  }
});

/**
 * **알면 넘어갈 수 있어야 한다.**
 *
 * 이번 하드모드는 함정을 짝지어 건다 — 벽에 막히는 순간 발밑이 꺼지고,
 * 튕기는 발판 위에는 창이 매달려 있다. 처음 보면 죽는 게 맞다. 하지만
 * "알고 있으면 빠져나가는 입력이 있다"가 무너지면 그건 어려운 판이 아니라
 * **못 깨는 판**이고, 화면만 봐서는 둘이 구분이 안 간다.
 *
 * 그래서 아는 사람을 흉내 낸 봇으로 네 판을 실제로 끝까지 굴려본다.
 * 아는 것은 딱 둘이다 — 앞을 보고 뛴다, 그리고 **위에 창이 달린 발판만** 피한다
 * (맨 발판은 오히려 밟아야 건너는 자리가 있다).
 */
test('아는 사람은 하드 네 판을 지형만으로 끝까지 간다', () => {
  const trapPad = (world, tx, ty) => {
    if (world.charAt(tx, ty) !== T.SPRING) return false;
    for (let d = 1; d <= 6; d++) if (world.charAt(tx, ty - d) === T.CEILSPIKE) return true;
    return false;
  };

  for (let index = 0; index < HARD_STAGES.length; index++) {
    const game = createGame({ seed: 5, save: { ...emptySave(), seenOpening: true } });
    startRun(game, index, { hard: true });
    for (let i = 0; i < 200; i++) updateGame(game, idle(), DT);

    const goal = game.world.goal.x;
    let far = game.player.x;
    let hold = 0;
    for (let i = 0; i < 60 * 90; i++) {
      // 지금 재는 건 **지형과 함정**이다 — 앨범한테 죽는 건 빼둔다
      game.albums.length = 0;
      game.player.invuln = 99;
      const p = game.player;
      const footTy = Math.floor((p.y + p.h + 2) / TILE);
      const aheadTx = Math.floor((p.x + p.w + 10) / TILE);
      const gap = p.onGround && game.world.tileAt(aheadTx, footTy) !== SOLID;
      const blocked = p.onGround && Math.abs(p.vx) < 24;
      const up = p.onGround && [0, 1].some((d) => game.world.tileAt(aheadTx + d, footTy - 2) === SOLID);
      const bad = p.onGround && [0, 1].some((d) => trapPad(game.world, aheadTx + d, footTy));
      if ((gap || blocked || up || bad) && hold === 0) hold = 13;
      const jump = hold > 0;
      const pressed = hold === 13;
      if (hold > 0) hold -= 1;
      const go = game.effects.reversed > 0 ? { left: true } : { right: true };
      updateGame(game, idle({ ...go, jump, jumpPressed: pressed }), DT);
      if (game.scene === 'play') far = Math.max(far, game.player.x);
      if (game.scene !== 'play' && game.scene !== 'death' && game.scene !== 'stageIntro') break;
    }
    assert.ok(
      far > goal - 40,
      `하드 ${index + 1}판: 알고도 못 지나가는 자리가 있다 — x ${Math.round(far)} / ${goal}`,
    );
  }
});

test('개발자 선택에서 하드 판 넷과 하드 보스로 바로 갈 수 있다', () => {
  // 하드 3판만 확인하고 싶은데 매번 1판부터 달려야 하면 아무도 안 본다.
  for (let i = 0; i < HARD_STAGES.length; i++) {
    const slot = SELECT_ITEMS.findIndex((s) => s.run?.hard && s.run.index === i);
    assert.ok(slot >= 0, `하드 ${i + 1}판 칸이 없다`);
    const game = createGame({ seed: 9, save: { ...emptySave(), seenOpening: true, dev: true } });
    game.scene = 'select';
    game.selectIndex = slot;
    step(game, idle({ confirmPressed: true }), 1);
    assert.equal(game.hard, true, `하드 ${i + 1}판 칸인데 하드모드가 아니다`);
    assert.equal(game.world.stage.id, HARD_STAGES[i].id, `하드 ${i + 1}판 칸이 엉뚱한 판을 연다`);
  }

  const game = createGame({ seed: 9, save: { ...emptySave(), seenOpening: true, dev: true } });
  game.scene = 'select';
  game.selectIndex = SELECT_HARD_BOSS;
  step(game, idle({ confirmPressed: true }), 1);
  assert.equal(game.hard, true, '하드 보스 칸인데 하드모드가 아니다');
  assert.ok(game.boss, '하드 보스 칸인데 보스가 없다');
  assert.equal(game.boss.maxHp, HARD_MAX_HP, '보스가 하드 체력이 아니다');
});

test('선택 칸의 이름과 실제로 열리는 판이 어긋나지 않는다', () => {
  // 칸 목록을 core 와 화면이 따로 들고 있으면 한쪽만 고쳤을 때
  // **화면은 맞는데 엉뚱한 판이 시작된다.** 목록이 하나뿐인지 본다.
  for (const item of SELECT_ITEMS) {
    assert.ok(item.icon && item.label, '이름 없는 칸이 있다');
    assert.ok(item.run || item.action, `"${item.label}" 칸이 아무 일도 안 한다`);
  }
  const hardStages = SELECT_ITEMS.filter((s) => s.run?.hard && s.run.index < HARD_STAGES.length);
  assert.equal(hardStages.length, HARD_STAGES.length, '하드 판 칸 수가 판 수와 다르다');
});


// ── 2회차 시작 컷신 ─────────────────────────────────────────
test('2회차 시작 타임라인이 앞으로만 가고 end 로 끝난다', () => {
  for (let i = 1; i < HARD_OPEN_CUT.length; i++) {
    assert.ok(HARD_OPEN_CUT[i].at >= HARD_OPEN_CUT[i - 1].at, `${i}번째 단계가 뒤로 갔다`);
  }
  assert.equal(HARD_OPEN_CUT[HARD_OPEN_CUT.length - 1].kind, 'end');
  assert.ok(hardOpenLength() > 1, '너무 짧아 읽을 수가 없다');
  assert.equal(HARD_OPEN_CUT.filter((s) => s.kind === 'line').length, 0, '대사가 있다');
});

test('2회차 시작은 오프닝과 이야기가 겹치지 않는다', () => {
  // 오프닝은 방구석에서 올려다보는 이야기고, 여기는 꼭대기에서 떨어지는 이야기다.
  // 단계 이름이 통째로 같으면 같은 컷신을 두 번 보여주는 셈이다.
  const opening = new Set(INTRO_CUT.map((s) => s.kind));
  const shared = HARD_OPEN_CUT.filter((s) => s.kind !== 'end' && opening.has(s.kind));
  assert.equal(shared.length, 0, `겹치는 단계: ${shared.map((s) => s.kind).join(', ')}`);
});

test('이야기 순서가 뜻대로 짜여 있다 — 이룬 뒤에 잃고, 잃은 뒤에 다시 쥔다', () => {
  const at = (kind) => HARD_OPEN_CUT.findIndex((s) => s.kind === kind);
  assert.ok(at('after') < at('crack'), '다 이룬 자리가 먼저 나와야 금이 가는 게 뜻이 된다');
  assert.ok(at('graves') < at('evolve'), '떠오른 다음에 진화한다');
  assert.ok(at('evolve') < at('taken'), '진화한 것들이 채가야 2회차 이야기가 된다');
  assert.ok(at('taken') < at('drop'), '빼앗기고 나서 떨어진다');
  assert.ok(at('drop') < at('stand'), '떨어진 뒤에 다시 일어선다');
});

test('시작 컷신 도중에는 시간이 안 흐르고, 반드시 저절로 끝나 하드모드로 이어진다', () => {
  const game = createGame({ seed: 3, save: { ...emptySave(), seenOpening: true } });
  loadStage(game, 0);
  startIntro(game, 'hardopen');
  step(game, idle(), Math.round(2 / DT));
  assert.equal(game.scene, 'intro', '2초 만에 끝나버렸다');
  assert.equal(game.elapsedMs, 0, '컷신 시간이 기록에 얹혔다');

  step(game, idle(), Math.round((hardOpenLength() + 0.5) / DT));
  assert.notEqual(game.scene, 'intro', '컷신이 안 끝난다');
  assert.equal(game.hard, true, '컷신 뒤에 하드모드로 안 이어졌다');
  assert.equal(game.stageIndex, 0);
});

test('시작 컷신은 건너뛸 수 있고, 단계가 한꺼번에 쏟아지지 않는다', () => {
  const game = createGame({ seed: 3, save: { ...emptySave(), seenOpening: true } });
  const beats = [];
  game.onEvent = (name, data) => {
    if (name === 'cutbeat' && data.cut === 'hardopen') beats.push(data.kind);
  };
  loadStage(game, 0);
  startIntro(game, 'hardopen');
  step(game, idle({ confirmPressed: true }), Math.round(0.8 / DT));
  assert.ok(beats.length <= 2, `건너뛰었는데 ${beats.length}개가 울렸다`);
  assert.notEqual(game.scene, 'intro', '건너뛰기가 안 먹는다');
});

test('시작 컷신은 seenOpening 을 건드리지 않는다', () => {
  // introdone 은 1회차 오프닝만 내는 소식이다 — 여기서 내면 오프닝을 영영 못 보는 사람이 생긴다
  const game = createGame({ seed: 3, save: { ...emptySave(), seenOpening: false } });
  const seen = [];
  game.onEvent = (name) => seen.push(name);
  loadStage(game, 0);
  startIntro(game, 'hardopen');
  step(game, idle(), Math.round((hardOpenLength() + 0.5) / DT));
  assert.equal(seen.filter((n) => n === 'introdone').length, 0, '2회차 시작이 오프닝을 본 걸로 쳤다');
});

// ── 2회차 엔딩 ──────────────────────────────────────────────
test('2회차 엔딩 타임라인이 앞으로만 가고 end 로 끝난다', () => {
  for (let i = 1; i < HARD_END_CUT.length; i++) {
    assert.ok(HARD_END_CUT[i].at >= HARD_END_CUT[i - 1].at, `${i}번째 단계가 뒤로 갔다`);
  }
  assert.equal(HARD_END_CUT[HARD_END_CUT.length - 1].kind, 'end');
  assert.equal(HARD_END_CUT.filter((s) => s.kind === 'line').length, 0, '대사가 있다');
});

test('1회차 엔딩과 다른 결말이다 — 결혼식을 또 보여주지 않는다', () => {
  const wedding = new Set(ENDING_CUT.map((s) => s.kind));
  const shared = HARD_END_CUT.filter((s) => s.kind !== 'end' && wedding.has(s.kind));
  assert.equal(shared.length, 0, `겹치는 단계: ${shared.map((s) => s.kind).join(', ')}`);
});

test('엔딩 갈래를 한 곳에서만 정한다', () => {
  assert.equal(endingCut(true), 'hardEnd');
  assert.equal(endingCut(false), 'ending');
  assert.ok(isEndingCut('hardEnd') && isEndingCut('ending'));
  assert.ok(!isEndingCut('bossdown'), '쓰러지는 컷신이 엔딩으로 세어졌다');
  for (const id of ['hardEnd', 'ending']) assert.ok(BOSS_CUTS[id], `${id} 컷신이 없다`);
});

test('하드 보스를 쓰러뜨리면 2회차 엔딩이, 보통이면 결혼식이 이어진다', () => {
  for (const hard of [false, true]) {
    const game = createGame({ seed: 7, save: { ...emptySave(), seenOpening: true } });
    game.hard = hard;
    loadBoss(game);
    game.boss.hp = 0;
    game.boss.state = 'defeated';
    game.boss.defeatedAt = 1.2;
    step(game, idle(), 2);
    assert.equal(game.bossCut?.id, 'bossdown', '쓰러지는 컷신이 안 떴다');

    step(game, idle(), Math.round((bossCutLength('bossdown') + 0.2) / DT));
    assert.equal(game.bossCut?.id, endingCut(hard), `${hard ? '하드' : '보통'}에서 엉뚱한 엔딩이 떴다`);

    step(game, idle(), Math.round((bossCutLength(endingCut(hard)) + 0.5) / DT));
    assert.equal(game.scene, 'ending', '엔딩 컷신이 안 끝난다');
    assert.equal(game.ending.hard, hard, '기록에 남는 회차가 어긋났다');
  }
});

// ── 포탈 스테이지 1 (개발자 모드) ───────────────────────────
test('개발자 선택에 포탈 스테이지 1 과 2회차 시작 컷신이 있다', () => {
  assert.ok(SELECT_HUB >= 0, '포탈 스테이지 칸이 없다');
  assert.ok(SELECT_HARD_OPEN >= 0, '2회차 시작 컷신 칸이 없다');
  assert.equal(new Set([SELECT_HARD, SELECT_HUB, SELECT_HARD_OPEN, SELECT_OPENING, SELECT_DEV_OFF]).size, 5);
});

test('포탈 스테이지 칸은 한 바퀴를 안 돈 사람에게도 포탈을 열어준다', () => {
  const game = createGame({ seed: 9, save: { ...emptySave(), seenOpening: true, dev: true } });
  game.scene = 'select';
  game.selectIndex = SELECT_HUB;
  step(game, idle({ confirmPressed: true }), 1);
  step(game, idle(), 200);

  assert.equal(game.hard, false, '하드모드로 바로 뛰어들었다 — 입구를 보려고 만든 칸이다');
  assert.equal(game.world.stage.id, STAGES[0].id);
  assert.ok(game.world.npcs.length > 0);

  const npc = game.world.npcs[0];
  game.player.x = npc.x;
  game.player.y = npc.y;
  step(game, idle(), 1);
  assert.ok(npcInReach(game), '포탈 칸으로 들어왔는데 NPC 가 없는 셈이다');

  step(game, idle({ confirmPressed: true }), 1);
  step(game, idle(), 60 * 5);
  assert.ok(game.world.portals[0].open, '말을 걸었는데 문이 안 열렸다');

  const portal = game.world.portals[0];
  game.player.x = portal.x;
  game.player.y = portal.y;
  step(game, idle(), 2);
  assert.equal(game.introCut, 'hardopen', '문으로 들어갔는데 2회차 시작 컷신이 안 떴다');
});

test('포탈 스테이지 칸이 저장을 건드리지 않는다', () => {
  // clearedOnce 를 켜버리면 1회차를 안 깬 사람의 타이틀 화면까지 바뀐다
  const game = createGame({ seed: 9, save: { ...emptySave(), seenOpening: true, dev: true } });
  game.scene = 'select';
  game.selectIndex = SELECT_HUB;
  step(game, idle({ confirmPressed: true }), 1);
  assert.equal(game.save.clearedOnce, false, '저장에 한 바퀴 돈 걸로 남았다');
  assert.equal(runSummary(game).partial, true, '골라 들어간 판인데 기록에 올라간다');
});
