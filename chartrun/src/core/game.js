// 게임 전체의 상태 기계. 그리기는 하지 않는다 — render/ 가 이 상태를 보고 그린다.
import { createWorld, T } from './world.js';
import { STAGES, HARD_STAGES, BOSS_STAGE } from '../data/stages.js';
import { createPlayer, respawnPlayer, updatePlayer, bounce, damagePlayer } from './player.js';
import { spawnAlbum, updateAlbum, stompAlbum, updateShot } from './enemy.js';
import { createCamera, updateCamera, shakeCamera } from './camera.js';
import { rankAt, TOP_RANK } from './chart.js';
import {
  createBoss,
  updateBoss,
  hitBoss,
  syncPhase,
  bossPhase,
  throwMic,
  updateThrown,
  laserBeam,
  laserBeams,
} from './boss.js';
import { ZONE_EFFECTS, emptyEffects, createTrapMemory, trapKey } from '../data/traps.js';
import { CUTSCENE, CUTSCENE_LENGTH, beatsCrossed } from '../data/cutscene.js';
import { BOSS_CUTS, bossCutLength, cutForPhase } from '../data/bossCutscenes.js';
import { INTRO_CUT, introLength } from '../data/introCutscene.js';
import { NPC_TALK, npcTalkLength } from '../data/npcTalk.js';
import { CAUGHT_CUT, caughtLength } from '../data/caughtCut.js';
import { emptySave } from './save.js';
import { createRng } from './rng.js';
import { clamp, overlaps } from './util.js';
import { TILE } from './physics.js';

export const VIEW = { w: 384, h: 224 };

/**
 * 이 판이 볼 스테이지 표.
 *
 * HARD_STAGES 를 STAGES 에 덧붙이지 않는 이유: 순위 구간(core/chart.js)이 네 칸이라
 * 다섯 번째 스테이지는 마지막 구간을 조용히 재사용하고, 스테이지 선택 칸 번호도
 * 통째로 밀린다. 표를 나누면 1회차 쪽은 손댈 일이 없다.
 *
 * **읽는 곳이 넷이다** — loadStage, 다음 판 계산, 그리고 HUD 두 곳.
 * 하나라도 빠지면 하드모드에서 엉뚱한 스테이지 이름이 뜬다.
 */
export const stageTable = (game) => (game?.hard ? HARD_STAGES : STAGES);
export const stageCount = (game) => stageTable(game).length;

/** 가짜 발판이 무너지기까지 (짧아야 웃기다) */
const CRUMBLE_TIME = 0.14;
/** 무너지는 바닥은 잠깐 떨다 꺼진다 — 달리면 건널 수 있을 만큼만 */
const FLOOR_CRUMBLE_TIME = 0.45;
const DEATH_HOLD = 1.5;
const CLEAR_HOLD = 2.6;
const INTRO_HOLD = 2.0;

export function createGame(options = {}) {
  const save = options.save ?? emptySave();
  const game = {
    scene: 'title',
    sceneTime: 0,
    save,
    onEvent: options.onEvent ?? (() => {}),
    rng: createRng(options.seed ?? Date.now()),
    stageIndex: 0,
    world: null,
    player: null,
    albums: [],
    shots: [],
    /** 바닥에 떨어진 마이크(주울 것) 와 날아가는 마이크(던진 것) */
    mics: [],
    thrown: [],
    /** 구간 효과 남은 시간(초). 0 이면 안 걸린 것 */
    effects: emptyEffects(),
    /** 보스전 중간에 끼어드는 컷신 { id, t, length }. 있는 동안 싸움이 멈춘다 */
    bossCut: null,
    /** NPC 와 이야기하는 중 { t, length }. 있는 동안 판이 멈춘다 (bossCut 과 같은 모양) */
    npcTalk: null,
    /** 뒤에서 쫓아오는 거대 로봇 { x }. 추격 판에서만 있다 */
    chaser: null,
    /** 잡혀서 컷신이 도는 중 { t, length } (npcTalk 과 같은 모양) */
    caught: null,
    /** 깜빡이는 발판이 지금 켜져 있나 (바뀔 때만 격자를 손대려고 들고 있다) */
    blinkOn: null,
    particles: [],
    texts: [],
    camera: createCamera(VIEW.w, VIEW.h),
    checkpoint: null,
    crumbling: new Map(),
    trapMemory: createTrapMemory(save.revealedTraps),
    chartOuts: 0,
    plays: 0,
    score: 0,
    defeated: 0,
    rank: 100,
    elapsedMs: 0,
    boss: null,
    paused: false,
    muted: save.muted,
    flash: 0,
    cutsceneTime: 0,
    ending: null,
    /** 개발자 모드가 켜져 있는지 (비번 1234). 켜면 스테이지를 골라 들어갈 수 있다 */
    dev: save.dev ?? false,
    /** 타이틀에서 고른 줄, 스테이지 선택 화면에서 고른 칸, 일시정지 메뉴에서 고른 줄 */
    titleIndex: 0,
    selectIndex: 0,
    pauseIndex: 0,
    /**
     * 1스테이지부터 달린 판이 아니다 (골라 들어갔다).
     * 이런 판은 기록을 갱신하지 않는다 — 안 그러면 보스만 골라 이기고 최고 기록이 된다.
     */
    partial: false,
    /**
     * 2회차(하드모드)를 도는 중인가. 스테이지 표와 보스 페이즈가 여기서 갈린다.
     * 판 하나가 아니라 **한 바퀴 전체**의 성질이라 startRun 에서만 정한다.
     */
    hard: false,
  };
  return game;
}

const emit = (game, name, data) => game.onEvent(name, data ?? {});

/**
 * 이 판에서 함정 표시를 기억할 열쇠.
 * 하드모드만 스테이지 이름을 앞에 붙인다 — 보통 판의 형식을 바꾸면
 * 이미 저장돼 있던 표시가 전부 안 맞게 된다.
 */
const markKey = (game, tx, ty) => trapKey(tx, ty, game.hard ? game.world.stage.id : '');

function addParticles(game, x, y, count, colors, opts = {}) {
  for (let i = 0; i < count; i++) {
    const angle = game.rng.float() * Math.PI * 2;
    const speed = (opts.speed ?? 60) * (0.4 + game.rng.float());
    game.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (opts.lift ?? 30),
      life: opts.life ?? 0.6,
      max: opts.life ?? 0.6,
      size: opts.size ?? 2,
      color: colors[Math.floor(game.rng.float() * colors.length)],
      gravity: opts.gravity ?? 320,
    });
  }
}

function addText(game, x, y, text, color = '#fff') {
  game.texts.push({ x, y, text, color, life: 0.9, max: 0.9 });
}

// ── 스테이지 준비 ────────────────────────────────────────────
function spawnEntities(game) {
  game.albums = game.world.albumSpawns.map((s) => spawnAlbum(s.id, s.x, s.y));
  game.shots = [];
  game.mics = [];
  game.thrown = [];
  game.effects = emptyEffects();
  game.bossCut = null;
  game.crumbling.clear();
  game.chaser = null;
  game.caught = null;
  game.blinkOn = null;
  for (const p of game.world.pickups) p.taken = false;
  for (const f of game.world.fakeGoals) {
    f.fleeing = false;
    f.offset = 0;
    f.fade = 1;
    f.gone = false;
  }
}

export function loadStage(game, index) {
  game.stageIndex = index;
  game.world = createWorld(stageTable(game)[index]);
  game.player = createPlayer(game.world.spawn);
  game.checkpoint = { ...game.world.spawn };
  game.boss = null;
  spawnEntities(game);
  game.camera = createCamera(VIEW.w, VIEW.h);
  game.camera.x = clamp(game.player.x - VIEW.w / 2, 0, Math.max(0, game.world.pixelWidth - VIEW.w));
  game.camera.y = clamp(game.player.y - VIEW.h / 2, 0, Math.max(0, game.world.pixelHeight - VIEW.h));
  game.scene = 'stageIntro';
  game.sceneTime = 0;
  game.rank = rankAt(index, 0);
  emit(game, 'stage', { index });
}

export function loadBoss(game) {
  game.world = createWorld(BOSS_STAGE);
  game.player = createPlayer(game.world.spawn);
  game.checkpoint = { ...game.world.spawn };
  spawnEntities(game);
  // 레이저가 닿을 바닥 — 아레나 맨 아래 두 줄이 땅이다
  game.boss = createBoss(game.world.pixelWidth, game.world.pixelHeight - TILE * 2, game.hard);
  game.camera = createCamera(VIEW.w, VIEW.h);
  game.scene = 'boss';
  game.sceneTime = 0;
  game.rank = 2;
  emit(game, 'boss', {});
}

/**
 * 새 판. index 를 주면 그 스테이지부터 시작한다 (개발자 모드에서만 쓴다).
 * index 가 마지막 스테이지 다음이면 보스전으로 바로 들어간다.
 */
export function startRun(game, index = 0, { hard = false } = {}) {
  game.hard = hard;
  game.chartOuts = 0;
  game.plays = 0;
  game.score = 0;
  game.defeated = 0;
  game.elapsedMs = 0;
  game.ending = null;
  game.partial = index > 0;
  // 처음부터 달리는 판이고 오프닝을 아직 안 봤으면, 스테이지보다 먼저 오프닝을 튼다
  // 오프닝은 1회차에서만. 하드모드는 이미 다 본 사람이 들어오는 곳이다.
  if (index === 0 && !hard && !game.save.seenOpening) startIntro(game);
  else if (index >= stageCount(game)) loadBoss(game);
  else loadStage(game, index);
}

/** 오프닝 컷신을 튼다. 끝나면 스테이지 1 로 이어진다. */
export function startIntro(game) {
  game.scene = 'intro';
  game.cutsceneTime = 0;
  game.sceneTime = 0;
  emit(game, 'cutscene', { id: 'intro' });
}

// ── 죽음과 부활 ──────────────────────────────────────────────
function killPlayer(game) {
  if (game.scene === 'death') return;
  game.chartOuts += 1;
  game.scene = 'death';
  game.sceneTime = 0;
  shakeCamera(game.camera, 1.2);
  addParticles(game, game.player.x + 5, game.player.y + 7, 14, ['#ff5d8f', '#ffd166', '#ffffff'], {
    speed: 110,
    life: 0.9,
  });
  emit(game, 'death', {});
}

function reviveAtCheckpoint(game) {
  game.world.restoreChanged();
  spawnEntities(game);
  respawnPlayer(game.player, game.checkpoint);
  game.scene = game.boss ? 'boss' : 'play';
  game.sceneTime = 0;
  game.caught = null;
  // 쫓아오는 것을 내 뒤로 물린다. 안 하면 눈뜨자마자 다시 잡혀서 빠져나올 수가 없다.
  if (isChase(game)) game.chaser = { x: game.player.x - CHASE_LEAD };
  if (game.boss) {
    // 보스는 체력을 유지한다 — 다시 처음부터는 너무 가혹하다
    game.boss.state = 'recover';
    game.boss.timer = 1.2;
    game.boss.quarters = [];
  }
  emit(game, 'revive', {});
}

// ── 충돌 처리 ────────────────────────────────────────────────
function isStomp(player, target) {
  return player.vy > 0 && player.y + player.h - target.y <= target.h * 0.65;
}

function handleAlbums(game, dt, held = false) {
  const { player, world } = game;
  const ctx = {
    world,
    player,
    spawnShot: (shot) => game.shots.push({ wobble: 0, ...shot }),
    addAlbum: (album) => game.albums.push(album),
  };

  for (const album of game.albums) {
    updateAlbum(album, ctx, dt);
    if (!album.alive || player.dead) continue;
    if (!overlaps(player, album)) continue;

    if (isStomp(player, album)) {
      const result = stompAlbum(album, ctx);
      if (result === 'blocked') {
        // 위에 가시가 박힌 앨범 — 밟은 쪽이 죽는다
        if (damagePlayer(player)) killPlayer(game);
        continue;
      }
      bounce(player, result === 'dead', held);
      emit(game, 'stomp', {});
      addParticles(game, album.x + album.w / 2, album.y + album.h / 2, 8, album.def.palette, {
        speed: 70,
      });
      if (result === 'dead') {
        game.defeated += 1;
        game.score += album.def.score;
        addText(game, album.x, album.y, `+${album.def.score}`, album.def.palette[2]);
      }
    } else if (damagePlayer(player)) {
      killPlayer(game);
    } else {
      emit(game, 'hurt', {});
    }
  }
  game.albums = game.albums.filter((a) => a.alive || a.squash > 0);
}

/**
 * 한 대 맞았다고 알린다. **실제로 뭔가 벌어졌을 때만** 소리를 낸다.
 *
 * damagePlayer 는 무적일 때도 false 를 돌려준다. 그걸 그냥 "안 죽었다"로 읽고
 * 소리를 내면, 계속 닿아 있는 것(레이저 기둥 같은 것) 안에서는 무적 1.2초 동안
 * 프레임마다 아픈 소리가 터진다 — 70번쯤.
 */
function hurt(game) {
  const before = game.player.power;
  if (damagePlayer(game.player)) {
    killPlayer(game);
    return true;
  }
  // 파워업을 잃었으면 뭔가 벌어진 것이고, 그대로면 무적이라 아무 일도 없었던 것이다
  if (game.player.power !== before) {
    emit(game, 'hurt', {});
    return true;
  }
  return false;
}

/**
 * 레이저에 닿았나. 예고선(aim)은 안 아프다 — beam.live 하나로 갈린다.
 * 사각형은 boss.js 의 laserBeam 이 정한다. 그림도 같은 걸 본다.
 */
function handleLaser(game) {
  if (game.player.dead) return;
  for (const beam of laserBeams(game.boss)) {
    if (!beam.live) continue;
    if (overlaps(game.player, beam)) {
      hurt(game);
      return; // 한 프레임에 두 기둥에 두 번 맞을 이유가 없다
    }
  }
}

function handleShots(game, dt) {
  const { player, world } = game;
  game.shots = game.shots.filter((shot) => {
    const alive = updateShot(shot, world, dt);
    if (!alive) return false;
    if (!player.dead && overlaps(player, shot)) {
      hurt(game);
      return false;
    }
    return true;
  });
}

function handlePickups(game) {
  const { player } = game;
  for (const pickup of game.world.pickups) {
    if (pickup.taken || !overlaps(player, pickup)) continue;
    pickup.taken = true;
    game.plays += 1;
    game.score += 50;
    addText(game, pickup.x, pickup.y, '♪', '#ffd166');
    addParticles(game, pickup.x + 4, pickup.y + 4, 5, ['#ffd166', '#fff'], { speed: 40, life: 0.4 });
    emit(game, 'coin', {});
  }
}

function handleBlocks(game, events) {
  if (!events.bonked) return;
  const { tx, ty, ch } = events.bonked;
  const world = game.world;
  const key = trapKey(tx, ty);
  addParticles(game, tx * TILE + 8, ty * TILE + 12, 6, ['#ffd166', '#fff'], { speed: 50, life: 0.4 });

  if (ch === T.ITEM) {
    world.setChar(tx, ty, T.USED);
    if (game.player.power === 'none') {
      game.player.power = 'mic';
      emit(game, 'power', {});
    } else {
      game.plays += 3;
      game.score += 150;
      addText(game, tx * TILE, ty * TILE, '♪♪♪', '#ffd166');
      emit(game, 'coin', {});
    }
  } else if (ch === T.BAIT) {
    world.setChar(tx, ty, T.USED);
    game.trapMemory.reveal(key);
    const album = spawnAlbum('a06', tx * TILE, ty * TILE - TILE);
    album.vy = -120;
    game.albums.push(album);
    shakeCamera(game.camera, 0.6);
    emit(game, 'trap', { kind: 'baitBlock' });
  } else if (ch === T.INVISIBLE) {
    world.setChar(tx, ty, T.GROUND);
    game.trapMemory.reveal(key);
    emit(game, 'trap', { kind: 'invisibleBlock' });
  }
}

/** 밟으면 사라지는 칸들 — 가짜 발판(즉시)과 무너지는 바닥(잠깐 떨다가) */
const CRUMBLING = {
  [T.FAKE]: { time: CRUMBLE_TIME, kind: 'fakePlatform' },
  [T.CRUMBLE]: { time: FLOOR_CRUMBLE_TIME, kind: 'crumbleFloor' },
};

function handleCrumbling(game, dt) {
  const { player, world } = game;
  // 밟고 있는 칸이 무너질 것인지 본다
  if (player.onGround && !player.dead) {
    const ty = Math.floor((player.y + player.h + 1) / TILE);
    const tx0 = Math.floor(player.x / TILE);
    const tx1 = Math.floor((player.x + player.w - 0.001) / TILE);
    for (let tx = tx0; tx <= tx1; tx++) {
      const spec = CRUMBLING[world.charAt(tx, ty)];
      if (!spec) continue;
      const key = trapKey(tx, ty);
      if (!game.crumbling.has(key)) {
        game.crumbling.set(key, spec.time);
        emit(game, 'crumble', {});
      }
    }
  }
  for (const [key, time] of [...game.crumbling]) {
    const left = time - dt;
    if (left > 0) {
      game.crumbling.set(key, left);
      continue;
    }
    game.crumbling.delete(key);
    const [tx, ty] = key.split(',').map(Number);
    const spec = CRUMBLING[world.charAt(tx, ty)];
    if (!spec) continue;
    world.setChar(tx, ty, T.EMPTY);
    game.trapMemory.reveal(key);
    addParticles(game, tx * TILE + 8, ty * TILE + 8, 6, ['#c9c9c9', '#8a8a8a'], { speed: 40, life: 0.5 });
    emit(game, 'trap', { kind: spec.kind });
  }
}

/** 지나가면 바닥에서 벽이 솟는다. 넘을 수 있는 두 칸 높이. */
export const WALL_HEIGHT = 2;

function handleRisingWalls(game, dt) {
  const { player, world } = game;
  for (const wall of world.risingWalls) {
    if (!wall.risen) {
      const cx = wall.tx * TILE + TILE / 2;
      const near = Math.abs(player.x + player.w / 2 - cx) < 46;
      if (!near || player.dead) continue;
      wall.risen = true;
      wall.t = 0;
      for (let i = 0; i < WALL_HEIGHT; i++) world.setChar(wall.tx, wall.ty - i, T.RISEN);
      game.trapMemory.reveal(trapKey(wall.tx, wall.ty));
      shakeCamera(game.camera, 0.8);
      addParticles(game, cx, wall.ty * TILE, 8, ['#e8ecf7', '#8b93a8'], { speed: 60, life: 0.5 });
      emit(game, 'trap', { kind: 'risingWall' });
    } else {
      wall.t = Math.min(1, wall.t + dt * 5);
    }
  }
}

/** 밟으면 잠깐 걸리는 구간 효과 (역재생 · 정전) */
function handleZones(game, dt) {
  const { player, world } = game;
  for (const zone of world.zones) {
    if (zone.fired || player.dead) continue;
    const box = { x: zone.x, y: zone.y - TILE, w: TILE, h: TILE * 2 };
    if (!overlaps(player, box)) continue;
    zone.fired = true;
    const spec = ZONE_EFFECTS[zone.kind];
    game.effects[zone.kind] = spec.seconds;
    game.trapMemory.reveal(trapKey(zone.tx, zone.ty));
    shakeCamera(game.camera, 0.6);
    emit(game, 'trap', { kind: zone.kind });
  }
  // 반드시 저절로 풀린다 — 영구히 걸리면 게임이 끝난다
  for (const key of Object.keys(game.effects)) {
    game.effects[key] = Math.max(0, game.effects[key] - dt);
  }
}

function handlePopSpikes(game, dt) {
  const { player, world } = game;
  for (const spike of world.popSpikes) {
    const cx = spike.tx * TILE + TILE / 2;
    // 발밑에서 솟아야 웃기고, 또 알고 나면 뛰어넘을 수 있다.
    // 멀리서 미리 솟으면 제자리 점프로 넘어야 해서 불합리해진다.
    const near = Math.abs(player.x + player.w / 2 - cx) < 18;
    const sameFloor = Math.abs(player.y + player.h - spike.ty * TILE) < TILE * 2;
    if (!spike.popped && near && sameFloor && !player.dead) {
      spike.popped = true;
      spike.t = 0;
      game.trapMemory.reveal(trapKey(spike.tx, spike.ty));
      shakeCamera(game.camera, 0.4);
      emit(game, 'trap', { kind: 'popSpike' });
    }
    if (!spike.popped) continue;
    spike.t = Math.min(1, spike.t + dt * 6);
    const blade = {
      x: spike.tx * TILE + 2,
      y: spike.ty * TILE - TILE * spike.t + 2,
      w: TILE - 4,
      h: TILE * spike.t,
    };
    if (!player.dead && spike.t > 0.35 && overlaps(player, blade)) {
      if (damagePlayer(player)) killPlayer(game);
    }
  }
}

/**
 * 깜빡이는 발판. 다 같은 박자로 껐다 켠다 — 제각각이면 언제 건널지 못 잰다.
 * 격자를 직접 갈아끼우므로 물리(tileAt)가 그대로 이걸 본다.
 */
const BLINK_PERIOD = 2.0;
/** 켜져 있는 시간. 꺼진 0.7초보다 훨씬 길어야 건널 틈이 난다 */
const BLINK_ON = 1.3;

function handleBlinkers(game) {
  const { world } = game;
  if (!world.blinkers.length) return;
  const on = game.sceneTime % BLINK_PERIOD < BLINK_ON;
  if (game.blinkOn === on) return; // 바뀔 때만 손댄다
  game.blinkOn = on;
  for (const b of world.blinkers) world.setLive(b.tx, b.ty, on ? T.BLINK : T.EMPTY);
}

/** 체크포인트인 척하는 것. 먹으면 **저장이 안 되고** 사라진다 */
function handleFakeChecks(game) {
  for (const fc of game.world.fakeChecks) {
    if (fc.taken || game.player.dead) continue;
    const box = { x: fc.x - 6, y: fc.y - TILE, w: TILE + 12, h: TILE * 2 };
    if (!overlaps(game.player, box)) continue;
    fc.taken = true;
    game.trapMemory.reveal(markKey(game, fc.tx, fc.ty));
    shakeCamera(game.camera, 0.5);
    emit(game, 'trap', { kind: 'fakeCheck' });
  }
}

/** 천장 가시 — 아래를 지나가면 내려온다. 솟는 가시를 위아래만 뒤집은 것이다 */
function handleCeilSpikes(game, dt) {
  const { player, world } = game;
  for (const spike of world.ceilSpikes) {
    const cx = spike.tx * TILE + TILE / 2;
    const near = Math.abs(player.x + player.w / 2 - cx) < 20;
    const below = player.y > spike.ty * TILE && player.y - spike.ty * TILE < TILE * 4;
    if (!spike.popped && near && below && !player.dead) {
      spike.popped = true;
      spike.t = 0;
      game.trapMemory.reveal(markKey(game, spike.tx, spike.ty));
      shakeCamera(game.camera, 0.4);
      emit(game, 'trap', { kind: 'ceilingSpike' });
    }
    if (!spike.popped) continue;
    spike.t = Math.min(1, spike.t + dt * 5);
    const blade = {
      x: spike.tx * TILE + 2,
      y: (spike.ty + 1) * TILE - 2,
      w: TILE - 4,
      h: TILE * spike.t,
    };
    if (!player.dead && spike.t > 0.35 && overlaps(player, blade)) {
      if (damagePlayer(player)) killPlayer(game);
    }
  }
}

/**
 * 쫓아오는 속도. **달리기(PLAYER.maxSpeed = 124)보다 반드시 느려야 한다.**
 *
 * 여기를 넘기는 순간 "어려운 판"이 아니라 "달리기 속도를 시험하는 판"이 되고,
 * 그건 실력이 아니라 그냥 못 깨는 판이다. 잡히는 건 벽에 막혀 멈췄을 때,
 * 함정에 걸려 멈췄을 때, 길을 잘못 골랐을 때여야 한다.
 */
export const CHASE_SPEED = 82;
/** `>` 구간을 밟으면 잠깐 이만큼 빨라진다. 그래도 달리기보다는 느리다 */
export const SURGE_SPEED = 108;
/**
 * 되살아날 때 쫓아오는 것을 이만큼 뒤로 물린다.
 * 82px/s 로 오므로 약 4초 — 눈뜨고 상황을 보고 달리기 시작할 틈이다.
 * 200 이었을 때는 2.4초라 죽고 살아나면 곧바로 또 잡혔다.
 */
export const CHASE_LEAD = 330;
/** 추격 판에서 카메라를 이만큼 뒤로 물린다 — 뒤가 보여야 도망칠 마음이 든다 */
export const CHASE_BACK = 70;

/** 이 판이 추격 판인가 */
export const isChase = (game) => !!game.world?.stage?.chase;

/** 지금 쫓아오는 속도 */
const chaseSpeed = (game) => (game.effects.surge > 0 ? SURGE_SPEED : CHASE_SPEED);

/**
 * 뒤에서 밀고 오는 거대 로봇.
 *
 * 추격 판은 시작하자마자 붙는다 — 구간을 밟아야 시작하면 "올 것이 온다"는
 * 긴장이 아니라 그냥 갑자기 죽는 것이 된다.
 * 판정은 **세로 띠 하나**다. 그림이 아무리 커도 죽는 자리가 하나여야 헷갈리지 않는다.
 */
function handleChaser(game, dt) {
  if (!isChase(game)) {
    game.chaser = null;
    return;
  }
  if (!game.chaser) game.chaser = { x: game.player.x - CHASE_LEAD };
  game.chaser.x += chaseSpeed(game) * dt;
  if (game.player.dead || game.caught) return;
  const front = { x: game.chaser.x - 10, y: 0, w: 14, h: game.world.pixelHeight };
  if (!overlaps(game.player, front)) return;
  // 잡혔다 — 컷신이 돌고, 끝나면 **평소 죽음과 같은 길**로 체크포인트에 간다
  game.caught = { t: 0, length: caughtLength() };
  game.player.vx = 0;
  shakeCamera(game.camera, 1.4);
  emit(game, 'caught', {});
}

function handleFakeGoal(game, dt) {
  const { player, world } = game;
  for (const fake of world.fakeGoals) {
    if (fake.gone) continue;
    const box = { x: fake.x + fake.offset, y: fake.y, w: fake.w, h: fake.h };
    const dx = player.x - box.x;
    if (!fake.fleeing && Math.abs(dx) < 52) {
      fake.fleeing = true;
      game.trapMemory.reveal(trapKey(fake.tx, fake.ty));
      emit(game, 'trap', { kind: 'fakeGoal' });
    }
    if (fake.fleeing) {
      fake.offset += 150 * dt;
      fake.fade = (fake.fade ?? 1) - dt * 0.55;
      if (fake.fade <= 0) fake.gone = true;
    }
  }
}

function handleGoal(game) {
  const goal = game.world.goal;
  if (!goal || game.player.dead) return;
  const box = { x: goal.x, y: goal.y - TILE * 2, w: goal.w, h: TILE * 3 };
  if (!overlaps(game.player, box)) return;
  game.scene = 'stageClear';
  game.sceneTime = 0;
  game.player.cleared = true;
  game.player.vx = 0;
  game.score += 500;
  emit(game, 'clear', { stage: game.stageIndex });
}

function handleCheckpoints(game) {
  for (const cp of game.world.checkpoints) {
    if (cp.taken) continue;
    const box = { x: cp.x - 6, y: cp.y - TILE, w: TILE + 12, h: TILE * 2 };
    if (!overlaps(game.player, box)) continue;
    cp.taken = true;
    game.checkpoint = { x: cp.x, y: cp.y };
    emit(game, 'checkpoint', {});
  }
}

/**
 * 한 바퀴를 돌기 전에는 NPC 도 포탈도 **없는 셈** 친다.
 * 처음 하는 사람의 튜토리얼 판에 낯선 사람이 서 있으면 그냥 헷갈리기만 한다.
 * 스테이지 1 사본을 따로 두지 않는 이유이기도 하다 — 두 벌이 되면 한쪽만 고치는 날이 온다.
 */
const hubOpen = (game) => !!game.save?.clearedOnce && !game.hard;

/** 지금 말을 걸 수 있는 NPC (가까이 서 있고, 아직 안 걸었다). 없으면 null */
export function npcInReach(game) {
  if (!hubOpen(game) || game.player.dead || game.npcTalk) return null;
  for (const npc of game.world.npcs) {
    if (npc.talked) continue;
    const box = { x: npc.x - 14, y: npc.y - TILE, w: TILE + 28, h: TILE * 2 };
    if (overlaps(game.player, box)) return npc;
  }
  return null;
}

/**
 * NPC 에게 말 걸기와 포탈.
 *
 * 말 걸기는 **점프 키 그대로**다 (input.confirmPressed 가 confirm || jump).
 * 새 키를 만들면 폰에 버튼이 하나 더 붙어야 하는데, 딱 한 번 쓰는 것 때문에
 * 조작 화면을 더 복잡하게 만들 이유가 없다.
 */
function handleNpc(game, input) {
  if (!hubOpen(game)) return;
  const npc = npcInReach(game);
  if (npc && input.confirmPressed) {
    npc.talked = true;
    game.npcTalk = { t: 0, length: npcTalkLength() };
    game.player.vx = 0;
    emit(game, 'talk', {});
  }
  // 말을 걸어야 문이 열린다
  const talked = game.world.npcs.some((n) => n.talked);
  for (const portal of game.world.portals) portal.open = talked && !game.npcTalk;
}

/** 열린 포탈에 들어가면 2회차가 시작된다 */
function handlePortal(game) {
  if (!hubOpen(game) || game.player.dead) return;
  for (const portal of game.world.portals) {
    if (!portal.open) continue;
    if (!overlaps(game.player, portal)) continue;
    emit(game, 'portal', {});
    startRun(game, 0, { hard: true });
    return;
  }
}

// ── 잡동사니 갱신 ────────────────────────────────────────────
function updateParticles(game, dt) {
  for (const p of game.particles) {
    p.life -= dt;
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  game.particles = game.particles.filter((p) => p.life > 0);
  for (const t of game.texts) {
    t.life -= dt;
    t.y -= 24 * dt;
  }
  game.texts = game.texts.filter((t) => t.life > 0);
  game.flash = Math.max(0, game.flash - dt * 2);
}

function updateRank(game) {
  const goalX = game.world.goal?.x ?? game.world.pixelWidth;
  const progress = clamp(game.player.x / Math.max(1, goalX - TILE * 2), 0, 1);
  game.rank = rankAt(game.stageIndex, progress);
}

// ── 장면별 갱신 ──────────────────────────────────────────────
/** 역재생 구간에서는 좌우가 뒤바뀐다. 원본 input 은 건드리지 않는다. */
const applyEffects = (game, input) =>
  game.effects.reversed > 0 ? { ...input, left: input.right, right: input.left } : input;

/**
 * 대시는 **보스전에서만** 쓴다.
 *
 * 스테이지 1~4 는 걷기와 점프만으로 넘도록 짜여 있다. 판에서도 대시가 나가면
 * 구멍이 구멍이 아니게 되고, 넘으라고 만든 자리를 그냥 지나쳐 버린다.
 * 대시가 있어야 하는 건 아레나 하나뿐이다 — 3페이즈 레이저를 비켜서는 자리.
 */
const noDash = (input) => (input.dashPressed ? { ...input, dashPressed: false } : input);

/** 세게 떨어졌을 때만 발밑에 먼지. 걸음마다 피우면 화면이 지저분해진다. */
function landingDust(game, landed) {
  if (!landed || landed.impact < 0.45) return;
  const p = game.player;
  addParticles(game, p.x + p.w / 2, p.y + p.h, 4 + Math.round(landed.impact * 4), ['#e8ecf7', '#b3aecd'], {
    speed: 40 * landed.impact,
    life: 0.32,
    lift: -6,
    gravity: 120,
    size: 1,
  });
}

function updatePlay(game, input, dt) {
  // 잡힌 동안에도 아무것도 안 움직인다. 끝나면 평소 죽음과 같은 길로 간다 —
  // 새 길을 만들면 "죽으면 체크포인트" 라는 이미 배운 규칙이 안 통하게 된다.
  if (game.caught) {
    const was = game.caught.t;
    game.caught.t += dt;
    beat(game, 'caught', CAUGHT_CUT, was, game.caught.t);
    if (game.caught.t >= game.caught.length) {
      game.caught = null;
      killPlayer(game);
    }
    return;
  }

  // NPC 와 이야기하는 동안에는 아무것도 안 움직인다 — 보스 컷신과 같은 규칙이다
  if (game.npcTalk) {
    const was = game.npcTalk.t;
    game.npcTalk.t += dt;
    beat(game, 'talk', NPC_TALK, was, game.npcTalk.t);
    if (input.confirmPressed && game.npcTalk.t > 0.4) game.npcTalk.t = game.npcTalk.length;
    if (game.npcTalk.t >= game.npcTalk.length) game.npcTalk = null;
    return;
  }

  const events = updatePlayer(game.player, noDash(applyEffects(game, input)), game.world, dt);
  if (events.jumped) emit(game, 'jump', {});
  if (events.sprung) emit(game, 'spring', {});
  landingDust(game, events.landed);
  handleBlocks(game, events);
  handleCrumbling(game, dt);
  handleRisingWalls(game, dt);
  handleZones(game, dt);
  handlePopSpikes(game, dt);
  handleBlinkers(game);
  handleFakeChecks(game);
  handleCeilSpikes(game, dt);
  handleChaser(game, dt);
  handleAlbums(game, dt, input.jump);
  handleShots(game, dt);
  handlePickups(game);
  handleCheckpoints(game);
  handleNpc(game, input);
  handlePortal(game);
  handleFakeGoal(game, dt);
  handleGoal(game);
  updateRank(game);

  if (events.fell) {
    game.player.dead = true;
    killPlayer(game);
  } else if (events.hazard && damagePlayer(game.player)) {
    killPlayer(game);
  }
  updateCamera(game.camera, game.player, game.world, dt, isChase(game) ? CHASE_BACK : 0);
}

/** 엔딩 컷신이 끝나면 통계 화면으로 */
function finishRun(game) {
  game.rank = TOP_RANK;
  game.ending = {
    rank: TOP_RANK,
    chartOuts: game.chartOuts,
    plays: game.plays,
    score: game.score + 2000,
    defeated: game.defeated,
    timeMs: game.elapsedMs,
    hard: game.hard,
  };
  game.scene = 'ending';
  game.sceneTime = 0;
  emit(game, 'ending', game.ending);
}

/**
 * 엔딩을 본 뒤 스테이지 1 로 돌아온다. 거기 NPC 가 서 있고, 말을 걸면 하드모드로 가는
 * 포탈이 열린다.
 *
 * **반드시 partial 로 둔다.** startRun 만 elapsedMs·chartOuts 를 지우는데(startRun),
 * 여기는 그걸 안 거치므로 1회차의 시간을 그대로 안고 판을 돈다 — 그 시간이 기록으로
 * 올라가면 최고 기록이 거짓말이 된다.
 */
function returnToHub(game) {
  game.hard = false;
  game.partial = true;
  game.ending = null;
  loadStage(game, 0);
}

/** 타이틀에서 고를 수 있는 줄 수 (개발자 모드일 때: 처음부터 / 스테이지 선택) */
const TITLE_ROWS = 2;

// 스테이지 선택 화면의 칸. 0..STAGES.length 는 스테이지와 보스라 startRun 에 그대로 넘긴다.
/** 하드모드 1판부터 (NPC 를 안 거치고 바로 — 개발자 모드에서만) */
export const SELECT_HARD = STAGES.length + 1;
/** 오프닝 다시 보기 (한 번 보면 저절로는 안 뜨므로 여기서만 다시 볼 수 있다) */
export const SELECT_OPENING = STAGES.length + 2;
/** 개발자 모드 끄기 */
export const SELECT_DEV_OFF = STAGES.length + 3;
export const SELECT_SLOTS = STAGES.length + 4;

/** 개발자 모드를 켜고 끈다. 비번 판정은 ui 가 하고 결과만 여기로 온다. */
export function setDevMode(game, on) {
  game.dev = on;
  game.titleIndex = 0;
  emit(game, 'dev', { on });
}

/**
 * 컷신이 새 단계로 넘어가는 순간마다 알린다. 소리는 ui/ 가 낸다 — 여기는 시각만 판정한다.
 *
 * 첫 프레임(from 이 0)에는 0.0 초에 있는 단계도 넘긴 것으로 친다.
 * 안 그러면 컷신 맨 앞 단계만 소리가 안 난다.
 */
function beat(game, cut, timeline, from, to) {
  for (const step of beatsCrossed(timeline, from > 0 ? from : -1, to)) {
    emit(game, 'cutbeat', { cut, kind: step.kind });
  }
}

/** 보스전 컷신을 튼다. 도는 동안 보스도 플레이어도 멈춘다. */
function startBossCut(game, id) {
  if (!id) return;
  game.bossCut = { id, t: 0, length: bossCutLength(id) };
  emit(game, 'cutscene', { id });
}

/**
 * 보스에게 한 대 먹인다. 밟기와 던지기가 같은 길을 쓴다.
 * 실제로 들어갔으면 true.
 */
function damageBoss(game, opts = {}) {
  const boss = game.boss;
  if (!hitBoss(boss, opts)) return false;
  game.score += 400;
  game.defeated += 1;
  shakeCamera(game.camera, 1);
  addParticles(game, boss.x + boss.w / 2, boss.y + boss.h / 2, 16, ['#fff', '#ffd166', '#ff5d8f'], {
    speed: 120,
    life: 0.8,
  });
  emit(game, 'bosshit', {});

  const changed = syncPhase(boss);
  if (changed) {
    // 페이즈가 바뀌면 싸움을 멈추고 전환 컷신을 튼다
    startBossCut(game, cutForPhase(changed));
    game.flash = 1;
    shakeCamera(game.camera, 1.6);
    emit(game, 'phase', { phase: changed });
  } else if (boss.hp > 0) {
    game.flash = 1;
    emit(game, 'bossdown', {});
  }
  return true;
}

/** 보스가 흘린 마이크: 바닥에 떨어지고, 주우면 한 발 생긴다 */
function handleMics(game, dt) {
  const { player, world } = game;
  game.mics = game.mics.filter((mic) => {
    mic.life -= dt;
    if (mic.life <= 0) return false;
    if (!mic.landed) {
      mic.vy = Math.min(mic.vy + 620 * dt, 300);
      mic.y += mic.vy * dt;
      const ty = Math.floor((mic.y + mic.h) / TILE);
      const tx = Math.floor((mic.x + mic.w / 2) / TILE);
      if (world.tileAt(tx, ty) === 'solid') {
        mic.y = ty * TILE - mic.h;
        mic.landed = true;
      }
    } else {
      mic.bob += dt * 5;
    }
    if (!player.dead && player.ammo < 1 && overlaps(player, mic)) {
      player.ammo = 1;
      addParticles(game, mic.x + 5, mic.y + 5, 6, ['#ffd166', '#fff'], { speed: 50, life: 0.4 });
      emit(game, 'power', {});
      return false;
    }
    return true;
  });
}

/** 던진 마이크가 보스에 맞으면 한 대. 맞으면 사라진다(1회용) */
function handleThrown(game, dt, onHit) {
  const boss = game.boss;
  game.thrown = game.thrown.filter((mic) => {
    if (!updateThrown(mic, game.world, dt)) return false;
    if (boss && boss.state !== 'defeated' && overlaps(mic, boss)) {
      onHit();
      return false;
    }
    return true;
  });
}

function updateBossScene(game, input, dt) {
  const boss = game.boss;

  // 컷신이 도는 동안에는 아무것도 움직이지 않는다 — 연출 보다가 죽으면 안 된다
  if (game.bossCut) {
    const was = game.bossCut.t;
    game.bossCut.t += dt;
    // 실제로 흐른 만큼만 소리를 낸다. 건너뛰기로 시각을 끝까지 밀기 **전에** 판정해야
    // 남은 단계 열 개가 한 프레임에 쏟아지지 않는다.
    beat(game, game.bossCut.id, BOSS_CUTS[game.bossCut.id].timeline, was, game.bossCut.t);
    if (input.confirmPressed && game.bossCut.t > 0.5) game.bossCut.t = game.bossCut.length;
    if (game.bossCut.t >= game.bossCut.length) {
      const finished = game.bossCut.id;
      game.bossCut = null;
      // 컷신이 끝났다고 알린다. 건너뛰었을 때도 반드시 나오므로,
      // 컷신 때문에 꺼둔 것(브금 같은 것)을 여기서 되돌리면 안전하다.
      emit(game, 'cutdone', { cut: finished });
      if (finished === 'ending') finishRun(game);
    }
    return;
  }

  const events = updatePlayer(game.player, applyEffects(game, input), game.world, dt);
  if (events.jumped) emit(game, 'jump', {});
  if (events.dashed) emit(game, 'dash', {});
  landingDust(game, events.landed);

  const ctx = {
    player: game.player,
    arenaWidth: game.world.pixelWidth,
    spawnShot: (shot) => game.shots.push({ wobble: 0, ...shot }),
    addAlbum: (album) => game.albums.push(album),
    dropMic: (mic) => game.mics.push(mic),
    onAim: () => emit(game, 'laseraim', {}),
    onLaser: () => emit(game, 'laser', {}),
  };
  updateBoss(boss, ctx, dt);

  // 들고 있으면 던진다 — 한 발뿐이다
  if (input.throwPressed && game.player.ammo > 0 && !game.player.dead) {
    game.player.ammo = 0;
    game.thrown.push(throwMic(game.player));
    emit(game, 'throw', {});
  }

  handleMics(game, dt);
  handleThrown(game, dt, () => damageBoss(game, { ranged: true }));
  handleAlbums(game, dt, input.jump);
  handleShots(game, dt);
  handleLaser(game);

  if (boss.state !== 'defeated' && !game.player.dead) {
    // 약점 밟기 — 붙어야 해서 위험하지만 마이크를 기다릴 필요가 없다
    if (overlaps(game.player, boss)) {
      if (boss.vulnerable && isStomp(game.player, boss)) {
        if (damageBoss(game)) bounce(game.player, true, input.jump);
      } else if (damagePlayer(game.player)) {
        killPlayer(game);
      }
    }
    // 분열된 조각에 맞기
    for (const q of boss.quarters) {
      if (q.delay > 0) continue;
      if (!game.player.dead && overlaps(game.player, q) && damagePlayer(game.player)) killPlayer(game);
    }
  }

  if (events.fell) {
    game.player.dead = true;
    killPlayer(game);
  } else if (events.hazard && damagePlayer(game.player)) {
    killPlayer(game);
  }

  // 쓰러지고 잠깐 뒤 엔딩 컷신으로 넘어간다
  if (boss.state === 'defeated' && boss.defeatedAt > 1.6) startBossCut(game, 'ending');

  updateCamera(game.camera, game.player, game.world, dt);
}

/**
 * 멈췄을 때 고를 수 있는 줄. 순서가 곧 화면 순서다.
 *
 * volume 은 여기서 아무것도 안 한다 — core 는 소리를 모른다. 'volume' 이벤트만 내고
 * 실제로 크기를 바꾸는 건 ui/app.js 다 (오디오는 브라우저 것이라 여기 들어오면 테스트가 죽는다).
 */
export const PAUSE_ROWS = ['resume', 'retry', 'volume', 'title'];

/** 멈춤을 풀 수 있는 장면. 여기 아니면 Esc 를 눌러도 안 멈춘다. */
const pausable = (game) => game.scene === 'play' || game.scene === 'boss';

function choosePause(game) {
  const row = PAUSE_ROWS[game.pauseIndex] ?? 'resume';
  if (row === 'volume') {
    emit(game, 'volume', {});
    return;
  }
  // 나머지는 전부 멈춤을 푼다. 멈춘 채로 장면을 옮기면 아무 키도 안 먹어서 게임이 잠긴다.
  game.paused = false;
  emit(game, 'pause', { paused: false });
  if (row === 'retry') killPlayer(game);
  else if (row === 'title') {
    game.scene = 'title';
    game.sceneTime = 0;
    game.titleIndex = 0;
  }
}

function updatePauseMenu(game, input) {
  const moved = (input.rightPressed ? 1 : 0) - (input.leftPressed ? 1 : 0);
  if (moved) game.pauseIndex = (game.pauseIndex + moved + PAUSE_ROWS.length) % PAUSE_ROWS.length;
  if (input.confirmPressed) choosePause(game);
}

/** 게임 한 프레임. input 은 이미 sample() 된 상태여야 한다. */
export function updateGame(game, input, dt) {
  game.sceneTime += dt;

  if (input.pausePressed && pausable(game)) {
    game.paused = !game.paused;
    if (game.paused) game.pauseIndex = 0;
    emit(game, 'pause', { paused: game.paused });
  }
  if (game.paused) {
    // 멈춘 동안은 메뉴만 움직인다 — 시간도 안 흐르고 아무것도 갱신되지 않는다
    updatePauseMenu(game, input);
    return;
  }

  const playing = game.scene === 'play' || game.scene === 'boss';
  if (playing) game.elapsedMs += dt * 1000;

  updateParticles(game, dt);

  switch (game.scene) {
    case 'title': {
      // 개발자 모드가 꺼져 있으면 고를 것도 없다 — 예전과 똑같이 바로 시작한다
      if (!game.dev) {
        game.titleIndex = 0;
        if (input.confirmPressed) startRun(game);
        break;
      }
      const moved = (input.rightPressed ? 1 : 0) - (input.leftPressed ? 1 : 0);
      if (moved) game.titleIndex = (game.titleIndex + moved + TITLE_ROWS) % TITLE_ROWS;
      if (input.confirmPressed) {
        if (game.titleIndex === 0) startRun(game);
        else {
          game.scene = 'select';
          game.sceneTime = 0;
          game.selectIndex = 0;
        }
      }
      break;
    }

    case 'select': {
      const moved = (input.rightPressed ? 1 : 0) - (input.leftPressed ? 1 : 0);
      if (moved) game.selectIndex = (game.selectIndex + moved + SELECT_SLOTS) % SELECT_SLOTS;
      if (input.restartPressed) {
        game.scene = 'title';
        game.sceneTime = 0;
      } else if (input.confirmPressed) {
        if (game.selectIndex === SELECT_HARD) startRun(game, 0, { hard: true });
        else if (game.selectIndex === SELECT_OPENING) startIntro(game);
        else if (game.selectIndex === SELECT_DEV_OFF) {
          setDevMode(game, false);
          game.scene = 'title';
          game.sceneTime = 0;
        } else {
          startRun(game, game.selectIndex);
        }
      }
      break;
    }

    case 'intro': {
      const wasIntro = game.cutsceneTime;
      game.cutsceneTime += dt;
      beat(game, 'intro', INTRO_CUT, wasIntro, game.cutsceneTime);
      if (input.confirmPressed && game.cutsceneTime > 0.6) game.cutsceneTime = introLength();
      if (game.cutsceneTime >= introLength()) {
        // 건너뛰어도 여기를 지나므로 반드시 한 번 나온다 — 저장이 여기 달려 있다
        emit(game, 'introdone', {});
        loadStage(game, 0);
      }
      break;
    }

    case 'stageIntro':
      if (game.sceneTime >= INTRO_HOLD || input.confirmPressed) {
        game.scene = 'play';
        game.sceneTime = 0;
      }
      break;

    case 'play':
      if (input.restartPressed) killPlayer(game);
      else updatePlay(game, input, dt);
      break;

    case 'death':
      // 죽는 연출: 잠깐 튀어올랐다 떨어진다
      game.player.vy += 900 * dt;
      game.player.y += game.player.vy * dt;
      if (game.sceneTime >= DEATH_HOLD) reviveAtCheckpoint(game);
      break;

    case 'stageClear':
      if (game.sceneTime >= CLEAR_HOLD) {
        const next = game.stageIndex + 1;
        if (next < stageCount(game)) loadStage(game, next);
        else {
          game.scene = 'cutscene';
          game.cutsceneTime = 0;
          game.sceneTime = 0;
          emit(game, 'cutscene', { id: 'merge' });
        }
      }
      break;

    case 'cutscene': {
      const wasCut = game.cutsceneTime;
      game.cutsceneTime += dt;
      beat(game, 'merge', CUTSCENE, wasCut, game.cutsceneTime);
      if (input.confirmPressed && game.cutsceneTime > 0.6) game.cutsceneTime = CUTSCENE_LENGTH;
      if (game.cutsceneTime >= CUTSCENE_LENGTH) loadBoss(game);
      break;
    }

    case 'boss':
      // 컷신 중에는 R 도 안 먹는다 — 연출 도중에 죽는 건 사고다
      if (input.restartPressed && !game.bossCut) killPlayer(game);
      else updateBossScene(game, input, dt);
      break;

    case 'ending':
      if (game.sceneTime > 1.5 && input.confirmPressed) {
        // 한 바퀴를 돈 사람은 타이틀이 아니라 **판으로 돌아온다** — 거기 NPC 가 서 있다
        if (game.save.clearedOnce) returnToHub(game);
        else {
          game.scene = 'title';
          game.sceneTime = 0;
        }
      }
      break;

    default:
      break;
  }
}

/** 저장에 넣을 이번 판 요약 */
export const runSummary = (game) => ({
  rank: game.rank,
  chartOuts: game.chartOuts,
  clearedStage: game.scene === 'stageClear' ? game.stageIndex : null,
  revealedTraps: game.trapMemory.toJSON(),
  timeMs: game.ending ? game.ending.timeMs : null,
  // 골라 들어간 판인지. 저장 쪽(mergeRun)이 이걸 보고 기록 갱신을 건너뛴다.
  partial: game.partial,
  /** 하드모드 판인지. 기록이 어느 칸으로 갈지 이걸로 갈린다 */
  hard: game.hard,
});
