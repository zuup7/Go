// 일시정지. 멈추는 것보다 **다시 풀리는 것**이 중요하다 —
// 멈춘 채로 장면이 바뀌면 아무 키도 안 먹어서 게임이 영영 잠긴다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, loadStage, loadBoss, updateGame, PAUSE_ROWS } from '../src/core/game.js';
import { VOLUME_STEPS, nextVolume } from '../src/core/audio.js';
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

/** 오프닝은 이 파일의 관심 밖이라 이미 본 것으로 두고 시작한다 */
const played = () => ({ ...emptySave(), seenOpening: true });

/** 스테이지 1 을 실제로 굴러가는 상태로 */
function playing(seed = 4) {
  const game = createGame({ seed, save: played() });
  loadStage(game, 0);
  // stageIntro 를 넘겨 play 로
  for (let i = 0; i < 200; i++) updateGame(game, idle(), DT);
  assert.equal(game.scene, 'play');
  return game;
}

const pause = (game) => updateGame(game, idle({ pausePressed: true }), DT);
const confirm = (game) => updateGame(game, idle({ confirmPressed: true }), DT);
const move = (game, dir) =>
  updateGame(game, idle(dir > 0 ? { rightPressed: true } : { leftPressed: true }), DT);

/** 지금 고른 줄 이름 */
const row = (game) => PAUSE_ROWS[game.pauseIndex];

/** 그 줄이 나올 때까지 오른쪽으로 옮긴다 */
function pick(game, name) {
  for (let i = 0; i < PAUSE_ROWS.length && row(game) !== name; i++) move(game, 1);
  assert.equal(row(game), name, `${name} 줄로 못 갔다`);
}

// ── 언제 멈추나 ─────────────────────────────────────────────
test('판이 도는 동안에만 멈춘다', () => {
  const title = createGame({ seed: 1, save: played() });
  pause(title);
  assert.equal(title.paused, false, '타이틀에서 멈추면 아무 키도 안 먹어 잠긴다');

  const game = playing();
  pause(game);
  assert.equal(game.paused, true);

  const boss = createGame({ seed: 2, save: played() });
  loadBoss(boss);
  pause(boss);
  assert.equal(boss.paused, true, '보스전에서도 멈춰야 한다');
});

test('멈춘 동안에는 아무것도 안 움직인다', () => {
  const game = playing();
  // 조금 달려서 시간·자리를 벌어둔다
  for (let i = 0; i < 30; i++) updateGame(game, idle({ right: true }), DT);
  pause(game);

  const px = game.player.x;
  const py = game.player.y;
  const ms = game.elapsedMs;
  const albums = game.albums.map((a) => a.x);

  for (let i = 0; i < 60; i++) updateGame(game, idle({ right: true, jump: true }), DT);

  assert.equal(game.player.x, px, '멈췄는데 플레이어가 움직였다');
  assert.equal(game.player.y, py);
  assert.equal(game.elapsedMs, ms, '멈췄는데 시간이 흘렀다');
  assert.deepEqual(game.albums.map((a) => a.x), albums, '멈췄는데 앨범이 움직였다');
});

test('다시 누르면 풀린다', () => {
  const game = playing();
  pause(game);
  pause(game);
  assert.equal(game.paused, false);
});

// ── 메뉴 ────────────────────────────────────────────────────
test('멈출 때마다 맨 윗줄에서 시작한다', () => {
  const game = playing();
  pause(game);
  move(game, 1);
  move(game, 1);
  pause(game); // 풀고
  pause(game); // 다시 멈춘다
  assert.equal(game.pauseIndex, 0, '지난번에 고르던 줄이 남아 있으면 헷갈린다');
});

test('◀▶ 로 줄이 돌고, 끝에서 되돌아온다', () => {
  const game = playing();
  pause(game);
  assert.equal(row(game), 'resume');
  for (let i = 0; i < PAUSE_ROWS.length; i++) move(game, 1);
  assert.equal(row(game), 'resume', '한 바퀴 돌면 제자리');
  move(game, -1);
  assert.equal(row(game), PAUSE_ROWS[PAUSE_ROWS.length - 1], '맨 앞에서 왼쪽이면 맨 뒤로');
});

test('이어하기를 고르면 풀린다', () => {
  const game = playing();
  pause(game);
  pick(game, 'resume');
  confirm(game);
  assert.equal(game.paused, false);
  assert.equal(game.scene, 'play');
});

test('타이틀로 나가면 멈춤도 같이 풀린다', () => {
  // 이게 이 파일의 핵심이다 — 멈춘 채로 타이틀에 가면 아무 키도 안 먹어서 게임이 잠긴다
  const game = playing();
  pause(game);
  pick(game, 'title');
  confirm(game);
  assert.equal(game.scene, 'title');
  assert.equal(game.paused, false, '멈춘 채로 타이틀에 가면 게임이 영영 잠긴다');

  // 실제로 다시 시작되는지까지 본다
  confirm(game);
  assert.notEqual(game.scene, 'title', '타이틀에서 확인이 안 먹는다');
});

test('다시하기는 죽음을 거쳐 체크포인트로 돌아가고 멈춤이 풀린다', () => {
  const game = playing();
  const outs = game.chartOuts;
  pause(game);
  pick(game, 'retry');
  confirm(game);
  assert.equal(game.paused, false);
  assert.equal(game.scene, 'death');
  assert.equal(game.chartOuts, outs + 1, 'R 키와 같은 길이어야 한다');

  // 죽음 연출이 끝나면 살아난다
  for (let i = 0; i < 200; i++) updateGame(game, idle(), DT);
  assert.equal(game.scene, 'play');
  assert.equal(game.player.dead, false);
});

test('소리 줄은 멈춤을 풀지 않고 알리기만 한다', () => {
  // core 는 소리를 모른다. 실제로 크기를 바꾸는 건 ui 다.
  const game = playing();
  const heard = [];
  game.onEvent = (name) => heard.push(name);
  pause(game);
  pick(game, 'volume');
  confirm(game);
  assert.ok(heard.includes('volume'), '소리를 바꾸라고 알리지 않았다');
  assert.equal(game.paused, true, '소리를 만지다가 판이 다시 돌면 안 된다');
});

// ── 소리 크기 ───────────────────────────────────────────────
test('소리 크기가 버튼 하나로 한 바퀴 돈다', () => {
  let v = VOLUME_STEPS[0];
  const seen = [v];
  for (let i = 0; i < VOLUME_STEPS.length; i++) {
    v = nextVolume(v);
    seen.push(v);
  }
  assert.deepEqual(seen.slice(0, VOLUME_STEPS.length), VOLUME_STEPS, '순서대로 올라가야 한다');
  assert.equal(seen[seen.length - 1], VOLUME_STEPS[0], '끝에서 처음으로 돌아와야 한다');
});

test('모르는 크기가 저장돼 있어도 다음 칸이 나온다', () => {
  // 손으로 고친 저장이나 옛 저장 때문에 여기서 undefined 가 나오면 소리가 영영 안 바뀐다
  assert.ok(VOLUME_STEPS.includes(nextVolume(0.42)));
  assert.ok(VOLUME_STEPS.includes(nextVolume(undefined)));
});

test('새 저장에는 소리 크기 칸이 있고 최대다', () => {
  assert.equal(emptySave().volume, 1);
  assert.ok(VOLUME_STEPS.includes(emptySave().volume));
});
