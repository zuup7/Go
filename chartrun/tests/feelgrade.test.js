// 연출의 **등급**. 사건마다 세기가 다르다는 규칙을 코드가 지키는지 본다.
//
// 이 파일이 생긴 이유: 보스를 아홉 번 때리는데 아홉 번째(마지막 일격)가 앞의
// 여덟 번보다 초라했다. 분기가 `changed` 아니면 `hp > 0` 두 갈래라, hp 가 0 이
// 되는 순간에는 **어느 쪽도 실행되지 않았다.** 눈으로는 못 잡는 종류의 어긋남이라
// 규칙으로 박아둔다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  ENDING_LOCK,
  BOSS_CUT_GAP,
  inCutscene,
} from '../src/core/game.js';
import { emptySave } from '../src/core/save.js';
import { DEATH_FLY } from '../src/core/enemy.js';
import { bossHealthRatio, bossGhostRatio } from '../src/core/boss.js';
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

// ── 적이 죽는 과정 ─────────────────────────────────────────

test('밟힌 앨범은 **튕겨 날아간다** — 그 자리에서 사라지지 않는다', () => {
  const game = createGame({ seed: 5, save: { ...emptySave(), seenOpening: true } });
  startRun(game);
  loadStage(game, 0);
  game.scene = 'play';
  step(game, idle(), 5);

  const album = game.albums.find((a) => a.alive && a.stompable && a.hp === 1);
  assert.ok(album, '밟아서 한 방에 죽는 앨범이 있어야 한다');

  // 왼쪽에서 밟는다 → 오른쪽으로 날아가야 한다
  game.player.x = album.x + album.w / 2 - game.player.w - 1;
  game.player.y = album.y - game.player.h + 1;
  game.player.vy = 140;
  game.player.onGround = false;
  const x0 = album.x;
  step(game);
  assert.equal(album.alive, false, '한 방에 죽는 앨범이어야 이 다음이 성립한다');

  game.freeze = 0; // 히트스톱을 건너뛴다 — 여기서 볼 건 날아가는 쪽이다
  step(game, idle(), 6);
  assert.ok(game.albums.includes(album), '죽자마자 목록에서 빠지면 날아갈 틈이 없다');
  assert.ok(album.x > x0, `밟은 반대쪽으로 날아가야 한다 (${x0} → ${album.x})`);
  assert.ok(album.dying > 0, '죽는 시간이 흘러야 한다');
});

test('날아가던 앨범은 때가 되면 사라진다 — 영원히 남지 않는다', () => {
  const game = createGame({ seed: 5, save: { ...emptySave(), seenOpening: true } });
  startRun(game);
  loadStage(game, 0);
  game.scene = 'play';
  step(game, idle(), 5);
  const album = game.albums.find((a) => a.alive && a.stompable && a.hp === 1);

  game.player.x = album.x;
  game.player.y = album.y - game.player.h + 1;
  game.player.vy = 140;
  game.player.onGround = false;
  step(game);
  game.freeze = 0;

  step(game, idle(), Math.ceil(DEATH_FLY * 60) + 10);
  assert.ok(!game.albums.includes(album), '다 날아간 시체는 목록에서 빠져야 한다');
});

test('구멍에 빠져 사라진 앨범은 날아가지 않는다', () => {
  const game = createGame({ seed: 5, save: { ...emptySave(), seenOpening: true } });
  startRun(game);
  loadStage(game, 0);
  const album = game.albums.find((a) => a.alive);
  album.alive = false; // 밟힌 게 아니라 그냥 사라진 경우
  assert.equal(album.dying, undefined, '밟혀 죽은 게 아니면 날아갈 이유가 없다');
});

// ── 보스 체력계 잔상 ────────────────────────────────────────

test('체력계 잔상이 실제 체력을 **뒤늦게** 따라온다', () => {
  const { game, heard } = bossGame();
  const full = bossHealthRatio(game.boss);
  assert.equal(bossGhostRatio(game.boss), full, '처음에는 둘이 같다');

  hitOnce(game, heard);
  const after = bossHealthRatio(game.boss);
  assert.ok(after < full, '체력이 줄어야 한다');
  assert.ok(
    bossGhostRatio(game.boss) > after,
    '잔상은 아직 위에 남아 있어야 한다 — 그래야 방금 얼마나 깎였는지 보인다',
  );

  // 시간이 지나면 따라잡는다
  game.freeze = 0;
  step(game, idle(), 40);
  assert.equal(bossGhostRatio(game.boss), bossHealthRatio(game.boss), '결국은 따라잡아야 한다');
});

test('잔상은 체력 아래로 내려가지 않는다', () => {
  const { game } = bossGame();
  step(game, idle(), 120);
  assert.ok(bossGhostRatio(game.boss) >= bossHealthRatio(game.boss));
});

// ── 소리 등급 ──────────────────────────────────────────────

test('보스 발구르기는 앨범 밟기와 **다른 이벤트**를 쏜다', () => {
  // 거대 로봇이 땅을 내려찍는데 CD 한 장 밟는 소리가 나면 중요도가 뒤집힌다
  const heard = [];
  const game = createGame({
    seed: 11,
    save: { ...emptySave(), seenOpening: true },
    onEvent: (name) => heard.push(name),
  });
  startRun(game, 0, { hard: true });
  loadBoss(game);

  // 발구르기는 **공룡 페이즈부터** 나온다. hp 를 직접 깎아선 못 간다 —
  // phaseId 는 syncPhase 가 올리는데 그건 damageBoss 안에서만 돈다.
  // 그래서 진짜로 때려서 내려간다.
  while (game.boss.phaseId < 3 && game.boss.hp > 1) hitOnce(game, heard);
  assert.ok(game.boss.phaseId >= 3, '공룡 페이즈까지 내려가야 한다');

  let sawStomp = false;
  for (let i = 0; i < 4000 && !sawStomp; i++) {
    game.player.invuln = 99;
    if (game.bossCut) game.bossCut.t = game.bossCut.length;
    heard.length = 0;
    step(game);
    if (heard.includes('bossstomp')) sawStomp = true;
    assert.ok(!heard.includes('stomp'), '보스가 앨범 밟기 이벤트를 쏘면 안 된다');
  }
  assert.ok(sawStomp, '공룡 페이즈에서 발구르기를 봐야 한다');
});

// ── 클라이맥스의 쉼표 ───────────────────────────────────────

test('쓰러지는 컷신과 엔딩 사이에 숨이 하나 있다', () => {
  const game = createGame({ seed: 9, save: { ...emptySave(), seenOpening: true } });
  startRun(game);
  loadBoss(game);
  game.boss.hp = 0;
  game.boss.state = 'defeated';
  game.boss.defeatedAt = 1.2;
  step(game, idle(), 2);
  assert.equal(game.bossCut?.id, 'bossdown');

  // 쓰러지는 컷신을 끝까지 흘린다
  step(game, idle(), Math.ceil(game.bossCut.length * 60) + 2);
  assert.equal(game.bossCut, null, '두 컷신이 하드컷으로 붙어 있으면 한 덩어리로 읽힌다');
  assert.ok(game.bossCutGap > 0, '암전이 돌고 있어야 한다');
  assert.equal(inCutscene(game), true, '암전 동안 HUD 가 돌아오면 깜빡인다');

  step(game, idle(), Math.ceil(BOSS_CUT_GAP * 60) + 2);
  assert.equal(game.bossCut?.id, 'ending', '숨을 쉬고 나면 엔딩이 이어진다');
});

test('숨은 짧다 — 반복해서 보는 자리다', () => {
  assert.ok(BOSS_CUT_GAP > 0 && BOSS_CUT_GAP <= 0.6, `${BOSS_CUT_GAP}초는 숨이 아니라 끊김이다`);
});

// ── 엔딩 화면 ──────────────────────────────────────────────

test('「아무 키나 누르면」이 **정말 누를 수 있을 때** 뜬다', () => {
  // core 가 입력을 막는 시간과 CSS 가 글자를 띄우는 시각이 같아야 한다.
  // 어긋나면 못 누르는 동안 누르라고 하거나(예전이 그랬다) 누를 수 있는데 말이 없다.
  const css = readFileSync(new URL('../assets/style.css', import.meta.url), 'utf8');
  const lock = css.match(/--ending-lock:\s*([\d.]+)s/)?.[1];
  assert.ok(lock, 'style.css 에 --ending-lock 이 없다');
  assert.equal(Number(lock), ENDING_LOCK);
});

test('엔딩 화면은 잠깐 입력을 안 받는다 — 18초 컷신 끝의 키를 먹는다', () => {
  const game = createGame({ seed: 9, save: { ...emptySave(), seenOpening: true, clearedOnce: false } });
  game.scene = 'ending';
  game.sceneTime = 0;
  game.ending = { rank: 1, timeMs: 1000, chartOuts: 0, score: 100 };
  step(game, idle({ confirmPressed: true }), 10);
  assert.equal(game.scene, 'ending', '바로 날아가면 기록을 볼 새가 없다');

  step(game, idle(), Math.ceil(ENDING_LOCK * 60) + 2);
  step(game, idle({ confirmPressed: true }));
  assert.notEqual(game.scene, 'ending');
});

// ── 착지 ──────────────────────────────────────────────────

test('세게 착지하면 소리가 난다 — 먼지와 **같은 문턱**을 쓴다', () => {
  const heard = [];
  const game = createGame({
    seed: 2,
    save: { ...emptySave(), seenOpening: true },
    onEvent: (name) => heard.push(name),
  });
  startRun(game);
  loadStage(game, 0);
  game.scene = 'play';
  step(game, idle(), 10);

  // 살짝 떨어뜨린다 — 소리도 먼지도 없어야 한다
  heard.length = 0;
  game.player.y -= 6;
  step(game, idle(), 20);
  assert.ok(!heard.includes('land'), '한 칸 떨어진 걸로 쿵 소리가 나면 걷기만 해도 시끄럽다');

  // 높이 떨어뜨린다. **떨어진 그 프레임에서** 재야 한다 — 먼지는 0.32초면 사라지므로
  // 한참 뒤에 세면 소리는 들렸는데 먼지는 없는 것처럼 보인다 (한 번 속았다)
  game.player.y -= 90;
  game.player.vy = 0;
  let landedAt = -1;
  for (let i = 0; i < 90 && landedAt < 0; i++) {
    heard.length = 0;
    const before = game.particles.length;
    step(game);
    if (heard.includes('land')) {
      landedAt = i;
      assert.ok(game.particles.length > before, '소리가 났으면 먼지도 나야 한다 — 문턱이 하나다');
    }
  }
  assert.ok(landedAt >= 0, '세게 떨어졌는데 조용하면 무게가 없다');
});
