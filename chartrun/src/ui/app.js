// 차트런 진입점. 캔버스를 켜고, 입력·소리·게임 상태를 이어 붙인다.
import { createGame, updateGame, runSummary, VIEW } from '../core/game.js';
import { createLoop } from '../core/loop.js';
import { createInput, bindTouchButtons } from '../core/input.js';
import { createAudio } from '../core/audio.js';
import { loadSave, writeSave, mergeRun } from '../core/save.js';
import { drawScene } from '../render/scene.js';
import { createHud } from '../render/hud.js';
import { crisp } from '../render/pixel.js';
import { preloadAlbumArt } from '../render/albumArt.js';
import { ALBUMS } from '../data/albums.js';

const canvas = document.getElementById('game');
const ctx = crisp(canvas.getContext('2d'));
const uiRoot = document.getElementById('ui');
const shell = document.getElementById('shell');

const save = loadSave();
const audio = createAudio(save.muted);
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
  persisted.seenIntro = true;
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
      audio.stopBgm();
      break;
    case 'ending':
      audio.stopBgm();
      audio.play('ending');
      persist({ timeMs: data.timeMs, rank: 1 });
      break;
    default:
      break;
  }
}

function update(dt) {
  input.sample();
  if (input.anyPressed) audio.unlock();
  if (input.mutePressed) {
    audio.setMuted(!audio.muted);
    persist();
  }
  time += dt;
  updateGame(game, input, dt);
}

function render() {
  drawScene(ctx, game, time);
  hud.update(game);
}

// 자리가 넉넉하면 정수배로만 키운다 — 그래야 픽셀이 안 뭉갠다.
// 폰처럼 좁은 화면에서는 정수배로 깎으면 화면이 너무 작아지니 그대로 채운다.
function resize() {
  const pad = 24;
  const availableW = Math.min(window.innerWidth - pad, 1200);
  const availableH = window.innerHeight - pad - (window.innerWidth < 760 ? 160 : 96);
  const raw = Math.min(availableW / VIEW.w, availableH / VIEW.h);
  const scale = raw >= 2 ? Math.floor(raw) : Math.max(0.5, raw);
  shell.style.setProperty('--scale', String(scale));
  shell.style.setProperty('--view-w', String(VIEW.w));
  shell.style.setProperty('--view-h', String(VIEW.h));
}

window.addEventListener('resize', resize);
resize();

bindTouchButtons(document.getElementById('touch'), input);
document.getElementById('touch').addEventListener('pointerdown', () => audio.unlock(), { once: true });

const loop = createLoop({ update, render });
loop.start();

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    game.paused = game.scene === 'play' || game.scene === 'boss' ? true : game.paused;
  }
});
