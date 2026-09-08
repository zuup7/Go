// 보스전 컷신 — 여기서 막히면 게임이 영영 안 끝나므로 제일 빡빡하게 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, loadBoss, updateGame } from '../src/core/game.js';
import { hitBoss, syncPhase, bossCombined } from '../src/core/boss.js';
import {
  BOSS_CUTS,
  PHASE2_CUT,
  PHASE3_CUT,
  ENDING_CUT,
  PHASE2_AT,
  PHASE3_AT,
  ENDING_AT,
  bossCutLength,
  cutForPhase,
} from '../src/data/bossCutscenes.js';

const idle = (over = {}) => ({
  left: false,
  right: false,
  jump: false,
  jumpPressed: false,
  throwPressed: false,
  confirmPressed: false,
  restartPressed: false,
  pausePressed: false,
  mutePressed: false,
  anyPressed: false,
  ...over,
});

const DT = 1 / 60;

/** 보스전 한복판까지 데려다 놓는다 */
function bossGame() {
  const game = createGame({ seed: 7 });
  loadBoss(game);
  return game;
}

/** 밟기 한 대 (게임 안 damageBoss 와 같은 길) */
function hit(game) {
  game.boss.vulnerable = true;
  game.boss.invuln = 0;
  const landed = hitBoss(game.boss);
  const changed = syncPhase(game.boss);
  return { landed, changed };
}

const run = (game, seconds, over) => {
  for (let i = 0; i < Math.round(seconds / DT); i++) updateGame(game, idle(over), DT);
};

// ── 타임라인 데이터 ─────────────────────────────────────────
for (const [id, cut] of Object.entries(BOSS_CUTS)) {
  test(`${id} 컷신 타임라인이 앞으로만 가고 end 로 끝난다`, () => {
    const t = cut.timeline;
    for (let i = 1; i < t.length; i++) {
      assert.ok(t[i].at >= t[i - 1].at, `${id}: ${i}번째 단계가 뒤로 갔다`);
    }
    assert.equal(t[t.length - 1].kind, 'end', `${id}: 끝 표시가 없다`);
    assert.ok(bossCutLength(id) > 1, `${id}: 너무 짧아 읽을 수가 없다`);
    assert.equal(t.filter((s) => s.kind === 'line').length, 0, `${id}: 대사가 남아 있다`);
  });
}

test('그리는 쪽이 읽는 시각표가 타임라인과 같다', () => {
  // 시각을 그림 코드에 또 적어두면 타임라인만 고쳤을 때 조용히 어긋난다.
  for (const [at, timeline] of [
    [PHASE2_AT, PHASE2_CUT],
    [PHASE3_AT, PHASE3_CUT],
    [ENDING_AT, ENDING_CUT],
  ]) {
    for (const step of timeline) {
      if (step.kind === 'line') continue;
      assert.equal(at[step.kind], step.at, `${step.kind} 시각이 어긋났다`);
    }
  }
});

test('조작이 합체보다 먼저다 — 순서가 곧 이유다', () => {
  // 차트를 뺏은 힘으로 합체하는 것이라, 뒤집히면 왜 갑자기 합체하는지가 사라진다
  const at = (kind) => PHASE3_CUT.findIndex((s) => s.kind === kind);
  assert.ok(at('rig') < at('call'), '1위를 뺏은 다음에 조각을 부른다');
  assert.ok(at('call') < at('assemble'), '불러 모은 다음에 조립한다');
  assert.ok(at('assemble') < at('lock'), '부위를 붙이고 나서 마지막이 잠긴다');
  // 다 잠기기 전에 불이 들어오면 합체가 아니라 그냥 켜진 거다
  assert.ok(at('lock') < at('core'), '다 붙은 다음에 코어에 불이 들어온다');
});

test('3페이즈에서만 합체한 몸이다', () => {
  const game = bossGame();
  assert.equal(bossCombined(game.boss), false, '1페이즈는 아직 원반이다');
  game.boss.phaseId = 2;
  assert.equal(bossCombined(game.boss), false, '2페이즈는 쪼개진 조각이다');
  game.boss.phaseId = 3;
  assert.equal(bossCombined(game.boss), true);
  assert.equal(bossCombined(null), false, '보스가 없으면 합체도 없다');
});

test('전환 컷신은 페이즈 2·3 에만 붙는다', () => {
  assert.equal(cutForPhase(1), null, '1페이즈는 싸움 시작이라 전환이 없다');
  assert.equal(cutForPhase(2), 'phase2');
  assert.equal(cutForPhase(3), 'phase3');
});

test('연출 순서가 뜻대로 짜여 있다', () => {
  assert.deepEqual(
    PHASE2_CUT.filter((s) => s.kind !== 'line').map((s) => s.kind),
    ['shake', 'crack', 'split', 'title', 'end'],
  );
  // 3페이즈: 차트를 조작해 1위를 뺏고 → 그 힘으로 조각을 불러 → 로봇으로 합체한다
  assert.deepEqual(
    PHASE3_CUT.filter((s) => s.kind !== 'line').map((s) => s.kind),
    ['shake', 'chart', 'rig', 'call', 'assemble', 'lock', 'core', 'title', 'end'],
  );
  // 엔딩 1부: 터지고 → 흩어지고 → 줄 서고 → 1위 자리가 비고 → 올라서고 → 왕관
  // 엔딩 2부: 차트가 식장이 되고 → 공주가 들어오고 → 마주 서고 → 반지 → 하트
  assert.deepEqual(
    ENDING_CUT.filter((s) => s.kind !== 'line').map((s) => s.kind),
    ['crack', 'burst', 'scatter', 'chartline', 'empty', 'climb', 'crown',
      'aisle', 'bride', 'vow', 'ring', 'kiss', 'end'],
  );
});

// ── 싸움 중의 대사 ──────────────────────────────────────────
test('그냥 한 대 맞아서는 컷신이 끼어들지 않는다', () => {
  const game = bossGame();
  run(game, 0.5);
  const before = game.boss.hp;
  // 페이즈가 안 바뀌는 첫 대
  updateGame(game, idle(), DT);
  game.boss.vulnerable = true;
  game.boss.invuln = 0;
  game.player.x = game.boss.x + game.boss.w / 2 - game.player.w / 2;
  game.player.y = game.boss.y - game.player.h;
  game.player.vy = 120;
  run(game, 0.2);

  assert.ok(game.boss.hp < before, '한 대는 들어가야 한다');
  assert.equal(game.bossCut, null, '보통 피격에 컷신이 끼면 싸움이 계속 끊긴다');
});

// ── 전환 컷신 ───────────────────────────────────────────────
test('페이즈가 바뀌면 컷신이 서고, 그동안 싸움이 통째로 멈춘다', () => {
  const game = bossGame();
  run(game, 0.5);
  while (game.boss.phaseId === 1) {
    const { changed } = hit(game);
    if (changed) break;
  }
  // 게임이 하는 것과 같은 자리에서 컷신을 튼다
  game.bossCut = { id: 'phase2', t: 0, length: bossCutLength('phase2') };
  game.bossLine = null;

  const hp = game.boss.hp;
  const px = game.player.x;
  const py = game.player.y;
  const shots = game.shots.length;
  game.shots.push({ x: 10, y: 10, w: 4, h: 4, vx: 200, vy: 0, boss: true, wobble: 0 });

  run(game, 1.0, { left: true, jump: true, restartPressed: true });

  assert.ok(game.bossCut, '아직 컷신 중이어야 한다');
  assert.equal(game.boss.hp, hp, '컷신 중에 체력이 움직였다');
  assert.equal(game.player.x, px, '컷신 중에 플레이어가 움직였다');
  assert.equal(game.player.y, py);
  assert.equal(game.player.dead, false, '컷신 보다가 죽으면 안 된다');
  assert.equal(game.scene, 'boss');
  assert.equal(game.shots.length, shots + 1, '탄도 멈춰 있어야 한다');
});

test('컷신은 반드시 저절로 풀린다 — 안 풀리면 게임이 영영 멈춘다', () => {
  for (const id of Object.keys(BOSS_CUTS)) {
    const game = bossGame();
    game.bossCut = { id, t: 0, length: bossCutLength(id) };
    run(game, bossCutLength(id) + 1);
    assert.equal(game.bossCut, null, `${id} 컷신이 안 끝났다`);
  }
});

test('건너뛰기가 세 컷신 모두에서 먹는다', () => {
  for (const id of Object.keys(BOSS_CUTS)) {
    const game = bossGame();
    game.bossCut = { id, t: 0, length: bossCutLength(id) };
    run(game, 0.4, { confirmPressed: true });
    assert.ok(game.bossCut, `${id}: 시작하자마자 넘어가면 눌린 줄도 모른다`);
    run(game, 0.4, { confirmPressed: true });
    assert.equal(game.bossCut, null, `${id}: 건너뛰기가 안 먹는다`);
  }
});

// ── 엔딩 ────────────────────────────────────────────────────
test('보스를 쓰러뜨리면 엔딩 컷신을 거쳐 통계 화면으로 간다', () => {
  const game = bossGame();
  game.plays = 42;
  game.chartOuts = 3;
  game.elapsedMs = 123456;
  run(game, 0.5);

  while (game.boss.hp > 0) {
    hit(game);
    game.bossCut = null; // 전환 컷신은 여기선 관심 밖
  }
  assert.equal(game.boss.state, 'defeated');

  run(game, 2.0);
  assert.ok(game.bossCut, '격파하고 잠깐 뒤 엔딩 컷신이 떠야 한다');
  assert.equal(game.bossCut.id, 'ending');
  assert.equal(game.scene, 'boss', '컷신 도는 동안은 아직 보스 씬');

  run(game, bossCutLength('ending') + 0.5);
  assert.equal(game.scene, 'ending', '컷신이 끝나면 통계 화면');
  assert.equal(game.rank, 1, '1위가 됐다');
  assert.equal(game.ending.plays, 42, '통계가 그대로 넘어와야 한다');
  assert.equal(game.ending.chartOuts, 3);
  assert.equal(game.ending.timeMs, game.elapsedMs);
});

test('엔딩 컷신도 건너뛰면 바로 통계로 간다', () => {
  const game = bossGame();
  game.bossCut = { id: 'ending', t: 0, length: bossCutLength('ending') };
  run(game, 0.4, { confirmPressed: true });
  run(game, 0.4, { confirmPressed: true });
  assert.equal(game.scene, 'ending');
  assert.ok(game.ending, '통계가 만들어져야 한다');
});
