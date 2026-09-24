// 엔딩 크레딧 — 결혼식 뒤에 앨범 열일곱 장이 지나가고, 그 뒤가 통계 화면.
//
// 여기서 틀어지면 **한 바퀴를 다 돈 사람이 기록을 잃거나** 통계 화면에 영영
// 못 간다. 둘 다 20초짜리 크레딧 뒤에 숨어 있어서 화면만 봐서는 늦게 안다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createGame,
  loadBoss,
  updateGame,
  previewCut,
  cutPreviews,
  inCutscene,
  SKIP_AFTER,
} from '../src/core/game.js';
import { emptySave, mergeRun } from '../src/core/save.js';
import { runSummary } from '../src/core/game.js';
import { bossCutLength } from '../src/data/bossCutscenes.js';
import { ALBUMS } from '../src/data/albums.js';
import {
  creditAt,
  CREDITS_LENGTH,
  CREDIT_IN,
  CREDIT_HOLD,
  CREDIT_COUNT,
} from '../src/data/credits.js';


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
const run = (game, seconds, over) => {
  for (let i = 0; i < Math.round(seconds / DT); i++) updateGame(game, idle(over), DT);
};

/**
 * 결혼식 컷신 한복판에 세운다. 이벤트는 받아 적는다.
 *
 * `persist` 를 켜면 ui/app.js 가 하는 일을 **그대로** 한다 — 'ending' 을 받는 순간
 * 저장을 합쳐서 game.save 를 갈아끼운다. 신기록 버그가 바로 이 순서에서 났다.
 */
function atWedding({ save = {}, persist = false, elapsedMs = 250_000 } = {}) {
  const events = [];
  const game = createGame({
    seed: 3,
    save: { ...emptySave(), seenOpening: true, ...save },
    onEvent: (name, data) => {
      events.push(name);
      if (persist && name === 'ending') {
        game.save = mergeRun(game.save, {
          ...runSummary(game),
          timeMs: data.timeMs,
          rank: 1,
          clearedOnce: true,
          clearedHard: data.hard,
        });
      }
    },
  });
  loadBoss(game);
  game.elapsedMs = elapsedMs;
  game.bossCut = { id: 'ending', t: 0, length: bossCutLength('ending') };
  return { game, events };
}

const endWedding = (game) => run(game, bossCutLength('ending') + 0.1);

// ── 시간표 ──────────────────────────────────────────────────

test('앨범 열일곱 장이 **빠짐없이, 판에서 만난 순서대로** 한 번씩 지나간다', () => {
  assert.equal(CREDIT_COUNT, ALBUMS.length);
  const seen = [];
  for (let t = 0; t < CREDITS_LENGTH; t += 0.05) {
    const { index } = creditAt(t);
    if (index >= 0 && seen[seen.length - 1] !== index) seen.push(index);
  }
  assert.deepEqual(
    seen,
    ALBUMS.map((_, i) => i),
    '건너뛰거나 되돌아간 장이 있다',
  );
});

test('한 장마다 들어오고(slide 0→1), 자리를 잡는다', () => {
  const start = CREDIT_IN + 3 * CREDIT_HOLD;
  assert.equal(creditAt(start + 0.001).index, 3);
  assert.ok(creditAt(start + 0.001).slide < 0.1, '들어오는 중이어야 한다');
  assert.equal(creditAt(start + CREDIT_HOLD * 0.9).slide, 1, '머무는 동안은 자리를 잡았다');
});

test('처음엔 검고, 가운데선 밝고, 끝에선 다시 어두워진다', () => {
  // 결혼식이 검게 닫고 끝나므로 이어서 밝힌다. 툭 켜지면 필름이 튄 것처럼 보인다
  assert.equal(creditAt(0).fade, 0);
  assert.equal(creditAt(CREDITS_LENGTH / 2).fade, 1);
  assert.ok(creditAt(CREDITS_LENGTH - 0.01).fade < 0.05, '끝에서 안 어두워진다');
});

test('두 사람은 크레딧 내내 한 번 가로지른다 — 앞으로만 간다', () => {
  let last = -1;
  for (let t = 0; t <= CREDITS_LENGTH; t += 0.1) {
    const { walk } = creditAt(t);
    assert.ok(walk >= last, `${t.toFixed(1)}초에 뒤로 걸었다`);
    last = walk;
  }
  assert.equal(creditAt(0).walk, 0);
  assert.equal(creditAt(CREDITS_LENGTH).walk, 1);
});

// ── 흐름 ────────────────────────────────────────────────────

test('결혼식이 끝나면 크레딧, 크레딧이 끝나면 통계 화면', () => {
  const { game } = atWedding();
  endWedding(game);
  assert.equal(game.scene, 'credits');
  run(game, CREDITS_LENGTH + 0.1);
  assert.equal(game.scene, 'ending');
});

test('저장은 **크레딧 전에** 한다 — 크레딧 도중에 꺼도 한 바퀴가 남는다', () => {
  const { game, events } = atWedding();
  endWedding(game);
  assert.equal(game.scene, 'credits');
  assert.deepEqual(
    events.filter((e) => e === 'ending' || e === 'stats'),
    ['ending'],
    '크레딧이 시작됐는데 저장 이벤트가 없다 (또는 통계가 먼저 왔다)',
  );
  run(game, CREDITS_LENGTH + 0.1);
  assert.deepEqual(
    events.filter((e) => e === 'ending' || e === 'stats'),
    ['ending', 'stats'],
    '저장이 두 번 되거나, 통계 화면 알림이 안 왔다',
  );
});

test('결혼식에서 눌린 점프로 크레딧이 날아가지 않는다', () => {
  // 컷신을 건너뛰려고 누르던 손이 그대로 크레딧까지 넘겨버리면 한 장도 못 본다
  const { game } = atWedding();
  endWedding(game);
  run(game, SKIP_AFTER * 0.5, { confirmPressed: true });
  assert.equal(game.scene, 'credits', '뜨자마자 날아갔다');
  run(game, SKIP_AFTER, { confirmPressed: true });
  assert.equal(game.scene, 'ending', '잠깐 뒤에는 건너뛸 수 있어야 한다');
});

test('크레딧은 컷신이다 — HUD 를 치우고 폰에 「건너뛰기」를 띄운다', () => {
  const { game } = atWedding();
  endWedding(game);
  assert.equal(inCutscene(game), true);
});

// ── 신기록 ──────────────────────────────────────────────────
//
// 예전엔 통계 화면이 그릴 때마다 game.save 와 견줘 신기록을 정했다. 그런데 저장은
// 'ending' 이벤트에서 **동기로** 먼저 끝난다 — 방금 세운 기록을 자기 자신과 견주게
// 되어 신기록이 **한 번도 안 떴다.** 크레딧이 20초 끼면서 그 틈이 더 벌어졌다.

test('기록을 깨면 신기록이다 — 저장이 먼저 끝나도', () => {
  const { game } = atWedding({ save: { bestTimeMs: 300_000 }, persist: true, elapsedMs: 250_000 });
  endWedding(game);
  // 결혼식 컷신 동안에도 시계는 흐르므로 250초가 아니라 그 뒤의 값이다
  assert.equal(game.save.bestTimeMs, game.ending.timeMs, '저장이 안 합쳐졌다 — 테스트를 잘못 세웠다');
  assert.ok(game.ending.timeMs < 300_000);
  assert.equal(game.ending.fresh, true, '기록을 깼는데 신기록이 아니다');
  run(game, CREDITS_LENGTH + 0.1);
  assert.equal(game.ending.fresh, true, '크레딧을 지나오는 동안 신기록이 사라졌다');
});

test('처음 깬 판도 신기록이다', () => {
  const { game } = atWedding({ persist: true });
  endWedding(game);
  assert.equal(game.ending.fresh, true);
});

test('기록보다 느리면 신기록이 아니다', () => {
  const { game } = atWedding({ save: { bestTimeMs: 200_000 }, persist: true, elapsedMs: 250_000 });
  endWedding(game);
  assert.equal(game.ending.fresh, false);
});

test('골라 들어간 판은 신기록이 아니다 — 기록을 안 건드리는 판이다', () => {
  const { game } = atWedding({ persist: true });
  game.partial = true;
  endWedding(game);
  assert.equal(game.ending.fresh, false);
});

test('통계 화면은 신기록을 **스스로 판정하지 않는다**', () => {
  // 그리는 쪽이 game.save 와 다시 견주면 같은 버그가 돌아온다
  const hud = readFileSync(new URL('../src/render/hud.js', import.meta.url), 'utf8');
  assert.doesNotMatch(hud, /beatRecord\s*\(/, 'hud 가 저장된 기록과 다시 견주고 있다');
  assert.match(hud, /e\.fresh/, 'hud 가 core 가 정한 신기록을 안 읽는다');
});

// ── 컷신 보기 ───────────────────────────────────────────────

test('컷신 보기에서 크레딧을 틀 수 있고, 끝나면 목록으로 돌아간다', () => {
  const game = createGame({ seed: 4, save: { ...emptySave(), seenOpening: true, dev: true } });
  const at = cutPreviews().findIndex((p) => p.credits);
  assert.ok(at >= 0, '컷신 보기에 크레딧이 없다');
  assert.ok(previewCut(game, at));
  assert.equal(game.scene, 'credits');
  run(game, CREDITS_LENGTH + 0.1);
  assert.equal(game.scene, 'cutList', '크레딧만 봤는데 통계 화면으로 갔다');
});
