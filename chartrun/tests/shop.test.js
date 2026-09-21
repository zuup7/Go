// 킬·데스 이펙트 상점.
//
// 이펙트는 그림이 아니라 **값**이라(data/effects.js) 브라우저 없이 확인된다 —
// 진짜로 앨범을 밟고 진짜로 죽여서 game.particles 에 뭐가 들어갔는지 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  updateGame,
  loadStage,
  titleRows,
  buyOrEquip,
  shopItems,
  shopPoints,
} from '../src/core/game.js';
import { emptySave, mergeRun, serialize, deserialize, SAVE_VERSION } from '../src/core/save.js';
import {
  KILLS,
  DEATHS,
  SHOP_ITEMS,
  DEFAULT_FX,
  points,
  earned,
  spent,
  owns,
  canBuy,
  fxOf,
  sanitizeFx,
} from '../src/data/effects.js';

const DT = 1 / 60;
const idle = (over = {}) => ({
  left: false,
  right: false,
  jump: false,
  jumpPressed: false,
  leftPressed: false,
  rightPressed: false,
  throwPressed: false,
  dashPressed: false,
  confirmPressed: false,
  restartPressed: false,
  pausePressed: false,
  mutePressed: false,
  anyPressed: false,
  ...over,
});
const step = (game, input = idle(), n = 1) => {
  for (let i = 0; i < n; i++) updateGame(game, input, DT);
};
const rich = (over = {}) =>
  createGame({ seed: 7, save: { ...emptySave(), seenOpening: true, clears: 9, ...over } });

const uidOf = (slot, id) => `${slot}:${id}`;

// ── 점수 ────────────────────────────────────────────────────

test('완주하면 한 번씩 센다. 하드는 2점 더', () => {
  let save = emptySave();
  save = mergeRun(save, { clearedOnce: true });
  assert.equal(save.clears, 1);
  assert.equal(earned(save), 1);

  save = mergeRun(save, { clearedOnce: true, clearedHard: true });
  assert.equal(save.clears, 2);
  assert.equal(save.hardClears, 1);
  assert.equal(earned(save), 2 + 2, '하드 완주가 2점을 더 안 준다');
});

test('골라 들어간 판은 안 센다 — 보스만 이겨서 점수를 찍어내면 안 된다', () => {
  // 개발자 모드로 보스만 골라 이겨도 엔딩으로 이어진다. 그게 세지면
  // 스테이지 선택으로 점수를 무한히 만들 수 있다 (기록을 안 갱신하는 것과 같은 판단)
  const save = mergeRun(emptySave(), { clearedOnce: true, partial: true });
  assert.equal(save.clears, 0, `골라 들어간 판이 ${save.clears}회로 세어졌다`);
  assert.equal(earned(save), 0);
});

test('점수는 번 것 − 산 것들의 값이다', () => {
  const save = { ...emptySave(), clears: 3 };
  assert.equal(points(save), 3);

  const paid = SHOP_ITEMS.find((i) => i.cost > 0);
  const after = { ...save, owned: [paid.uid] };
  assert.equal(spent(after), paid.cost);
  assert.equal(points(after), 3 - paid.cost);
});

test('값 0 짜리는 처음부터 가진 것이고 점수를 안 먹는다', () => {
  const save = emptySave();
  assert.ok(owns(save, uidOf('kill', 'base')));
  assert.ok(owns(save, uidOf('death', 'base')));
  assert.equal(spent({ ...save, owned: [uidOf('kill', 'base')] }), 0);
});

test('이미 깬 사람은 0점으로 시작하지 않는다', () => {
  // 완주 횟수는 상점을 만들며 생긴 칸이라 그 전에 깬 사람 저장엔 없다.
  // 그대로 두면 다 깨고 온 사람이 값만 적힌 빈 상점을 본다.
  const old = { ...emptySave(), clearedOnce: true, clearedHard: true };
  delete old.clears;
  delete old.hardClears;
  const loaded = deserialize(JSON.stringify({ version: SAVE_VERSION, data: old }));
  assert.equal(loaded.clears, 1);
  assert.equal(loaded.hardClears, 1);
  assert.equal(earned(loaded), 3);
});

test('세던 값이 있으면 안 덮어쓴다 — 메우는 건 한 번뿐이다', () => {
  const many = { ...emptySave(), clearedOnce: true, clears: 8, hardClears: 2 };
  const loaded = deserialize(JSON.stringify({ version: SAVE_VERSION, data: many }));
  assert.equal(loaded.clears, 8);
  assert.equal(loaded.hardClears, 2);
});

// ── 사기 ────────────────────────────────────────────────────

test('사면 점수가 줄고 바로 끼워진다', () => {
  const game = rich();
  const at = SHOP_ITEMS.findIndex((i) => i.id === 'note');
  const before = shopPoints(game);
  assert.ok(buyOrEquip(game, at), '살 수 있는데 안 사진다');
  assert.equal(shopPoints(game), before - SHOP_ITEMS[at].cost);
  assert.equal(game.save.fx.kill, 'note', '샀는데 안 끼워진다');
});

test('점수가 모자라면 안 사진다', () => {
  const game = createGame({ seed: 1, save: { ...emptySave(), seenOpening: true } }); // 0점
  const at = SHOP_ITEMS.findIndex((i) => i.cost > 0);
  assert.equal(buyOrEquip(game, at), false);
  assert.deepEqual(game.save.owned, [], '점수도 없는데 샀다');
  assert.deepEqual(game.save.fx, DEFAULT_FX, '못 샀는데 끼워졌다');
  assert.ok(game.shopDenied > 0, '못 샀다는 걸 화면에 안 알린다');
});

test('이미 산 걸 다시 눌러도 점수가 또 빠지지 않는다', () => {
  const game = rich();
  const at = SHOP_ITEMS.findIndex((i) => i.id === 'heart');
  buyOrEquip(game, at);
  const after = shopPoints(game);
  buyOrEquip(game, at);
  assert.equal(shopPoints(game), after, '같은 걸 두 번 사졌다');
  assert.equal(game.save.owned.filter((u) => u === SHOP_ITEMS[at].uid).length, 1);
});

test('가진 것으로 점수를 다 쓰면 더는 못 산다', () => {
  const game = createGame({ seed: 2, save: { ...emptySave(), seenOpening: true, clears: 1 } });
  const paid = SHOP_ITEMS.filter((i) => i.cost > 0);
  assert.ok(buyOrEquip(game, SHOP_ITEMS.indexOf(paid[0])));
  assert.equal(shopPoints(game), 1 - paid[0].cost);
  assert.equal(canBuy(game.save, paid[1].uid), false, '점수를 다 썼는데 또 살 수 있다');
});

// ── 저장값이 이상할 때 ──────────────────────────────────────

test('없는 이펙트를 끼워둔 저장은 기본으로 되돌아간다', () => {
  // 그대로 두면 fxOf 가 undefined 를 주고 **밟아도 아무것도 안 튄다** — 조용히 깨진다
  const game = createGame({
    seed: 1,
    save: { ...emptySave(), fx: { kill: '없는것', death: 'heart' } },
  });
  assert.equal(game.save.fx.kill, 'base');
  assert.equal(game.save.fx.death, 'base', '안 산 걸 끼워둔 것도 되돌려야 한다');
  assert.ok(fxOf(game.save, 'kill'), '이펙트를 못 찾는다');
});

test('산 것은 끼운 채로 남는다', () => {
  const save = { ...emptySave(), clears: 5, owned: [uidOf('death', 'heart')], fx: { kill: 'base', death: 'heart' } };
  assert.equal(sanitizeFx(save).death, 'heart');
  const back = deserialize(serialize(save));
  assert.deepEqual(back.owned, [uidOf('death', 'heart')]);
});

test('목록에 없는 id 가 저장에 남아 있으면 걷어낸다', () => {
  const save = { ...emptySave(), owned: ['kill:없는것', uidOf('kill', 'note'), uidOf('kill', 'note')] };
  const loaded = deserialize(JSON.stringify({ version: SAVE_VERSION, data: save }));
  assert.deepEqual(loaded.owned, [uidOf('kill', 'note')], '쓰레기가 남거나 중복이 센다');
});

// ── 진짜로 밟고 진짜로 죽어본다 ─────────────────────────────

/** 스테이지 1 에서 굴러가는 상태로 */
function inStage(save) {
  const game = createGame({ seed: 11, save: { ...emptySave(), seenOpening: true, ...save } });
  loadStage(game, 0);
  step(game, idle(), 200);
  assert.equal(game.scene, 'play');
  return game;
}

/** 제일 가까운 앨범을 밟는다 */
function stompOne(game) {
  const album = game.albums.find((a) => a.alive);
  assert.ok(album, '밟을 앨범이 없다');
  game.particles.length = 0;
  // 앨범 바로 위에서 내려온다 — isStomp 는 「위에서 아래로」를 본다
  game.player.x = album.x;
  game.player.y = album.y - game.player.h + 2;
  game.player.vy = 200;
  game.player.onGround = false;
  step(game, idle(), 1);
  return album;
}

test('밟으면 **끼운 킬 이펙트**가 튄다', () => {
  const note = KILLS.find((k) => k.id === 'note');
  const game = inStage({ clears: 9, owned: ['kill:note'], fx: { kill: 'note', death: 'base' } });
  stompOne(game);
  assert.ok(game.particles.length > 0, '밟았는데 아무것도 안 튄다');
  assert.equal(game.particles.length, note.count, `${note.count}개여야 하는데 ${game.particles.length}개다`);
  for (const p of game.particles) {
    assert.equal(p.shape, 'note', '모양이 음표가 아니다');
    assert.ok(note.colors.includes(p.color), `${p.color} 는 이 이펙트 색이 아니다`);
  }
});

test('아무것도 안 산 사람은 예전 그대로 — 밟힌 앨범 색이 튄다', () => {
  const game = inStage({});
  const album = stompOne(game);
  assert.ok(game.particles.length > 0);
  for (const p of game.particles) {
    assert.ok(album.def.palette.includes(p.color), `${p.color} 가 앨범 색이 아니다`);
    assert.equal(p.shape, undefined, '기본인데 모양이 붙었다');
  }
});

test('양옆으로 나눠 튀어도 **개수는 적어둔 그대로**다', () => {
  // 한쪽만 세면 산 사람이 두 배를 보게 된다
  for (const kill of KILLS.filter((k) => k.split)) {
    const game = inStage({ clears: 9, owned: [`kill:${kill.id}`], fx: { kill: kill.id, death: 'base' } });
    stompOne(game);
    assert.equal(game.particles.length, kill.count, `${kill.label}: ${game.particles.length}개가 튄다`);
  }
});

test('죽으면 **끼운 데스 이펙트**가 튄다', () => {
  const heart = DEATHS.find((d) => d.id === 'heart');
  const game = inStage({ clears: 9, owned: ['death:heart'], fx: { kill: 'base', death: 'heart' } });
  game.particles.length = 0;
  // 구덩이로 떨어뜨린다 — 진짜 죽는 길로 간다
  game.player.y = game.world.pixelHeight + 50;
  step(game, idle(), 2);
  assert.equal(game.scene, 'death', '안 죽었다');
  assert.equal(game.particles.length, heart.count);
  for (const p of game.particles) {
    assert.equal(p.shape, 'heart');
    assert.ok(heart.colors.includes(p.color));
  }
});

test('승천은 위로 오른다 — 중력이 음수다', () => {
  const game = inStage({ clears: 9, owned: ['death:soul'], fx: { kill: 'base', death: 'soul' } });
  game.particles.length = 0;
  game.player.y = game.world.pixelHeight + 50;
  step(game, idle(), 2);
  assert.ok(game.particles.length > 0);
  for (const p of game.particles) assert.ok(p.gravity < 0, `중력이 ${p.gravity} 라 떨어진다`);
});

// ── 화면 ────────────────────────────────────────────────────

test('타이틀에서 상점으로 들어가고 뒤로 나온다', () => {
  const game = rich();
  const at = titleRows(game).findIndex((r) => r.action === 'shop');
  assert.ok(at >= 0, '타이틀에 상점 줄이 없다');
  game.titleIndex = at;
  step(game, idle({ confirmPressed: true }));
  assert.equal(game.scene, 'shop');

  // 폰에는 R 키가 없다. 여기가 막히면 이 화면에서 갇힌다
  step(game, idle({ restartPressed: true }));
  assert.equal(game.scene, 'title');
});

test('◀▶ 로 칸을 옮기고 양쪽 끝에서 돌아온다', () => {
  const game = rich();
  game.scene = 'shop';
  game.shopIndex = 0;
  step(game, idle({ leftPressed: true }));
  assert.equal(game.shopIndex, SHOP_ITEMS.length - 1, '왼쪽 끝에서 안 돌아온다');
  step(game, idle({ rightPressed: true }));
  assert.equal(game.shopIndex, 0);
});

test('목록이 폰 화면 안에 들어간다 — 「뒤로」가 밀려나면 갇힌다', () => {
  // 컷신 보기와 같은 규칙이다 (4줄 × 3칸)
  assert.ok(SHOP_ITEMS.length <= 12, `칸이 ${SHOP_ITEMS.length}개면 넷으로 늘어 화면 밖으로 나간다`);
  for (const i of SHOP_ITEMS) {
    assert.ok(i.label.length <= 10, `「${i.label}」 이 길어서 세 칸에 안 들어간다`);
  }
});

test('상점 목록은 core 가 갖고 있다 — 화면이 따로 적으면 엉뚱한 게 팔린다', () => {
  assert.deepEqual(
    shopItems().map((i) => i.uid),
    SHOP_ITEMS.map((i) => i.uid),
  );
  assert.equal(shopItems().length, KILLS.length + DEATHS.length);
});
