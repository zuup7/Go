// 게임 전체의 상태 기계. 그리기는 하지 않는다 — render/ 가 이 상태를 보고 그린다.
import { createWorld, T } from './world.js';
import { STAGES, BOSS_STAGE } from '../data/stages.js';
import { createPlayer, respawnPlayer, updatePlayer, bounce, damagePlayer } from './player.js';
import { spawnAlbum, updateAlbum, stompAlbum, updateShot } from './enemy.js';
import { createCamera, updateCamera, shakeCamera } from './camera.js';
import { rankAt, TOP_RANK } from './chart.js';
import { createBoss, updateBoss, hitBoss, syncPhase, bossPhase } from './boss.js';
import { PHASE_LINES, BOSS_HURT_LINES, BOSS_DEFEAT_LINES } from '../data/bossData.js';
import { DEATH_MESSAGES, PIT_MESSAGES, createTrapMemory, trapKey } from '../data/traps.js';
import { CUTSCENE_LENGTH } from '../data/cutscene.js';
import { emptySave } from './save.js';
import { createRng } from './rng.js';
import { clamp, overlaps } from './util.js';
import { TILE } from './physics.js';

export const VIEW = { w: 384, h: 224 };

/** 가짜 발판이 무너지기까지 (짧아야 웃기다) */
const CRUMBLE_TIME = 0.14;
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
    deathMessage: '',
    banner: null,
    boss: null,
    bossLine: null,
    paused: false,
    muted: save.muted,
    flash: 0,
    cutsceneTime: 0,
    ending: null,
  };
  return game;
}

const emit = (game, name, data) => game.onEvent(name, data ?? {});

export function say(game, text, kind = 'info', life = 2.2) {
  game.banner = { text, kind, life, max: life };
}

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
  game.crumbling.clear();
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
  game.world = createWorld(STAGES[index]);
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
  game.boss = createBoss(game.world.pixelWidth);
  game.camera = createCamera(VIEW.w, VIEW.h);
  game.scene = 'boss';
  game.sceneTime = 0;
  game.rank = 2;
  game.bossLine = { text: bossPhase(game.boss).line, life: 3 };
  emit(game, 'boss', {});
}

export function startRun(game) {
  game.chartOuts = 0;
  game.plays = 0;
  game.score = 0;
  game.defeated = 0;
  game.elapsedMs = 0;
  game.ending = null;
  loadStage(game, 0);
}

// ── 죽음과 부활 ──────────────────────────────────────────────
function killPlayer(game, messages = DEATH_MESSAGES) {
  if (game.scene === 'death') return;
  game.chartOuts += 1;
  game.deathMessage = game.rng.pick(messages);
  game.scene = 'death';
  game.sceneTime = 0;
  shakeCamera(game.camera, 1.2);
  addParticles(game, game.player.x + 5, game.player.y + 7, 14, ['#ff5d8f', '#ffd166', '#ffffff'], {
    speed: 110,
    life: 0.9,
  });
  emit(game, 'death', { message: game.deathMessage });
}

function reviveAtCheckpoint(game) {
  game.world.restoreChanged();
  spawnEntities(game);
  respawnPlayer(game.player, game.checkpoint);
  game.scene = game.boss ? 'boss' : 'play';
  game.sceneTime = 0;
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

function handleAlbums(game, dt) {
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
        say(game, `${album.def.name}: ${album.def.taunt}`, 'bad');
        if (damagePlayer(player)) killPlayer(game);
        continue;
      }
      bounce(player, result === 'dead');
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
      say(game, `${album.def.name} ${album.def.title}: ${album.def.taunt}`, 'bad');
      killPlayer(game);
    } else {
      say(game, '마이크를 놓쳤다!', 'warn', 1.4);
      emit(game, 'hurt', {});
    }
  }
  game.albums = game.albums.filter((a) => a.alive || a.squash > 0);
}

function handleShots(game, dt) {
  const { player, world } = game;
  game.shots = game.shots.filter((shot) => {
    const alive = updateShot(shot, world, dt);
    if (!alive) return false;
    if (!player.dead && overlaps(player, shot)) {
      if (damagePlayer(player)) killPlayer(game);
      else emit(game, 'hurt', {});
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
      say(game, '🎤 마이크를 얻었다! 한 대는 버틴다', 'good');
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
    say(game, '낚였다! 아이템이 아니라 리믹스였다', 'bad');
    shakeCamera(game.camera, 0.6);
    emit(game, 'trap', { kind: 'baitBlock' });
  } else if (ch === T.INVISIBLE) {
    world.setChar(tx, ty, T.GROUND);
    game.trapMemory.reveal(key);
    say(game, '뭐야 이거… 보이지도 않는 벽이', 'warn');
    emit(game, 'trap', { kind: 'invisibleBlock' });
  }
}

function handleFakePlatforms(game, dt) {
  const { player, world } = game;
  // 밟고 있는 가짜 발판을 찾아 무너뜨린다
  if (player.onGround && !player.dead) {
    const ty = Math.floor((player.y + player.h + 1) / TILE);
    const tx0 = Math.floor(player.x / TILE);
    const tx1 = Math.floor((player.x + player.w - 0.001) / TILE);
    for (let tx = tx0; tx <= tx1; tx++) {
      if (world.charAt(tx, ty) !== T.FAKE) continue;
      const key = trapKey(tx, ty);
      if (!game.crumbling.has(key)) {
        game.crumbling.set(key, CRUMBLE_TIME);
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
    if (world.charAt(tx, ty) !== T.FAKE) continue;
    world.setChar(tx, ty, T.EMPTY);
    game.trapMemory.reveal(key);
    addParticles(game, tx * TILE + 8, ty * TILE + 8, 6, ['#c9c9c9', '#8a8a8a'], { speed: 40, life: 0.5 });
    say(game, '가짜 발판이었다', 'bad', 1.4);
    emit(game, 'trap', { kind: 'fakePlatform' });
  }
}

function handlePopSpikes(game, dt) {
  const { player, world } = game;
  for (const spike of world.popSpikes) {
    const cx = spike.tx * TILE + TILE / 2;
    const near = Math.abs(player.x + player.w / 2 - cx) < 30;
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

function handleFakeGoal(game, dt) {
  const { player, world } = game;
  for (const fake of world.fakeGoals) {
    if (fake.gone) continue;
    const box = { x: fake.x + fake.offset, y: fake.y, w: fake.w, h: fake.h };
    const dx = player.x - box.x;
    if (!fake.fleeing && Math.abs(dx) < 52) {
      fake.fleeing = true;
      game.trapMemory.reveal(trapKey(fake.tx, fake.ty));
      say(game, '골이 도망갔다', 'bad');
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
    say(game, '💿 체크포인트 · 여기서 다시 시작', 'good');
    emit(game, 'checkpoint', {});
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
  if (game.banner) {
    game.banner.life -= dt;
    if (game.banner.life <= 0) game.banner = null;
  }
  game.flash = Math.max(0, game.flash - dt * 2);
}

function updateRank(game) {
  const goalX = game.world.goal?.x ?? game.world.pixelWidth;
  const progress = clamp(game.player.x / Math.max(1, goalX - TILE * 2), 0, 1);
  game.rank = rankAt(game.stageIndex, progress);
}

// ── 장면별 갱신 ──────────────────────────────────────────────
function updatePlay(game, input, dt) {
  const events = updatePlayer(game.player, input, game.world, dt);
  if (events.jumped) emit(game, 'jump', {});
  handleBlocks(game, events);
  handleFakePlatforms(game, dt);
  handlePopSpikes(game, dt);
  handleAlbums(game, dt);
  handleShots(game, dt);
  handlePickups(game);
  handleCheckpoints(game);
  handleFakeGoal(game, dt);
  handleGoal(game);
  updateRank(game);

  if (events.fell) {
    game.player.dead = true;
    killPlayer(game, PIT_MESSAGES);
  } else if (events.hazard && damagePlayer(game.player)) {
    killPlayer(game);
  }
  updateCamera(game.camera, game.player, game.world, dt);
}

function updateBossScene(game, input, dt) {
  const boss = game.boss;
  const events = updatePlayer(game.player, input, game.world, dt);
  if (events.jumped) emit(game, 'jump', {});

  const ctx = {
    player: game.player,
    arenaWidth: game.world.pixelWidth,
    spawnShot: (shot) => game.shots.push({ wobble: 0, ...shot }),
    addAlbum: (album) => game.albums.push(album),
  };
  updateBoss(boss, ctx, dt);

  handleAlbums(game, dt);
  handleShots(game, dt);

  if (boss.state !== 'defeated' && !game.player.dead) {
    // 약점 밟기
    if (overlaps(game.player, boss)) {
      if (boss.vulnerable && isStomp(game.player, boss)) {
        if (hitBoss(boss)) {
          bounce(game.player, true);
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
            game.bossLine = { text: game.rng.pick(PHASE_LINES[changed] ?? ['…']), life: 3 };
            game.flash = 1;
            shakeCamera(game.camera, 1.6);
            emit(game, 'phase', { phase: changed });
          } else if (boss.hp > 0) {
            game.bossLine = { text: game.rng.pick(BOSS_HURT_LINES), life: 2 };
          } else {
            game.bossLine = { text: game.rng.pick(BOSS_DEFEAT_LINES), life: 4 };
            game.flash = 1;
            emit(game, 'bossdown', {});
          }
        }
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
    killPlayer(game, PIT_MESSAGES);
  } else if (events.hazard && damagePlayer(game.player)) {
    killPlayer(game);
  }

  if (game.bossLine) {
    game.bossLine.life -= dt;
    if (game.bossLine.life <= 0) game.bossLine = null;
  }

  if (boss.state === 'defeated' && boss.defeatedAt > 2.6) {
    game.rank = TOP_RANK;
    game.ending = {
      rank: TOP_RANK,
      chartOuts: game.chartOuts,
      plays: game.plays,
      score: game.score + 2000,
      defeated: game.defeated,
      timeMs: game.elapsedMs,
    };
    game.scene = 'ending';
    game.sceneTime = 0;
    emit(game, 'ending', game.ending);
  }
  updateCamera(game.camera, game.player, game.world, dt);
}

/** 게임 한 프레임. input 은 이미 sample() 된 상태여야 한다. */
export function updateGame(game, input, dt) {
  game.sceneTime += dt;

  if (input.pausePressed && (game.scene === 'play' || game.scene === 'boss')) {
    game.paused = !game.paused;
    emit(game, 'pause', { paused: game.paused });
  }
  if (game.paused) return;

  const playing = game.scene === 'play' || game.scene === 'boss';
  if (playing) game.elapsedMs += dt * 1000;

  updateParticles(game, dt);

  switch (game.scene) {
    case 'title':
      if (input.confirmPressed) startRun(game);
      break;

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
        if (next < STAGES.length) loadStage(game, next);
        else {
          game.scene = 'cutscene';
          game.cutsceneTime = 0;
          game.sceneTime = 0;
          emit(game, 'cutscene', {});
        }
      }
      break;

    case 'cutscene':
      game.cutsceneTime += dt;
      if (input.confirmPressed && game.cutsceneTime > 0.6) game.cutsceneTime = CUTSCENE_LENGTH;
      if (game.cutsceneTime >= CUTSCENE_LENGTH) loadBoss(game);
      break;

    case 'boss':
      if (input.restartPressed) killPlayer(game);
      else updateBossScene(game, input, dt);
      break;

    case 'ending':
      if (game.sceneTime > 1.5 && input.confirmPressed) {
        game.scene = 'title';
        game.sceneTime = 0;
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
});
