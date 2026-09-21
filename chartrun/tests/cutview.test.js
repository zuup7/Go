// 개발자 모드 · 컷신 보기.
//
// 「보스 컷신 확인하는 데 시간 너무 잡아먹어」 — 컷신 하나 보려고 보스를 3페이즈까지
// 때려야 했다. 목록에서 골라 바로 튼다.
//
// **이 화면의 전부는 「몸을 맞춰 세우는 것」이다.** 그리는 쪽은 bossBody(game.boss)
// 에게 물어보므로, hard 와 페이즈를 안 맞추면 공룡 컷신에 로봇이 나온다 —
// 예전에 실제로 있던 버그다(tests/hardcut.test.js 가 그걸 고정하고 있다).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  updateGame,
  previewCut,
  openCutList,
  cutPreviews,
  cutSlotOf,
  resumeState,
  SELECT_CUTS,
} from '../src/core/game.js';
import { bossBody } from '../src/core/boss.js';
import { CUT_PREVIEWS, bossCutLength, BOSS_CUTS } from '../src/data/bossCutscenes.js';
import { emptySave } from '../src/core/save.js';
import { readFileSync } from 'node:fs';

const DT = 1 / 60;
const idle = (over = {}) => ({
  left: false, right: false, jump: false, jumpPressed: false,
  leftPressed: false, rightPressed: false, throwPressed: false, dashPressed: false,
  confirmPressed: false, restartPressed: false, pausePressed: false,
  mutePressed: false, anyPressed: false, ...over,
});
const step = (game, frames = 1, over) => {
  for (let i = 0; i < frames; i++) updateGame(game, idle(over), DT);
};
const dev = () => createGame({ seed: 3, save: { ...emptySave(), seenOpening: true, dev: true } });

test('개발자 선택에서 컷신 목록으로 들어간다', () => {
  const game = dev();
  game.scene = 'select';
  game.selectIndex = SELECT_CUTS;
  step(game, 1, { confirmPressed: true });
  assert.equal(game.scene, 'cutList');
});

test('목록에 보스 컷신이 **하나도 안 빠졌다**', () => {
  // 컷신을 새로 만들고 목록에 안 넣으면, 그게 바로 확인하기 어려운 컷신이 된다
  const listed = new Set(cutPreviews().map((c) => c.id));
  for (const id of Object.keys(BOSS_CUTS)) {
    assert.ok(listed.has(id), `${id} 를 목록에서 고를 수 없다`);
  }
});

test('**고른 컷신마다 보스 몸이 맞게 선다**', () => {
  // 이게 이 기능의 요점이다. 몸이 틀리면 있지도 않은 놈이 컷신에 나온다.
  const want = { phase2: 'disc', phase3: 'robot', hard3: 'dino', phase4: 'dino' };
  for (const [i, p] of CUT_PREVIEWS.entries()) {
    if (p.intro) continue;
    const game = dev();
    assert.ok(previewCut(game, i), `${p.label} 을 못 틀었다`);
    assert.equal(game.bossCut?.id, p.id, `${p.label}: 다른 컷신이 돌고 있다`);
    assert.equal(game.hard, p.hard, `${p.label}: 회차가 안 맞는다`);
    assert.equal(game.boss.phaseId, p.phaseId, `${p.label}: 페이즈가 안 맞는다`);
    if (want[p.id]) assert.equal(bossBody(game.boss), want[p.id], `${p.label}: 몸이 틀렸다`);
  }
});

test('공룡 컷신은 **몸 크기까지** 공룡이다', () => {
  // phaseId 를 그냥 대입하면 크기를 건너뛰어 로봇 크기로 그려진다 (여러 번 물렸다)
  const robot = dev();
  previewCut(robot, cutSlotOf('phase3'));
  const dino = dev();
  previewCut(dino, CUT_PREVIEWS.findIndex((c) => c.id === 'hard3'));
  assert.ok(dino.boss.w > robot.boss.w, `공룡이 로봇과 같은 폭이다 (${dino.boss.w})`);
  assert.ok(dino.boss.h > robot.boss.h, '공룡이 로봇과 같은 높이다');
});

test('격파·엔딩 컷신은 **쓰러진 보스**로 튼다', () => {
  for (const id of ['bossdown', 'ending', 'hardEnd']) {
    const game = dev();
    previewCut(game, CUT_PREVIEWS.findIndex((c) => c.id === id));
    assert.equal(game.boss.state, 'defeated', `${id}: 살아 있는 보스로 틀었다`);
  }
});

test('컷신이 끝나면 **목록으로 돌아온다** — 엔딩으로 안 이어진다', () => {
  const game = dev();
  const i = CUT_PREVIEWS.findIndex((c) => c.id === 'bossdown');
  previewCut(game, i);
  step(game, Math.ceil((bossCutLength('bossdown') + 1) * 60));
  assert.equal(game.scene, 'cutList', '격파 컷신이 끝나고 목록으로 안 왔다');
  assert.equal(game.bossCut, null);
});

test('보기만 한 건 **깬 걸로 저장되지 않는다**', () => {
  // 격파 → 엔딩으로 이어지면 finishRun 이 돌아 기록이 남는다. 보기만 했는데 깬 게 된다.
  const game = dev();
  previewCut(game, CUT_PREVIEWS.findIndex((c) => c.id === 'hardEnd'));
  step(game, Math.ceil((bossCutLength('hardEnd') + 1) * 60));
  assert.equal(game.scene, 'cutList');
  assert.equal(game.ending, null, '보기만 했는데 엔딩 기록이 생겼다');
});

test('컷신 보기는 **이어하기로 찍히지 않는다**', () => {
  // loadBoss 가 'boss' 를 알리므로, 안 막으면 타이틀에 「이어하기 — 보스전」이 남는다
  const game = dev();
  previewCut(game, cutSlotOf('phase3'));
  assert.equal(resumeState(game), null, '컷신 보기가 하던 판으로 찍혔다');
});

test('목록에서 뒤로 가면 선택 화면이다 — 갇히지 않는다', () => {
  const game = dev();
  openCutList(game);
  step(game, 1, { restartPressed: true });
  assert.equal(game.scene, 'select');
});

test('◀▶ 가 양끝에서 돌아간다', () => {
  const game = dev();
  openCutList(game);
  game.cutIndex = 0;
  step(game, 1, { leftPressed: true });
  assert.equal(game.cutIndex, cutPreviews().length - 1, '왼쪽 끝에서 안 돌아간다');
  step(game, 1, { rightPressed: true });
  assert.equal(game.cutIndex, 0);
});

test('목록이 폰 화면 안에 들어간다 — 「뒤로」가 밀려나면 갇힌다', () => {
  // 스테이지 선택과 같은 규칙이다(tests/padlayout.test.js). 여기는 줄이 더 적어야
  // 패널이 세로로 안 길어진다 — R 키가 없는 폰에서 나갈 방법이 사라진다.
  const css = readFileSync(new URL('../assets/style.css', import.meta.url), 'utf8');
  const rows = Number(css.match(/\.slots\.cut-slots\s*\{\s*--slot-rows:\s*(\d+)/)?.[1]);
  assert.ok(rows > 0, 'CSS 에 .slots.cut-slots 의 --slot-rows 가 없다');
  assert.ok(
    CUT_PREVIEWS.length <= rows * 3,
    `컷신이 ${CUT_PREVIEWS.length}개면 칸이 넷으로 늘어 패널이 화면보다 넓어진다`,
  );
  // 세 칸이 들어가려면 이름이 짧아야 한다. 길어지면 칸이 넓어져 화면 밖으로 나간다.
  for (const c of CUT_PREVIEWS) {
    assert.ok(c.label.length <= 10, `「${c.label}」 이 길어서 세 칸에 안 들어간다`);
  }
});
