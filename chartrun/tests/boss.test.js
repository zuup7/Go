import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoss, updateBoss, hitBoss, syncPhase, bossPhase, bossHealthRatio } from '../src/core/boss.js';
import { BOSS_MAX_HP, PHASES, phaseFor } from '../src/data/bossData.js';
import { CUTSCENE, CUTSCENE_LENGTH, lineAt, phaseAt } from '../src/data/cutscene.js';

const ctx = (extra = {}) => ({
  player: { x: 100, y: 150, w: 10, h: 14 },
  arenaWidth: 640,
  spawnShot: () => {},
  addAlbum: () => {},
  ...extra,
});

test('페이즈는 체력 비율로 갈린다', () => {
  assert.equal(phaseFor(BOSS_MAX_HP).id, 1);
  assert.equal(phaseFor(9).id, 1);
  assert.equal(phaseFor(8).id, 2, '2/3 지점은 2페이즈부터');
  assert.equal(phaseFor(5).id, 2);
  assert.equal(phaseFor(4).id, 3, '1/3 지점은 3페이즈부터');
  assert.equal(phaseFor(0).id, 3);
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
  boss.hp = 2;
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
  boss.hp = 3;
  syncPhase(boss);
  boss.state = 'attack';
  boss.timer = 999;
  const minions = [];
  for (let i = 0; i < 60 * 8; i++) updateBoss(boss, ctx({ addAlbum: (a) => minions.push(a) }), 1 / 60);
  assert.ok(minions.length >= 1, '잡몹이 나왔다');
});

test('2페이즈부터 분열 조각이 생긴다', () => {
  const boss = createBoss(640);
  boss.hp = 6;
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
  assert.ok(CUTSCENE_LENGTH > 10, '너무 짧으면 합체가 안 보인다');
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

test('대사는 다음 대사가 나올 때까지 유지된다', () => {
  assert.equal(lineAt(0), null);
  const first = lineAt(1.5);
  assert.ok(first && first.text.length > 0);
  assert.equal(lineAt(2.0).text, first.text, '아직 다음 대사 전');
  assert.notEqual(lineAt(3.0).text, first.text, '다음 대사로 넘어감');
});

test('연출 단계 조회', () => {
  assert.equal(phaseAt(0), 'gather');
  assert.equal(phaseAt(CUTSCENE_LENGTH), 'end');
});
