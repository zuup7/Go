import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bossBody,
  laserBeams,
  createBoss,
  updateBoss,
  hitBoss,
  syncPhase,
  bossPhase,
  bossHealthRatio,
  laserBeam,
  tailBand,
  shockWaves,
  ceilingSlabs,
  whirlGapX,
} from '../src/core/boss.js';
import { BOSS_MAX_HP, PHASES, HARD_PHASES, phaseFor } from '../src/data/bossData.js';
import { PLAYER } from '../src/core/player.js';
import { createGame, loadBoss, updateGame } from '../src/core/game.js';
import { emptySave } from '../src/core/save.js';
import { CUTSCENE, CUTSCENE_LENGTH, phaseAt } from '../src/data/cutscene.js';

const ctx = (extra = {}) => ({
  player: { x: 100, y: 150, w: 10, h: 14 },
  arenaWidth: 640,
  spawnShot: () => {},
  addAlbum: () => {},
  ...extra,
});

test('페이즈는 체력 비율로 갈린다', () => {
  // 체력 9 = 페이즈당 3대
  assert.equal(BOSS_MAX_HP, 9);
  assert.equal(phaseFor(9).id, 1);
  assert.equal(phaseFor(7).id, 1);
  assert.equal(phaseFor(6).id, 2, '2/3 지점은 2페이즈부터');
  assert.equal(phaseFor(4).id, 2);
  assert.equal(phaseFor(3).id, 3, '1/3 지점은 3페이즈부터');
  assert.equal(phaseFor(0).id, 3);
});

test('세 페이즈를 다 보려면 아홉 대면 된다 — 그래야 3페이즈까지 간다', () => {
  const boss = createBoss(640);
  const seen = new Set([1]);
  for (let i = 0; i < BOSS_MAX_HP; i++) {
    boss.vulnerable = true;
    hitBoss(boss);
    seen.add(boss.phaseId);
    syncPhase(boss);
    seen.add(boss.phaseId);
  }
  assert.deepEqual([...seen].sort(), [1, 2, 3], '한 판에 세 페이즈가 전부 나온다');
  assert.equal(boss.state, 'defeated');
});

test('페이즈 정의가 셋이고 순서대로다', () => {
  assert.equal(PHASES.length, 3);
  assert.deepEqual(PHASES.map((p) => p.id), [1, 2, 3]);
  for (let i = 1; i < PHASES.length; i++) {
    assert.ok(PHASES[i].from < PHASES[i - 1].from, '체력 경계가 내려가야 한다');
    assert.ok(PHASES[i].fireEvery < PHASES[i - 1].fireEvery, '뒤로 갈수록 빨라져야 한다');
  }
});

test('약점이 열렸을 때만 때릴 수 있다', () => {
  const boss = createBoss(640);
  boss.vulnerable = false;
  assert.equal(hitBoss(boss), false);
  assert.equal(boss.hp, BOSS_MAX_HP);

  boss.vulnerable = true;
  assert.equal(hitBoss(boss), true);
  assert.equal(boss.hp, BOSS_MAX_HP - 1);
  assert.equal(boss.vulnerable, false, '한 방 맞으면 바로 닫힌다');
});

test('체력을 다 깎으면 쓰러진다', () => {
  const boss = createBoss(640);
  for (let i = 0; i < BOSS_MAX_HP; i++) {
    boss.vulnerable = true;
    hitBoss(boss);
    syncPhase(boss);
  }
  assert.equal(boss.hp, 0);
  assert.equal(boss.state, 'defeated');
  assert.equal(bossHealthRatio(boss), 0);
});

test('페이즈는 1 → 2 → 3 으로만 가고 되돌아가지 않는다', () => {
  const boss = createBoss(640);
  const seen = [boss.phaseId];
  for (let i = 0; i < BOSS_MAX_HP; i++) {
    boss.vulnerable = true;
    hitBoss(boss);
    const changed = syncPhase(boss);
    if (changed) seen.push(changed);
    assert.ok(boss.phaseId >= seen[seen.length - 1], '페이즈가 역행했다');
  }
  assert.deepEqual(seen, [1, 2, 3]);
});

test('체력이 회복돼도 페이즈는 돌아가지 않는다', () => {
  const boss = createBoss(640);
  boss.hp = 1;
  syncPhase(boss);
  assert.equal(boss.phaseId, 3);
  boss.hp = BOSS_MAX_HP;
  assert.equal(syncPhase(boss), null);
  assert.equal(boss.phaseId, 3);
});

test('보스는 공격 → 약점 개방 → 회복을 돈다', () => {
  const boss = createBoss(640);
  boss.timer = 0.01;
  const seen = new Set();
  for (let i = 0; i < 60 * 20; i++) {
    updateBoss(boss, ctx(), 1 / 60);
    seen.add(boss.state);
  }
  assert.ok(seen.has('attack') && seen.has('open') && seen.has('recover'), [...seen].join(','));
});

test('보스가 무대 밖으로 나가지 않는다', () => {
  const boss = createBoss(640);
  for (let i = 0; i < 60 * 30; i++) {
    updateBoss(boss, ctx(), 1 / 60);
    assert.ok(boss.x >= 20 && boss.x + boss.w <= 640 - 20, `x=${boss.x}`);
  }
});

test('1페이즈 공격에서 탄환이 나온다', () => {
  const boss = createBoss(640);
  const shots = [];
  boss.state = 'attack';
  boss.timer = 999;
  for (let i = 0; i < 60 * 4; i++) updateBoss(boss, ctx({ spawnShot: (s) => shots.push(s) }), 1 / 60);
  assert.ok(shots.length >= bossPhase(boss).shots, '탄막이 나왔다');
  assert.ok(shots.every((s) => s.vy > 0), '아래쪽으로 뿌린다');
});

test('3페이즈에서는 잡몹 앨범을 부른다', () => {
  const boss = createBoss(640);
  boss.hp = 2;
  syncPhase(boss);
  boss.state = 'attack';
  boss.timer = 999;
  const minions = [];
  for (let i = 0; i < 60 * 8; i++) updateBoss(boss, ctx({ addAlbum: (a) => minions.push(a) }), 1 / 60);
  assert.ok(minions.length >= 1, '잡몹이 나왔다');
});

test('2페이즈부터 분열 조각이 생긴다', () => {
  const boss = createBoss(640);
  boss.hp = 5;
  syncPhase(boss);
  boss.state = 'attack';
  boss.timer = 999;
  for (let i = 0; i < 60; i++) updateBoss(boss, ctx(), 1 / 60);
  assert.equal(boss.quarters.length, 4);
});

test('쓰러진 뒤에는 더 때릴 수 없다', () => {
  const boss = createBoss(640);
  boss.hp = 1;
  boss.vulnerable = true;
  hitBoss(boss);
  boss.vulnerable = true;
  assert.equal(hitBoss(boss), false);
});

// ── 컷신 ───────────────────────────────────────────────────
test('컷신은 gather 로 시작해 end 로 끝난다', () => {
  assert.equal(CUTSCENE[0].kind, 'gather');
  assert.equal(CUTSCENE[CUTSCENE.length - 1].kind, 'end');
  assert.ok(CUTSCENE_LENGTH > 6, '너무 짧으면 합체가 안 보인다');
});

test('컷신 시각이 항상 앞으로만 간다', () => {
  for (let i = 1; i < CUTSCENE.length; i++) {
    assert.ok(CUTSCENE[i].at >= CUTSCENE[i - 1].at, `${i}번째 단계가 뒤로 갔다`);
  }
});

test('컷신에 합체와 등장 연출이 들어있다', () => {
  const kinds = CUTSCENE.map((s) => s.kind);
  for (const need of ['gather', 'swirl', 'merge', 'flash', 'reveal']) {
    assert.ok(kinds.includes(need), `${need} 단계가 없다`);
  }
});

test('컷신에 대사가 없다 — 보면 아는 연출로만 간다', () => {
  assert.equal(CUTSCENE.filter((s) => s.kind === 'line').length, 0);
});

test('연출 단계 조회', () => {
  assert.equal(phaseAt(0), 'gather');
  assert.equal(phaseAt(CUTSCENE_LENGTH), 'end');
});

// ── 3페이즈 레이저 ──────────────────────────────────────────
// 이 판에서 제일 위험한 건 "못 피하는 공격"이다. 아래는 전부 그걸 막는 규칙이다.

const DT = 1 / 60;

/** 3페이즈 보스 하나. hp 를 낮춰 페이즈를 올린다 */
function phase3Boss() {
  const boss = createBoss(640, 192);
  boss.hp = 3;
  syncPhase(boss);
  assert.equal(boss.phaseId, 3);
  boss.state = 'attack';
  boss.timer = 99; // 약점 열기가 먼저 끼어들지 않게
  return boss;
}

/** 그 상태가 될 때까지 굴린다. 안 되면 null */
function runUntil(boss, want, seconds = 20, extra = {}) {
  for (let i = 0; i < seconds * 60; i++) {
    updateBoss(boss, ctx(extra), DT);
    if (boss.state === want) return boss;
  }
  return null;
}

test('레이저는 3페이즈만 쓴다', () => {
  for (const p of PHASES) {
    const laser = p.laserEvery > 0;
    assert.equal(laser, p.id === 3, `페이즈 ${p.id}: 레이저 유무가 뜻과 다르다`);
  }

  // 1·2페이즈는 아무리 굴려도 겨누지 않는다
  for (const hp of [9, 5]) {
    const boss = createBoss(640, 192);
    boss.hp = hp;
    syncPhase(boss);
    boss.timer = 99;
    for (let i = 0; i < 60 * 30; i++) {
      updateBoss(boss, ctx(), DT);
      assert.ok(boss.state !== 'aim' && boss.state !== 'laser', `체력 ${hp} 에서 레이저가 나왔다`);
    }
  }
});

test('겨누는 동안에는 안 아프다 — 예고에 맞아 죽으면 그건 예고가 아니다', () => {
  const boss = phase3Boss();
  assert.ok(runUntil(boss, 'aim'), '레이저를 안 겨눴다');
  const beam = laserBeam(boss);
  assert.ok(beam, '겨누는 동안 빔 칸이 없다');
  assert.equal(beam.live, false, '예고선이 아프면 피할 방법이 없다');

  assert.ok(runUntil(boss, 'laser'), '겨누기만 하고 안 쐈다');
  assert.equal(laserBeam(boss).live, true, '쏘는데 안 아프면 그냥 배경이다');
});

test('겨누는 동안 보스가 멈춘다 — 멈추는 것 자체가 예고다', () => {
  const boss = phase3Boss();
  assert.ok(runUntil(boss, 'aim'));
  const x = boss.x;
  for (let i = 0; i < 30; i++) updateBoss(boss, ctx(), DT);
  assert.equal(boss.x, x, '겨누면서 돌아다니면 어디로 올지 알 수가 없다');
});

test('훑는 방향은 내가 서 있는 쪽이다', () => {
  for (const [px, want] of [[600, 1], [20, -1]]) {
    const boss = phase3Boss();
    const at = { player: { x: px, y: 150, w: 10, h: 14 } };
    assert.ok(runUntil(boss, 'aim', 20, at), '안 겨눴다');
    assert.equal(boss.beamDir, want, `플레이어가 ${px} 인데 반대로 훑는다`);
  }
});

test('훑는 속도가 달리기보다 느리다 — 달려서 피할 수 있어야 한다', () => {
  // 이 부등호를 넘기는 순간 대시가 없으면 못 피하는 판이 된다.
  // 수치를 만지다 뒤집힐 수 있는 곳이라 테스트로 못 박는다.
  const p3 = PHASES.find((p) => p.id === 3);
  assert.ok(p3.laserSweep < PLAYER.maxSpeed, '훑는 속도가 달리기보다 빠르면 못 피한다');
});

test('훑는 거리가 아레나보다 짧다 — 구석에 갇히지 않는다', () => {
  const p3 = PHASES.find((p) => p.id === 3);
  const swept = p3.laserSweep * p3.laserFire;
  assert.ok(swept < 640 / 2, `${swept}px 나 훑으면 끝까지 밀려 갇힌다`);
});

test('레이저는 반드시 끝나고 약점이 다시 열린다', () => {
  // 여기서 갇히면 재생 버튼이 영영 안 열려서 보스를 못 잡는다
  const boss = phase3Boss();
  assert.ok(runUntil(boss, 'laser'), '안 쐈다');
  assert.ok(runUntil(boss, 'recover', 5), '쏘고 나서 빠져나오질 못한다');
  boss.timer = 0;
  assert.ok(runUntil(boss, 'open', 15), '약점이 다시 안 열린다');
  assert.equal(laserBeam(boss), null, '안 쏘는데 빔 칸이 남아 있다');
});

test('빔 칸은 바이저에서 바닥까지 이어진다', () => {
  const boss = phase3Boss();
  assert.ok(runUntil(boss, 'laser'));
  const beam = laserBeam(boss);
  assert.ok(beam.y > boss.y, '빔이 보스 위에서 시작한다');
  assert.ok(beam.y < boss.floorY, '빔이 바닥 아래에서 시작한다');
  assert.ok(Math.abs(beam.y + beam.h - boss.floorY) < 0.01, '빔이 바닥까지 안 닿는다');
  // 발판(y=160) 높이를 지나므로 발판 위에 서도 안전하지 않다
  assert.ok(beam.y < 160 && beam.y + beam.h > 160, '발판 높이를 안 지나면 그냥 서서 피한다');
});

test('무적일 때는 아픈 소리가 안 난다', () => {
  // damagePlayer 는 무적일 때도 false 를 준다. 그걸 "안 죽었다"로 읽고 소리를 내면,
  // 계속 닿아 있는 레이저 기둥 안에서 무적 1.2초 내내 프레임마다 소리가 터진다.
  const game = createGame({ seed: 3, save: { ...emptySave(), seenOpening: true } });
  loadBoss(game);
  for (let i = 0; i < 900 && game.bossCut; i++) updateGame(game, idleInput(), DT);

  const heard = [];
  game.onEvent = (name) => heard.push(name);

  // 3페이즈 레이저를 켜고, 그 한복판에 무적인 채로 세워둔다
  const boss = game.boss;
  boss.hp = 3;
  boss.phaseId = 3;
  boss.state = 'laser';
  boss.timer = 5;
  boss.beamX = game.player.x + game.player.w / 2;
  game.player.invuln = 5;
  game.player.power = 'none';

  for (let i = 0; i < 60; i++) {
    boss.beamX = game.player.x + game.player.w / 2; // 계속 안에 있게 붙들어둔다
    updateGame(game, idleInput(), DT);
  }
  const hurts = heard.filter((n) => n === 'hurt').length;
  assert.equal(hurts, 0, `무적인데 아픈 소리가 ${hurts}번 났다`);
  assert.equal(game.player.dead, false, '무적인데 죽었다');
});

test('파워업을 잃을 때는 한 번만 소리가 난다', () => {
  const game = createGame({ seed: 3, save: { ...emptySave(), seenOpening: true } });
  loadBoss(game);
  for (let i = 0; i < 900 && game.bossCut; i++) updateGame(game, idleInput(), DT);

  const heard = [];
  game.onEvent = (name) => heard.push(name);

  const boss = game.boss;
  boss.hp = 3;
  boss.phaseId = 3;
  boss.state = 'laser';
  boss.timer = 5;
  game.player.invuln = 0;
  game.player.power = 'mic'; // 한 대 버틴다

  for (let i = 0; i < 60; i++) {
    boss.beamX = game.player.x + game.player.w / 2;
    updateGame(game, idleInput(), DT);
  }
  const hurts = heard.filter((n) => n === 'hurt').length;
  assert.equal(hurts, 1, `한 번이어야 하는데 ${hurts}번 났다`);
  assert.equal(game.player.power, 'none', '파워업을 안 잃었다');
});

/** 아무 키도 안 누른 입력 */
function idleInput() {
  return {
    left: false, right: false, jump: false, jumpPressed: false,
    leftPressed: false, rightPressed: false, throwPressed: false, dashPressed: false,
    confirmPressed: false, restartPressed: false, pausePressed: false,
    mutePressed: false, anyPressed: false,
  };
}

// ── 하드 4페이즈 — 못 피하는 판이 되지 않게 ──────────────────
test('하드의 모든 페이즈에서 훑는 속도가 달리기보다 느리다', () => {
  // 여기를 넘기는 순간 달려서 못 피하는 판이 된다. 하드라고 예외가 아니다.
  for (const p of HARD_PHASES) {
    assert.ok(p.laserEvery > 0, `하드 ${p.id}페이즈에 레이저가 없다`);
    assert.ok(
      p.laserSweep < PLAYER.maxSpeed,
      `하드 ${p.id}페이즈: 훑는 속도 ${p.laserSweep} 가 달리기 ${PLAYER.maxSpeed} 보다 빠르다`,
    );
  }
});

test('쌍둥이 레이저 둘 사이에 설 자리가 남는다', () => {
  // 양쪽에서 마주 오는데 가운데가 다 덮이면 어디에도 못 선다 —
  // 그건 어려운 게 아니라 그냥 죽으라는 것이다.
  const p4 = HARD_PHASES.find((p) => p.twinLaser);
  assert.ok(p4, '쌍둥이 레이저를 쓰는 페이즈가 없다');

  const arena = 640;
  const swept = p4.laserSweep * p4.laserFire;
  // 8 에서 오른쪽으로, arena-8 에서 왼쪽으로
  const leftEnd = 8 + swept;
  const rightEnd = arena - 8 - swept;
  const gap = rightEnd - leftEnd;
  assert.ok(gap > 60, `둘 사이에 ${Math.round(gap)}px 밖에 안 남는다 — 설 자리가 없다`);
});

test('하드 4페이즈에서 기둥이 둘, 그 전에는 하나다', () => {
  const boss = createBoss(640, 192, true);
  const ctx4 = () => ctx({ arenaWidth: 640 });
  // 체력 12 를 넷으로 나누면 3대씩이다 — 12~10 은 1페이즈, 3~0 은 이미 4페이즈다
  for (const [hp, want] of [[12, 1], [8, 1], [5, 1], [2, 2]]) {
    boss.hp = hp;
    boss.phaseId = 1;
    syncPhase(boss);
    boss.state = 'attack';
    boss.timer = 99;
    boss.laserTimer = 0;
    let got = 0;
    for (let i = 0; i < 60 * 20; i++) {
      updateBoss(boss, ctx4(), DT);
      if (boss.state === 'laser') {
        got = laserBeams(boss).length;
        break;
      }
    }
    assert.equal(got, want, `체력 ${hp}(${boss.phaseId}페이즈): 기둥이 ${got}개`);
  }
});

// ── 공룡 형태의 가로 공격 ────────────────────────────────────
test('공룡 페이즈에만 꼬리와 내리찍기가 있다', () => {
  for (const phase of HARD_PHASES) {
    const hasDino = !!phase.dino;
    assert.equal(
      (phase.tailEvery ?? 0) > 0,
      hasDino,
      `하드 ${phase.id}페이즈: 공룡(${hasDino})인데 꼬리가 안 맞는다`,
    );
    assert.equal((phase.stompEvery ?? 0) > 0, hasDino, `하드 ${phase.id}페이즈: 내리찍기가 안 맞는다`);
  }
  assert.ok(
    HARD_PHASES.some((p) => p.dino),
    '공룡으로 변신하는 페이즈가 하나도 없다',
  );
  // 보통 모드는 공룡이 안 된다 — 그게 하드의 볼거리다
  assert.ok(!PHASES.some((p) => p.dino), '보통 모드에도 공룡이 있다');
});

test('꼬리와 충격파는 뛰어서 넘을 수 있는 높이다', () => {
  // 레이저는 옆으로 비켜서 피하지만 이건 **뛰어야만** 피한다.
  // 점프 높이(2.95칸 ≈ 47px)보다 낮아야 넘을 수 있다.
  const jump = 47;
  for (const phase of HARD_PHASES.filter((p) => p.dino)) {
    assert.ok(
      phase.tailHeight < jump,
      `하드 ${phase.id}페이즈: 꼬리가 ${phase.tailHeight}px 라 뛰어도 못 넘는다`,
    );
    assert.ok(
      phase.waveHeight < jump,
      `하드 ${phase.id}페이즈: 충격파가 ${phase.waveHeight}px 라 뛰어도 못 넘는다`,
    );
  }
});

test('꼬리는 플레이어 반대쪽 끝에서 시작한다 — 발밑에서 안 생긴다', () => {
  // 예고가 있어도 발밑에서 생기면 못 피한다.
  const arenaWidth = 640;
  for (const px of [60, 580]) {
    const boss = createBoss(arenaWidth, 192, true);
    boss.hp = 3; // 4페이즈(공룡)
    syncPhase(boss);
    const phase = bossPhase(boss);
    assert.ok(phase.dino, '공룡 페이즈가 아니다');
    boss.state = 'attack';
    boss.tailTimer = phase.tailEvery;
    updateBoss(boss, { arenaWidth, playerX: px, spawnShot() {}, addAlbum() {} }, 1 / 60);
    assert.equal(boss.state, 'tailAim', '꼬리를 안 감았다');
    const band = tailBand(boss);
    assert.ok(
      Math.abs(band.x + band.w / 2 - px) > arenaWidth / 3,
      `플레이어(${px}) 코앞(${Math.round(band.x)})에서 꼬리가 시작했다`,
    );
  }
});

test('내리찍으면 충격파가 양쪽으로 퍼져서 사라진다', () => {
  const arenaWidth = 640;
  const boss = createBoss(arenaWidth, 192, true);
  boss.hp = 3;
  syncPhase(boss);
  boss.state = 'stompAim';
  boss.timer = 0;
  const ctx = { arenaWidth, playerX: 300, spawnShot() {}, addAlbum() {} };
  for (let i = 0; i < 40 && boss.waves.length === 0; i++) updateBoss(boss, ctx, 1 / 60);
  assert.equal(boss.waves.length, 2, '충격파가 양쪽으로 안 퍼졌다');
  assert.equal(boss.waves[0].dir, -1);
  assert.equal(boss.waves[1].dir, 1);
  // 끝까지 가면 사라진다 — 안 그러면 영원히 남는다
  for (let i = 0; i < 60 * 6; i++) updateBoss(boss, ctx, 1 / 60);
  assert.equal(boss.waves.length, 0, '충격파가 안 사라진다');
});

// ── 1·2페이즈의 새 패턴 ──────────────────────────────────────
test('하드 1·2페이즈에도 저마다 새 기술이 있다', () => {
  const p1 = HARD_PHASES[0];
  const p2 = HARD_PHASES[1];
  assert.ok(p1.whirlEvery > 0, '1페이즈에 회오리가 없다');
  assert.ok(p2.ceilEvery > 0, '2페이즈에 천장 붕괴가 없다');
  // 보통 모드에는 없다 — 그게 하드의 볼거리다
  assert.ok(!PHASES.some((p) => p.whirlEvery > 0 || p.ceilEvery > 0), '보통 모드에도 있다');
});

test('회오리에는 반드시 빠져나갈 빈 자리가 있다', () => {
  // 다 막으면 어려운 게 아니라 그냥 맞는 기술이 된다.
  const arenaWidth = 640;
  for (const px of [80, 560]) {
    const boss = createBoss(arenaWidth, 192, true);
    boss.state = 'attack';
    const phase = bossPhase(boss);
    boss.whirlTimer = phase.whirlEvery;
    const shots = [];
    const ctx = { arenaWidth, playerX: px, spawnShot: (s) => shots.push(s), addAlbum() {} };
    updateBoss(boss, ctx, 1 / 60);
    assert.equal(boss.state, 'whirlAim', '회오리를 안 겨눴다');

    // 빈 자리가 바닥 어디쯤인지 그림도 판정도 이걸 본다
    const gap = whirlGapX(boss);
    assert.ok(gap != null, '빈 자리를 알 수가 없다');
    assert.ok(gap > 0 && gap < arenaWidth, `빈 자리(${Math.round(gap)})가 아레나 밖이다`);

    // 실제로 쏴 보면 빈 자리 쪽으로는 탄이 안 간다
    boss.timer = 0;
    updateBoss(boss, ctx, 1 / 60);
    assert.ok(shots.length > 0, '회오리가 안 나갔다');
    const toGap = shots.filter(
      (sh) => Math.abs(Math.atan2(sh.vy, sh.vx) - boss.whirlGap) < 0.2,
    );
    assert.equal(toGap.length, 0, '빈 자리로도 탄이 날아간다 — 빈 자리가 아니다');
  }
});

test('천장 붕괴 사이에는 설 자리가 남는다', () => {
  const arenaWidth = 640;
  const boss = createBoss(arenaWidth, 192, true);
  boss.hp = 7; // 2페이즈
  syncPhase(boss);
  boss.state = 'attack';
  const phase = bossPhase(boss);
  boss.ceilTimer = phase.ceilEvery;
  updateBoss(boss, { arenaWidth, playerX: 300, spawnShot() {}, addAlbum() {} }, 1 / 60);

  const slabs = ceilingSlabs(boss);
  assert.ok(slabs.length >= 2, '천장이 안 무너졌다');
  const xs = slabs.map((s) => s.x).sort((a, b) => a - b);
  for (let i = 1; i < xs.length; i++) {
    assert.ok(xs[i] - xs[i - 1] >= 32, `조각 둘이 ${xs[i] - xs[i - 1]}px 붙어서 떨어진다`);
  }
  // 예고가 먼저다
  assert.ok(slabs.every((s) => s.warn > 0), '예고 없이 떨어진다');
});

// ── 어떤 몸으로 그릴까 ──────────────────────────────────────
//
// 이 규칙이 그리는 쪽에 흩어져 있어서 실제로 어긋났다 — 2회차인데 컷신에서는
// 1회차의 매끈한 원반이 찢어졌고, 보통 모드인데 쓰러지는 컷신에서는 있지도 않던
// 공룡이 무너졌다. bossBody 한 곳으로 모았으니 여기서 못을 박는다.

/** hp 를 깎아 그 페이즈까지 올린다 */
const atPhase = (hard, phaseId) => {
  const boss = createBoss(640, 192, hard);
  for (let hp = boss.maxHp; hp >= 0 && boss.phaseId < phaseId; hp--) {
    boss.hp = hp;
    syncPhase(boss);
  }
  assert.equal(boss.phaseId, phaseId, `${hard ? '하드' : '보통'} ${phaseId}페이즈까지 못 갔다`);
  return boss;
};

test('보통 모드 1·2페이즈는 매끈한 원반이다', () => {
  assert.equal(bossBody(createBoss(640, 192, false)), 'disc');
  assert.equal(bossBody(atPhase(false, 2)), 'disc');
});

test('하드 1·2페이즈는 진화한 원반이다 — 1회차와 같은 몸이면 2회차에 새 볼거리가 없다', () => {
  assert.equal(bossBody(createBoss(640, 192, true)), 'evolved');
  assert.equal(bossBody(atPhase(true, 2)), 'evolved');
});

test('3페이즈부터 몸이 바뀐다 — 보통은 합체 로봇, 하드는 공룡', () => {
  assert.equal(bossBody(atPhase(false, 3)), 'robot');
  assert.equal(bossBody(atPhase(true, 3)), 'dino');
});

test('하드는 4페이즈까지 가도 공룡으로 남는다', () => {
  assert.equal(bossBody(atPhase(true, 4)), 'dino');
});

test('두 모드의 몸이 어느 페이즈에서도 겹치지 않는다', () => {
  // 겹치면 "저놈이 진화한 놈"이라는 게 안 읽힌다
  for (const phaseId of [1, 2, 3]) {
    assert.notEqual(
      bossBody(atPhase(false, phaseId)),
      bossBody(atPhase(true, phaseId)),
      `${phaseId}페이즈에서 두 모드가 같은 몸이다`,
    );
  }
});
