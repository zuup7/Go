// 차트런 진입점. 캔버스를 켜고, 입력·소리·게임 상태를 이어 붙인다.
import { createGame, updateGame, runSummary, setDevMode, PAUSE_ROWS, VIEW } from '../core/game.js';
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
  writeSave(persisted);
}

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
    case 'hurt':
      audio.play('hurt');
      break;
    case 'trap':
      audio.play('trap');
      break;
    case 'crumble':
      audio.play('crumble');
      break;
    case 'checkpoint':
      audio.play('checkpoint');
      persist();
      break;
    case 'death':
      audio.play('death');
      break;
    case 'clear':
      audio.play('clear');
      persist({ clearedStage: data.stage });
      break;
    case 'bosshit':
      audio.play('bosshit');
      break;
    case 'phase':
      audio.play('phase');
      break;
    case 'bossdown':
      audio.play('bossdown');
      break;
    case 'boss':
      audio.bgm('boss');
      break;
    case 'stage':
      audio.bgm('stage');
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
      // 한 바퀴를 돌았다고 남긴다 — 이걸로 NPC 와 하드모드가 열린다
      persist({ timeMs: data.timeMs, rank: 1, clearedOnce: true, clearedHard: data.hard });
      break;
    case 'talk':
      audio.play('blip');
      break;
    case 'portal':
      audio.play('swirl');
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
const ui = { keypad: null, volume: audio.volume };

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
    audio.setMuted(!audio.muted);
    persist();
  }
  time += dt;
  updateGame(game, input, dt);
}

const throwBtn = document.getElementById('throw-btn');
const pauseBtn = document.querySelector('.pause-btn');
const dashBtn = document.getElementById('dash-btn');

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

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    game.paused = game.scene === 'play' || game.scene === 'boss' ? true : game.paused;
  }
});
