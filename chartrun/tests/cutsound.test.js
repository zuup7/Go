// 컷신 소리. 시각은 타임라인 한 곳에만 있어야 하고, 표에 빠진 단계가 없어야 한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, loadBoss, updateGame } from '../src/core/game.js';
import { createAudio } from '../src/core/audio.js';
import { CUTSCENE, beatsCrossed } from '../src/data/cutscene.js';
import {
  BOSS_CUTS,
  PHASE2_CUT,
  PHASE3_CUT,
  ENDING_CUT,
  bossCutLength,
} from '../src/data/bossCutscenes.js';
import { CUT_SOUND, soundFor } from '../src/data/cutSound.js';

const DT = 1 / 60;

const idle = (over = {}) => ({
  left: false,
  right: false,
  jump: false,
  jumpPressed: false,
  throwPressed: false,
  confirmPressed: false,
  restartPressed: false,
  pausePressed: false,
  mutePressed: false,
  anyPressed: false,
  ...over,
});

/** 컷신을 돌리면서 나온 cutbeat 을 순서대로 모은다 */
function beatsOf(id, { seconds, input } = {}) {
  const game = createGame({ seed: 3 });
  loadBoss(game);
  const beats = [];
  game.onEvent = (name, data) => {
    if (name === 'cutbeat') beats.push(data);
  };
  game.bossCut = { id, t: 0, length: bossCutLength(id) };
  const total = seconds ?? bossCutLength(id) + 0.5;
  for (let i = 0; i < Math.round(total / DT); i++) updateGame(game, idle(input), DT);
  return { game, beats };
}

// ── beatsCrossed ────────────────────────────────────────────
test('경계를 정확히 한 번만 넘긴다', () => {
  const line = [
    { at: 0, kind: 'a' },
    { at: 1, kind: 'b' },
    { at: 2, kind: 'c' },
  ];
  assert.deepEqual(beatsCrossed(line, -1, 0).map((s) => s.kind), ['a']);
  assert.deepEqual(beatsCrossed(line, 0, 1).map((s) => s.kind), ['b']);
  // 같은 구간을 다시 물어보면 아무것도 안 나온다 — 두 번 울리면 소리가 겹친다
  assert.deepEqual(beatsCrossed(line, 1, 1), []);
  assert.deepEqual(beatsCrossed(line, 0.5, 2).map((s) => s.kind), ['b', 'c']);
});

// ── 표에 빠진 단계가 없어야 한다 (이 파일의 핵심) ────────────
test('모든 컷신 단계가 소리 표에 있다', () => {
  const timelines = [
    ['merge', CUTSCENE],
    ['phase2', PHASE2_CUT],
    ['phase3', PHASE3_CUT],
    ['ending', ENDING_CUT],
  ];
  for (const [cut, timeline] of timelines) {
    for (const step of timeline) {
      assert.ok(
        soundFor(cut, step.kind) !== undefined,
        `${cut}/${step.kind} 이 소리 표에 없다 — 새 단계를 넣고 소리를 빠뜨렸다`,
      );
    }
    // 반대쪽도 본다. 타임라인에서 지운 단계가 표에 남아 있으면 헷갈린다.
    for (const kind of Object.keys(CUT_SOUND[cut])) {
      assert.ok(
        timeline.some((s) => s.kind === kind),
        `${cut}/${kind} 은 타임라인에 없는 단계다`,
      );
    }
  }
});

test('표가 가리키는 소리 이름이 실제로 있다', () => {
  // createAudio() 는 부르는 것만으로는 소리를 내지 않아 브라우저 밖에서도 안전하다
  const { sfx, bgm } = createAudio(true).names();
  for (const [cut, steps] of Object.entries(CUT_SOUND)) {
    for (const [kind, cue] of Object.entries(steps)) {
      if (cue.sfx) assert.ok(sfx.includes(cue.sfx), `${cut}/${kind}: 없는 효과음 ${cue.sfx}`);
      if (cue.bgm) assert.ok(bgm.includes(cue.bgm), `${cut}/${kind}: 없는 곡 ${cue.bgm}`);
    }
  }
});

test('엔딩 2부는 결혼식 곡으로 갈아탄다', () => {
  assert.equal(soundFor('ending', 'aisle').bgm, 'wedding');
  assert.equal(soundFor('ending', 'climb').bgm, 'victory');
});

// ── 실제로 흐를 때 ──────────────────────────────────────────
for (const id of Object.keys(BOSS_CUTS)) {
  test(`${id} 컷신을 끝까지 돌리면 모든 단계가 순서대로 한 번씩 울린다`, () => {
    const { beats } = beatsOf(id);
    assert.deepEqual(
      beats.map((b) => b.kind),
      BOSS_CUTS[id].timeline.map((s) => s.kind),
      `${id}: 울린 순서가 타임라인과 다르다`,
    );
    assert.ok(beats.every((b) => b.cut === id));
  });
}

test('맨 앞 단계도 울린다 — 0초짜리를 빠뜨리기 쉽다', () => {
  const { beats } = beatsOf('ending', { seconds: 0.1 });
  assert.deepEqual(beats.map((b) => b.kind), ['crack']);
});

test('건너뛰면 남은 단계가 한꺼번에 쏟아지지 않는다', () => {
  // 0.4초씩 두 번 — 두 번째에 건너뛰기가 먹는다
  const { game, beats } = beatsOf('ending', { seconds: 0.8, input: { confirmPressed: true } });
  assert.equal(game.bossCut, null, '건너뛰기가 먹어야 한다');
  assert.ok(beats.length <= 2, `건너뛰었는데 ${beats.length}개가 울렸다`);
});

test('컷신이 끝나면 끝났다고 알린다 — 건너뛰어도 나온다', () => {
  for (const skip of [false, true]) {
    const game = createGame({ seed: 5 });
    loadBoss(game);
    const done = [];
    game.onEvent = (name, data) => {
      if (name === 'cutdone') done.push(data.cut);
    };
    game.bossCut = { id: 'phase2', t: 0, length: bossCutLength('phase2') };
    const seconds = skip ? 1.2 : bossCutLength('phase2') + 0.5;
    for (let i = 0; i < Math.round(seconds / DT); i++) {
      updateGame(game, idle({ confirmPressed: skip }), DT);
    }
    assert.deepEqual(done, ['phase2'], skip ? '건너뛰었을 때 안 나왔다' : '끝났을 때 안 나왔다');
  }
});
