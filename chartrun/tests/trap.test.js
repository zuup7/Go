import test from 'node:test';
import assert from 'node:assert/strict';
import { TRAPS, TRAP_KINDS, createTrapMemory, trapKey } from '../src/data/traps.js';
import { createGame, updateGame, startRun, loadStage, VIEW } from '../src/core/game.js';
import { emptySave, mergeRun, beatRecord, serialize, deserialize } from '../src/core/save.js';
import { T } from '../src/core/world.js';
import { STAGES } from '../src/data/stages.js';

const idle = {
  left: false,
  right: false,
  jump: false,
  jumpPressed: false,
  confirmPressed: false,
  restartPressed: false,
  pausePressed: false,
  mutePressed: false,
  anyPressed: false,
};
const press = (over) => ({ ...idle, ...over });

/**
 * 오프닝을 이미 본 판. 여기 테스트들은 오프닝이 아니라 게임 흐름을 보므로,
 * 처음 켠 사람이 아니라 다시 켠 사람의 상태에서 시작한다.
 */
const played = (seed) => createGame({ seed, save: { ...emptySave(), seenOpening: true } });
const step = (game, input = idle, frames = 1) => {
  for (let i = 0; i < frames; i++) updateGame(game, input, 1 / 60);
};

test('함정 글자가 서로 겹치지 않는다', () => {
  assert.ok(TRAP_KINDS.length >= 11, `함정이 ${TRAP_KINDS.length}종밖에 없다`);
  const chars = TRAP_KINDS.map((k) => TRAPS[k].char);
  assert.equal(new Set(chars).size, chars.length);
});

test('함정 기억 — 한 번 당하면 표시된다', () => {
  const memory = createTrapMemory();
  const key = trapKey(12, 9);
  assert.equal(memory.has(key), false);
  memory.reveal(key);
  assert.equal(memory.has(key), true);
  assert.deepEqual(memory.toJSON(), [key]);
});

test('함정 기억은 저장에서 복원된다', () => {
  const memory = createTrapMemory(['3,4', '9,9']);
  assert.equal(memory.has('3,4'), true);
  assert.equal(memory.has('0,0'), false);
  assert.equal(memory.size, 2);
});

test('신기록 판정이 실제 저장 조건과 같다', () => {
  // 화면에 "신기록" 을 띄우는 판단과 mergeRun 이 실제로 갱신하는 판단이 어긋나면,
  // 신기록이라고 해놓고 저장은 안 되는 일이 생긴다.
  const none = emptySave();
  assert.equal(beatRecord(none, 90_000), true, '기록이 없으면 처음 세운 것이다');

  const has = { ...emptySave(), bestTimeMs: 90_000 };
  assert.equal(beatRecord(has, 80_000), true);
  assert.equal(beatRecord(has, 90_000), false, '같은 기록은 갱신이 아니다');
  assert.equal(beatRecord(has, 120_000), false);
  assert.equal(beatRecord(has, null), false, '기록이 없는 판은 갱신이 아니다');

  // mergeRun 과 실제로 같은 답을 내는가
  for (const [save, timeMs] of [[none, 90_000], [has, 80_000], [has, 120_000]]) {
    const merged = mergeRun(save, { timeMs, chartOuts: 0 });
    assert.equal(
      merged.bestTimeMs === timeMs,
      beatRecord(save, timeMs),
      `${timeMs} 에서 표시와 저장이 어긋난다`,
    );
  }
});

test('저장 직렬화가 왕복한다', () => {
  const save = { ...emptySave(), bestRank: 7, chartOuts: 42, revealedTraps: ['1,2'] };
  const back = deserialize(serialize(save));
  assert.equal(back.bestRank, 7);
  assert.equal(back.chartOuts, 42);
  assert.deepEqual(back.revealedTraps, ['1,2']);
});

test('판 결과를 기록에 합친다', () => {
  const save = emptySave();
  const after = mergeRun(save, { rank: 12, chartOuts: 5, clearedStage: 0, revealedTraps: ['2,2'], timeMs: 90000 });
  assert.equal(after.bestRank, 12);
  assert.equal(after.chartOuts, 5);
  assert.deepEqual(after.clearedStages, [0]);
  assert.equal(after.bestTimeMs, 90000);

  const worse = mergeRun(after, { rank: 40, chartOuts: 2, timeMs: 120000 });
  assert.equal(worse.bestRank, 12, '더 나쁜 순위는 기록을 못 밀어낸다');
  assert.equal(worse.chartOuts, 7, '차트아웃은 누적된다');
  assert.equal(worse.bestTimeMs, 90000, '더 느린 기록은 안 남는다');
});

// ── 실제 게임 흐름 ─────────────────────────────────────────
test('타이틀에서 아무 키나 누르면 1스테이지가 시작된다', () => {
  const game = played(1);
  assert.equal(game.scene, 'title');
  step(game, press({ confirmPressed: true }));
  assert.equal(game.scene, 'stageIntro');
  assert.equal(game.stageIndex, 0);
  step(game, idle, 130);
  assert.equal(game.scene, 'play');
});

test('죽으면 차트아웃이 늘고 체크포인트에서 부활한다', () => {
  const game = played(2);
  startRun(game);
  step(game, idle, 130);
  assert.equal(game.scene, 'play');

  const before = game.chartOuts;
  step(game, press({ restartPressed: true }));
  assert.equal(game.scene, 'death');
  assert.equal(game.chartOuts, before + 1);

  step(game, idle, 120);
  assert.equal(game.scene, 'play', '알아서 다시 시작한다');
  assert.equal(game.player.dead, false);
  assert.equal(game.player.x, game.checkpoint.x);
});

test('목숨은 무한 — 계속 죽어도 게임오버가 없다', () => {
  const game = played(3);
  startRun(game);
  step(game, idle, 130);
  for (let i = 0; i < 5; i++) {
    step(game, press({ restartPressed: true }));
    step(game, idle, 120);
  }
  assert.equal(game.chartOuts, 5);
  assert.equal(game.scene, 'play');
});

test('가짜 발판은 밟으면 사라지고 기억에 남는다', () => {
  const game = played(4);
  loadStage(game, 0);
  game.scene = 'play';
  const world = game.world;
  // 맵에서 가짜 발판 한 칸을 찾아 그 위에 세운다
  let found = null;
  for (let ty = 0; ty < world.height && !found; ty++) {
    for (let tx = 0; tx < world.width; tx++) {
      if (world.charAt(tx, ty) === T.FAKE) {
        found = { tx, ty };
        break;
      }
    }
  }
  assert.ok(found, '스테이지 1 에 가짜 발판이 있어야 한다');

  game.player.x = found.tx * 16 + 3;
  game.player.y = found.ty * 16 - 14;
  game.player.vy = 10;
  step(game, idle, 30);
  assert.equal(world.charAt(found.tx, found.ty), T.EMPTY, '발판이 사라졌다');
  assert.equal(game.trapMemory.has(trapKey(found.tx, found.ty)), true, '다음부터는 표시된다');
});

test('골에 닿으면 스테이지를 넘긴다', () => {
  const game = played(5);
  loadStage(game, 0);
  game.scene = 'play';
  game.player.x = game.world.goal.x;
  game.player.y = game.world.goal.y;
  step(game);
  assert.equal(game.scene, 'stageClear');
  step(game, idle, 60 * 3);
  assert.equal(game.stageIndex, 1, '다음 스테이지로');
});

test('마지막 스테이지를 깨면 합체 컷신이 나오고 보스전으로 간다', () => {
  const game = played(6);
  loadStage(game, STAGES.length - 1);
  game.scene = 'play';
  game.player.x = game.world.goal.x;
  game.player.y = game.world.goal.y;
  step(game);
  assert.equal(game.scene, 'stageClear');
  step(game, idle, 60 * 3);
  assert.equal(game.scene, 'cutscene');
  step(game, idle, 60 * 17);
  assert.equal(game.scene, 'boss');
  assert.ok(game.boss);
  assert.equal(game.rank, 2, '보스 앞에서는 2위');
});

test('컷신은 건너뛸 수 있다', () => {
  const game = played(7);
  game.scene = 'cutscene';
  game.cutsceneTime = 0;
  step(game, idle, 60);
  step(game, press({ confirmPressed: true }));
  step(game);
  assert.equal(game.scene, 'boss');
});

test('보스를 잡으면 1위 엔딩', () => {
  const game = played(8);
  loadStage(game, 0);
  game.scene = 'cutscene';
  game.cutsceneTime = 999;
  step(game);
  assert.equal(game.scene, 'boss');

  game.boss.hp = 0;
  game.boss.state = 'defeated';
  game.boss.defeatedAt = 3;
  step(game);
  assert.equal(game.bossCut?.id, 'ending', '격파하면 먼저 엔딩 컷신');
  step(game, idle, Math.ceil(game.bossCut.length * 60) + 2);
  assert.equal(game.scene, 'ending');
  assert.equal(game.rank, 1);
  assert.equal(game.ending.rank, 1);
});

test('일시정지 중에는 시간이 멈춘다', () => {
  const game = played(9);
  startRun(game);
  step(game, idle, 130);
  step(game, press({ pausePressed: true }));
  assert.equal(game.paused, true);
  const x = game.player.x;
  step(game, press({ right: true }), 60);
  assert.equal(game.player.x, x, '멈춰 있어야 한다');
  step(game, press({ pausePressed: true }));
  assert.equal(game.paused, false);
});

test('화면 크기는 4:2.33 저해상도', () => {
  assert.equal(VIEW.w, 384);
  assert.equal(VIEW.h, 224);
});

test('화면에 문구를 띄우는 장치가 아예 없다', () => {
  // 대사·배너를 다시 들이면 여기서 걸린다. 화면 글자는 HUD 의 숫자뿐이다.
  const game = played(10);
  startRun(game);
  step(game, idle, 60);
  assert.equal(game.banner, undefined, '배너가 되살아났다');
  assert.equal(game.bossLine, undefined, '보스 대사가 되살아났다');
  assert.equal(game.deathMessage, undefined, '사망 문구가 되살아났다');
});
