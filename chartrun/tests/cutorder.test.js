// 컷신이 **순서대로** 나오는가.
//
// 각 컷신 하나하나는 bosscut/introcut 테스트가 이미 본다. 여기서 보는 것은
// 한 바퀴를 돌 때 이야기가 **어떤 순서로** 흐르는지다 — 순서가 뒤바뀌면
// 각 컷신은 멀쩡한데 이야기가 말이 안 된다 (합체 전에 엔딩이 나오는 식).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  startRun,
  loadStage,
  updateGame,
  inCutscene,
  SKIP_AFTER,
} from '../src/core/game.js';
import { bossCutLength } from '../src/data/bossCutscenes.js';
import { caughtLength } from '../src/data/caughtCut.js';
import { npcTalkLength } from '../src/data/npcTalk.js';
import { STAGES } from '../src/data/stages.js';
import { PHASES, HARD_PHASES } from '../src/data/bossData.js';
import { emptySave } from '../src/core/save.js';

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

/** 컷신을 건너뛴다 — 화면 버튼 「건너뛰기」가 타는 길과 같다 */
const skip = (game) => run(game, SKIP_AFTER + 0.3, { confirmPressed: true });

/**
 * 약점을 한 번 밟는다 — **게임이 실제로 타는 길 그대로.**
 *
 * hitBoss/syncPhase 를 직접 부르면 안 된다. 페이즈가 바뀐 걸 알려주는 건
 * syncPhase 의 반환값이고, 그걸 보고 전환 컷신을 트는 건 game 안의 damageBoss 다.
 * 테스트가 syncPhase 를 먼저 불러버리면 **바뀐 걸 가로채서** 컷신이 영영 안 뜬다
 * (처음에 그렇게 짜서 "전환 컷신이 안 나온다"고 헛짚었다).
 *
 * 그래서 주인공을 보스 머리 위에 놓고 아래로 떨어뜨린다. isStomp 가 보는 것은
 * "내려오는 중이고 보스 높이의 65% 위쪽에 닿았나" 다.
 */
function stomp(game) {
  const { player, boss } = game;
  boss.vulnerable = true;
  boss.invuln = 0;
  // 이 테스트는 순서만 본다 — 보스 공격에 맞아 죽는 건 관심 밖이다.
  // damagePlayer 는 invuln 이 남아 있으면 아무 일도 안 한다.
  player.invuln = 999;
  player.dead = false;
  player.x = boss.x + boss.w / 2 - player.w / 2;
  player.y = boss.y - player.h + 1;
  player.vy = 200;
  updateGame(game, idle(), DT);
  // 보스 안에 계속 서 있으면 다음 프레임부터 몸통에 부딪힌다 — 비켜 세운다
  player.x = boss.x - 200;
}

/**
 * 한 바퀴를 돌면서 컷신이 뜬 순서를 적는다.
 *
 * 판을 실제로 달리지는 않는다 — 골에 닿는 것만 흉내내고(scene = 'stageClear')
 * 나머지는 게임이 제 규칙대로 굴러가게 둔다. 그래야 **순서를 만드는 코드**가
 * 그대로 돌아간다.
 */
function walkThrough({ hard = false, save = {} } = {}) {
  const seen = [];
  const game = createGame({
    seed: 3,
    save: { ...emptySave(), ...save },
    onEvent: (name, data) => {
      if (name === 'cutscene') seen.push(data.id ?? '?');
    },
  });

  /** 컷신과 STAGE 카드를 지나 판이 실제로 굴러갈 때까지 */
  const settle = () => {
    for (let i = 0; i < 200; i += 1) {
      if (game.scene === 'play' || game.scene === 'boss') {
        if (!inCutscene(game)) return;
        skip(game);
      } else if (inCutscene(game)) skip(game);
      else run(game, 0.2); // stageIntro 카드가 지나가길 기다린다
    }
    assert.fail(`판이 시작되지 않는다 (scene ${game.scene})`);
  };

  startRun(game, 0, { hard });
  settle();

  // 판 넷을 골에 닿은 것으로 처리한다
  for (let i = 0; i < STAGES.length; i += 1) {
    assert.equal(game.scene, 'play', `${i + 1}번째 판이 시작되지 않았다`);
    game.scene = 'stageClear';
    game.sceneTime = 99;
    run(game, 0.2);
    settle(); // 다음 판의 STAGE 카드, 또는 마지막 판 뒤의 합체 컷신
  }

  assert.equal(game.scene, 'boss', '판을 다 깼는데 보스전이 아니다');

  // 보스를 끝까지 때린다. 전환 컷신이 뜨면 건너뛰고 계속.
  let guard = 0;
  while (game.scene === 'boss') {
    if (inCutscene(game)) {
      skip(game);
    } else if (game.boss.hp > 0) {
      stomp(game);
      run(game, 0.2);
    } else {
      run(game, 0.3);
    }
    // 밟기는 보스가 약점을 드러낸 순간에만 먹으므로 한 대에 수십 프레임이 든다.
    // 하드 보스는 체력이 12 라 넉넉히 준다 (그래도 1초 안에 끝난다).
    assert.ok((guard += 1) < 3000, `보스전이 안 끝난다 (hp ${game.boss?.hp}, 컷신 ${seen.join(' → ')})`);
  }

  assert.equal(game.scene, 'ending', '보스를 잡았는데 통계 화면이 아니다');
  return seen;
}

test('1회차 — 오프닝 → 합체 → 페이즈 2 → 페이즈 3 → 격파 → 엔딩', () => {
  assert.deepEqual(walkThrough(), [
    'intro',
    'merge',
    'phase2',
    'phase3',
    'bossdown',
    'ending',
  ]);
});

test('오프닝을 이미 봤으면 그것만 빠지고 나머지 순서는 그대로다', () => {
  assert.deepEqual(walkThrough({ save: { seenOpening: true } }), [
    'merge',
    'phase2',
    'phase3',
    'bossdown',
    'ending',
  ]);
});

test('2회차 — 페이즈가 넷이고, 3페이즈는 변신, 엔딩도 다른 것이다', () => {
  // 1회차 보스는 페이즈 셋(PHASES), 2회차는 **넷**(HARD_PHASES)이라 전환 컷신이
  // 하나 더 붙는다. 하드모드는 오프닝을 안 튼다 (이미 다 본 사람이 들어오는 곳이다).
  assert.equal(PHASES.length, 3);
  assert.equal(HARD_PHASES.length, 4);
  assert.deepEqual(walkThrough({ hard: true, save: { seenOpening: true, clearedOnce: true } }), [
    'merge',
    'phase2',
    'hard3',
    'phase4',
    'bossdown',
    'hardEnd',
  ]);
});

test('페이즈 컷신이 순서를 건너뛰지 않는다 — 2 없이 3 이 오면 안 된다', () => {
  const order = walkThrough({ save: { seenOpening: true } });
  assert.ok(order.indexOf('phase2') < order.indexOf('phase3'), '3페이즈가 2페이즈보다 먼저 왔다');
  assert.ok(order.indexOf('bossdown') < order.indexOf('ending'), '쓰러지기 전에 엔딩이 왔다');
  assert.ok(order.indexOf('merge') < order.indexOf('phase2'), '합체 전에 전환 컷신이 왔다');
});

test('같은 컷신이 두 번 뜨지 않는다', () => {
  // 한 번 지난 컷신이 다시 뜨면 이야기가 되돌아간다.
  const order = walkThrough({ save: { seenOpening: true } });
  assert.equal(new Set(order).size, order.length, `겹치는 컷신이 있다: ${order.join(' → ')}`);
});

// ── 건너뛰기 ────────────────────────────────────────────────
//
// 「건너뛰기」 버튼은 키보드와 **똑같은 한 프레임**을 흘려보낸다 (ui/app.js).
// 그래서 버튼이 제대로 동작하는지는 곧 이 규칙들이 맞는지다.

test('컷신 판단은 한 군데뿐이다 — 화면을 덮는 것만 컷신이다', () => {
  const game = createGame({ seed: 1, save: { ...emptySave(), seenOpening: true } });
  loadStage(game, 0);
  run(game, 4); // STAGE 카드를 지나 판으로
  assert.equal(game.scene, 'play');
  assert.equal(inCutscene(game), false, '판이 도는 중은 컷신이 아니다');

  // 화면을 덮는 것들
  game.caught = { t: 0, length: caughtLength() };
  assert.equal(inCutscene(game), true, '잡히는 컷신이 빠져 있다');
  game.caught = null;

  game.bossCut = { id: 'phase2', t: 0, length: bossCutLength('phase2') };
  assert.equal(inCutscene(game), true);
  game.bossCut = null;

  // NPC 대화는 판 위의 작은 말풍선이다 — HUD 도 그대로 있어야 한다
  game.npcTalk = { t: 0, length: npcTalkLength() };
  assert.equal(inCutscene(game), false, 'NPC 대화는 화면을 덮지 않는다');
});

test('잡히는 컷신도 건너뛸 수 있다 — 추격 판에서 계속 보게 되는 컷신이다', () => {
  // 예전에는 이것만 건너뛰기가 없어서 매번 끝까지 봐야 했다.
  const game = createGame({ seed: 1, save: { ...emptySave(), seenOpening: true } });
  loadStage(game, 0);
  run(game, 4);
  game.caught = { t: 0, length: caughtLength() };

  run(game, SKIP_AFTER + 0.2, { confirmPressed: true });
  assert.equal(game.caught, null, '건너뛰었는데 컷신이 안 끝났다');
  // 잡히면 죽는 길로 간다 — 건너뛴다고 살아나는 게 아니다
  assert.ok(game.player.dead || game.scene === 'death', '잡힌 결과가 사라졌다');
});

test('컷신이 시작된 직후에는 못 건너뛴다 — 눌린 점프에 날아가면 안 된다', () => {
  for (const setup of [
    (g) => {
      g.bossCut = { id: 'phase2', t: 0, length: bossCutLength('phase2') };
      return () => g.bossCut;
    },
    (g) => {
      g.caught = { t: 0, length: caughtLength() };
      return () => g.caught;
    },
  ]) {
    const game = createGame({ seed: 1, save: { ...emptySave(), seenOpening: true } });
    loadStage(game, 0);
    run(game, 4);
    const alive = setup(game);

    // 문턱 전까지는 계속 눌러도 안 넘어간다
    run(game, SKIP_AFTER - 0.2, { confirmPressed: true });
    assert.ok(alive(), '시작하자마자 건너뛰어졌다');
  }
});

test('오프닝은 문턱을 넘긴 뒤에만 건너뛰어진다', () => {
  const game = createGame({ seed: 1, save: emptySave() });
  startRun(game);
  assert.equal(game.scene, 'intro');

  run(game, SKIP_AFTER - 0.2, { confirmPressed: true });
  assert.equal(game.scene, 'intro', '시작하자마자 오프닝이 날아갔다');

  run(game, 0.4, { confirmPressed: true });
  assert.notEqual(game.scene, 'intro', '문턱을 넘겼는데도 안 건너뛰어졌다');
});
