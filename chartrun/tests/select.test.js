// 깬 사람에게 열리는 스테이지 선택.
//
// 개발자 모드와 **같은 화면**을 쓰지만 보이는 칸이 다르다. 목록이 줄어들면
// 자리 번호가 밀리므로, 여기서 제일 중요한 건 「화면에 보이는 칸을 골랐을 때
// 그 판이 시작되는가」다 — 이게 어긋나면 화면은 맞는데 엉뚱한 판이 열린다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  updateGame,
  setDevMode,
  selectItems,
  canSelect,
  SELECT_ITEMS,
  SELECT_HARD,
  SELECT_HARD_BOSS,
  SELECT_DEV_OFF,
  stageTable,
} from '../src/core/game.js';
import { STAGES, HARD_STAGES } from '../src/data/stages.js';
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

const step = (game, input, frames = 1) => {
  for (let i = 0; i < frames; i++) updateGame(game, input, DT);
};

/** 오프닝은 이 파일의 관심 밖이라 이미 본 것으로 둔다 */
const gameWith = (save) =>
  createGame({ seed: 4, save: { ...emptySave(), seenOpening: true, ...save } });

const labels = (game) => selectItems(game).map((s) => s.label);

// ── 누구에게 열리나 ─────────────────────────────────────────

test('아직 한 바퀴도 못 깼으면 고를 게 없다 — 예전처럼 바로 시작한다', () => {
  const game = gameWith({});
  assert.equal(canSelect(game), false);
  assert.deepEqual(labels(game), []);

  // 타이틀에서 점프는 곧 시작이다 (메뉴를 거치지 않는다)
  step(game, idle({ confirmPressed: true }));
  assert.notEqual(game.scene, 'select');
  assert.equal(game.titleIndex, 0, '고를 줄이 없으니 줄 번호도 안 움직인다');
});

test('한 바퀴 깨면 스테이지 넷·보스전·2회차 입구가 열린다 — 개발자 칸은 안 보인다', () => {
  const game = gameWith({ clearedOnce: true });
  assert.equal(canSelect(game), true);
  assert.deepEqual(labels(game), [
    'STAGE 1',
    'STAGE 2',
    'STAGE 3',
    'STAGE 4',
    '보스전',
    // 하드 개별 판은 아직 안 보인다. 이 칸이 없으면 **하드를 깨야 하드가 보이는**
    // 닭-달걀이라, 2회차가 있다는 걸 알 방법이 목록에 없다.
    '2회차 입구',
  ]);
});

test('2회차까지 깨면 하드 판까지 열린다 — 개발자 칸은 그래도 안 보인다', () => {
  const game = gameWith({ clearedOnce: true, clearedHard: true });
  assert.deepEqual(labels(game), [
    'STAGE 1',
    'STAGE 2',
    'STAGE 3',
    'STAGE 4',
    '보스전',
    '하드 1판',
    '하드 2판',
    '하드 3판',
    '하드 4판',
    '하드 보스전',
    '2회차 입구',
  ]);
  assert.ok(
    !labels(game).some((l) => l.includes('개발자') || l.includes('컷신') || l.includes('포탈')),
    '이야기 순서를 건너뛰는 칸이 플레이어에게 보인다',
  );
});

test('개발자 모드는 전부 본다 — 그래야 SELECT_* 자리 번호가 그대로 맞는다', () => {
  const game = gameWith({ dev: true });
  assert.deepEqual(selectItems(game), SELECT_ITEMS);
  // 개발자 전용 자리 번호들은 이 목록의 번호다. 필터가 걸리면 어긋난다.
  for (const slot of [SELECT_HARD, SELECT_HARD_BOSS, SELECT_DEV_OFF]) {
    assert.equal(selectItems(game)[slot], SELECT_ITEMS[slot]);
  }
});

// ── 고른 칸과 열리는 판이 같은가 ← 제일 중요 ────────────────

test('보이는 칸을 고르면 그 판이 열린다 (한 바퀴 깬 사람)', () => {
  // 목록이 짧아지면서 자리가 밀렸다면 여기서 걸린다.
  const save = { clearedOnce: true };
  const slots = labels(gameWith(save));
  slots.forEach((label, i) => {
    const game = gameWith(save);
    game.scene = 'select';
    game.selectIndex = i;
    step(game, idle({ confirmPressed: true }));

    assert.equal(game.hard, false, `"${label}" 은 1회차 판이어야 한다`);
    if (label === '2회차 입구') {
      // 판 번호가 아니라 **입구**다 — 포탈이 열린 스테이지 1 로 간다
      assert.equal(game.world.stage.id, STAGES[0].id, '2회차 입구가 스테이지 1 이 아니다');
      return;
    }
    if (label === '보스전') {
      assert.ok(game.boss, `"${label}" 을 골랐는데 보스가 없다`);
    } else {
      const number = Number(label.replace('STAGE ', ''));
      assert.equal(game.world.stage.id, STAGES[number - 1].id, `"${label}" 이 엉뚱한 판을 연다`);
    }
  });
});

test('하드 칸을 고르면 하드 판이 열린다 (2회차까지 깬 사람)', () => {
  const save = { clearedOnce: true, clearedHard: true };
  const slots = labels(gameWith(save));
  slots.forEach((label, i) => {
    if (!label.startsWith('하드')) return;
    const game = gameWith(save);
    game.scene = 'select';
    game.selectIndex = i;
    step(game, idle({ confirmPressed: true }));

    assert.equal(game.hard, true, `"${label}" 인데 하드모드가 아니다`);
    if (label === '하드 보스전') {
      assert.ok(game.boss, `"${label}" 을 골랐는데 보스가 없다`);
    } else {
      const number = Number(label.replace('하드 ', '').replace('판', ''));
      assert.equal(game.world.stage.id, HARD_STAGES[number - 1].id, `"${label}" 이 엉뚱한 판을 연다`);
      assert.equal(stageTable(game), HARD_STAGES, '하드 판인데 표가 1회차 표다');
    }
  });
});

// ── 목록을 돌아다니기 ───────────────────────────────────────

test('◀▶ 는 보이는 칸 안에서만 돈다', () => {
  const game = gameWith({ clearedOnce: true });
  const count = selectItems(game).length;
  game.scene = 'select';
  game.selectIndex = 0;

  step(game, idle({ leftPressed: true }));
  assert.equal(game.selectIndex, count - 1, '왼쪽 끝에서 오른쪽 끝으로 돌아야 한다');
  step(game, idle({ rightPressed: true }));
  assert.equal(game.selectIndex, 0);
});

test('개발자 모드를 끄면 고른 자리가 처음으로 돌아간다', () => {
  // 목록이 14칸에서 5칸으로 줄어든다 — 자리를 안 되돌리면 범위 밖을 가리킨다
  const game = gameWith({ clearedOnce: true, dev: true });
  game.selectIndex = SELECT_DEV_OFF;
  setDevMode(game, false);
  assert.equal(game.selectIndex, 0);
  assert.ok(game.selectIndex < selectItems(game).length, '고른 자리가 목록 밖이다');
});

test('깬 판을 다시 골라도 최고 기록은 안 망가진다', () => {
  // 2판만 골라 깨고 "최고 기록"이 되면 기록이 거짓말이 된다.
  // (STAGE 1 을 골라 끝까지 달리는 건 정상 한 바퀴이므로 기록으로 남는다)
  const game = gameWith({ clearedOnce: true });
  game.scene = 'select';
  game.selectIndex = labels(game).indexOf('STAGE 2');
  step(game, idle({ confirmPressed: true }));
  assert.equal(game.partial, true, '골라 들어간 판인데 기록을 갱신할 판으로 잡혔다');

  const first = gameWith({ clearedOnce: true });
  first.scene = 'select';
  first.selectIndex = labels(first).indexOf('STAGE 1');
  step(first, idle({ confirmPressed: true }));
  assert.equal(first.partial, false, '1판부터 달리는 건 정상 한 바퀴다');
});

// ── 탭으로 누르는 길이 타는 core 경로 ───────────────────────
// (탭 자체는 ui/app.js 가 합성 입력 한 프레임으로 바꿔 흘린다 — 그 프레임이
//  core 에서 뭘 하는지를 여기서 못 박는다. 브라우저에서도 따로 확인했다.)

test('타이틀에서 「스테이지 선택」 줄을 고르고 확인하면 선택 화면으로 간다', () => {
  const game = gameWith({ clearedOnce: true });
  game.titleIndex = 1;
  step(game, idle({ confirmPressed: true }));
  assert.equal(game.scene, 'select');
  assert.equal(game.selectIndex, 0, '들어올 때는 첫 칸부터');
});

test('선택 화면에서 「뒤로」는 타이틀로 되돌린다 — 판이 시작되지 않는다', () => {
  // 폰에는 R 키가 없어서 이 경로가 막히면 선택 화면에서 나갈 방법이 없다.
  const game = gameWith({ clearedOnce: true });
  game.scene = 'select';
  game.selectIndex = 2;
  step(game, idle({ restartPressed: true }));
  assert.equal(game.scene, 'title');
  assert.equal(game.world, null, '뒤로 눌렀는데 판이 실렸다');
});
