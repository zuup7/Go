// 게임 전체의 상태 기계. 그리기는 하지 않는다 — render/ 가 이 상태를 보고 그린다.
import { createWorld, T } from './world.js';
import { STAGES, HARD_STAGES, BOSS_STAGE, NOTE_TOTAL } from '../data/stages.js';
import { createPlayer, respawnPlayer, updatePlayer, bounce, damagePlayer } from './player.js';
import { spawnAlbum, updateAlbum, stompAlbum, updateShot, albumGone } from './enemy.js';
import { createCamera, updateCamera, updateCameraShake, shakeCamera } from './camera.js';
import { rankAt, TOP_RANK } from './chart.js';
import {
  createBoss,
  updateBoss,
  hitBoss,
  syncPhase,
  enterPhaseId,
  bossPhase,
  throwMic,
  updateThrown,
  laserBeam,
  laserBeams,
  tailBand,
  shockWaves,
  ceilingSlabs,
  whirlGapX,
} from './boss.js';
import { ZONE_EFFECTS, emptyEffects, createTrapMemory, trapKey } from '../data/traps.js';
import { CUTSCENE, CUTSCENE_LENGTH, beatsCrossed } from '../data/cutscene.js';
import {
  BOSS_CUTS,
  CUT_PREVIEWS,
  bossCutLength,
  cutForPhase,
  endingCut,
  isEndingCut,
} from '../data/bossCutscenes.js';
import { introTimeline, introCutLength } from '../data/introCutscene.js';
import { talkTimeline, talkLength, HINT_TALKS } from '../data/npcTalk.js';
import { CAUGHT_CUT, caughtLength } from '../data/caughtCut.js';
import { emptySave } from './save.js';
import { createRng } from './rng.js';
import { clamp, overlaps } from './util.js';
import { TILE, SOLID } from './physics.js';

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
/**
 * 무너지는 바닥이 꺼지기까지. **거의 바로다.**
 *
 * 전속력(124px/s)이면 한 칸을 0.13초에 지난다. 0.16초로 잡으면
 * **달리면 건너지고, 멈추면 빠진다** — 벽에 막혀 멈추는 순간 발밑이
 * 사라지는 연쇄가 여기서 나온다. 0.45초였을 때는 밟고 서서 구경할 틈이 있었다.
 */
const FLOOR_CRUMBLE_TIME = 0.16;
const DEATH_HOLD = 1.5;
/** 쓰러지는 컷신과 엔딩 컷신 사이의 암전(초). 숨 한 번 — 길면 끊긴 것처럼 보인다 */
export const BOSS_CUT_GAP = 0.3;
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
    /** NPC 와 이야기하는 중 { id, t, length }. 있는 동안 판이 멈춘다 (bossCut 과 같은 모양) */
    npcTalk: null,
    /**
     * 지나갈 때 저 혼자 떴다 지는 한 마디 { id, t, length }.
     * npcTalk 과 **모양은 같고 판을 안 멈춘다** — 그게 둘을 나눈 이유의 전부다.
     */
    npcHint: null,
    /** 뒤에서 쫓아오는 거대 로봇 { x }. 추격 판에서만 있다 */
    chaser: null,
    /** 잡혀서 컷신이 도는 중 { t, length } (npcTalk 과 같은 모양) */
    caught: null,
    /** 깜빡이는 발판이 지금 켜져 있나 (바뀔 때만 격자를 손대려고 들고 있다) */
    blinkOn: null,
    /** 하늘에서 떨어지는 폭탄. 폭탄 구간에 들어서면 생긴다 */
    bombs: [],
    bombTimer: 0,
    bombPhase: 0,
    /** 폭탄이 터진 자리에 남은 불 { x, groundY, t } */
    fires: [],
    /** 쓰러지는 컷신을 이미 틀었나 (한 번만 튼다) */
    downShown: false,
    particles: [],
    texts: [],
    camera: createCamera(VIEW.w, VIEW.h),
    checkpoint: null,
    crumbling: new Map(),
    trapMemory: createTrapMemory(save.revealedTraps),
    /**
     * 주운 음표의 **자리**들. 개수를 세지 않는 이유가 있다 — 죽으면 되살아나므로
     * (reviveAtCheckpoint → spawnEntities) 개수만 세면 같은 음표를 두 번 센다.
     * 함정 표시와 같은 그릇을 쓴다.
     */
    noteMemory: createTrapMemory(save.foundNotes),
    chartOuts: 0,
    plays: 0,
    score: 0,
    defeated: 0,
    rank: 100,
    elapsedMs: 0,
    boss: null,
    paused: false,
    /**
     * 저장이 막혔는가 (WebView 에서 DomStorage 가 꺼져 있는 경우).
     * writeSave 가 false 를 돌려주면 ui/app.js 가 켠다. 저장에 남기는 값이 아니라
     * **지금 이 기기의 상태**라, 타이틀에 한 줄 알려주는 데만 쓴다.
     */
    saveBroken: false,
    muted: save.muted,
    flash: 0,
    cutsceneTime: 0,
    ending: null,
    /** 개발자 모드가 켜져 있는지 (비번 1234). 켜면 스테이지를 골라 들어갈 수 있다 */
    dev: save.dev ?? false,
    /** 히트스톱으로 멈춰 있는 프레임 수. 0 이면 평소대로 돈다 (FREEZE 참고) */
    freeze: 0,
    /** 보스 컷신 사이의 암전에 남은 시간(초) */
    bossCutGap: 0,
    /** 타이틀에서 고른 줄, 스테이지 선택 화면에서 고른 칸, 일시정지 메뉴에서 고른 줄 */
    titleIndex: 0,
    selectIndex: 0,
    pauseIndex: 0,
    /** 숨은 화면에서 나가면 어디로 돌아갈지 ('title' | 'select') */
    galleryBack: 'title',
    /**
     * 1스테이지부터 달린 판이 아니다 (골라 들어갔다).
     * 이런 판은 기록을 갱신하지 않는다 — 안 그러면 보스만 골라 이기고 최고 기록이 된다.
     */
    partial: false,
    /**
     * 지금 'intro' 장면이 틀고 있는 컷신 ('intro' | 'hardopen').
     * 그리는 쪽도 이걸 보고 어느 그림을 그릴지 정한다.
     */
    introCut: 'intro',
    /**
     * 한 바퀴를 돈 셈 쳐준다 (개발자 모드에서 포탈 판을 바로 열 때).
     * **저장에는 안 남는다** — 저장을 건드리면 1회차를 안 깬 사람의 타이틀까지 바뀐다.
     */
    forceHub: false,
    /**
     * 지금 있는 스테이지 1 이 **판이 아니라 둘러보기인가** (엔딩을 보고 나왔거나
     * 개발자 모드로 포탈 판을 연 경우).
     *
     * 둘러보기는 「하던 판」이 아니므로 이어하기로 찍히면 안 된다 —
     * returnToHub 의 주석에 무슨 일이 있었는지 적어뒀다.
     */
    hubVisit: false,
    /**
     * 개발자 모드에서 컷신만 보고 있는 중인가 (CUT_PREVIEWS 의 자리 번호).
     *
     * 이것도 hubVisit 과 같은 뜻이다 — **판이 아니다.** 이어하기로 찍히면 안 되고,
     * 컷신이 끝나도 엔딩으로 이어지면 안 된다 (목록으로 돌아간다).
     */
    cutPreview: null,
    /** 컷신 목록에서 고르고 있는 자리 */
    cutIndex: 0,
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
 * 함정 표시를 기억하는 열쇠. 하드모드에서는 **판 이름을 붙인다** —
 * 안 그러면 같은 칸이면 같은 열쇠라, 하드 (12,9) 가 스테이지 1 에서 당한 표시를
 * 물려받아 처음부터 붉게 뜬다.
 *
 * 표시를 **켜는 쪽(game)과 그리는 쪽(scene)이 반드시 같은 열쇠**를 써야 한다.
 * 한쪽만 이름을 붙이면 표시가 켜져도 안 그려지므로, 두 곳이 이 함수 하나를 같이 쓴다.
 */
export const markKey = (game, tx, ty) => trapKey(tx, ty, game.hard ? game.world.stage.id : '');

/**
 * 히트스톱 — 맞은 순간 판을 몇 프레임 세운다.
 *
 * 세기를 **사건의 무게에 비례해서** 나눈다. 전부 같은 값을 주면 앨범 하나 밟는 것과
 * 보스를 쓰러뜨리는 것이 똑같이 느껴진다. 한 판에 서른 번 하는 일은 짧아야 하고,
 * 한 판에 한 번 하는 일은 길어도 된다.
 *
 * 프레임 수다 (60Hz 고정 타임스텝이라 그대로 쓴다). 0.05초를 넘기면 조작이
 * 끊기는 느낌이 들기 시작하므로 평범한 행동은 두 프레임에서 끊는다.
 */
export const FREEZE = {
  /** 앨범 밟기 — 한 판에 스무 번 넘게 한다. 있는 줄 모르게 짧아야 한다 */
  stomp: 2,
  /** 보스 평타 */
  bossHit: 5,
  /** 죽음 */
  death: 6,
  /** 페이즈 전환 · 마지막 일격 — 한 판에 서너 번뿐이라 길어도 된다 */
  bossBig: 9,
};

/**
 * 판을 멈춘다. **더 센 것이 이긴다** — 이미 멈춰 있는데 약한 사건이 덮어쓰면
 * 큰 사건의 여운이 잘린다 (마지막 일격 다음 프레임에 탄이 스쳐도 9프레임을 지킨다).
 */
export const freezeGame = (game, frames) => {
  game.freeze = Math.max(game.freeze ?? 0, frames);
};

/**
 * 주운 음표를 기억하는 열쇠. **판 이름을 언제나 붙인다** — markKey 를 그대로 쓰면 안 된다.
 * 저 위는 1회차에서 이름을 떼는데, 음표는 네 판을 통틀어 한 자루에 모으므로
 * 스테이지 1 의 (12,9) 와 스테이지 2 의 (12,9) 가 같은 음표가 돼버린다.
 */
export const noteKey = (game, tx, ty) => trapKey(tx, ty, game.world.stage.id);

/** 지금까지 주운 음표 수. 이번 판에 주운 것까지 센다 (저장은 판이 끝나야 합쳐진다) */
export const notesFound = (game) => game.noteMemory?.size ?? game.save?.foundNotes?.length ?? 0;

/** 음표를 다 모았는가. 숨은 화면이 이 조건으로 열린다 */
export const allNotes = (game) => notesFound(game) >= NOTE_TOTAL;

/**
 * 튀는 조각들.
 *
 * `dir`·`arc` 를 주면 그 방향 부채꼴로만 튄다 (라디안). 안 주면 예전 그대로
 * 사방으로 퍼진다 — 이미 쓰고 있는 열한 군데를 안 건드리려고 기본값을 그렇게 뒀다.
 * 접점이 분명한 것(밟기 같은 것)만 방향을 준다: 사방으로 퍼지면 어디를 맞혔는지
 * 안 읽힌다.
 */
function addParticles(game, x, y, count, colors, opts = {}) {
  for (let i = 0; i < count; i++) {
    const angle =
      opts.dir == null
        ? game.rng.float() * Math.PI * 2
        : opts.dir + (game.rng.float() - 0.5) * (opts.arc ?? Math.PI * 0.6);
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
  game.bombs = [];
  game.bombTimer = 0;
  game.bombPhase = 0;
  game.fires = [];
  game.downShown = false;
  for (const p of game.world.pickups) p.taken = false;
  // 떨어진 땅덩이는 되살아나면 도로 매달린다 — 한 번 죽으면 그 구간이 통째로
  // 비어버리면 "알고 나서 2층으로 넘어간다"는 공략이 사라진다
  for (const slab of game.world.dropSlabs) {
    slab.fired = false;
    slab.done = false;
    slab.y = 0;
  }
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
  // 판이 바뀌면 말풍선도 치운다 — 안 그러면 다음 판 허공에 남는다
  game.npcTalk = null;
  game.npcHint = null;
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
  game.npcTalk = null;
  game.npcHint = null;
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
  // 개발자 모드로 열어둔 포탈 판에서 넘어왔을 수도 있다 — 새 판에서는 원래 규칙으로
  game.forceHub = false;
  // 새 판이 시작되므로 「둘러보기」도 「컷신만 보기」도 아니다
  game.hubVisit = false;
  game.cutPreview = null;
  if (index === 0 && !hard && !game.save.seenOpening) startIntro(game);
  else if (index >= stageCount(game)) loadBoss(game);
  else loadStage(game, index);
}

/**
 * 판 앞에 끼어드는 컷신을 튼다. 끝나면 스테이지 1 로 이어진다.
 *
 * id 는 'intro'(1회차 오프닝) 또는 'hardopen'(2회차 시작). **같은 장면 기계**를 탄다 —
 * 건너뛰기·소리·시간 안 흐르기를 두 벌 적으면 한쪽만 고치는 날이 온다.
 */
export function startIntro(game, id = 'intro') {
  game.scene = 'intro';
  game.introCut = id;
  game.cutsceneTime = 0;
  game.sceneTime = 0;
  emit(game, 'cutscene', { id });
}

// ── 죽음과 부활 ──────────────────────────────────────────────
function killPlayer(game) {
  if (game.scene === 'death') return;
  game.chartOuts += 1;
  game.scene = 'death';
  game.sceneTime = 0;
  freezeGame(game, FREEZE.death);
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
      // 아주 짧게. 한 판에 스무 번 넘게 하는 일이라 길면 판이 끊긴다
      freezeGame(game, FREEZE.stomp);
      emit(game, 'stomp', {});
      // 밟은 자리에서 **옆으로** 터진다. 사방으로 퍼지면 위에서 밟았다는 게 안 읽힌다.
      // (0 = 오른쪽, π = 왼쪽. 반반씩 나눠 양옆으로 보낸다)
      addParticles(game, album.x + album.w / 2, album.y + album.h / 2, 4, album.def.palette, {
        speed: 70,
        dir: 0,
        arc: Math.PI * 0.5,
      });
      addParticles(game, album.x + album.w / 2, album.y + album.h / 2, 4, album.def.palette, {
        speed: 70,
        dir: Math.PI,
        arc: Math.PI * 0.5,
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
  game.albums = game.albums.filter((a) => !albumGone(a));
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

/**
 * 공룡 형태의 가로 공격 — 꼬리와 충격파.
 *
 * 레이저는 **세로 기둥**이라 옆으로 비켜서 피했다. 이건 바닥을 훑는 **가로**라
 * 뛰어야만 피한다. 피하는 축이 달라야 "새 형태"로 읽힌다.
 * 사각형은 boss.js 가 정하고, 그림도 같은 걸 본다.
 */
function handleGroundSweeps(game) {
  if (game.player.dead) return;
  const tail = tailBand(game.boss);
  if (tail?.live && overlaps(game.player, tail)) {
    hurt(game);
    return;
  }
  for (const wave of shockWaves(game.boss)) {
    if (overlaps(game.player, wave)) {
      hurt(game);
      return;
    }
  }
  // 천장에서 떨어지는 조각 — 예고 중(warn > 0)에는 안 아프다
  for (const slab of ceilingSlabs(game.boss)) {
    if (slab.warn > 0) continue;
    if (overlaps(game.player, slab)) {
      hurt(game);
      return;
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
    // 어느 칸이었는지 남긴다 — 죽어서 되살아난 같은 음표를 다시 주워도 안 늘어난다
    game.noteMemory.reveal(noteKey(game, pickup.tx, pickup.ty));
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
  const key = markKey(game, tx, ty);
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
      const key = markKey(game, tx, ty);
      if (!game.crumbling.has(key)) {
        // 칸 좌표를 **값에 같이 들고 있는다.** 예전에는 열쇠를 ',' 로 쪼개 되읽었는데,
        // 하드모드 열쇠에는 판 이름이 붙어서(`hard1:12,9`) 그렇게 하면 NaN 이 나온다.
        game.crumbling.set(key, { time: spec.time, tx, ty });
        emit(game, 'crumble', {});
      }
    }
  }
  for (const [key, cell] of [...game.crumbling]) {
    const left = cell.time - dt;
    if (left > 0) {
      game.crumbling.set(key, { ...cell, time: left });
      continue;
    }
    game.crumbling.delete(key);
    const { tx, ty } = cell;
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
      game.trapMemory.reveal(markKey(game, wall.tx, wall.ty));
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
    game.trapMemory.reveal(markKey(game, zone.tx, zone.ty));
    shakeCamera(game.camera, 0.6);
    emit(game, 'trap', { kind: zone.kind });
  }
  // 반드시 저절로 풀린다 — 영구히 걸리면 게임이 끝난다
  for (const key of Object.keys(game.effects)) {
    game.effects[key] = Math.max(0, game.effects[key] - dt);
  }
}

/** 떨어지는 땅덩이 — 빠르다. 예고가 없는 대신 **빠르게 지나간다** */
const SLAB_FALL = 620;
/** 땅덩이가 매달려 있는 높이 (밟는 칸에서 위로 몇 칸) */
export const SLAB_HANG = 5;

/**
 * **하늘에서 떨어지는 땅.** 1층을 밟는 순간 머리 위 슬래브가 바로 떨어진다.
 *
 * 이 게임의 다른 함정과 달리 **시간 예고가 없다.** 대신 두 가지가 받쳐준다.
 *   1. 매달린 슬래브가 2층 밑에 **그려져 있다** — 지형을 읽으면 알 수 있다
 *   2. 한 번 당하면 그 칸이 붉게 남는다 (trapMemory)
 * 공략은 피하는 게 아니라 **애초에 1층으로 안 가는 것**이다. 2층으로 넘어간다.
 */
function handleDropSlabs(game, dt) {
  const { player, world } = game;
  for (const slab of world.dropSlabs) {
    const cx = slab.tx * TILE + TILE / 2;
    const near = Math.abs(player.x + player.w / 2 - cx) < 18;
    // **딛고 선 층이 같아야** 발동한다. 2층으로 넘어가면 안 떨어진다 —
    // 이게 이 장치의 전부다. 층을 안 보면 위를 지나가도 터져서 공략이 사라진다.
    const sameFloor = Math.abs(player.y + player.h - slab.ty * TILE) < TILE * 2;
    if (!slab.fired && near && sameFloor && !player.dead) {
      slab.fired = true;
      slab.y = (slab.ty - SLAB_HANG) * TILE;
      game.trapMemory.reveal(markKey(game, slab.tx, slab.ty));
      shakeCamera(game.camera, 0.8);
      emit(game, 'trap', { kind: 'dropSlab' });
    }
    if (!slab.fired || slab.done) continue;
    slab.y += SLAB_FALL * dt;
    const box = { x: slab.tx * TILE, y: slab.y, w: TILE, h: TILE };
    if (!player.dead && overlaps(player, box) && damagePlayer(player)) killPlayer(game);
    if (slab.y >= slab.ty * TILE - TILE) {
      slab.done = true;
      addParticles(game, cx, slab.ty * TILE, 10, ['#c9c9c9', '#8a8a8a', '#fff'], {
        speed: 90,
        life: 0.4,
      });
      shakeCamera(game.camera, 0.7);
    }
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
      game.trapMemory.reveal(markKey(game, spike.tx, spike.ty));
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

/**
 * 천장 가시가 **몇 칸까지 뻗는가.**
 *
 * 1칸이었을 때는 바닥 딱 2칸 위에만 달 수 있었다 — 그보다 높이 달면 닿지를
 * 않아서 그냥 그림이 됐다. 창처럼 길게 만들면 천장에 높이 달아놓고도
 * 바닥까지 내리꽂을 수 있고, 그래야 **점핑패드로 솟았다가 꽂히는** 자리도 나온다.
 */
export const CEIL_BLADE = 3;

/** 천장 가시 — 아래를 지나가면 내려온다. 솟는 가시를 위아래만 뒤집은 것이다 */
function handleCeilSpikes(game, dt) {
  const { player, world } = game;
  for (const spike of world.ceilSpikes) {
    const cx = spike.tx * TILE + TILE / 2;
    const near = Math.abs(player.x + player.w / 2 - cx) < 20;
    // 칼날이 닿는 데까지는 발동해야 한다. 칼날만 늘리고 여기를 안 늘리면
    // 높이 단 가시가 "닿을 수는 있는데 발동은 안 하는" 상태가 된다.
    const reach = TILE * (CEIL_BLADE + 2);
    const below = player.y > spike.ty * TILE && player.y - spike.ty * TILE < reach;
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
      h: TILE * CEIL_BLADE * spike.t,
    };
    if (!player.dead && spike.t > 0.35 && overlaps(player, blade)) {
      if (damagePlayer(player)) killPlayer(game);
    }
  }
}

// ── 하늘에서 떨어지는 폭탄 ──────────────────────────────────
/** 폭탄 하나를 떨어뜨리는 간격(초) */
const BOMB_EVERY = 0.4;
/**
 * 떨어질 자리에 **그림자만 보이는** 시간.
 * 이게 없으면 하늘에서 예고 없이 죽는 것이고, 그건 트롤이 아니라 불합리한 게임이다.
 */
export const BOMB_WARN = 0.35;
/**
 * 잇달아 떨어지는 폭탄 사이에 비워두는 칸 수.
 * 붙여서 떨어뜨리면 설 자리가 없어져 못 지나가는 구간이 된다 — 테스트가 지킨다.
 */
export const BOMB_GAP = 4;
const BOMB_FALL = 240;
/** 터질 때 휩쓰는 범위 */
const BOMB_BLAST = 12;
/** 터진 자리에 불이 남는 시간. 폭탄이 "때리는 것"에서 **설 자리를 지우는 것**이 된다 */
export const FIRE_TIME = 1.5;
/** 떨어지며 좌우로 흔들리는 폭. 그림자 자리를 그대로 믿고 서 있으면 맞는다 */
const BOMB_SWAY = 7;

/** 그 칸 아래로 처음 나오는 바닥의 윗면 y (없으면 판 바닥) */
function groundBelow(world, tx, fromTy) {
  for (let ty = fromTy; ty < world.height; ty++) {
    if (world.tileAt(tx, ty) === SOLID) return ty * TILE;
  }
  return world.pixelHeight;
}

function spawnBomb(game) {
  const { player, world } = game;
  // 셋씩 돌아가며 왼쪽·가운데·오른쪽.
  //
  // 자리를 **BOMB_GAP 격자에 붙인다.** 플레이어 위치에 그냥 더하면, 달리는 동안
  // 기준이 밀려서 앞뒤 폭탄이 한두 칸 차이로 겹칠 수 있다 — 그러면 설 자리가
  // 없어져 못 지나가는 구간이 된다. 격자에 붙이면 두 폭탄은 같은 칸이거나
  // 최소 BOMB_GAP 칸 떨어진다.
  const lane = (game.bombPhase % 3) - 1;
  game.bombPhase += 1;
  const want = Math.floor((player.x + player.w / 2) / TILE) + 2 + lane * BOMB_GAP;
  const tx = clamp(Math.round(want / BOMB_GAP) * BOMB_GAP, 0, world.width - 1);
  game.bombs.push({
    x: tx * TILE + TILE / 2,
    y: game.camera.y - TILE,
    tx,
    groundY: groundBelow(world, tx, 0),
    warn: BOMB_WARN,
    /** 흔들리는 위상. 폭탄마다 달라야 줄줄이 같은 궤적으로 안 떨어진다 */
    sway: game.rng.float() * Math.PI * 2,
    baseX: tx * TILE + TILE / 2,
  });
}

/**
 * 폭탄 구간. 걸려 있는 동안 하늘에서 떨어진다.
 *
 * 순서는 늘 같다 — **그림자가 먼저, 폭탄은 나중.** 그림자를 보고 비키면 산다.
 */
function handleBombs(game, dt) {
  if (game.effects.bombs > 0) {
    game.bombTimer -= dt;
    if (game.bombTimer <= 0) {
      game.bombTimer += BOMB_EVERY;
      spawnBomb(game);
    }
  } else {
    game.bombTimer = 0;
  }

  const { player } = game;
  game.bombs = game.bombs.filter((bomb) => {
    if (bomb.warn > 0) {
      bomb.warn -= dt;
      return true;
    }
    bomb.y += BOMB_FALL * dt;
    // 좌우로 흔들며 내려온다 — 그림자 자리에 그대로 서 있으면 맞는다
    bomb.sway += dt * 7;
    bomb.x = bomb.baseX + Math.sin(bomb.sway) * BOMB_SWAY;
    const hitGround = bomb.y >= bomb.groundY;
    const box = { x: bomb.x - 5, y: bomb.y - 5, w: 10, h: 10 };
    const hitPlayer = !player.dead && overlaps(player, box);
    if (!hitGround && !hitPlayer) return true;

    // 터진다 — 닿은 자리 둘레를 휩쓴다
    const blast = {
      x: bomb.x - BOMB_BLAST,
      y: Math.min(bomb.y, bomb.groundY) - BOMB_BLAST,
      w: BOMB_BLAST * 2,
      h: BOMB_BLAST * 2,
    };
    if (!player.dead && overlaps(player, blast) && damagePlayer(player)) killPlayer(game);
    addParticles(game, bomb.x, Math.min(bomb.y, bomb.groundY), 10, ['#ff8f3c', '#ffd166', '#fff'], {
      speed: 120,
      life: 0.4,
    });
    shakeCamera(game.camera, 0.5);
    // 터진 자리에 불이 남는다 — 여기가 이번 강화의 핵심이다.
    // 맞는 걸 피하는 게 아니라 **설 자리를 계속 옮겨야** 한다.
    game.fires.push({ x: bomb.x, groundY: bomb.groundY, t: FIRE_TIME });
    emit(game, 'trap', { kind: 'bomb' });
    return false;
  });

  // 남은 불 — 시간이 지나면 꺼진다. 안 꺼지면 판이 통째로 막힌다.
  game.fires = game.fires.filter((fire) => {
    fire.t -= dt;
    if (fire.t <= 0) return false;
    const box = { x: fire.x - 9, y: fire.groundY - 12, w: 18, h: 12 };
    if (!player.dead && overlaps(player, box) && damagePlayer(player)) killPlayer(game);
    return true;
  });
}

/**
 * 쫓아오는 속도. **달리기(PLAYER.maxSpeed = 124)보다 반드시 느려야 한다.**
 *
 * 여기를 넘기는 순간 "어려운 판"이 아니라 "달리기 속도를 시험하는 판"이 되고,
 * 그건 실력이 아니라 그냥 못 깨는 판이다. 잡히는 건 벽에 막혀 멈췄을 때,
 * 함정에 걸려 멈췄을 때, 길을 잘못 골랐을 때여야 한다.
 */
export const CHASE_SPEED = 108;
/** `>` 구간을 밟으면 잠깐 이만큼 빨라진다. 그래도 달리기보다는 느리다 */
export const SURGE_SPEED = 120;
/**
 * **되살아날 때** 쫓아오는 것을 이만큼 뒤로 물린다.
 * 108px/s 로 오므로 3.3초 — 눈뜨고 상황을 보고 달리기 시작할 틈이다.
 * 짧게 잡으면 눈뜨자마자 다시 잡혀서 빠져나올 수 없는 판이 된다.
 */
export const CHASE_LEAD = 360;
/**
 * **판을 시작할 때** 벌려두는 거리. 되살아날 때(CHASE_LEAD)보다 짧다.
 *
 * 둘을 같은 값으로 두면 시작이 너무 여유로워서, 잘 달리는 사람은 로봇을
 * 한 번도 못 보고 판을 끝낸다 — 쫓기는 판인데 쫓기는 느낌이 없다.
 * 되살아날 때는 반대로 넉넉해야 한다. 눈뜨자마자 다시 잡히면 빠져나올 수가 없다.
 */
export const CHASE_START_LEAD = 200;
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
  if (!game.chaser) game.chaser = { x: game.player.x - CHASE_START_LEAD };
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
      game.trapMemory.reveal(markKey(game, fake.tx, fake.ty));
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
const hubOpen = (game) => !game.hard && (!!game.save?.clearedOnce || !!game.forceHub);

/**
 * 포탈이 열려 있는 스테이지 1 로 바로 간다 (개발자 모드).
 *
 * 2회차 입구를 보려고 한 바퀴를 다 돌게 하면 아무도 안 본다. **한 바퀴 돈 셈만**
 * 쳐주고(forceHub) 저장은 안 건드린다 — clearedOnce 를 켜버리면 그 기기에서
 * 1회차를 안 깬 사람의 타이틀 화면까지 바뀐다.
 */
export function openHub(game) {
  game.forceHub = true;
  returnToHub(game);
}

/**
 * 말을 걸 수 있는 거리.
 *
 * **바닥까지 내려와야 한다.** 예전엔 `TILE * 2` 라 상자 아래끝(178)이 바닥에 선
 * 플레이어의 머리 높이(178)와 딱 같았고, `overlaps` 는 딱 닿는 걸 안 쳐준다 —
 * 그래서 **걸어가서는 1픽셀 차이로 영영 안 닿았다.** 옆에서 점프해야만 말이 걸렸다.
 */
const npcReach = (npc) => ({ x: npc.x - 14, y: npc.y - TILE, w: TILE + 28, h: TILE * 3 });

/**
 * 이 사람이 지금 **무슨 말을 할 차례인가**.
 *
 * 세 갈래를 한 군데서 정한다. 그리는 쪽도 소리 쪽도 이걸 타므로, 조건을 두 군데
 * 적어두면 말풍선과 소리가 서로 다른 말을 하는 날이 온다.
 *   'talkLocked'  아직 한 바퀴를 못 돌았다 — 「여기는 아직 아니다」
 *   'talk'        깨고 왔는데 아직 안 열어줬다 — 문을 열어준다
 *   'talkAgain'   이미 열어줬다 — 「저기다」
 */
export function npcSays(game, npc) {
  if (!hubOpen(game)) return 'talkLocked';
  return npc.opened ? 'talkAgain' : 'talk';
}

/**
 * 지금 **눌러서** 말을 걸 수 있는 NPC. 없으면 null.
 *
 * 눌러서 거는 건 문을 열어주는 이야기 하나뿐이다. 나머지 둘은 지나가면 저절로 뜨므로
 * (handleNpc 의 아래쪽) 버튼을 기다리지 않는다 — 안 그러면 잠긴 사람 옆에서
 * 점프할 때마다 판이 멈춘다.
 */
export function npcInReach(game) {
  if (game.player.dead || game.npcTalk) return null;
  for (const npc of game.world.npcs) {
    if (npcSays(game, npc) !== 'talk') continue;
    if (npc.said) continue;
    if (overlaps(game.player, npcReach(npc))) return npc;
  }
  return null;
}

/** 저 혼자 떴다 지는 한 마디. 판은 계속 돈다 */
function startHint(game, id) {
  game.npcHint = { id, t: 0, length: talkLength(id) };
}

/**
 * NPC 에게 말 걸기와 포탈.
 *
 * 말 걸기는 **점프 키 그대로**다 (input.confirmPressed 가 confirm || jump).
 * 새 키를 만들면 폰에 버튼이 하나 더 붙어야 하는데, 딱 한 번 쓰는 것 때문에
 * 조작 화면을 더 복잡하게 만들 이유가 없다.
 *
 * 이 사람은 **언제나 서 있다** — 한 바퀴 돌기 전에도. 예전에는 아무 반응이 없어서
 * 판에 박힌 장식처럼 보였고, 그래서 2회차가 있는 줄도 몰랐다. 이제 지나가면
 * 아직 아니라고 말해주고, 깨고 오면 열어주고, 열어준 뒤에도 문을 가리킨다.
 */
function handleNpc(game, input) {
  const npcs = game.world?.npcs;
  if (!npcs?.length || game.hard) return;

  for (const npc of npcs) {
    const near = !game.player.dead && overlaps(game.player, npcReach(npc));
    npc.near = near;
    // **멀어지면 풀린다.** 이게 다시 말을 걸 수 있게 하는 전부다
    if (!near) {
      npc.said = false;
      continue;
    }
    if (npc.said || game.npcTalk || game.npcHint) continue;
    const id = npcSays(game, npc);
    // 문을 열어주는 이야기만 버튼을 기다린다. 나머지는 지나가면 저절로
    if (HINT_TALKS.includes(id)) {
      npc.said = true;
      startHint(game, id);
      emit(game, 'talk', {});
    }
  }

  const npc = npcInReach(game);
  if (npc && input.confirmPressed) {
    npc.opened = true;
    npc.said = true;
    game.npcHint = null; // 진짜 이야기가 시작되면 스쳐가는 한 마디는 치운다
    game.npcTalk = { id: 'talk', t: 0, length: talkLength('talk') };
    game.player.vx = 0;
    emit(game, 'talk', {});
  }
  // 말을 걸어야 문이 열린다
  const opened = npcs.some((n) => n.opened);
  for (const portal of game.world.portals) portal.open = opened && !game.npcTalk;
}

/** 열린 포탈에 들어가면 2회차가 시작된다 */
function handlePortal(game) {
  if (!hubOpen(game) || game.player.dead) return;
  for (const portal of game.world.portals) {
    if (!portal.open) continue;
    if (!overlaps(game.player, portal)) continue;
    emit(game, 'portal', {});
    // 판을 바로 열지 않고 **왜 또 달리는지**를 먼저 보여준다.
    // 컷신이 끝나면 아래 'intro' 장면이 startRun 으로 이어붙인다.
    startIntro(game, 'hardopen');
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

/**
 * 세게 떨어졌을 때만 발밑에 먼지. 걸음마다 피우면 화면이 지저분해진다.
 *
 * 소리도 **같은 문턱**을 쓴다. 먼지는 나는데 소리가 없어서 무게가 반쪽이었다 —
 * 문턱을 따로 두면 언젠가 "먼지는 나는데 조용한 착지"가 생긴다.
 */
function landingDust(game, landed) {
  if (!landed || landed.impact < 0.45) return;
  emit(game, 'land', { impact: landed.impact });
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
    // 추격 판에서 계속 보게 되는 컷신이다 — 다른 컷신처럼 건너뛸 수 있어야 한다
    if (skipping(input, game.caught.t)) game.caught.t = game.caught.length;
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
    beat(game, game.npcTalk.id, talkTimeline(game.npcTalk.id), was, game.npcTalk.t);
    if (skipping(input, game.npcTalk.t)) game.npcTalk.t = game.npcTalk.length;
    if (game.npcTalk.t >= game.npcTalk.length) game.npcTalk = null;
    return;
  }

  // 지나갈 때 뜨는 한 마디. **return 이 없다** — 판은 계속 돌고 말풍선만 뜬다.
  // 위의 npcTalk 과 나눠둔 이유가 이 한 줄이다.
  if (game.npcHint) {
    const was = game.npcHint.t;
    game.npcHint.t += dt;
    beat(game, game.npcHint.id, talkTimeline(game.npcHint.id), was, game.npcHint.t);
    if (game.npcHint.t >= game.npcHint.length) game.npcHint = null;
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
  handleDropSlabs(game, dt);
  handleBlinkers(game);
  handleFakeChecks(game);
  handleCeilSpikes(game, dt);
  handleBombs(game, dt);
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
  /**
   * **이건 판이 아니라 둘러보기다.**
   *
   * 여기로 오는 길은 둘뿐이다 — 엔딩을 다 보고 나온 사람, 개발자 모드로 연 사람.
   * 둘 다 「하던 판」이 없다. 그런데 loadStage 가 'stage' 를 알리고 저장 쪽이
   * 그걸 이어하기로 찍어버려서, 엔딩에서 일부러 지운 이어하기(app.js 의
   * `resume: null`)가 **한 프레임 뒤에 STAGE 1 로 되살아났다.** 다 깬 사람의
   * 타이틀에 「이어하기 — STAGE 1」이 영영 붙어 있던 게 이것이다.
   */
  game.hubVisit = true;
  loadStage(game, 0);
}

/**
 * 음표를 다 모으면 열리는 숨은 화면. 앨범 열일곱 장이 한자리에 놓인다.
 *
 * **어디서 들어왔는지 기억해 둔다**(galleryBack). 타이틀에서 들어왔는데 나갈 때
 * 선택 화면으로 떨어지면, 한 바퀴를 안 깬 사람은 거기 갈 자격이 없는 자리에 서게 된다.
 */
/**
 * 개발자 모드 · **컷신 보기.**
 *
 * 컷신 하나 확인하려고 보스를 3페이즈까지 때리는 데 시간이 너무 든다.
 * 목록에서 골라 바로 튼다.
 */
export function openCutList(game) {
  game.scene = 'cutList';
  game.sceneTime = 0;
  game.cutPreview = null;
  game.bossCut = null;
  game.bossCutGap = 0;
}

/** 컷신 목록에서 고를 수 있는 것들 (개발자 모드에서만 들어온다) */
export const cutPreviews = () => CUT_PREVIEWS;

/**
 * 컷신 하나를 바로 튼다.
 *
 * **몸을 맞춰 세우는 게 이 함수의 전부다.** 그리는 쪽은 bossBody(game.boss) 에게
 * 물어보므로, hard 와 페이즈를 안 맞추면 공룡 컷신에 로봇이 나온다 —
 * 예전에 실제로 그 버그가 있었다. 페이즈에 들어가는 건 enterPhaseId 가 하는데,
 * phaseId 를 그냥 대입하면 공룡 몸 크기를 건너뛰기 때문이다.
 */
export function previewCut(game, index) {
  const p = CUT_PREVIEWS[index];
  if (!p) return false;
  game.cutPreview = index;
  // 오프닝·2회차 시작은 보스가 없는 컷신이다 — 같은 목록에 있지만 트는 길이 다르다
  if (p.intro) {
    startIntro(game, p.intro);
    return true;
  }
  // cutPreview 를 **loadBoss 보다 먼저** 세워야 한다. loadBoss 가 'boss' 를
  // 알리고 저장 쪽이 그걸 이어하기로 찍는데, 컷신 보기는 판이 아니다.
  game.hard = p.hard;
  game.partial = true;
  game.hubVisit = false;
  loadBoss(game);
  enterPhaseId(game.boss, p.phaseId);
  // 격파 컷신은 쓰러지는 몸을 그린다 — 살아 있는 채로 틀면 몸이 안 맞는다
  if (p.id === 'bossdown' || isEndingCut(p.id)) {
    game.boss.hp = 0;
    game.boss.state = 'defeated';
    game.boss.defeatedAt = 0;
  }
  startBossCut(game, p.id);
  return true;
}

function openGallery(game, from) {
  game.scene = 'gallery';
  game.sceneTime = 0;
  game.galleryBack = from;
}

/**
 * 타이틀에서 고를 수 있는 줄.
 *
 * **고르는 쪽(updateGame)과 그리는 쪽(render/hud)이 같이 본다** — 줄 수를 따로
 * 적어두면 줄이 늘었을 때 화면은 셋인데 고르기는 둘에서 도는 꼴이 된다.
 *
 * 줄이 하나뿐이면 메뉴를 아예 안 띄운다 — 예전처럼 아무 키나 누르면 시작이다.
 */
export function titleRows(game) {
  const rows = [{ label: '처음부터', action: 'start' }];
  // 하던 판이 있으면 **맨 위**에. 나갔다 들어온 사람이 제일 먼저 찾는 줄이다.
  // (어디까지 갔는지도 같이 적는다 — 「이어하기」만 있으면 어디로 가는지 모른다)
  if (game.save?.resume) {
    rows.unshift({ label: resumeLabel(game.save.resume), action: 'resume' });
  }
  if (canSelect(game)) rows.push({ label: '스테이지 선택', action: 'select' });
  // 2회차가 있다는 걸 **여기서 말해준다.** 예전에는 깨고 나면 말없이 스테이지 1 로
  // 되돌려놓는 게 전부라, NPC 를 지나치면 2회차가 있는 줄도 몰랐다.
  if (game.save?.clearedOnce) rows.push({ label: '2회차', action: 'hub' });
  // 음표를 다 모은 사람에게만. 선택 목록에도 같은 칸이 있지만 여기 두는 게 중요하다 —
  // 한 바퀴를 안 깨도 음표는 다 모을 수 있어서, 목록 쪽만 두면 「스테이지 선택」 안에
  // 이것 하나만 덩그러니 들어 있는 꼴이 된다.
  if (allNotes(game)) rows.push({ label: '숨은 화면', action: 'gallery' });
  return rows;
}

/**
 * 스테이지 선택 화면의 칸 **한 벌**.
 *
 * 예전에는 칸 번호(core)와 칸 이름(render/hud)을 따로 적어뒀다. 하드 판을 넣으려면
 * 두 곳을 같이 고쳐야 하고, 한쪽만 고치면 **엉뚱한 판이 시작되는데 화면은 맞게 보인다**.
 * 그래서 여기 한 곳에만 적고 양쪽이 이걸 읽는다.
 *
 * run 이 있으면 startRun 에 그대로 넘긴다. index 가 판 수와 같으면 보스전이다.
 *
 * `needs` 가 이 칸을 누가 볼 수 있는지 정한다:
 *   'clearedOnce'  한 바퀴 깬 사람 (그냥 플레이어도 본다)
 *   'clearedHard'  2회차까지 깬 사람
 *   'dev'          개발자 모드에서만 — 이야기 순서를 건너뛰거나 모드를 끄는 칸들
 */
export const SELECT_ITEMS = [
  ...STAGES.map((s, i) => ({ label: `STAGE ${s.number}`, run: { index: i }, needs: 'clearedOnce' })),
  { label: '보스전', run: { index: STAGES.length }, needs: 'clearedOnce' },
  ...HARD_STAGES.map((s, i) => ({
    label: `하드 ${s.number}판`,
    run: { index: i, hard: true },
    needs: 'clearedHard',
  })),
  { label: '하드 보스전', run: { index: HARD_STAGES.length, hard: true }, needs: 'clearedHard' },
  /**
   * 포탈이 열려 있는 스테이지 1. NPC 에게 말을 걸고 문으로 들어가면 2회차가 시작된다 —
   * 하드 판으로 바로 뛰어드는 위 칸들과 달리 **입구 전체**를 볼 수 있다.
   */
  /**
   * 깬 사람에게 보이는 2회차 입구. 하드 개별 판(위)은 `clearedHard` 라, 이게 없으면
   * **하드를 깨야 하드가 목록에 보이는** 닭-달걀이 된다.
   */
  { label: '2회차 입구', action: 'hub', needs: 'clearedOnce' },
  /** 음표를 다 모으면 열리는 숨은 화면. 'allNotes' 는 저장 칸이 아니라 아래 GATES 가 센다 */
  { label: '숨은 화면', action: 'gallery', needs: 'allNotes' },
  { label: '포탈 스테이지 1', action: 'hub', needs: 'dev' },
  { label: '컷신 보기', action: 'cuts', needs: 'dev' },
  { label: '개발자 모드 끄기', action: 'devOff', needs: 'dev' },
];

/**
 * 지금 이 사람에게 보이는 칸들.
 *
 * **고르는 쪽(updateGame)과 그리는 쪽(render/hud)이 반드시 이 함수를 같이 써야 한다.**
 * selectIndex 는 여기서 나온 목록의 자리 번호다 — 목록이 서로 다르면 화면은 맞는데
 * 엉뚱한 판이 시작된다 (위 주석의 그 사고다).
 *
 * 개발자 모드는 전부 본다. 그러면 SELECT_HARD 같은 자리 번호가 그대로 맞는다.
 */
/**
 * `needs` 가 저장의 칸 이름이 아닌 것들. 음표는 저장에 **개수가 아니라 자리 목록**이
 * 들어 있어서 세어봐야 하고, 이번 판에 주운 것도 쳐줘야 한다.
 */
const GATES = { allNotes };

export function selectItems(game) {
  if (game.dev) return SELECT_ITEMS;
  const save = game.save ?? {};
  const open = (needs) => (GATES[needs] ? GATES[needs](game) : !!save[needs]);
  return SELECT_ITEMS.filter((item) => item.needs !== 'dev' && open(item.needs));
}

/** 고를 게 하나라도 있나. 없으면 타이틀에 메뉴를 띄우지 않는다 (예전 그대로 바로 시작) */
export const canSelect = (game) => selectItems(game).length > 0;

const slotOf = (test) => SELECT_ITEMS.findIndex(test);
/** 하드모드 1판부터 (NPC 를 안 거치고 바로 — 개발자 모드에서만) */
export const SELECT_HARD = slotOf((s) => s.run?.hard && s.run.index === 0);
/** 하드 보스전으로 바로 */
export const SELECT_HARD_BOSS = slotOf((s) => s.run?.hard && s.run.index === HARD_STAGES.length);
/**
 * 컷신 보기 (개발자 모드).
 *
 * 오프닝·2회차 시작 컷신도 **여기 안으로 들어갔다** — 「컷신을 본다」는 한 가지 일인데
 * 선택 목록에 칸이 셋으로 흩어져 있었다. 어느 컷신이든 CUT_PREVIEWS 에서 고른다.
 */
export const SELECT_CUTS = slotOf((s) => s.action === 'cuts');
/** 포탈이 열려 있는 스테이지 1 (2회차 입구를 통째로 보는 칸) */
export const SELECT_HUB = slotOf((s) => s.action === 'hub');
/** 컷신 목록에서 오프닝 / 2회차 시작이 몇 번째인가 */
export const cutSlotOf = (id) => CUT_PREVIEWS.findIndex((c) => c.id === id);
/** 개발자 모드 끄기 */
export const SELECT_DEV_OFF = slotOf((s) => s.action === 'devOff');
export const SELECT_SLOTS = SELECT_ITEMS.length;

/**
 * 화면을 덮는 컷신이 도는 중인가.
 *
 * HUD 를 숨기는 판단과 「건너뛰기」 버튼을 띄우는 판단이 **같은 상태**다. 두 군데
 * 적어두면 한쪽만 고치는 날이 온다 — 실제로 hud 쪽은 잡히는 컷신(caught)을
 * 빼먹고 있어서 그 컷신에서만 HUD 가 화면 위에 남아 있었다.
 *
 * NPC 대화(npcTalk)는 여기 안 넣는다. 판 위에 작은 말풍선이 뜬 것뿐이고 화면을
 * 안 덮으므로, HUD 도 그대로 있어야 하고 「건너뛰기」 버튼을 띄울 자리도 아니다.
 */
export const inCutscene = (game) =>
  game.scene === 'intro' ||
  game.scene === 'cutscene' ||
  !!game.bossCut ||
  // 컷신 사이의 암전도 컷신이다 — 여기서 HUD 가 0.3초 돌아왔다 사라지면 깜빡인다
  game.bossCutGap > 0 ||
  !!game.caught;

/**
 * 컷신을 튼 뒤 이만큼은 못 건너뛴다.
 *
 * 들어가는 순간 눌려 있던 점프가 그대로 먹으면 컷신이 시작도 안 하고 날아간다.
 * 예전에는 컷신마다 0.6·0.6·0.5·0.4 로 따로 적혀 있었고 잡히는 컷신에는 아예
 * 건너뛰기가 없었다 — 다섯 군데 중 한 군데를 빠뜨린 셈이다.
 */
export const SKIP_AFTER = 0.5;

/**
 * 엔딩 통계 화면이 입력을 안 받는 시간(초). 18초짜리 컷신이 끝나자마자 눌려 있던
 * 키에 화면이 날아가면 기록을 볼 새가 없다.
 *
 * **style.css 의 `--ending-lock` 과 같은 값이어야 한다** — 「아무 키나 누르면」
 * 줄이 뜨는 시각을 거기서 정하기 때문이다. 둘이 어긋나면 못 누르는 동안 누르라고
 * 하거나(예전이 그랬다), 누를 수 있는데 아무 말이 없다. 테스트가 둘을 견준다.
 */
export const ENDING_LOCK = 1.5;

/** 지금 이 컷신(시작한 지 t 초)을 건너뛰라는 입력인가 */
const skipping = (input, t) => input.confirmPressed && t > SKIP_AFTER;

/** 개발자 모드를 켜고 끈다. 비번 판정은 ui 가 하고 결과만 여기로 온다. */
export function setDevMode(game, on) {
  game.dev = on;
  game.titleIndex = 0;
  // 목록이 짧아지므로 고른 자리가 범위 밖일 수 있다
  game.selectIndex = 0;
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

  /**
   * 세 갈래다. **평타 / 페이즈 전환 / 마지막 일격**.
   *
   * 예전에는 두 갈래였고 (`changed` 아니면 `hp > 0`), 그래서 hp 가 0 이 되는
   * 순간에는 **어느 쪽도 실행되지 않았다** — 아홉 번 중 가장 중요한 아홉 번째에
   * 플래시도 전용 소리도 없었다. 게다가 'bossdown'(쓰러지는 팡파르, 1초짜리)이
   * 평타에 붙어 있어서 매 타격마다 다음 타격 위로 겹쳐 울렸다. 이름도 사실과 반대였다.
   */
  const changed = syncPhase(boss);
  if (boss.hp <= 0) {
    // 마지막 일격. 평타 플래시(1)보다 **위로 벌린다** — 렌더가 0.85 까지 받는다
    game.flash = 1.4;
    freezeGame(game, FREEZE.bossBig);
    shakeCamera(game.camera, 1.8);
    // 이제야 이름이 사실이 된다. 소리가 끝나갈 즈음 보스가 다 가라앉는다
    emit(game, 'bossdown', {});
  } else if (changed) {
    // 페이즈가 바뀌면 싸움을 멈추고 전환 컷신을 튼다
    startBossCut(game, cutForPhase(changed, game.hard));
    game.flash = 1;
    freezeGame(game, FREEZE.bossBig);
    shakeCamera(game.camera, 1.6);
    emit(game, 'phase', { phase: changed });
  } else {
    // 평타. 보스 몸이 하얘지는 hurtFlash 와 별개로 화면도 한 번 번쩍인다
    game.flash = 1;
    freezeGame(game, FREEZE.bossHit);
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
  // 쓰러지는 컷신과 엔딩 사이의 숨. 화면은 이미 검다.
  if (game.bossCutGap > 0) {
    game.bossCutGap -= dt;
    if (game.bossCutGap <= 0) {
      game.bossCutGap = 0;
      startBossCut(game, endingCut(game.hard));
    }
    return;
  }

  if (game.bossCut) {
    const was = game.bossCut.t;
    game.bossCut.t += dt;
    // 실제로 흐른 만큼만 소리를 낸다. 건너뛰기로 시각을 끝까지 밀기 **전에** 판정해야
    // 남은 단계 열 개가 한 프레임에 쏟아지지 않는다.
    beat(game, game.bossCut.id, BOSS_CUTS[game.bossCut.id].timeline, was, game.bossCut.t);
    if (skipping(input, game.bossCut.t)) game.bossCut.t = game.bossCut.length;
    if (game.bossCut.t >= game.bossCut.length) {
      const finished = game.bossCut.id;
      game.bossCut = null;
      // 컷신이 끝났다고 알린다. 건너뛰었을 때도 반드시 나오므로,
      // 컷신 때문에 꺼둔 것(브금 같은 것)을 여기서 되돌리면 안전하다.
      emit(game, 'cutdone', { cut: finished });
      // 쓰러지는 컷신이 끝나면 엔딩으로 이어진다. **쉼표를 하나 둔다** —
      // 하드컷으로 붙이면 4.6초와 18초짜리 두 컷신이 한 덩어리로 뭉쳐 읽힌다.
      // (컷신 그리기가 앞뒤 0.3/0.4초를 검게 여닫으므로 그 사이가 완전한 암전이다)
      /**
       * 컷신만 보는 중이면 **여기서 끊는다.** 안 끊으면 격파 컷신이 엔딩으로
       * 이어지고 엔딩이 기록을 남긴다 — 보기만 했는데 깬 걸로 저장된다.
       */
      if (game.cutPreview != null) {
        openCutList(game);
        return;
      }
      if (finished === 'bossdown') game.bossCutGap = BOSS_CUT_GAP;
      if (isEndingCut(finished)) finishRun(game);
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
    onFire: () => emit(game, 'shot', {}),
    // 꼬리는 플레이어 반대쪽에서 시작한다 — 발밑에서 생기면 예고가 있어도 못 피한다
    playerX: game.player.x + game.player.w / 2,
    onTailAim: () => emit(game, 'tailaim', {}),
    onTail: () => emit(game, 'tail', {}),
    onStompAim: () => emit(game, 'stompaim', {}),
    onWhirlAim: () => emit(game, 'laseraim', {}),
    onWhirl: () => emit(game, 'trap', { kind: 'whirl' }),
    onCeiling: () => {
      shakeCamera(game.camera, 0.6);
      emit(game, 'trap', { kind: 'ceiling' });
    },
    onStomp: () => {
      shakeCamera(game.camera, 1.2);
      // **앨범 밟기와 다른 이벤트다.** 같은 'stomp' 를 쓰고 있었더니 거대 로봇이
      // 땅을 내려찍는데 CD 한 장 밟는 소리가 났다 — 중요도가 뒤집힌다.
      emit(game, 'bossstomp', {});
    },
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
  handleGroundSweeps(game);

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

  // 쓰러지면 **먼저 쓰러지는 컷신**을 틀고, 그게 끝나야 엔딩으로 간다.
  // 그냥 사라지면 이긴 것 같지가 않다 — 박혀 있던 앨범이 떨어져 나가는 걸 보여준다.
  if (boss.state === 'defeated' && boss.defeatedAt > 0.9 && !game.downShown) {
    game.downShown = true;
    startBossCut(game, 'bossdown');
  }

  updateCamera(game.camera, game.player, game.world, dt);
}

/**
 * 멈췄을 때 고를 수 있는 줄. 순서가 곧 화면 순서다.
 *
 * volume 은 여기서 아무것도 안 한다 — core 는 소리를 모른다. 'volume' 이벤트만 내고
 * 실제로 크기를 바꾸는 건 ui/app.js 다 (오디오는 브라우저 것이라 여기 들어오면 테스트가 죽는다).
 */
/**
 * 일시정지 메뉴의 줄.
 *
 * 'mute' 가 여기 있는 이유: 음소거는 **M 키뿐**이었다. 폰에는 키보드가 없으니
 * 소리를 끌 방법이 아예 없었다 — 조용한 데서 켰다가 그냥 창을 닫아야 했다.
 */
export const PAUSE_ROWS = ['resume', 'retry', 'volume', 'mute', 'title'];

/** 멈춤을 풀 수 있는 장면. 여기 아니면 Esc 를 눌러도 안 멈춘다. */
/** 지금 멈출 수 있는 장면인가. 컷신·타이틀에서는 멈춤이 없다.
 *  (ui/app.js 의 뒤로가기·화면 가림 처리도 이걸 쓴다 — 두 군데 적으면 어긋난다) */
export const pausable = (game) => game.scene === 'play' || game.scene === 'boss';

function choosePause(game) {
  const row = PAUSE_ROWS[game.pauseIndex] ?? 'resume';
  // 소리 줄들은 멈춘 채로 머문다 — 한 칸 돌리고 바로 들어보고 싶기 때문이다
  if (row === 'volume') {
    emit(game, 'volume', {});
    return;
  }
  if (row === 'mute') {
    emit(game, 'mute', {});
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

  /**
   * 히트스톱. 맞은 프레임을 몇 개 붙잡아 둬야 "닿았다"가 손에 남는다.
   *
   * **파티클과 화면 흔들림은 계속 돌린다** (위에서 이미 updateParticles 를 지났고,
   * 아래에서 카메라도 흔든다). 그게 이 기능의 핵심이다 — 전부 멈추면 게임이
   * 버벅인 것처럼 보이고, 튄 조각이 떨리는 화면 위로 흩어져야 충격으로 읽힌다.
   *
   * 판만 세운다. sceneTime·elapsedMs 는 위에서 이미 흘렀다 — 기록이 히트스톱만큼
   * 유리해지면 안 되고, 컷신 타이밍도 멈춤에 끌려가면 안 된다.
   */
  if (game.freeze > 0) {
    game.freeze -= 1;
    if (game.camera) updateCameraShake(game.camera, dt);
    return;
  }

  switch (game.scene) {
    case 'title': {
      const rows = titleRows(game);
      // 고를 게 없으면(아직 한 바퀴를 못 깼고 개발자 모드도 아니면) 예전과 똑같이 바로 시작한다
      if (rows.length < 2) {
        game.titleIndex = 0;
        if (input.confirmPressed) startRun(game);
        break;
      }
      const moved = (input.rightPressed ? 1 : 0) - (input.leftPressed ? 1 : 0);
      if (moved) game.titleIndex = (game.titleIndex + moved + rows.length) % rows.length;
      if (input.confirmPressed) {
        const pick = rows[game.titleIndex];
        if (pick?.action === 'select') {
          game.scene = 'select';
          game.sceneTime = 0;
          game.selectIndex = 0;
        } else if (pick?.action === 'hub') openHub(game);
        else if (pick?.action === 'gallery') openGallery(game, 'title');
        else if (pick?.action === 'resume') resumeRun(game, game.save.resume);
        else startRun(game);
      }
      break;
    }

    case 'cutList': {
      const cuts = CUT_PREVIEWS;
      const moved = (input.rightPressed ? 1 : 0) - (input.leftPressed ? 1 : 0);
      if (moved) game.cutIndex = (game.cutIndex + moved + cuts.length) % cuts.length;
      if (input.restartPressed) {
        game.scene = 'select';
        game.sceneTime = 0;
      } else if (input.confirmPressed) {
        previewCut(game, game.cutIndex);
      }
      break;
    }

    case 'select': {
      const slots = selectItems(game);
      const moved = (input.rightPressed ? 1 : 0) - (input.leftPressed ? 1 : 0);
      if (moved) game.selectIndex = (game.selectIndex + moved + slots.length) % slots.length;
      if (input.restartPressed) {
        game.scene = 'title';
        game.sceneTime = 0;
      } else if (input.confirmPressed) {
        const pick = slots[game.selectIndex];
        if (pick?.run) startRun(game, pick.run.index, { hard: !!pick.run.hard });
        else if (pick?.action === 'cuts') openCutList(game);
        else if (pick?.action === 'hub') openHub(game);
        else if (pick?.action === 'gallery') openGallery(game, 'select');
        else if (pick?.action === 'devOff') {
          setDevMode(game, false);
          game.scene = 'title';
          game.sceneTime = 0;
        }
      }
      break;
    }

    case 'gallery': {
      // 나가는 길. 컷신과 같은 이유로 들어온 직후 잠깐은 안 받는다 — 고른 그 입력이
      // 그대로 남아 있으면 화면이 뜨자마자 도로 닫힌다.
      if (input.restartPressed || skipping(input, game.sceneTime)) {
        game.scene = game.galleryBack === 'title' ? 'title' : 'select';
        game.sceneTime = 0;
      }
      break;
    }

    case 'intro': {
      const id = game.introCut ?? 'intro';
      const length = introCutLength(id);
      const wasIntro = game.cutsceneTime;
      game.cutsceneTime += dt;
      beat(game, id, introTimeline(id), wasIntro, game.cutsceneTime);
      if (skipping(input, game.cutsceneTime)) game.cutsceneTime = length;
      if (game.cutsceneTime >= length) {
        if (game.cutPreview != null) {
          openCutList(game);
          break;
        }
        if (id === 'hardopen') {
          // 2회차가 여기서 시작된다. startRun 이 시간·차트아웃을 지우므로 기록이 안 섞인다.
          startRun(game, 0, { hard: true });
          break;
        }
        // 컷신만 보는 중이면 판을 시작하지 않고 목록으로 돌아간다
        if (game.cutPreview != null) {
          openCutList(game);
          break;
        }
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
      // 트롤 게임이라 한 판에 수십 번 죽는다. 다 본 연출을 매번 1.5초씩 기다리게
      // 하면 그건 긴장이 아니라 그냥 지루함이다. 스테이지 카드(아래 stageIntro)가
      // 이미 쓰던 수법 그대로 — 다만 죽은 순간 눌려 있던 점프가 그대로 먹으면
      // 연출이 시작도 못 하므로 최소 시간을 둔다 (컷신의 SKIP_AFTER 와 같은 이유).
      if (game.sceneTime >= DEATH_HOLD || skipping(input, game.sceneTime)) {
        reviveAtCheckpoint(game);
      }
      break;

    case 'stageClear':
      if (game.sceneTime >= CLEAR_HOLD || skipping(input, game.sceneTime)) {
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
      if (skipping(input, game.cutsceneTime)) game.cutsceneTime = CUTSCENE_LENGTH;
      if (game.cutsceneTime >= CUTSCENE_LENGTH) loadBoss(game);
      break;
    }

    case 'boss':
      // 컷신 중에는 R 도 안 먹는다 — 연출 도중에 죽는 건 사고다
      if (input.restartPressed && !game.bossCut) killPlayer(game);
      else updateBossScene(game, input, dt);
      break;

    case 'ending':
      if (game.sceneTime > ENDING_LOCK && input.confirmPressed) {
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
  /** 주운 음표 자리. 여러 판에 걸쳐 모아도 되도록 저장 쪽(mergeRun)이 합집합으로 합친다 */
  foundNotes: game.noteMemory.toJSON(),
  timeMs: game.ending ? game.ending.timeMs : null,
  // 골라 들어간 판인지. 저장 쪽(mergeRun)이 이걸 보고 기록 갱신을 건너뛴다.
  partial: game.partial,
  /** 하드모드 판인지. 기록이 어느 칸으로 갈지 이걸로 갈린다 */
  hard: game.hard,
});

// ── 이어하기 ─────────────────────────────────────────────────
/**
 * 하던 판을 한 장으로 찍는다. 판 중이 아니면 null.
 *
 * **한 시점을 통째로 찍는 게 핵심이다.** 자리는 체크포인트에서 가져오고 숫자는
 * 나가던 순간에서 가져오면, 체크포인트 뒤에 주운 음표를 돌아와서 또 줍는다 —
 * 음표 이스터에그에서 한 번 물렸던 그 함정이다. 그래서 이걸 부르는 쪽(ui/app.js)이
 * **체크포인트를 밟는 순간과 판이 시작되는 순간**에만 찍는다. 나갈 때는 안 찍는다.
 *
 * **pausable 을 쓰면 안 된다.** 그건 「지금 멈출 수 있나」라 play·boss 뿐인데,
 * 찍는 순간의 장면은 그보다 넓다 — loadStage 는 scene 을 'stageIntro' 로 둔 채
 * 'stage' 를 알리고, 골에 닿으면 'stageClear' 다. 좁게 잡으면 그 자리에서 null 이
 * 나가고, null 은 **지우라는 뜻**이라 하던 판이 오히려 날아간다.
 */
const RUN_SCENES = new Set(['stageIntro', 'play', 'death', 'stageClear', 'boss']);

export const resumeState = (game) =>
  RUN_SCENES.has(game.scene) && game.world && !game.hubVisit && game.cutPreview == null
    ? {
        stage: game.stageIndex,
        hard: game.hard,
        boss: game.scene === 'boss',
        // 개발자 모드로 연 포탈 판. 저장엔 안 남는 값이라(createGame 주석) 여기 싣는다
        forceHub: !!game.forceHub,
        checkpoint: game.checkpoint ? { ...game.checkpoint } : null,
        elapsedMs: game.elapsedMs,
        chartOuts: game.chartOuts,
        plays: game.plays,
        score: game.score,
        defeated: game.defeated,
        partial: game.partial,
      }
    : null;

/**
 * 하던 판으로 돌아간다. **죽었다 되살아난 것과 같은 상태**로 만든다 —
 * 플레이어가 이미 아는 규칙이라 따로 설명할 게 없다.
 *
 * 순서가 중요하다. loadStage 안의 stageTable 이 game.hard 를 보고 1회차/하드 표를
 * 고르므로 **hard 를 먼저** 세워야 하고, loadStage 가 체크포인트를 시작점으로
 * 덮어쓰므로 **그 뒤에** 되돌려야 한다.
 */
export function resumeRun(game, resume) {
  if (!resume) return false;
  game.hard = !!resume.hard;
  game.partial = !!resume.partial;
  game.forceHub = !!resume.forceHub;
  game.hubVisit = false;
  game.cutPreview = null;
  game.ending = null;

  if (resume.boss) loadBoss(game);
  else loadStage(game, clamp(resume.stage ?? 0, 0, stageCount(game) - 1));

  game.elapsedMs = resume.elapsedMs ?? 0;
  game.chartOuts = resume.chartOuts ?? 0;
  game.plays = resume.plays ?? 0;
  game.score = resume.score ?? 0;
  game.defeated = resume.defeated ?? 0;

  // 보스 아레나는 체크포인트가 하나뿐(시작점)이라 되돌릴 게 없다
  if (!resume.boss && resume.checkpoint) {
    game.checkpoint = { ...resume.checkpoint };
    respawnPlayer(game.player, game.checkpoint);
    updateRank(game);
  }
  return true;
}

/**
 * 타이틀 줄에 적을 글자. 판 번호는 **표에서 꺼낸다** — 찍어둔 쪽에 번호를 또 적으면
 * 판 표를 고쳤을 때 조용히 어긋난다.
 */
export function resumeLabel(resume) {
  if (!resume) return '';
  if (resume.boss) return '이어하기 — 보스전';
  const table = resume.hard ? HARD_STAGES : STAGES;
  const number = table[resume.stage]?.number ?? 1;
  return `이어하기 — ${resume.hard ? '하드 ' : ''}STAGE ${number}`;
}
