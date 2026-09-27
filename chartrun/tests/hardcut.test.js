// 하드 보스전 뒷부분. 여기가 통째로 망가져 있었다.
//
// 1. 마지막 전환(phase4) 컷신이 **로봇**을 그렸다 — 하드 페이즈 4는 이미 공룡인데.
//    phase4 는 하드 전용이라(보통은 페이즈가 셋) 이 함수가 도는 100% 가 틀렸다.
// 2. 공룡 변신(hard3) 컷신이 drawCutTitle 을 한 번도 안 불러서 마지막 1.4초가 빈 화면.
// 3. 그런데 애초에 'FINAL'·'EVOLVED' 는 글리프가 없어서 찍히지도 않았다.
//    'FINAL' 은 화면에 'A' 한 글자만 나왔다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, updateGame, startRun, loadBoss } from '../src/core/game.js';
import { bossBody, hitBoss, syncPhase } from '../src/core/boss.js';
import { BOSS_CUTS, cutForPhase, bossCutLength } from '../src/data/bossCutscenes.js';
import { HARD_PHASES, PHASES, HARD_MAX_HP } from '../src/data/bossData.js';
import { CUT_SOUND } from '../src/data/cutSound.js';
import { GLYPHS } from '../src/render/bigtext.js';
import { emptySave } from '../src/core/save.js';

const DT = 1 / 60;
const step = (game, frames = 1) => {
  for (let i = 0; i < frames; i++) updateGame(game, idle(), DT);
};
const idle = () => ({
  left: false, right: false, jump: false, jumpPressed: false,
  leftPressed: false, rightPressed: false, throwPressed: false, dashPressed: false,
  confirmPressed: false, restartPressed: false, pausePressed: false,
  mutePressed: false, anyPressed: false,
});

function hardBoss() {
  const game = createGame({ seed: 5, save: { ...emptySave(), seenOpening: true } });
  startRun(game, 0, { hard: true });
  loadBoss(game);
  return game;
}

// ── 버그 1: 컷신이 딴 몸을 그렸다 ──────────────────────────

test('하드 3·4페이즈는 공룡이다 — 컷신도 그 몸을 그려야 한다', () => {
  const game = hardBoss();
  const seen = {};
  for (let i = 0; i < HARD_MAX_HP; i++) {
    hitBoss(game.boss, { ranged: true });
    syncPhase(game.boss);
    seen[game.boss.phaseId] = bossBody(game.boss);
  }
  assert.equal(seen[3], 'dino', '3페이즈부터 공룡이다');
  assert.equal(seen[4], 'dino', '4페이즈도 공룡이다 — 여기서 로봇이 나오던 게 버그였다');
});

test('**마지막 전환 컷신이 도는 동안 보스는 공룡이다**', () => {
  // 신고된 버그를 고정하는 자리. 그리는 쪽은 이제 bossBody 가 준 값으로 몸을 고른다.
  const game = hardBoss();
  let cutAtPhase4 = null;
  for (let i = 0; i < HARD_MAX_HP && !cutAtPhase4; i++) {
    hitBoss(game.boss, { ranged: true });
    const changed = syncPhase(game.boss);
    if (changed === 4) cutAtPhase4 = cutForPhase(changed, true);
  }
  assert.equal(cutAtPhase4, 'phase4', '하드 4페이즈 전환은 phase4 컷신이다');
  assert.equal(
    bossBody(game.boss),
    'dino',
    'phase4 컷신이 도는 순간의 몸. 로봇을 그리면 있지도 않은 놈이 5.8초 나온다',
  );
});

test('phase4 컷신은 하드 전용이다 — 보통 모드는 여기 못 온다', () => {
  assert.equal(PHASES.length, 3);
  assert.ok(!PHASES.some((p) => p.id === 4));
  assert.equal(HARD_PHASES.length, 4);
  assert.equal(cutForPhase(4, true), 'phase4');
});

// ── 버그 3: 제목 글자가 없었다 ─────────────────────────────

test('**컷신 제목에 쓰는 글자가 글리프 표에 다 있다**', () => {
  // 없으면 drawBigText 가 조용히 빈 칸으로 흘린다 — 'FINAL' 이 'A' 한 글자로 나왔다.
  // BOSS_CUTS 에서 훑으므로 제목을 새로 지어도 여기서 잡힌다.
  for (const [id, cut] of Object.entries(BOSS_CUTS)) {
    if (!cut.title) continue;
    for (const ch of cut.title.toUpperCase()) {
      if (ch === ' ') continue;
      assert.ok(GLYPHS[ch], `${id} 의 제목 「${cut.title}」 에 쓰는 '${ch}' 가 글리프에 없다`);
    }
  }
});

test('하드모드 간판 제목 둘이 온전히 찍힌다', () => {
  for (const word of ['FINAL', 'EVOLVED']) {
    const missing = [...word].filter((c) => !GLYPHS[c]);
    assert.deepEqual(missing, [], `${word} 에서 ${missing.join(',')} 가 빠졌다`);
  }
});

// ── 새 비트와 길이 ─────────────────────────────────────────

test('두 컷신에 정적(still) 한 박자가 있고, 소리표가 덮는다', () => {
  for (const id of ['hard3', 'bossdown']) {
    const kinds = BOSS_CUTS[id].timeline.map((s) => s.kind);
    assert.ok(kinds.includes('still'), `${id} 에 정적이 없다`);
    assert.ok('still' in CUT_SOUND[id], `${id}.still 이 소리표에 없다`);
    assert.deepEqual(CUT_SOUND[id].still, {}, '정적은 **일부러** 조용하다');
  }
});

test('길어지긴 했지만 반복해서 볼 만한 길이다', () => {
  const hard3 = bossCutLength('hard3');
  const down = bossCutLength('bossdown');
  assert.ok(hard3 > 8.8, `공룡 변신이 안 길어졌다 (${hard3}s)`);
  assert.ok(down > 4.6, `죽는 컷신이 안 길어졌다 (${down}s)`);
  // 건너뛰기가 있어도 기본값이 너무 길면 그때부터는 기다림이다
  assert.ok(hard3 <= 12, `${hard3}s 는 너무 길다`);
  assert.ok(down <= 12, `${down}s 는 너무 길다`);
});

// ── 컷신이 저절로 끝나는가 (막히면 게임이 영영 안 끝난다) ──

test('늘어난 컷신도 반드시 저절로 풀린다', () => {
  for (const id of ['hard3', 'bossdown']) {
    const game = hardBoss();
    game.bossCut = { id, t: 0, length: bossCutLength(id) };
    step(game, Math.ceil((bossCutLength(id) + 1) * 60));
    // bossdown 은 **일부러** 엔딩으로 이어진다 (사이에 암전이 하나 있다)
    if (id === 'bossdown') {
      assert.ok(game.bossCut?.id === 'hardEnd' || game.bossCutGap > 0, 'bossdown 은 엔딩으로 이어진다');
    } else {
      assert.equal(game.bossCut, null, `${id} 컷신이 안 끝났다`);
    }
  }
});

// ── 변신은 **합체**다 ───────────────────────────────────────
//
// 예전에는 껍질에 금이 가고(shell) 안에서 찢고 나오는(hatch) 이야기였다.
// 그건 알에서 깨는 그림이라, 1회차에서 부품을 불러 모아 조립한 로봇과
// 세계가 어긋났다. 이제 같은 공장에서 나온 물건으로 만든다.

test('하드 변신은 로봇 합체와 **같은 비트**로 조립된다', () => {
  const kinds = BOSS_CUTS.hard3.timeline.map((s) => s.kind);
  for (const beat of ['assemble', 'lock', 'core']) {
    assert.ok(kinds.includes(beat), `합체에 ${beat} 이 없다`);
    assert.ok(
      BOSS_CUTS.phase3.timeline.some((s) => s.kind === beat),
      `${beat} 이 1회차 로봇 합체에는 없는 이름이다 — 둘이 같은 말을 써야 한다`,
    );
  }
});

test('알에서 깨는 비트는 없어졌다', () => {
  const kinds = BOSS_CUTS.hard3.timeline.map((s) => s.kind);
  for (const gone of ['shell', 'hatch']) {
    assert.ok(!kinds.includes(gone), `${gone} 이 남아 있다 — 조립 이야기와 안 맞는다`);
  }
});

test('**조립 구간의 길이가 양수여야 한다** — 0 이면 보스가 사라진다', () => {
  // 그리는 쪽(assembleAt)이 (lock - assemble) / 4 와 (core - lock) 으로 나눈다.
  // 순서를 뒤집거나 붙여 놓으면 0 으로 나눠서 grow 가 NaN 이 되고,
  // 몸이 한 조각도 안 그려진다. 타임라인만 고쳤을 때 여기서 잡힌다.
  for (const id of ['phase3', 'hard3']) {
    const at = Object.fromEntries(BOSS_CUTS[id].timeline.map((s) => [s.kind, s.at]));
    assert.ok(at.lock > at.assemble, `${id}: lock 이 assemble 보다 앞이거나 같다`);
    assert.ok(at.core > at.lock, `${id}: core 가 lock 보다 앞이거나 같다`);
    // 네 단계로 쪼개므로 한 단계가 최소한 눈에 보일 만큼은 돼야 한다
    assert.ok((at.lock - at.assemble) / 4 > 0.2, `${id}: 한 부위가 꽂히는 시간이 너무 짧다`);
  }
});

test('합체 앞에 정적이 있고, 그 뒤에 조립이 온다 (순서가 곧 연출이다)', () => {
  const at = Object.fromEntries(BOSS_CUTS.hard3.timeline.map((s) => [s.kind, s.at]));
  assert.ok(at.split < at.still, '갈라지기 전에 멈추면 뭐가 멈춘 건지 알 수 없다');
  assert.ok(at.still < at.assemble, '정적이 조립 뒤로 가면 한 박자 쉬는 뜻이 없다');
  assert.ok(at.core < at.roar, '코어에 불이 들어오기 전에 포효하면 죽은 몸이 우는 것이다');
});

// ── 죽는 컷신은 **폭주**다 ──────────────────────────────────
//
// 예전에는 비틀거리다 무릎을 꿇고 펑 터졌다. 이 몸은 3페이즈에서 조립해서 만든
// 기계인데 죽을 때만 생물처럼 무릎을 꿇었고, 마지막도 흰 원 하나에 별 몇 개라
// 「터졌다」 말고는 남는 게 없었다. 이제 안에서 못 버티고 제 안으로 무너진다.

const downAt = () => Object.fromEntries(BOSS_CUTS.bossdown.timeline.map((s) => [s.kind, s.at]));

test('죽는 컷신에 폭주 비트가 있고, 무릎 꿇기와 폭발은 없어졌다', () => {
  const kinds = BOSS_CUTS.bossdown.timeline.map((s) => s.kind);
  for (const beat of ['seep', 'seize', 'implode']) {
    assert.ok(kinds.includes(beat), `폭주에 ${beat} 이 없다`);
  }
  for (const gone of ['kneel', 'burst']) {
    assert.ok(!kinds.includes(gone), `${gone} 이 남아 있다 — 조립한 기계는 무릎을 안 꿇는다`);
  }
});

test('열이 차오르고 → 굳고 → 멈추고 → 무너진다 (순서가 곧 연출이다)', () => {
  const at = downAt();
  assert.ok(at.stagger < at.seep, '새기 전에 비틀거려야 한다');
  assert.ok(at.seep < at.shed, '앨범은 **빛에 밀려** 나온다 — 새는 게 먼저다');
  assert.ok(at.shed < at.seize, '다 빠져나온 뒤에 굳는다');
  assert.ok(at.seize < at.still, '굳어야 멈출 것이 있다');
  assert.ok(at.still < at.implode, '멈춘 뒤에 무너진다');
});

test('**정적이 한 박자는 된다** — 이 컷신은 무음 위에서 돈다', () => {
  // 마지막 일격에 브금을 끊으므로 여기가 짧으면 폭주에서 무너짐으로 넘어가는
  // 맛이 통째로 사라진다. 0.4초는 돼야 한 박자로 들린다.
  const at = downAt();
  assert.ok(at.implode - at.still >= 0.4, `정적이 ${(at.implode - at.still).toFixed(2)}초뿐이다`);
  assert.deepEqual(CUT_SOUND.bossdown.still, {}, '정적은 **일부러** 조용하다');
  assert.ok(CUT_SOUND.bossdown.implode.sfx, '무너지는데 소리가 없다');
});

test('무너지는 소리는 터지는 소리가 아니다', () => {
  // 그림은 안으로 오므라드는데 소리가 밖으로 터지면 둘이 따로 논다
  assert.notEqual(CUT_SOUND.bossdown.implode.sfx, 'burst', '안으로 무너지는데 폭발음이다');
});

test('죽는 컷신이 한 박자 길어졌지만 여전히 볼 만하다', () => {
  const down = bossCutLength('bossdown');
  assert.ok(down > 6, `폭주를 담기엔 짧다 (${down}s)`);
  assert.ok(down <= 12, `${down}s 는 너무 길다`);
});

// ── 모았다가 **터뜨린다** ───────────────────────────────────
//
// 「끝이 허전하다 — 이긴 맛이 없다」.
//
// 안으로 빨려 들며 조용히 사라지는 걸로 끝냈더니 최종보스를 이긴 것 같지가 않았다.
// 빨아들이는 건 **끝이 아니라 준비동작**이어야 한다 — 한 점으로 모았다가 놓는다.

test('안으로 모은 다음 **터진다** — 빨아들이는 게 끝이 아니다', () => {
  const kinds = BOSS_CUTS.bossdown.timeline.map((s) => s.kind);
  assert.ok(kinds.includes('blast'), '터지는 비트가 없다 — 조용히 사라지고 만다');
  const at = downAt();
  assert.ok(at.implode < at.blast, '터진 다음에 모으면 순서가 거꾸로다');
  // blast 가 **마지막 비트**여야 한다. 뒤에 뭘 더 붙이면 한 방이 묻힌다.
  const last = BOSS_CUTS.bossdown.timeline.filter((s) => s.kind !== 'end').pop();
  assert.equal(last.kind, 'blast', '터진 뒤에 다른 비트가 더 있다');
});

test('모으는 구간은 **짧다** — 준비동작이지 결말이 아니다', () => {
  const at = downAt();
  const windUp = at.blast - at.implode;
  assert.ok(windUp > 0.2, `모으는 시간이 ${windUp.toFixed(2)}초뿐이라 모은 게 안 보인다`);
  assert.ok(windUp <= 0.8, `${windUp.toFixed(2)}초는 너무 길다 — 사라지는 걸로 보인다`);
});

test('터지는 데 소리가 있다 — 이 컷신에서 유일하게 큰 소리다', () => {
  assert.ok(CUT_SOUND.bossdown.blast?.sfx, '터지는데 소리가 없다');
  // 앞의 정적이 이걸 받치는 구조다
  assert.deepEqual(CUT_SOUND.bossdown.still, {}, '정적이 깨지면 터지는 맛이 반감된다');
});

test('터지고 나서 여운이 있다 — 바로 끊기면 그것대로 허전하다', () => {
  const at = downAt();
  const after = bossCutLength('bossdown') - at.blast;
  assert.ok(after >= 1.2, `터진 뒤 ${after.toFixed(2)}초뿐이라 충격파가 다 퍼지기도 전에 끝난다`);
});
