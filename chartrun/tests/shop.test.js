// 킬·데스 이펙트 상점.
//
// 이펙트는 그림이 아니라 **값**이라(data/effects.js) 브라우저 없이 확인된다 —
// 진짜로 앨범을 밟고 진짜로 죽여서 game.particles 에 뭐가 들어갔는지 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createGame,
  updateGame,
  loadStage,
  titleRows,
  buyOrEquip,
  shopItems,
  shopPoints,
  shopPointsText,
  setDevMode,
  npcSays,
  npcAction,
  npcInReach,
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
  FX_SLOTS,
} from '../src/data/effects.js';
import { PARTICLE_ART, frameOf, spriteFor } from '../src/render/particleArt.js';

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

// ── 개발자 모드 ─────────────────────────────────────────────
//
// 만든 사람이 이펙트를 훑어보려고 완주를 열세 번 할 수는 없다.
// **사는 게 아니라 써보는 것**이다 — 끄면 진짜 산 것만 남아야 한다.

test('개발자 모드면 점수가 0이어도 전부 끼워진다', () => {
  const game = createGame({ seed: 3, save: { ...emptySave(), seenOpening: true, dev: true } });
  assert.equal(shopPoints(game), 0, '점수가 있으면 이 테스트가 아무것도 안 지킨다');
  for (const item of SHOP_ITEMS) {
    assert.ok(owns(game.save, item.uid), `${item.label} 이 잠겨 있다`);
  }
  const at = SHOP_ITEMS.findIndex((i) => i.id === 'disc');
  assert.ok(buyOrEquip(game, at), '개발자 모드인데 안 끼워진다');
  assert.equal(game.save.fx.death, 'disc');
});

test('개발자 모드로 끼운 건 **안 산 것**이다 — owned 도 점수도 그대로', () => {
  const game = createGame({ seed: 3, save: { ...emptySave(), seenOpening: true, dev: true, clears: 4 } });
  const before = shopPoints(game);
  buyOrEquip(game, SHOP_ITEMS.findIndex((i) => i.id === 'ring'));
  buyOrEquip(game, SHOP_ITEMS.findIndex((i) => i.id === 'bubble'));
  assert.deepEqual(game.save.owned, [], `개발자 모드인데 ${game.save.owned} 를 샀다`);
  assert.equal(shopPoints(game), before, '점수가 깎였다');
});

test('개발자 모드를 끄면 안 산 건 기본으로 돌아간다', () => {
  // 이게 핵심이다. 안 되돌리면 개발자 모드로 끼운 걸 끄고도 공짜로 쓴다
  const game = createGame({ seed: 3, save: { ...emptySave(), seenOpening: true, clears: 1 } });
  setDevMode(game, true);
  buyOrEquip(game, SHOP_ITEMS.findIndex((i) => i.id === 'ring'));
  assert.equal(game.save.fx.kill, 'ring');

  setDevMode(game, false);
  assert.equal(game.save.fx.kill, 'base', '개발자 모드를 껐는데 안 산 게 그대로 끼워져 있다');
  assert.deepEqual(game.save.owned, []);
});

test('진짜 산 것은 개발자 모드를 꺼도 남는다', () => {
  const game = createGame({ seed: 3, save: { ...emptySave(), seenOpening: true, clears: 3 } });
  buyOrEquip(game, SHOP_ITEMS.findIndex((i) => i.id === 'heart' && true)); // 킬·하트
  const bought = [...game.save.owned];
  assert.equal(bought.length, 1, '안 샀다');
  setDevMode(game, true);
  setDevMode(game, false);
  assert.deepEqual(game.save.owned, bought, '산 게 날아갔다');
  assert.equal(game.save.fx.kill, 'heart', '산 건 끼운 채로 남아야 한다');
});

test('점수 표시는 개발자 모드에서 ∞ 다', () => {
  const plain = createGame({ seed: 3, save: { ...emptySave(), clears: 2 } });
  assert.equal(shopPointsText(plain), '2');
  const dev = createGame({ seed: 3, save: { ...emptySave(), clears: 2, dev: true } });
  assert.equal(shopPointsText(dev), '∞', '왜 다 되는지 화면이 말해주지 않는다');
});

// ── 모양 ────────────────────────────────────────────────────

test('모양 이름마다 진짜 그림이 있다 — 양쪽 다', () => {
  // data 에만 적고 그림을 안 이으면 **모양 이름만 붙고 아무것도 안 그려진다**.
  // 반대로 그림만 있고 쓰는 데가 없으면 죽은 코드다.
  const used = new Set(SHOP_ITEMS.map((i) => i.shape).filter(Boolean));
  const drawn = new Set(Object.keys(PARTICLE_ART));
  for (const name of used) assert.ok(drawn.has(name), `${name} 에 그림이 없다`);
  for (const name of drawn) assert.ok(used.has(name), `${name} 그림을 쓰는 이펙트가 없다`);
});

test('값을 낸 이펙트는 **제 그림**이 있다 — 색만 다른 네모가 아니다', () => {
  // 「좀더 개성있게, 티나게」가 이 줄이다. 값을 받고 네모를 주면 안 된다.
  for (const item of SHOP_ITEMS) {
    if (item.cost === 0) continue; // 기본 둘은 네모 그대로가 맞다
    assert.ok(item.shape, `${item.slot}·${item.label} 에 모양이 없다 — 색만 다른 네모다`);
  }
});

test('그림 한 장짜리로 퇴화하지 않았나 — 여러 장이라야 개성이 산다', () => {
  const many = Object.entries(PARTICLE_ART).filter(([, a]) => a.rows.length > 1);
  assert.ok(many.length >= 8, `여러 장짜리가 ${many.length}개뿐이다`);
});

test('모든 그림이 네모반듯하다 — 줄이 들쑥날쑥하면 그 장만 옆으로 밀린다', () => {
  for (const [name, art] of Object.entries(PARTICLE_ART)) {
    art.rows.forEach((rows, i) => {
      const widths = new Set(rows.map((r) => r.length));
      assert.equal(widths.size, 1, `${name} ${i}번 장의 줄 길이가 ${[...widths]} 로 다르다`);
      assert.ok(rows[0].length <= 10, `${name} 이 ${rows[0].length}px — 알갱이로는 너무 크다`);
    });
  }
});

test("by: 'life' 는 닳으면서 장이 넘어가고, 끝에서 멈춘다", () => {
  // 마지막 장에서 안 멈추면 다 닳는 순간 첫 장으로 되돌아가 깜빡인다
  const art = PARTICLE_ART.bubble;
  const at = (l) => frameOf(art, { life: l, max: 1 });
  assert.equal(at(1), 0, '갓 나온 알갱이가 첫 장이 아니다');
  assert.ok(at(0.5) > at(1), '중간인데 안 넘어갔다');
  assert.equal(at(0.001), art.rows.length - 1, '끝에서 마지막 장이 아니다');
  assert.equal(at(0), art.rows.length - 1, '다 닳으면 첫 장으로 되돌아간다');
});

test("by: 'seed' 는 알갱이마다 갈린다", () => {
  const art = PARTICLE_ART.petal;
  const picks = new Set([0, 1, 2, 3, 4, 5].map((seed) => frameOf(art, { seed })));
  assert.equal(picks.size, art.rows.length, `${art.rows.length}장인데 ${picks.size}가지만 나온다`);
});

test('같은 (이름·장·색) 이면 **같은 객체**다', () => {
  // bake() 가 스프라이트 객체를 열쇠로 캐시한다. 매번 새로 만들면
  // 알갱이마다 캔버스를 새로 굽는다 (꾸미기의 spritesFor 와 같은 이유)
  assert.equal(spriteFor('petal', 0, '#ff5d8f'), spriteFor('petal', 0, '#ff5d8f'));
  assert.notEqual(spriteFor('petal', 0, '#ff5d8f'), spriteFor('petal', 0, '#ffd166'));
  assert.notEqual(spriteFor('petal', 0, '#ff5d8f'), spriteFor('petal', 1, '#ff5d8f'));
});

test('그림에 **이펙트 색이 입혀진다** — 팔레트가 박혀 있으면 다섯 색이 한 색이 된다', () => {
  const spr = spriteFor('petal', 0, '#39ff9a');
  assert.equal(spr.palette.o, '#39ff9a');
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
  // 숫자를 박아두지 않고 **CSS 에서 읽는다.** 줄 수를 늘리면 여기도 같이 늘어야
  // 하는데, 따로 적어두면 한쪽만 고치는 날 화면과 어긋난다.
  const css = readFileSync(new URL('../assets/style.css', import.meta.url), 'utf8');
  const rows = Number(css.match(/\.slots\.shop-slots\s*\{[^}]*--slot-rows:\s*(\d+)/)?.[1]);
  assert.ok(rows > 0, 'CSS 에 .slots.shop-slots 의 --slot-rows 가 없다');

  // **묶음마다 따로 흘러간다.** 한 목록이 아니라 킬·데스가 제 머리말 밑에서
  // 각자 칸을 만든다 — 그래서 전체 개수가 아니라 **묶음별로** 재야 한다.
  // 묶음당 두 칸까지 (둘이니 화면 전체로는 넉 칸, 컷신 목록에서 본 그 한계다).
  let cols = 0;
  for (const slot of FX_SLOTS) {
    const need = Math.ceil(slot.items.length / rows);
    assert.ok(
      need <= 2,
      `「${slot.label}」 이 ${slot.items.length}개면 ${rows}줄로 ${need}칸이 되어 넘친다`,
    );
    cols += need;
  }
  assert.ok(cols <= 4, `칸이 ${cols}개면 폰 가로폭을 넘는다`);

  // **세로가 더 아슬아슬하다.** 844×390 에서 패널이 이미 320px 를 쓰는데
  // 머리말 한 줄이 더 붙었다
  assert.ok(rows <= 4, `${rows}줄에 머리말까지면 「뒤로」가 화면 밖으로 밀린다`);

  // 앞머리(킬·/데스·)를 뗐으니 이름이 짧아졌다. 그만큼 기준도 조인다 —
  // 느슨하게 두면 다시 길어져도 모른다
  for (const i of SHOP_ITEMS) {
    assert.ok(i.label.length <= 4, `「${i.label}」 이 길어서 네 칸에 안 들어간다`);
  }
});

test('상점 목록은 core 가 갖고 있다 — 화면이 따로 적으면 엉뚱한 게 팔린다', () => {
  assert.deepEqual(
    shopItems().map((i) => i.uid),
    SHOP_ITEMS.map((i) => i.uid),
  );
  assert.equal(shopItems().length, KILLS.length + DEATHS.length);
});


// ── 좌판 아줌마 ─────────────────────────────────────────────
//
// 타이틀의 「상점」 줄은 빠른 길이고, 이 사람은 **세계 안의 입구**다.
// 둘 다 같은 화면으로 가지만, 이쪽은 판 위에 있어서 틀어질 구석이 많다 —
// 노인과 같은 판(npcs)을 타는데 하는 일이 정반대이기 때문이다.

/** 스테이지 1 에서 굴러가는 상태로 (hard.test.js 의 inStage1 과 같은 수법) */
function inStage1(over = {}) {
  const game = createGame({ seed: 5, save: { ...emptySave(), seenOpening: true, ...over } });
  loadStage(game, 0);
  step(game, idle(), 200);
  assert.equal(game.scene, 'play');
  return game;
}

const merchantOf = (game) => game.world.npcs.find((n) => n.kind === 'shop');
const elderOf = (game) => game.world.npcs.find((n) => n.kind === 'portal');

test('스테이지 1 에 상인이 앉아 있다 — 노인과 별개다', () => {
  const game = inStage1();
  const m = merchantOf(game);
  const e = elderOf(game);
  assert.ok(m, '판에 상인이 없다');
  assert.ok(e, '판에 노인이 없다');
  assert.notEqual(m, e, '둘이 같은 사람이다');
  assert.equal(npcSays(game, m), 'talkShop');
  assert.equal(npcAction(game, m), 'shop');
});

// 좌표를 꽂는 테스트만으로는 **진짜로 걸어가서 닿는지**를 못 본다.
// 노인이 바로 그것 때문에 한 칸 떠 있었고, 걸어서는 영영 말이 안 걸렸다.
test('스폰에서 걸어가기만 해도 상인에게 닿는다', () => {
  const game = inStage1();
  const m = merchantOf(game);
  for (let i = 0; i < 600 && !m.near; i++) step(game, idle({ right: true }), 1);
  assert.ok(
    m.near,
    `바닥으로 걸어가면 좌판에 안 닿는다 (플레이어 y ${Math.round(game.player.y)}, 상인 y ${m.y})`,
  );
});

test('상인에게 말을 걸면 상점이 열린다', () => {
  const game = inStage1();
  const m = merchantOf(game);
  game.player.x = m.x;
  game.player.y = m.y;
  step(game, idle(), 1);
  assert.equal(npcInReach(game), m, '좌판 앞인데 말을 못 건다');

  step(game, idle({ confirmPressed: true }), 1);
  assert.equal(game.scene, 'shop', '말을 걸었는데 상점이 안 열렸다');
  assert.equal(game.shopIndex, 0, '목록 첫 칸부터 안 보여준다');
});

// 이 하나가 「노인과 안 섞였나」를 본다. kind 를 빼면 여기가 빨개진다.
test('상인은 하드모드 문을 못 연다', () => {
  const game = inStage1({ clearedOnce: true });
  const m = merchantOf(game);
  game.player.x = m.x;
  game.player.y = m.y;
  step(game, idle({ confirmPressed: true }), 1);

  assert.equal(m.opened, false, '상인이 문을 열어준 셈이 됐다');
  // 화면은 상점으로 갔지만 판은 그대로 있다 — 문이 열렸는지 그 자리에서 본다
  assert.equal(game.world.portals[0].open, false, '상인에게 말을 걸었는데 문이 열렸다');
  assert.equal(game.npcTalk, null, '상인이 판을 멈추는 대화를 시작했다');
});

test('상점에서 나가면 서 있던 판으로 돌아온다 — 타이틀로 떨어지면 판이 날아간다', () => {
  const game = inStage1();
  const m = merchantOf(game);
  game.player.x = m.x;
  game.player.y = m.y;
  step(game, idle({ confirmPressed: true }), 1);
  assert.equal(game.scene, 'shop');

  step(game, idle({ restartPressed: true }), 1);
  assert.equal(game.scene, 'play', '상인에게 들렀다 나왔더니 타이틀이다');

  // 타이틀에서 들어간 것은 타이틀로 — 같은 화면인데 나가는 문이 다르다
  const t = rich();
  t.scene = 'title';
  t.titleIndex = titleRows(t).findIndex((r) => r.action === 'shop');
  step(t, idle({ confirmPressed: true }), 1);
  assert.equal(t.scene, 'shop');
  step(t, idle({ restartPressed: true }), 1);
  assert.equal(t.scene, 'title');
});

test('지나가면 저 혼자 한 마디 — 판은 안 멈춘다', () => {
  const game = inStage1();
  const m = merchantOf(game);
  game.player.x = m.x;
  game.player.y = m.y;
  step(game, idle(), 2);
  assert.ok(game.npcHint, '좌판을 지나는데 아무 말이 없다');
  assert.equal(game.npcHint.id, 'talkShop');
  assert.equal(game.npcTalk, null, '스쳐가는 한 마디가 판을 멈췄다');
  // **누가 한 말인지 들고 있어야 한다** — 안 그러면 말풍선이 노인 머리 위에 뜬다
  assert.equal(game.npcHint.npc, m, '말풍선이 누구 것인지 모른다');

  const px = game.player.x;
  step(game, idle({ right: true }), 12);
  assert.ok(game.player.x > px, '말풍선이 떴다고 판이 멈췄다');
});

test('스쳐 지나간 뒤에도 눌러서 열 수 있다 — 한 마디 했다고 잠기면 안 된다', () => {
  const game = inStage1();
  const m = merchantOf(game);
  game.player.x = m.x;
  game.player.y = m.y;
  step(game, idle(), 2);
  assert.ok(m.said, '한 마디도 안 했다');

  // said 가 선 채로도 말이 걸려야 한다 (노인은 여기서 잠긴다 — 문은 한 번뿐이므로)
  assert.equal(npcInReach(game), m, '한 마디 하고 나니 좌판이 닫혔다');
  step(game, idle({ confirmPressed: true }), 1);
  assert.equal(game.scene, 'shop');
});
