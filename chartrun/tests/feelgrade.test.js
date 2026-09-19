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
  loadBoss,
  startRun,
  PAUSE_ROWS,
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
