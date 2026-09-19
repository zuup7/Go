// 공룡로봇의 몸짓.
//
// 움직임은 그림이라 숫자로 다 볼 수 없다. 다만 **어떤 순서로 움직이는가**는
// 규칙이고, 그건 여기서 못 박을 수 있다 — 특히 「들었다 찍는다」의 순서가
// 거꾸로면 예고가 사라져서 피할 수 없는 공격이 된다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoss, updateBoss, bossPose, bossBody, bossFloor, NEUTRAL_POSE, BOSS_H } from '../src/core/boss.js';
import { HARD_PHASES, PHASES } from '../src/data/bossData.js';

const DT = 1 / 60;
const ARENA = 640;

/** 하드 3페이즈(공룡)로 바로 세운 보스 */
function dino(phaseId = 3) {
  const boss = createBoss(ARENA, 192, true);
  boss.phaseId = phaseId;
  boss.hp = Math.ceil(boss.maxHp * (HARD_PHASES[phaseId - 1].from + 0.01));
  return boss;
}

const ctx = ({ playerX = 120, ...over } = {}) => ({
  arenaWidth: ARENA,
  playerX,
  // 레이저를 겨눌 때 주인공 상자를 읽는다 (ctx.player.x / .w)
  player: { x: playerX, y: 170, w: 10, h: 14 },
  spawnShot: () => {},
  addAlbum: () => {},
  ...over,
});

const step = (boss, seconds, over) => {
  for (let i = 0; i < Math.round(seconds / DT); i++) updateBoss(boss, ctx(over), DT);
};

/** 값 넷이 제 범위 안이고 숫자인가 */
function assertSane(pose, where) {
  for (const [key, lo, hi] of [
    ['swing', -1, 1],
    ['paw', -1, 1],
    ['jaw', 0, 1],
  ]) {
    assert.ok(Number.isFinite(pose[key]), `${where}: ${key} 가 숫자가 아니다 (${pose[key]})`);
    assert.ok(pose[key] >= lo && pose[key] <= hi, `${where}: ${key} 가 범위 밖 (${pose[key]})`);
  }
  assert.ok(Number.isFinite(pose.stride) && pose.stride >= 0, `${where}: stride 가 이상하다`);
}

test('공룡 페이즈인지 확인 — 3·4페이즈만 공룡이다', () => {
  assert.equal(bossBody(dino(3)), 'dino');
  assert.equal(bossBody(dino(4)), 'dino');
  assert.equal(HARD_PHASES[0].dino, undefined, '1페이즈는 공룡이 아니어야 한다');
  assert.equal(PHASES.some((p) => p.dino), false, '1회차에는 공룡이 없다');
});

test('보스가 없으면 기본 자세를 준다 — 구워둔 거대 로봇이 이걸 쓴다', () => {
  assert.equal(bossPose(null), NEUTRAL_POSE);
  assertSane(NEUTRAL_POSE, '기본 자세');
  assert.equal(NEUTRAL_POSE.swing, 0);
  assert.equal(NEUTRAL_POSE.paw, 0);
});

test('어느 페이즈를 오래 굴려도 값이 범위를 안 넘는다', () => {
  // 공룡이 아닌 페이즈, 꼬리 수치가 없는 페이즈도 같이 본다
  for (const phaseId of [1, 2, 3, 4]) {
    const boss = dino(phaseId);
    for (let i = 0; i < 60 * 30; i++) {
      updateBoss(boss, ctx({ playerX: 100 + (i % 400) }), DT);
      if (i % 37 === 0) assertSane(bossPose(boss), `${phaseId}페이즈 ${i}프레임`);
    }
  }
});

// ── 앞발: 들었다 찍는다 (순서가 곧 예고다) ──────────────────

test('앞발은 찍기 **전에** 들린다 — 거꾸로면 피할 수가 없다', () => {
  const boss = dino(3);
  boss.state = 'stompAim';
  boss.timer = HARD_PHASES[2].stompAim;

  // 겨누는 동안 계속 올라간다
  let last = bossPose(boss).paw;
  for (let i = 0; i < 20; i++) {
    updateBoss(boss, ctx(), DT);
    const now = bossPose(boss).paw;
    assert.ok(now >= last, `겨누는 중에 발이 내려갔다 (${last} → ${now})`);
    last = now;
  }
  assert.ok(last > 0.5, `겨누기가 끝날 때쯤엔 충분히 들려 있어야 한다 (${last})`);

  // 겨누기가 끝나면 그 프레임에 꽂힌다
  boss.timer = 0;
  updateBoss(boss, ctx(), DT);
  assert.equal(boss.state, 'stomp');
  assert.ok(bossPose(boss).paw < 0, `찍는 순간 발이 아래로 가야 한다 (${bossPose(boss).paw})`);
});

test('찍는 순간이 충격파가 생기는 순간과 같다', () => {
  // 발이 먼저 닿고 나중에 바닥이 흔들리면 두 동작으로 보인다
  const boss = dino(3);
  boss.state = 'stompAim';
  boss.timer = 0;
  updateBoss(boss, ctx(), DT);
  assert.equal(boss.state, 'stomp');
  assert.ok(bossPose(boss).paw < 0, '발이 아직 안 꽂혔다');

  // 'stomp' 는 바닥에 닿을 때 충격파를 낳는다 — 그때까지 발은 내려간 채여야 한다
  step(boss, 0.4);
  assert.ok(boss.waves.length > 0 || boss.state !== 'stomp', '충격파가 안 생겼다');
});

test('공격이 끝나면 앞발이 제자리로 돌아온다', () => {
  const boss = dino(3);
  boss.state = 'stompAim';
  step(boss, 0.6);
  step(boss, 3); // 찍고 회복까지
  assert.ok(Math.abs(bossPose(boss).paw) < 0.1, `자세가 남아 있다 (${bossPose(boss).paw})`);
});

// ── 꼬리: 감았다 휘두른다 ───────────────────────────────────

test('꼬리는 훑을 방향의 **반대쪽으로** 감긴다', () => {
  for (const playerX of [80, ARENA - 80]) {
    const boss = dino(3);
    boss.tailTimer = 999; // 다음 프레임에 꼬리가 나가게
    boss.state = 'attack';
    boss.timer = 0;
    // startTail 을 타게 한 뒤 감기는 걸 본다
    for (let i = 0; i < 300 && boss.state !== 'tailAim'; i++) updateBoss(boss, ctx({ playerX }), DT);
    assert.equal(boss.state, 'tailAim', '꼬리를 안 감는다');

    step(boss, 0.3, { playerX });
    const pose = bossPose(boss);
    assert.ok(
      Math.sign(pose.swing) === -boss.tailDir,
      `훑는 방향(${boss.tailDir})과 감는 방향(${pose.swing})이 같다 — 예고가 안 된다`,
    );
  }
});

test('휘두르는 동안 꼬리가 감긴 쪽에서 반대쪽으로 지나간다', () => {
  const boss = dino(3);
  boss.state = 'tail';
  boss.tailDir = 1;
  boss.timer = HARD_PHASES[2].tailSweep;
  boss.swing = -1;

  const first = bossPose(boss).swing;
  step(boss, HARD_PHASES[2].tailSweep * 0.5);
  const mid = bossPose(boss).swing;
  assert.ok(mid > first, `휘두르는데 꼬리가 안 지나간다 (${first} → ${mid})`);
  assert.ok(Math.abs(mid) < 0.4, `중간쯤엔 몸 옆을 지나야 한다 (${mid})`);
});

test('꼬리를 다 휘두르면 자세가 풀린다', () => {
  const boss = dino(3);
  boss.state = 'tailAim';
  step(boss, 0.8 + HARD_PHASES[2].tailSweep + 1.2);
  assert.ok(Math.abs(bossPose(boss).swing) < 0.15, `꼬리가 휘둘린 채 굳었다 (${bossPose(boss).swing})`);
});

// ── 걸음 ────────────────────────────────────────────────────

test('걸음은 시간이 아니라 **움직인 거리**로 돈다', () => {
  // 시간으로 돌리면 제자리에 선 동안에도 발이 움직여 미끄러진다
  const moving = dino(3);
  moving.state = 'attack';
  step(moving, 1);
  assert.ok(bossPose(moving).stride > 0, '움직였는데 걸음이 안 돈다');

  const still = dino(3);
  still.state = 'tailAim'; // 겨누는 동안에는 제자리에 선다
  const before = bossPose(still).stride;
  step(still, 0.5);
  assert.equal(bossPose(still).stride, before, '제자리에 섰는데 발이 움직였다');
});

// ── 로봇도 자세를 받는다 ────────────────────────────────────
// 「허공에 떠 있는 것 같다」던 이유: 그리는 쪽이 boss.y 를 몰라서, 84픽셀 공중에
// 있든 땅을 딛고 있든 똑같은 그림이었다. lift 가 그 차이를 알려준다.

test('lift 는 땅에 닿으면 0, 높이 뜨면 1 이다', () => {
  const boss = createBoss(ARENA, 192, false);
  boss.y = bossFloor(boss);
  assert.equal(bossPose(boss).lift, 0, '발이 땅에 닿으면 추진기가 꺼져야 한다');

  boss.y = bossFloor(boss) - 200;
  assert.equal(bossPose(boss).lift, 1, '한참 뜨면 최대');

  boss.y = bossFloor(boss) - 45;
  const mid = bossPose(boss).lift;
  assert.ok(mid > 0.2 && mid < 0.8, `중간 높이면 중간값이어야 한다 (${mid})`);
});

test('약점이 열릴 때는 내려와 발을 딛는다 — 그때 lift 가 뚝 떨어진다', () => {
  const boss = createBoss(ARENA, 192, false);
  // 공격 중(높이 뜸)
  boss.state = 'attack';
  step(boss, 3);
  const flying = bossPose(boss).lift;

  // 약점이 열릴 때까지 굴린다
  for (let i = 0; i < 2000 && boss.state !== 'open'; i++) updateBoss(boss, ctx(), DT);
  assert.equal(boss.state, 'open', '약점이 열리는 걸 봐야 한다');
  step(boss, 2);
  const landed = bossPose(boss).lift;

  assert.ok(flying > 0.5, `공격 중에는 떠 있어야 한다 (${flying})`);
  assert.ok(landed < flying, `내려앉으면 덜 떠야 한다 (${flying} → ${landed})`);
});

test('lean 은 미는 쪽을 가리킨다', () => {
  const boss = createBoss(ARENA, 192, false);
  boss.drift = 1;
  assert.equal(bossPose(boss).lean, 1);
  boss.drift = -1;
  assert.equal(bossPose(boss).lean, -1);
});

test('내리꽂기가 멈추는 자리가 곧 발이 닿는 높이다 — 값이 한 곳에서 나온다', () => {
  // 그리는 쪽은 bossFloor 로 「땅을 딛었나」를 판단하고, 내리꽂기는 제 높이에서
  // 멈춘다. 이 둘을 따로 적어두면 발은 바닥에 박혔는데 추진기는 계속 타는
  // 그림이 된다 — 그래서 실제로 꽂아보고 두 값이 만나는지 본다.
  const boss = createBoss(ARENA, 192, false);
  boss.state = 'stomp';
  boss.timer = 5;
  boss.y = 40;
  for (let i = 0; i < 300 && boss.state === 'stomp'; i++) updateBoss(boss, ctx(), DT);

  assert.equal(boss.state, 'recover', '내리꽂기가 안 끝났다');
  assert.equal(boss.y, bossFloor(boss), '멈춘 자리와 bossFloor 가 어긋났다');
  assert.equal(bossPose(boss).lift, 0, '발은 땅에 닿았는데 추진기가 타고 있다');
  assert.equal(bossFloor(boss), boss.floorY - BOSS_H - 6);
});
