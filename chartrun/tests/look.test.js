// 주인공 꾸미기 — 머리 한 벌 + 옷 색 + 바지 색.
//
// 제일 중요한 건 두 가지다.
//   1. 고른 게 **판에서도 컷신에서도** 같이 나오나 (playerFrame 은 일곱 군데서 불린다)
//   2. 저장값이 이상해도 주인공이 안 사라지나
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, updateGame, titleRows } from '../src/core/game.js';
import { emptySave, deserialize, serialize, SAVE_VERSION } from '../src/core/save.js';
import {
  HAIRS,
  JACKETS,
  PANTS,
  LOOK_SLOTS,
  DEFAULT_LOOK,
  sanitizeLook,
  cycleLook,
  lookKey,
} from '../src/data/looks.js';
import { spritesFor, playerFrame, PLAYER_SPRITES, setLook } from '../src/render/sprites.js';

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
/** 오프닝을 본 사람 (그래야 타이틀에 꾸미기가 나온다) */
const seen = (over = {}) => createGame({ seed: 3, save: { ...emptySave(), seenOpening: true, ...over } });

// ── 데이터 ──────────────────────────────────────────────────

test('머리 목록과 그림이 서로 빠짐없이 맞는다', () => {
  // data/looks.js 는 이름만 갖고 render/sprites.js 가 그림을 갖는다 (core 는 DOM 을
  // 못 본다). 한쪽만 고치면 **고를 수는 있는데 안 그려지는** 머리가 생긴다.
  for (const hair of HAIRS) {
    const set = spritesFor({ ...DEFAULT_LOOK, hair: HAIRS.indexOf(hair) });
    assert.ok(set.frames.stand, `${hair.label} 의 그림이 없다`);
    assert.equal(set.frames.stand.w, 12, `${hair.label} 의 너비가 다르다`);
    assert.equal(set.frames.stand.h, 16, `${hair.label} 의 높이가 다르다`);
  }
});

test('머리마다 그림이 실제로 다르다', () => {
  // 이름만 늘리고 그림을 안 그리면 「고를 수는 있는데 다 똑같은」 게 된다
  const shots = new Set(
    HAIRS.map((_, i) => spritesFor({ ...DEFAULT_LOOK, hair: i }).frames.stand.rows.join('')),
  );
  assert.equal(shots.size, HAIRS.length, `머리가 ${HAIRS.length}개인데 그림은 ${shots.size}가지다`);
});

test('옷·바지 색이 실제로 팔레트에 박힌다', () => {
  for (let i = 0; i < JACKETS.length; i++) {
    assert.equal(spritesFor({ ...DEFAULT_LOOK, jacket: i }).frames.stand.palette.j, JACKETS[i].color);
  }
  for (let i = 0; i < PANTS.length; i++) {
    assert.equal(spritesFor({ ...DEFAULT_LOOK, pants: i }).frames.stand.palette.p, PANTS[i].color);
  }
});

test('아무것도 안 고른 사람은 예전과 똑같이 보인다', () => {
  const now = spritesFor(DEFAULT_LOOK).frames;
  for (const [name, spr] of Object.entries(PLAYER_SPRITES)) {
    assert.equal(spr.rows.join('|'), now[name].rows.join('|'), `${name} 이 달라졌다`);
  }
});

test('같은 차림새면 **같은 객체**를 돌려준다', () => {
  // bake() 가 스프라이트 객체를 열쇠로 캐시한다. 매번 새로 만들면 그 캐시가
  // 매 프레임 헛돌아 여덟 장을 계속 다시 굽는다.
  const a = spritesFor({ hair: 1, jacket: 2, pants: 3 });
  const b = spritesFor({ hair: 1, jacket: 2, pants: 3 });
  assert.equal(a, b);
  assert.notEqual(a, spritesFor({ hair: 2, jacket: 2, pants: 3 }));
});

// ── 이상한 저장값 ───────────────────────────────────────────

test('저장값이 이상해도 주인공이 안 사라진다', () => {
  // 범위 밖 번호를 그대로 쓰면 그림이 undefined 가 되어 **아무것도 안 그려진다**
  for (const bad of [null, undefined, {}, { hair: 99 }, { hair: -1 }, { jacket: 1.7 }, { pants: 'x' }]) {
    const l = sanitizeLook(bad);
    for (const slot of LOOK_SLOTS) {
      assert.ok(l[slot.key] >= 0 && l[slot.key] < slot.items.length, `${JSON.stringify(bad)} → ${l[slot.key]}`);
    }
    assert.ok(spritesFor(bad).frames.stand, `${JSON.stringify(bad)} 로 그림을 못 만든다`);
  }
});

test('look 칸이 없는 옛 저장도 안 깨진다', () => {
  const old = { ...emptySave() };
  delete old.look;
  const loaded = deserialize(JSON.stringify({ version: SAVE_VERSION, data: old }));
  const game = createGame({ seed: 1, save: loaded });
  assert.deepEqual(game.save.look, DEFAULT_LOOK);
});

test('망가진 저장값은 게임을 만들 때 걸러진다', () => {
  // 항목을 줄이면 이미 저장된 번호가 범위 밖으로 나간다. 그대로 쓰면 그 사람은
  // **주인공이 안 그려지는** 게임을 켜게 된다 — 켜자마자 못 쓴다.
  const game = createGame({ seed: 1, save: { ...emptySave(), look: { hair: 99, jacket: -3, pants: 'x' } } });
  assert.deepEqual(game.save.look, DEFAULT_LOOK);
  assert.ok(spritesFor(game.save.look).frames.stand, '이 차림새로는 그림이 안 나온다');
});

test('고른 건 저장에 남는다', () => {
  const game = seen();
  game.save.look = cycleLook(game.save.look, 'jacket', 2);
  const back = deserialize(serialize(game.save));
  assert.equal(back.look.jacket, 2);
});

// ── 고르기 ──────────────────────────────────────────────────

test('양쪽 끝에서 돌아온다', () => {
  assert.equal(cycleLook({ ...DEFAULT_LOOK, jacket: 0 }, 'jacket', -1).jacket, JACKETS.length - 1);
  assert.equal(cycleLook({ ...DEFAULT_LOOK, jacket: JACKETS.length - 1 }, 'jacket', 1).jacket, 0);
});

test('타이틀에서 꾸미기로 들어가고 뒤로 나온다', () => {
  const game = seen();
  const at = titleRows(game).findIndex((r) => r.action === 'look');
  assert.ok(at >= 0, '타이틀에 꾸미기 줄이 없다');
  game.titleIndex = at;
  step(game, idle({ confirmPressed: true }));
  assert.equal(game.scene, 'look');

  // 폰에는 R 키가 없다. 「뒤로」가 막히면 이 화면에서 갇힌다
  step(game, idle({ restartPressed: true }));
  assert.equal(game.scene, 'title');
});

test('처음 켠 사람에게는 안 보인다 — 첫 화면은 메뉴 없이 바로 시작이다', () => {
  const fresh = createGame({ seed: 1, save: emptySave() });
  assert.deepEqual(titleRows(fresh).map((r) => r.action), ['start']);
});

test('◀▶ 로 그 줄을 바꾸고, 점프로 다음 줄로 간다', () => {
  const game = seen();
  game.scene = 'look';
  game.lookIndex = 0; // 머리

  step(game, idle({ rightPressed: true }));
  assert.equal(game.save.look.hair, 1, '오른쪽을 눌렀는데 안 바뀐다');
  step(game, idle({ leftPressed: true }));
  assert.equal(game.save.look.hair, 0, '왼쪽으로 안 돌아온다');

  step(game, idle({ confirmPressed: true }));
  assert.equal(game.lookIndex, 1, '점프로 다음 줄에 안 간다');
  step(game, idle({ rightPressed: true }));
  assert.equal(game.save.look.jacket, 1, '줄을 옮겼는데 엉뚱한 칸이 바뀐다');
  assert.equal(game.save.look.hair, 0, '옮기기 전 줄까지 같이 바뀐다');
});

test('줄은 한 바퀴 돈다 — 마지막 줄에서 점프하면 첫 줄로', () => {
  const game = seen();
  game.scene = 'look';
  game.lookIndex = LOOK_SLOTS.length - 1;
  step(game, idle({ confirmPressed: true }));
  assert.equal(game.lookIndex, 0);
});

// ── 판과 컷신이 같은 걸 본다 ────────────────────────────────

test('setLook 한 번이면 playerFrame 이 전부 그 차림새로 나온다', () => {
  // playerFrame 은 판에서 둘, 컷신에서 다섯 번 불린다. 인자로 넘기지 않는 이유가
  // 이것이다 — 한 군데만 빠뜨리면 「판에서는 꾸민 대로인데 결혼식에서는 원래 옷」
  const look = { hair: 1, jacket: 3, pants: 2 };
  setLook(look);
  const want = spritesFor(look).frames;
  const states = [
    { onGround: true, vx: 0, vy: 0, dashTime: 0, stride: 0 },
    { onGround: true, vx: 90, vy: 0, dashTime: 0, stride: 20 },
    { onGround: false, vx: 0, vy: -50, dashTime: 0, stride: 0 },
    { onGround: false, vx: 0, vy: 200, dashTime: 0, stride: 0 },
    { onGround: true, vx: 0, vy: 0, dashTime: 0.2, stride: 0 },
  ];
  for (const st of states) {
    const f = playerFrame(st);
    assert.ok(
      Object.values(want).includes(f) || spritesFor(look).run.includes(f),
      `${JSON.stringify(st)} 가 꾸민 차림새가 아니다`,
    );
    assert.equal(f.palette.j, JACKETS[3].color);
  }
  setLook(DEFAULT_LOOK); // 다른 테스트에 안 새게 되돌린다
});

test('lookKey 는 차림새가 다르면 다르다', () => {
  const keys = new Set();
  for (let h = 0; h < HAIRS.length; h++) {
    for (let j = 0; j < JACKETS.length; j++) keys.add(lookKey({ hair: h, jacket: j, pants: 0 }));
  }
  assert.equal(keys.size, HAIRS.length * JACKETS.length);
});
