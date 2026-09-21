// 차트런 진입점. 캔버스를 켜고, 입력·소리·게임 상태를 이어 붙인다.
import {
  createGame,
  updateGame,
  runSummary,
  resumeState,
  setDevMode,
  pausable,
  inCutscene,
  PAUSE_ROWS,
  VIEW,
} from '../core/game.js';
import { DEV_CODE, pushDigit, codeMatches } from '../core/devmode.js';
import { createLoop } from '../core/loop.js';
import { createInput, bindTouchButtons } from '../core/input.js';
import { createAudio, nextVolume } from '../core/audio.js';
import { loadSave, writeSave, mergeRun } from '../core/save.js';
import { drawScene } from '../render/scene.js';
import { createHud } from '../render/hud.js';
import { crisp } from '../render/pixel.js';
import { preloadAlbumArt } from '../render/albumArt.js';
import { ALBUMS } from '../data/albums.js';
import { soundFor } from '../data/cutSound.js';
import { createTouchLayout } from './touchLayout.js';

const canvas = document.getElementById('game');
const ctx = crisp(canvas.getContext('2d'));
const uiRoot = document.getElementById('ui');
const shell = document.getElementById('shell');

const save = loadSave();
const audio = createAudio(save.muted, save.volume);
const input = createInput(window);
const hud = createHud(uiRoot);

// 나중에 진짜 앨범 사진을 넣으면 여기서 자동으로 불러온다 (없으면 그냥 넘어간다)
preloadAlbumArt(ALBUMS);

const game = createGame({
  save,
  onEvent: (name, data) => handleEvent(name, data),
});

// 개발·검증용 손잡이. 콘솔에서 window.__game / __input 으로 상태를 들여다볼 수 있다.
window.__game = game;
window.__input = input;

let time = 0;
let persisted = save;

function persist(extra = {}) {
  persisted = mergeRun(persisted, { ...runSummary(game), ...extra });
  persisted.muted = audio.muted;
  persisted.volume = audio.volume;
  persisted.dev = game.dev;
  game.save = persisted;
  // 저장이 막히면 writeSave 가 false 를 준다. 안 받아두면 친구가 한 바퀴를 다 돌고
  // 나서야 기록이 하나도 안 남은 걸 알게 된다 — 타이틀에 한 줄 알려준다.
  if (!writeSave(persisted)) game.saveBroken = true;
}

// 저장이 되는 기기인지 시작할 때 한 번 확인한다. 읽기만 해서는 알 수 없고(빈 저장과
// 구별이 안 된다) 첫 체크포인트까지 기다리면, 한 바퀴를 다 돌고 나서야 기록이 하나도
// 안 남은 걸 알게 된다. 쓰는 값은 방금 읽은 그대로라 아무것도 안 바뀐다.
if (!writeSave(persisted)) game.saveBroken = true;

// ── 멈추기 · 뒤로가기 · 화면 잠금 ───────────────────────────
// (handleEvent 가 armBackTrap 을 부르므로 그보다 위에 둔다)

// 멈춤을 직접 game.paused 로 켜지 않는다 — pausable() 판단과 'pause' 이벤트가 있는
// updateGame 경로를 그대로 태워야 규칙이 한 군데에만 남는다. (pressKey 가 쓰는 수법과 같다)
const pressPause = () => {
  updateGame(
    game,
    { ...input, pausePressed: true, leftPressed: false, rightPressed: false, confirmPressed: false },
    0,
  );
};

/**
 * 안드로이드 뒤로가기.
 *
 * WebView 는 기본으로 뒤로가기 = 앱 종료다. 보스전 중에 잘못 누르면 그대로 끝난다.
 * 히스토리에 한 칸 심어두고, 그 칸이 빠질 때 **일시정지**로 돌린다.
 * 칸을 다시 안 심으므로 멈춘 채로 한 번 더 누르면 정상적으로 나간다 —
 * 칸은 판이 다시 굴러갈 때(이어하기·새 판) 다시 심는다.
 */
let backTrap = false;
function armBackTrap() {
  if (backTrap) return;
  // 샌드박스 iframe(아티팩트)에서는 pushState 가 SecurityError 를 던진다.
  // 뒤로가기 버튼도 없는 곳이니 조용히 기능만 끈다.
  try {
    history.pushState({ chartrun: 'back' }, '');
    backTrap = true;
  } catch {
    backTrap = false;
  }
}
armBackTrap();
window.addEventListener('popstate', () => {
  if (!backTrap) return;
  backTrap = false;
  if (pausable(game) && !game.paused) pressPause();
});

/**
 * 화면이 잠들지 않게.
 *
 * 손을 안 대고 보고만 있는 구간이 길다 (엔딩 컷신이 18초다). 잠금은 화면이 꺼지거나
 * 탭이 가려지면 저절로 풀리므로, 돌아올 때 다시 잡는다.
 * 없는 기기·거절하는 기기에서는 조용히 넘어간다.
 */
let wakeLock = null;
async function keepAwake() {
  if (wakeLock || document.hidden) return;
  try {
    wakeLock = (await navigator.wakeLock?.request('screen')) ?? null;
    wakeLock?.addEventListener?.('release', () => {
      wakeLock = null;
    });
  } catch {
    wakeLock = null;
  }
}
keepAwake();

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (pausable(game) && !game.paused) pressPause();
  } else {
    keepAwake();
  }
});

/**
 * 손에 전하는 알림.
 *
 * **세 군데에만 쓴다** — 맞았을 때·죽었을 때·보스에게 한 대 먹였을 때.
 * 밟기마다 울리면 한 판에 마흔 번이라 그건 알림이 아니라 소음이다.
 * 폰에서 소리를 꺼둔 사람에게는 이게 유일한 "방금 뭔가 일어났다"다.
 * (진동을 막아둔 기기·데스크톱에서는 그냥 아무 일도 안 일어난다)
 */
const buzz = (pattern) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* 막아둔 기기도 있다 */
  }
};

function handleEvent(name, data) {
  switch (name) {
    case 'jump':
      audio.play('jump');
      break;
    case 'stomp':
      audio.play('stomp');
      break;
    case 'coin':
      audio.play('coin');
      break;
    case 'power':
      audio.play('power');
      break;
    case 'throw':
      audio.play('jump');
      break;
    case 'dash':
      audio.play('crumble');
      break;
    case 'laseraim':
      audio.play('gather');
      break;
    case 'laser':
      audio.play('flash');
      break;
    case 'shot':
      audio.play('shot');
      break;
    // 공룡의 간판 공격 둘은 **예비동작도 타격도 소리가 없었다.** 레이저는
    // laseraim/laser 로 예고와 발사가 다 들리는데 꼬리와 발구르기만 조용했다.
    case 'tailaim':
      audio.play('gather');
      break;
    case 'tail':
      audio.play('crumble');
      break;
    case 'stompaim':
      audio.play('rumble');
      break;
    case 'bossstomp':
      audio.play('thud');
      break;
    case 'revive':
      audio.play('blip');
      break;
    case 'land':
      audio.play('land');
      break;
    case 'hurt':
      buzz(25);
      audio.play('hurt');
      break;
    case 'trap':
      // 폭탄만 따로 — 함정 소리로는 "터졌다"가 안 들린다
      audio.play(data.kind === 'bomb' ? 'burst' : 'trap');
      break;
    case 'crumble':
      audio.play('crumble');
      break;
    case 'checkpoint':
      audio.play('checkpoint');
      // 하던 판을 **여기서** 찍는다. 자리와 숫자를 한 시점에서 통째로 가져와야
      // 이어했을 때 체크포인트 뒤에 주운 걸 또 줍지 않는다 (core 의 resumeState).
      persist({ resume: resumeState(game) });
      break;
    case 'death':
      buzz(60);
      audio.play('death');
      break;
    case 'clear':
      audio.play('clear');
      // 여기서는 하던 판을 안 찍는다. 2.6초 뒤 다음 판이 열리면서 'stage' 가
      // 찍을 거고, 그 사이에 나가도 이 판 마지막 체크포인트로 돌아오면 그만이다.
      // 방금 깬 판의 시작점을 가리키게 두면 그게 오히려 한 판을 되돌린다.
      persist({ clearedStage: data.stage });
      break;
    case 'bosshit':
      buzz([0, 25, 35, 25]);
      audio.play('bosshit');
      break;
    case 'phase':
      audio.play('phase');
      break;
    case 'bossdown':
      // 마지막 일격에만 온다. 브금을 **여기서** 끊는다 — 쓰러지는 컷신이 뜨기까지
      // 0.9초 동안 보스가 조용히 가라앉는데, 그 위로 전투 브금이 계속 돌면
      // 여운이 될 자리를 음악이 덮는다.
      audio.stopBgm();
      audio.play('bossdown');
      break;
    case 'boss':
      audio.bgm('boss');
      persist({ resume: resumeState(game) });
      break;
    case 'pause':
      // 멈춤이 풀렸다 — 뒤로가기 칸을 다시 심는다 (멈출 때 하나 빠졌다)
      if (!data.paused) armBackTrap();
      break;
    case 'stage':
      audio.bgm('stage');
      // 새 판이 시작됐다. 타이틀에서 나가느라 칸이 빠져 있을 수 있다
      armBackTrap();
      // 판이 시작됐으면 조작 안내는 할 일을 다 했다 — 타이틀에 다시 안 띄운다
      if (!persisted.seenHelp) persisted = { ...persisted, seenHelp: true };
      // **판마다 찍는다.** 예전에는 seenHelp 일 때만 저장해서 첫 판 말고는
      // 아무것도 안 남았다. 이게 있어야 판에 들어서자마자 나가도 그 판에서 다시 연다.
      persist({ resume: resumeState(game) });
      break;
    case 'cutscene':
      // 컷신은 정적으로 시작한다. 음악은 아래 cutbeat 가 알맞은 때에 다시 켠다.
      audio.stopBgm();
      break;
    case 'cutbeat': {
      const cue = soundFor(data.cut, data.kind);
      if (cue?.bgm) audio.bgm(cue.bgm);
      if (cue?.sfx) audio.play(cue.sfx);
      break;
    }
    case 'volume':
      // 일시정지 메뉴에서 소리 줄을 골랐다. core 는 소리를 모르니 여기서 한 칸 돌린다.
      ui.volume = audio.setVolume(nextVolume(audio.volume));
      audio.play('blip');
      persist();
      break;
    case 'mute':
      // 폰에는 M 키가 없다. 일시정지 메뉴가 유일한 길이다.
      ui.muted = audio.setMuted(!audio.muted);
      // 켜는 쪽에서는 이 소리가 안 난다(play 가 음소거면 그냥 돌아온다) — 그게 맞다.
      // 푸는 쪽에서만 한 번 울려서 "돌아왔다"를 들려준다.
      audio.play('blip');
      persist();
      break;
    case 'dev':
      // 켜고 끈 걸 기억한다 — 새로고침할 때마다 다시 넣게 하면 성가시다
      persist();
      break;
    case 'introdone':
      // 오프닝은 한 번만 — 끝까지 봤든 건너뛰었든 여기로 온다.
      // persist() 가 persisted 를 그대로 이어받으므로 여기서 켜두면 그대로 저장된다.
      persisted = { ...persisted, seenOpening: true };
      persist();
      break;
    case 'cutdone':
      // 페이즈 전환 컷신이 끝나면 싸움이 이어진다 — 브금을 되돌린다.
      // (엔딩은 곧 통계 화면이 stopBgm 을 부르므로 건드리지 않는다)
      if (data.cut !== 'ending') audio.bgm('boss');
      break;
    case 'ending':
      audio.stopBgm();
      audio.play('ending');
      // 한 바퀴를 돌았다고 남긴다 — 이걸로 NPC 와 하드모드가 열린다.
      // resume: null 은 **판이 끝났다**는 뜻이다. 안 지우면 다 깬 뒤에도 타이틀에
      // 「이어하기」가 남아서, 끝난 판으로 되돌아가게 된다.
      persist({
        timeMs: data.timeMs,
        rank: 1,
        clearedOnce: true,
        clearedHard: data.hard,
        resume: null,
      });
      break;
    case 'talk':
      audio.play('blip');
      break;
    case 'portal':
      audio.play('swirl');
      break;
    case 'caught':
      audio.stopBgm();
      audio.play('roar');
      break;
    case 'spring':
      audio.play('power');
      break;
    default:
      break;
  }
}

// ── 개발자 모드 숫자판 ──────────────────────────────────────
// 화면에 그리는 건 hud 가 하고, 여기서는 상태와 입력만 다룬다.
const ui = { keypad: null, volume: audio.volume, muted: audio.muted };

function openKeypad() {
  ui.keypad = { buf: '', bad: false };
}

function pressKey(key) {
  // 일시정지 메뉴는 그 줄로 옮긴 뒤 바로 고른다 — 폰에는 ◀▶ 도 엔터도 없다
  if (key.startsWith('pause:')) {
    const row = PAUSE_ROWS.indexOf(key.slice('pause:'.length));
    if (row >= 0 && game.paused) {
      game.pauseIndex = row;
      // 눌린 상태를 그대로 넘기면 안 된다 — pausePressed 가 살아 있으면 멈춤이 도로 풀린다
      updateGame(
        game,
        { ...input, pausePressed: false, leftPressed: false, rightPressed: false, confirmPressed: true },
        0,
      );
    }
    return;
  }
  // 타이틀 메뉴도 탭으로. 안 그러면 「스테이지 선택」이라고 적힌 줄을 눌러도
  // 아무 일도 안 일어난다 (.ui 위에 캔버스가 있어서 줄은 클릭을 안 받는다).
  if (key.startsWith('title:')) {
    if (game.scene !== 'title') return;
    game.titleIndex = Number(key.slice('title:'.length));
    updateGame(
      game,
      { ...input, leftPressed: false, rightPressed: false, confirmPressed: true },
      0,
    );
    return;
  }
  // 스테이지 선택도 탭으로 — 폰에는 R 키가 없어서 「뒤로」를 누를 방법이 없다.
  // 일시정지 메뉴와 같은 수법이다: 줄만 옮겨두고 합성 입력 한 프레임을 흘린다.
  if (key.startsWith('slot:')) {
    if (game.scene !== 'select') return;
    const what = key.slice('slot:'.length);
    const frame = { ...input, leftPressed: false, rightPressed: false };
    if (what === 'back') {
      updateGame(game, { ...frame, restartPressed: true, confirmPressed: false }, 0);
    } else {
      game.selectIndex = Number(what);
      updateGame(game, { ...frame, restartPressed: false, confirmPressed: true }, 0);
    }
    return;
  }
  // 컷신 보기도 같은 방식 (개발자 모드). 여기도 폰에는 R 키가 없다.
  if (key.startsWith('cut:')) {
    if (game.scene !== 'cutList') return;
    const what = key.slice('cut:'.length);
    const frame = { ...input, leftPressed: false, rightPressed: false };
    if (what === 'back') {
      updateGame(game, { ...frame, restartPressed: true, confirmPressed: false }, 0);
    } else {
      game.cutIndex = Number(what);
      updateGame(game, { ...frame, restartPressed: false, confirmPressed: true }, 0);
    }
    return;
  }
  // 숨은 화면에서 나가기. 선택 화면의 「뒤로」와 같은 이유로 꼭 있어야 한다 —
  // 폰에는 R 키가 없고, 이 화면은 캔버스만 있어서 안 그러면 갇힌다.
  if (key === 'gallery:back') {
    if (game.scene !== 'gallery') return;
    updateGame(
      game,
      { ...input, leftPressed: false, rightPressed: false, confirmPressed: false, restartPressed: true },
      0,
    );
    return;
  }
  if (key === 'open') {
    openKeypad();
    return;
  }
  const pad = ui.keypad;
  if (!pad) return;
  if (key === 'close') {
    ui.keypad = null;
    return;
  }
  if (key === 'back') {
    pad.buf = pad.buf.slice(0, -1);
    pad.bad = false;
    return;
  }
  if (!/^[0-9]$/.test(key)) return;

  pad.buf = pushDigit(pad.bad ? '' : pad.buf, key);
  pad.bad = false;
  if (pad.buf.length < DEV_CODE.length) return;

  if (codeMatches(pad.buf)) {
    ui.keypad = null;
    setDevMode(game, true);
  } else {
    // 틀리면 지우고 다시 — 칸을 한 번 빨갛게 흔든다
    pad.bad = true;
  }
}

// 다시 그릴 때마다 innerHTML 이 통째로 갈리므로 버튼마다 핸들러를 달 수 없다.
// 리스너는 #center 에 하나만 두고 위임한다.
uiRoot.querySelector('#center').addEventListener('click', (e) => {
  const key = e.target.closest?.('[data-key]')?.dataset.key;
  if (key) pressKey(key);
});

// 키보드로도 넣을 수 있다. 숫자판이 열려 있을 때만 받는다.
window.addEventListener('keydown', (e) => {
  if (!ui.keypad) return;
  if (/^[0-9]$/.test(e.key)) pressKey(e.key);
  else if (e.key === 'Backspace') pressKey('back');
  else if (e.key === 'Escape') pressKey('close');
});

function update(dt) {
  // 숫자판이 떠 있는 동안은 게임 입력을 먹지 않는다 — 점프 키로 판이 시작돼버린다
  if (ui.keypad) {
    input.sample();
    return;
  }
  input.sample();
  if (input.anyPressed) audio.unlock();
  if (input.mutePressed) {
    // 일시정지 메뉴의 음소거 줄과 **같은 값을 본다** — 안 맞춰두면 M 으로 끈 뒤
    // 메뉴를 열었을 때 「음소거 꺼짐」이라고 거짓말을 한다
    ui.muted = audio.setMuted(!audio.muted);
    persist();
  }
  time += dt;
  updateGame(game, input, dt);
}

const throwBtn = document.getElementById('throw-btn');
const pauseBtn = document.querySelector('.pause-btn');
const dashBtn = document.getElementById('dash-btn');
const skipBtn = document.getElementById('skip-btn');

/**
 * 컷신 건너뛰기.
 *
 * 규칙(언제부터 건너뛸 수 있나, 어떤 컷신이 어떻게 끝나나)은 전부 core 에 있다.
 * 이 버튼은 **키보드로 누르는 것과 똑같은 한 프레임**을 흘려보낼 뿐이다 —
 * 여기서 game.cutsceneTime 을 직접 만지면 컷신마다 끝나는 방식이 달라서 어긋난다.
 */
skipBtn.addEventListener('click', () => {
  if (!inCutscene(game)) return;
  updateGame(
    game,
    { ...input, leftPressed: false, rightPressed: false, confirmPressed: true },
    0,
  );
});

// 인자를 안 받는다. loop 가 보간 비율을 넘겨주지만 **픽셀 게임에는 해롭다** —
// 정수 좌표로 반올림해 찍는 그림이라 사이값을 섞으면 픽셀이 흐려진다.
function render() {
  drawScene(ctx, game, time);
  hud.update(game, ui);
  // 던지기 버튼은 쓸 수 있을 때만 — 평소엔 자리만 차지한다
  throwBtn.hidden = game.scene !== 'boss';
  throwBtn.disabled = !(game.player?.ammo > 0);
  // 대시도 보스전에서만 쓴다 — 판에서는 자리만 차지한다
  dashBtn.hidden = game.scene !== 'boss';
  // 돌아왔는지 폰에서도 보여야 한다 — 흐려진 버튼이 곧 쿨이다
  dashBtn.disabled = !(game.player && game.player.dashCool <= 0);
  // 멈출 수 있을 때만 보인다 (편집 중에는 touchLayout 이 알아서 다 보여준다)
  pauseBtn.hidden = !(game.scene === 'play' || game.scene === 'boss');
  // 컷신이 도는 동안만. 「아무 키나 누르면 넘어간다」를 아무도 모른다.
  const cut = inCutscene(game);
  skipBtn.hidden = !cut;
  // 컷신 동안에는 조작 버튼을 치운다 (CSS 가 .touch-left/.touch-right 를 숨긴다).
  // 안 치우면 대시 버튼이 「건너뛰기」 위에 얹혀서 눌리지 않는다.
  document.body.classList.toggle('in-cut', cut);
}

// 화면 맞추기.
//
// 손으로 잡는 기기(pointer: coarse)에서는 게임이 화면을 꽉 채운다. 조작 버튼은
// 화면 아래에 자리를 차지하지 않고 좌우 여백과 구석에 겹쳐 뜬다.
// 세로로 들고 있으면 화면을 통째로 90도 돌린다 — 회전 잠금을 켜둔 사람이 많아서,
// "가로로 돌려주세요" 라고만 써두면 아무 일도 안 일어난다.
const coarsePointer = window.matchMedia('(pointer: coarse)');
const rotateNote = document.getElementById('rotate-note');
/** 버튼 자리 관리자 (아래에서 만들어 넣는다) */
let padsRef = null;

function resize() {
  const handheld = coarsePointer.matches;
  const rotated = handheld && window.innerHeight > window.innerWidth;
  document.body.classList.toggle('handheld', handheld);
  document.body.classList.toggle('rotated', rotated);
  rotateNote.hidden = !rotated;

  // 돌려놓은 화면에서는 가로·세로가 뒤바뀐다
  const viewW = rotated ? window.innerHeight : window.innerWidth;
  const viewH = rotated ? window.innerWidth : window.innerHeight;

  let scale;
  if (handheld) {
    scale = Math.min(viewW / VIEW.w, viewH / VIEW.h);
  } else {
    // 자리가 넉넉하면 정수배로만 키운다 — 그래야 픽셀이 안 뭉갠다
    const pad = 24;
    const raw = Math.min(Math.min(viewW - pad, 1200) / VIEW.w, (viewH - pad - 96) / VIEW.h);
    scale = raw >= 2 ? Math.floor(raw) : Math.max(0.5, raw);
  }

  shell.style.setProperty('--scale', String(scale));
  shell.style.setProperty('--view-w', String(VIEW.w));
  shell.style.setProperty('--view-h', String(VIEW.h));

  // 가로↔세로가 바뀌면 좌표계가 달라진다. 그 모드에 저장해둔 자리를 다시 얹는다.
  padsRef?.apply();
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
coarsePointer.addEventListener?.('change', resize);
resize();

const touchRoot = document.getElementById('touch');
bindTouchButtons(touchRoot, input);
touchRoot.addEventListener('pointerdown', () => audio.unlock(), { once: true });

const loop = createLoop({ update, render });
loop.start();

// 버튼 자리 바꾸기. 편집하는 동안에는 게임을 세운다 — 옮기다가 죽으면 억울하다.
const pads = createTouchLayout({
  root: touchRoot,
  isRotated: () => document.body.classList.contains('rotated'),
  onEdit: (on) => {
    if (on) loop.stop();
    else loop.start();
  },
});
pads.apply();
padsRef = pads;

