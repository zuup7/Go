// 연출의 **등급**. 사건마다 세기가 다르다는 규칙을 코드가 지키는지 본다.
//
// 이 파일이 생긴 이유: 보스를 아홉 번 때리는데 아홉 번째(마지막 일격)가 앞의
// 여덟 번보다 초라했다. 분기가 `changed` 아니면 `hp > 0` 두 갈래라, hp 가 0 이
// 되는 순간에는 **어느 쪽도 실행되지 않았다.** 눈으로는 못 잡는 종류의 어긋남이라
// 규칙으로 박아둔다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  updateGame,
  loadStage,
  loadBoss,
  startRun,
  PAUSE_ROWS,
  FREEZE,
  freezeGame,
  SKIP_AFTER,
} from '../src/core/game.js';
import { emptySave } from '../src/core/save.js';
import { BOSS_MAX_HP } from '../src/data/bossData.js';

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

const step = (game, input = idle(), frames = 1) => {
  for (let i = 0; i < frames; i++) updateGame(game, input, DT);
};

/** 보스전에 들어간 판. 이벤트를 전부 받아 적는다 */
function bossGame() {
  const heard = [];
  const game = createGame({
    seed: 3,
    save: { ...emptySave(), seenOpening: true },
    onEvent: (name, data) => heard.push({ name, data }),
  });
  startRun(game);
  loadBoss(game);
  heard.length = 0;
  return { game, heard };
}

const namesOf = (heard) => heard.map((e) => e.name);

/**
 * 보스를 한 대 때린다.
 *
 * **진짜 밟기로 때린다.** `boss.vulnerable` 은 상태 기계가 매 프레임 다시 정하므로
 * 밖에서 켜봐야 그 프레임에 도로 꺼진다 — 열릴 때까지 기다렸다가 그 순간 발을 얹는다.
 * (던진 마이크는 중력을 받는 포물선이라 보스가 움직이면 빗나간다. 한 번 물렸다.)
 */
function hitOnce(game, heard) {
  const before = game.boss.hp;
  for (let i = 0; i < 3000 && game.boss.hp === before; i++) {
    // 페이즈 전환 컷신이 돌면 끝날 때까지 흘려보낸다
    if (game.bossCut) {
      step(game);
      continue;
    }
    // 날아다니는 탄에 죽으면 이 판정 자체가 못 끝난다. 여기서 볼 건 그게 아니다.
    game.player.invuln = 99;
    const b = game.boss;
    heard.length = 0;
    if (b.vulnerable) {
      // isStomp: 떨어지는 중(vy > 0) + 발이 보스 위쪽 65% 안
      game.player.x = b.x + b.w / 2 - game.player.w / 2;
      game.player.y = b.y - game.player.h + 2;
      game.player.vy = 120;
      game.player.onGround = false;
    }
    step(game);
  }
  assert.ok(game.boss.hp < before, '보스를 한 대 때려야 이 다음 이야기가 성립한다');
  return namesOf(heard);
}

// ── 보스 타격 등급 ──────────────────────────────────────────

test('평타에는 "쓰러진다" 팡파르가 안 나간다', () => {
  const { game, heard } = bossGame();
  const names = hitOnce(game, heard);
  assert.ok(names.includes('bosshit'), '맞은 소리는 나야 한다');
  assert.ok(
    !names.includes('bossdown'),
    'bossdown 은 1초짜리 하강 아르페지오다. 평타마다 나가면 다음 타격 위로 겹친다',
  );
  assert.ok(game.boss.hp > 0);
});

test('**마지막 일격이 평타보다 약하지 않다**', () => {
  const { game, heard } = bossGame();

  // 마지막 한 대만 남기고 때린다. **직전 평타**의 세기를 재 둔다 — 그게 비교 대상이다
  let plain = null;
  for (let i = 0; i < BOSS_MAX_HP - 1; i++) {
    const names = hitOnce(game, heard);
    if (!names.includes('phase')) plain = { flash: game.flash, shake: game.camera.shake };
  }
  assert.equal(game.boss.hp, 1, '한 대만 남아 있어야 한다');
  assert.ok(plain, '평타의 세기를 재 둬야 비교가 된다');

  const names = hitOnce(game, heard);
  assert.equal(game.boss.hp, 0);

  assert.ok(
    names.includes('bossdown'),
    '진짜 쓰러뜨렸을 때 쓰러지는 소리가 나야 한다 — 이름이 사실이 되는 자리다',
  );
  assert.ok(game.flash > plain.flash, `마지막 일격의 플래시(${game.flash})가 평타(${plain.flash})보다 세야 한다`);
  assert.ok(game.camera.shake > plain.shake, '흔들림도 마찬가지다');
});

test('페이즈 전환은 컷신을 틀고, 마지막 일격은 안 튼다', () => {
  const { game, heard } = bossGame();
  let sawPhase = false;
  for (let i = 0; i < BOSS_MAX_HP; i++) {
    const names = hitOnce(game, heard);
    if (names.includes('phase')) {
      sawPhase = true;
      assert.ok(game.bossCut, '페이즈가 바뀌면 전환 컷신이 돈다');
    }
  }
  assert.ok(sawPhase, '아홉 대를 때리는 동안 페이즈는 바뀌어야 한다');
  assert.equal(game.boss.hp, 0);
  assert.ok(!game.bossCut, '마지막 일격은 페이즈 컷신을 틀지 않는다 — 쓰러지는 컷신이 따로 온다');
});

// ── 보스 탄막 ──────────────────────────────────────────────

test('보스가 탄을 쏘면 소리가 난다 — 한 무더기에 한 번', () => {
  const { game, heard } = bossGame();
  // 탄이 나갈 때까지 굴린다 (phase.fireEvery 마다 한 무더기)
  let fired = 0;
  for (let i = 0; i < 1200; i++) {
    heard.length = 0;
    const before = game.shots.length;
    step(game);
    const spawned = game.shots.length - before;
    const shots = namesOf(heard).filter((n) => n === 'shot').length;
    if (spawned > 0) {
      fired += 1;
      assert.equal(shots, 1, `탄 ${spawned}발이 나갔는데 소리는 한 번이어야 한다 (${shots}번)`);
    } else {
      assert.equal(shots, 0, '탄이 안 나갔는데 소리가 났다');
    }
    if (fired >= 2) break;
  }
  assert.ok(fired >= 2, '탄막이 나가는 걸 두 번은 봐야 한다');
});

// ── 폰에서 소리 끄기 ────────────────────────────────────────

test('일시정지 메뉴에 음소거 줄이 있다 — 폰에는 M 키가 없다', () => {
  assert.ok(PAUSE_ROWS.includes('mute'));
});

test('음소거 줄을 고르면 알리고, 멈춘 채로 남는다', () => {
  const heard = [];
  const game = createGame({
    seed: 3,
    save: { ...emptySave(), seenOpening: true },
    onEvent: (name) => heard.push(name),
  });
  startRun(game);
  game.scene = 'play';
  step(game, idle({ pausePressed: true }));
  assert.equal(game.paused, true);

  // 음소거 줄로 옮긴다
  for (let i = 0; i < PAUSE_ROWS.length && PAUSE_ROWS[game.pauseIndex] !== 'mute'; i++) {
    step(game, idle({ rightPressed: true }));
  }
  assert.equal(PAUSE_ROWS[game.pauseIndex], 'mute');

  heard.length = 0;
  step(game, idle({ confirmPressed: true }));
  assert.ok(heard.includes('mute'), '소리를 끄라고 알리지 않았다');
  assert.equal(game.paused, true, '소리 줄은 멈춘 채로 머문다 — 바로 들어보고 싶기 때문이다');
});

// ── 히트스톱 ───────────────────────────────────────────────

test('히트스톱 세기가 사건의 무게 순서를 지킨다', () => {
  assert.ok(FREEZE.stomp < FREEZE.bossHit, '앨범 밟기가 보스 평타보다 짧아야 한다');
  assert.ok(FREEZE.bossHit < FREEZE.bossBig, '평타가 마지막 일격보다 짧아야 한다');
  assert.ok(FREEZE.death <= FREEZE.bossBig);
  // 한 판에 스무 번 넘게 하는 일이다. 0.05초(3프레임)를 넘기면 판이 끊긴다
  assert.ok(FREEZE.stomp <= 3, `밟기 멈춤이 ${FREEZE.stomp}프레임이면 너무 길다`);
});

test('더 센 멈춤이 이긴다 — 약한 사건이 큰 사건의 여운을 못 자른다', () => {
  const game = createGame({ seed: 1, save: { ...emptySave(), seenOpening: true } });
  freezeGame(game, FREEZE.bossBig);
  freezeGame(game, FREEZE.stomp);
  assert.equal(game.freeze, FREEZE.bossBig);
});

test('멈춘 동안 판은 서고, **화면 흔들림과 파티클은 계속 돈다**', () => {
  const game = createGame({ seed: 1, save: { ...emptySave(), seenOpening: true } });
  startRun(game);
  loadStage(game, 0);
  game.scene = 'play';
  game.sceneTime = 0;
  step(game, idle(), 10);

  // 흔들림과 파티클을 깔아두고 멈춘다
  game.camera.shake = 1.5;
  game.particles.push({ x: 0, y: 0, vx: 10, vy: 0, life: 1, max: 1, size: 2, color: '#fff', gravity: 0 });
  const shakeBefore = game.camera.shake;
  const partBefore = game.particles[0].x;
  const px = game.player.x;
  const py = game.player.y;

  freezeGame(game, 3);
  step(game, idle({ right: true }));

  assert.equal(game.player.x, px, '멈춘 동안 플레이어가 움직이면 안 된다');
  assert.equal(game.player.y, py, '중력도 안 먹어야 한다');
  assert.ok(game.camera.shake < shakeBefore, '흔들림은 계속 줄어야 한다 — 멈춘 화면이 떨려야 충격이다');
  assert.ok(game.particles[0].x > partBefore, '튄 조각도 계속 날아가야 한다');
});

test('멈춤이 끝나면 정확히 그만큼만 쉬고 돌아온다', () => {
  const game = createGame({ seed: 1, save: { ...emptySave(), seenOpening: true } });
  startRun(game);
  loadStage(game, 0);
  game.scene = 'play';
  step(game, idle(), 10);

  freezeGame(game, 3);
  const px = game.player.x;
  step(game, idle({ right: true }), 3);
  assert.equal(game.player.x, px, '세 프레임 동안은 그대로');
  assert.equal(game.freeze, 0, '세 프레임이면 다 풀려야 한다');

  step(game, idle({ right: true }));
  assert.ok(game.player.x > px, '풀리면 다시 움직인다');
});

test('멈춤은 시간 기록을 늦춰주지 않는다', () => {
  const game = createGame({ seed: 1, save: { ...emptySave(), seenOpening: true } });
  startRun(game);
  loadStage(game, 0);
  game.scene = 'play';
  const before = game.elapsedMs;
  freezeGame(game, 6);
  step(game, idle(), 6);
  assert.ok(game.elapsedMs > before, '멈춰 있어도 시계는 간다 — 안 그러면 히트스톱이 기록을 깎아준다');
});

// ── 죽음·클리어 건너뛰기 ────────────────────────────────────

/** 판에 들어가 죽인다 */
function dieIn(game) {
  game.scene = 'death';
  game.sceneTime = 0;
  game.freeze = 0;
}

test('죽는 연출을 건너뛸 수 있다 — 트롤 게임이라 수십 번 죽는다', () => {
  const game = createGame({ seed: 1, save: { ...emptySave(), seenOpening: true } });
  startRun(game);
  loadStage(game, 0);
  dieIn(game);

  // 최소 시간 전에는 안 먹는다 (죽은 순간 눌려 있던 점프가 연출을 날리면 안 된다)
  step(game, idle({ confirmPressed: true }), 10);
  assert.equal(game.scene, 'death', `${SKIP_AFTER}초 전에는 안 건너뛴다`);

  step(game, idle(), 30);
  step(game, idle({ confirmPressed: true }));
  assert.notEqual(game.scene, 'death', '최소 시간이 지나면 바로 되살아난다');
});

test('스테이지 클리어 연출도 건너뛸 수 있다', () => {
  const game = createGame({ seed: 1, save: { ...emptySave(), seenOpening: true } });
  startRun(game);
  loadStage(game, 0);
  game.scene = 'stageClear';
  game.sceneTime = 0;

  step(game, idle({ confirmPressed: true }), 10);
  assert.equal(game.scene, 'stageClear', `${SKIP_AFTER}초 전에는 안 건너뛴다`);

  step(game, idle(), 30);
  step(game, idle({ confirmPressed: true }));
  assert.notEqual(game.scene, 'stageClear', '최소 시간이 지나면 다음 판으로');
});
