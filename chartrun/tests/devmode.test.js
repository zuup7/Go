// 개발자 모드와 스테이지 선택.
// 제일 중요한 건 "평소 진행이 그대로인가" 와 "골라 들어간 판이 기록을 더럽히지 않는가" 다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  updateGame,
  startRun,
  setDevMode,
  runSummary,
  SELECT_OPENING,
  SELECT_DEV_OFF,
  SELECT_SLOTS,
} from '../src/core/game.js';
import { DEV_CODE, pushDigit, codeMatches, KEYPAD } from '../src/core/devmode.js';
import { emptySave, mergeRun, deserialize, serialize } from '../src/core/save.js';
import { STAGES } from '../src/data/stages.js';

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

/** 한 프레임 */
const tap = (game, over) => updateGame(game, idle(over), DT);

/** 오프닝을 이미 본 판 — 여기 테스트들은 오프닝이 아니라 개발자 모드를 본다 */
const played = (seed = 1) => createGame({ seed, save: { ...emptySave(), seenOpening: true } });

/** 여러 자리를 차례로 넣는다 */
const type = (digits) => [...String(digits)].reduce((buf, d) => pushDigit(buf, d), '');

// ── 비밀번호 ────────────────────────────────────────────────
test('마지막 네 자리만 남는다', () => {
  assert.equal(type('1'), '1');
  assert.equal(type('12'), '12');
  assert.equal(type('1234'), '1234');
  // 한 자 더 넣으면 앞이 밀린다
  assert.equal(type('12345'), '2345');
});

test('앞에서 헛손질해도 뒤 네 자리가 맞으면 열린다', () => {
  assert.ok(codeMatches(type('991234')));
  assert.ok(codeMatches(type(DEV_CODE)));
});

test('틀린 번호로는 안 열린다', () => {
  for (const wrong of ['1235', '4321', '0000', '', '123']) {
    assert.equal(codeMatches(type(wrong)), false, `${wrong} 로 열렸다`);
  }
});

test('숫자판에 0~9 와 지우기·닫기가 다 있다', () => {
  for (let d = 0; d <= 9; d++) assert.ok(KEYPAD.includes(String(d)), `${d} 이 없다`);
  assert.ok(KEYPAD.includes('back'));
  assert.ok(KEYPAD.includes('close'));
});

// ── 평소 진행은 그대로 ──────────────────────────────────────
test('개발자 모드를 안 켰으면 타이틀에서 바로 시작한다 — 예전과 같다', () => {
  const game = played();
  assert.equal(game.dev, false);
  tap(game, { confirmPressed: true });
  assert.equal(game.scene, 'stageIntro', '바로 1스테이지로 가야 한다');
  assert.equal(game.stageIndex, 0);
  assert.equal(game.partial, false);
});

test('개발자 모드가 꺼져 있으면 ◀▶ 를 눌러도 선택 화면이 안 열린다', () => {
  const game = played();
  tap(game, { rightPressed: true });
  assert.equal(game.titleIndex, 0, '고를 줄 자체가 없어야 한다');
  tap(game, { confirmPressed: true });
  assert.equal(game.scene, 'stageIntro');
});

// ── 켠 뒤 ───────────────────────────────────────────────────
test('켜면 타이틀에서 스테이지 선택으로 갈 수 있다', () => {
  const game = played();
  setDevMode(game, true);
  tap(game, { rightPressed: true });
  assert.equal(game.titleIndex, 1);
  tap(game, { confirmPressed: true });
  assert.equal(game.scene, 'select');
});

test('선택 화면에서 뒤로 나올 수 있다', () => {
  const game = played();
  setDevMode(game, true);
  game.scene = 'select';
  tap(game, { restartPressed: true });
  assert.equal(game.scene, 'title');
});

test('선택 화면 마지막 칸은 개발자 모드 끄기다', () => {
  const game = played();
  setDevMode(game, true);
  game.scene = 'select';
  game.selectIndex = SELECT_DEV_OFF;
  tap(game, { confirmPressed: true });
  assert.equal(game.dev, false);
  assert.equal(game.scene, 'title');
});

test('오프닝 다시 보기 칸이 오프닝을 다시 튼다', () => {
  // 오프닝은 한 번 보면 저절로는 안 뜬다 — 여기가 유일하게 다시 보는 길이다
  const game = played();
  setDevMode(game, true);
  game.scene = 'select';
  game.selectIndex = SELECT_OPENING;
  tap(game, { confirmPressed: true });
  assert.equal(game.scene, 'intro');
  assert.equal(game.cutsceneTime, 0, '처음부터 다시 틀어야 한다');
});

test('칸 고르기가 양끝에서 돌아간다', () => {
  const game = played();
  setDevMode(game, true);
  game.scene = 'select';
  tap(game, { leftPressed: true });
  assert.equal(game.selectIndex, SELECT_SLOTS - 1, '왼쪽 끝에서 오른쪽 끝으로 돌아야 한다');
  tap(game, { rightPressed: true });
  assert.equal(game.selectIndex, 0);
});

// ── 골라 들어가기 ───────────────────────────────────────────
test('고른 스테이지에서 시작하고 순위도 거기서 시작한다', () => {
  const game = played();
  startRun(game, 2);
  assert.equal(game.stageIndex, 2);
  assert.equal(game.scene, 'stageIntro');
  assert.equal(game.rank, 20, '3스테이지는 #20 부터다');
  assert.equal(game.partial, true);
});

test('마지막 칸 다음은 보스전이다', () => {
  const game = played();
  startRun(game, STAGES.length);
  assert.equal(game.scene, 'boss');
  assert.ok(game.boss, '보스가 있어야 한다');
  assert.equal(game.partial, true);
});

test('처음부터 시작한 판은 partial 이 아니다', () => {
  const game = played();
  startRun(game, 2);
  startRun(game); // 다시 처음부터
  assert.equal(game.partial, false);
  assert.equal(game.stageIndex, 0);
});

// ── 기록 보호 (제일 중요) ───────────────────────────────────
test('골라 들어간 판은 최고 기록·최고 순위를 갱신하지 않는다', () => {
  const before = { ...emptySave(), bestRank: 40, bestTimeMs: 90_000 };
  const after = mergeRun(before, { rank: 1, timeMs: 1000, chartOuts: 2, partial: true });

  assert.equal(after.bestRank, 40, '보스만 골라 이기고 1위 기록이 되면 안 된다');
  assert.equal(after.bestTimeMs, 90_000, '한 스테이지만 뛰고 최고 기록이 되면 안 된다');
  assert.equal(after.chartOuts, 2, '죽은 횟수는 그대로 쌓아도 된다');
});

test('처음부터 달린 판은 기록을 갱신한다', () => {
  const before = { ...emptySave(), bestRank: 40, bestTimeMs: 90_000 };
  const after = mergeRun(before, { rank: 1, timeMs: 1000, chartOuts: 0, partial: false });
  assert.equal(after.bestRank, 1);
  assert.equal(after.bestTimeMs, 1000);
});

test('요약에 partial 이 실려 나간다', () => {
  const game = played();
  startRun(game, 3);
  assert.equal(runSummary(game).partial, true);
});

// ── 저장 ────────────────────────────────────────────────────
test('dev 칸이 없는 옛 저장값을 읽어도 안 깨진다', () => {
  const old = JSON.stringify({
    version: 1,
    savedAt: 0,
    data: { bestRank: 12, chartOuts: 3, clearedStages: [0], revealedTraps: [] },
  });
  const save = deserialize(old);
  assert.equal(save.dev, false, '없으면 꺼진 것으로 봐야 한다');
  assert.equal(save.bestRank, 12, '나머지는 그대로 살아 있어야 한다');
});

test('켠 상태가 저장을 거쳐 살아남는다', () => {
  const save = deserialize(serialize({ ...emptySave(), dev: true }));
  assert.equal(save.dev, true);
  const game = createGame({ save });
  assert.equal(game.dev, true, '새로고침해도 켜져 있어야 한다');
});
