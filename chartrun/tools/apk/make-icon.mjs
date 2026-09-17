/**
 * 앱 아이콘 (1024×1024) 을 굽는다 — `node chartrun/tools/apk/make-icon.mjs`
 *
 * 새로 그리지 않는다. **게임이 실제로 쓰는 스프라이트와 글리프**를 그대로 키워 찍는다.
 * 손으로 다시 그리면 주인공 모양이 바뀔 때마다 아이콘만 옛날 모습으로 남는다.
 *
 * 의존성 없이 PNG 를 직접 쓴다 (zlib 은 node 에 들어 있다).
 */
import { deflateSync } from 'node:zlib';
import { writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAYER_SPRITES } from '../../src/render/sprites.js';
import { GLYPHS } from '../../src/render/bigtext.js';

const SIZE = 1024;
const BG = '#0a0616';
const BAR = '#3d1a5c';
const BAR_TOP = '#7a34ad';
const FLOOR = '#160b26';
const WARN = '#ffd166';

// ── 아주 작은 래스터 ────────────────────────────────────────
const px = Buffer.alloc(SIZE * SIZE * 4);
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

function rect(x, y, w, h, hex) {
  const [r, g, b] = rgb(hex);
  for (let yy = Math.max(0, y); yy < Math.min(SIZE, y + h); yy += 1) {
    for (let xx = Math.max(0, x); xx < Math.min(SIZE, x + w); xx += 1) {
      const i = (yy * SIZE + xx) * 4;
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
    }
  }
}

/** 점 그림(스프라이트·글리프)을 scale 배로 찍는다. on(ch) 이 색을 돌려주면 칠한다 */
const stamp = (rows, x, y, scale, on) => {
  rows.forEach((row, ry) => {
    [...row].forEach((ch, rx) => {
      const color = on(ch);
      if (color) rect(x + rx * scale, y + ry * scale, scale, scale, color);
    });
  });
};

// ── 그리기 ──────────────────────────────────────────────────
// 안드로이드 적응형 아이콘은 가운데 66% 만 남기고 잘라낼 수 있다.
// 주인공과 「#1」은 그 안(가로세로 174~850)에 들어가야 한다.
const SAFE = { lo: Math.round(SIZE * 0.17), hi: Math.round(SIZE * 0.83) };
const GROUND = 840;

rect(0, 0, SIZE, SIZE, BG);

// 뒤에 깔리는 차트 막대 — 타이틀 화면과 같은 모양이다.
// 주인공의 검은 다리와 겹치므로 배경치고는 밝게 둔다.
const TOPS = [740, 600, 680, 470, 580, 420, 520, 370];
const barW = Math.floor(SIZE / TOPS.length);
TOPS.forEach((top, i) => {
  rect(i * barW + 8, top, barW - 16, GROUND - top, BAR);
  rect(i * barW + 8, top, barW - 16, 12, BAR_TOP);
});
// 바닥. 배경색으로 두면 아래쪽이 텅 빈 하늘처럼 보인다
rect(0, GROUND, SIZE, SIZE - GROUND, FLOOR);
rect(0, GROUND, SIZE, 8, BAR_TOP);

// 주인공 — 달리는 프레임 그대로 (12×16). 발이 바닥선에 닿는다.
const hero = PLAYER_SPRITES.runReachA;
const heroScale = 30;
stamp(
  hero.rows,
  Math.round((SIZE - hero.w * heroScale) / 2),
  GROUND - hero.h * heroScale,
  heroScale,
  (ch) => hero.palette[ch] ?? null,
);

// 1위 — 게임 안에서 쓰는 5×7 글리프 그대로
const sc = 14;
const label = '#1';
const labelW = label.length * (5 + 1) * sc - sc;
[...label].forEach((ch, i) => {
  stamp(GLYPHS[ch], Math.round((SIZE - labelW) / 2) + i * (5 + 1) * sc, SAFE.lo + 20, sc, (d) => (d === '1' ? WARN : null));
});

// ── PNG 로 굽기 ─────────────────────────────────────────────
const CRC = Int32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (buf) => {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // 채널당 8비트
ihdr[9] = 6; // RGBA
// 줄마다 필터 바이트 0 을 끼운다 (PNG 규격)
const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
for (let y = 0; y < SIZE; y += 1) {
  raw[y * (SIZE * 4 + 1)] = 0;
  px.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}
const out = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const path = join(dirname(fileURLToPath(import.meta.url)), 'icon.png');
await writeFile(path, out);
console.log(`${path} (${SIZE}×${SIZE}, ${(out.length / 1024).toFixed(1)} KB)`);
