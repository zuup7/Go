/**
 * 앱 아이콘을 굽는다 — `node chartrun/tools/apk/make-icon.mjs`
 *
 * 새로 그리지 않는다. **게임이 실제로 쓰는 스프라이트와 글리프**를 그대로 키워 찍는다.
 * 손으로 다시 그리면 주인공 모양이 바뀔 때마다 아이콘만 옛날 모습으로 남는다.
 *
 * 나오는 것:
 *   docs/icon-192.png · docs/icon-512.png   홈 화면에 추가했을 때 쓰는 아이콘
 *   docs/icon-maskable.png                  안드로이드가 동그랗게 잘라내는 판 (여백을 더 준다)
 *   chartrun/tools/apk/icon.png             APK 로 쌀 때 (1024)
 *
 * 의존성 없이 PNG 를 직접 쓴다 (zlib 은 node 에 들어 있다).
 */
import { deflateSync } from 'node:zlib';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAYER_SPRITES } from '../../src/render/sprites.js';
import { GLYPHS } from '../../src/render/bigtext.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '../../..');

const BG = '#0a0616';
const BAR = '#3d1a5c';
const BAR_TOP = '#7a34ad';
const FLOOR = '#160b26';
const WARN = '#ffd166';

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** size×size RGBA 한 장. 칸을 채우고 점 그림을 찍는 것뿐이다. */
function canvas(size) {
  const px = Buffer.alloc(size * size * 4);
  const rect = (x, y, w, h, hex) => {
    const [r, g, b] = rgb(hex);
    for (let yy = Math.max(0, Math.round(y)); yy < Math.min(size, Math.round(y + h)); yy += 1) {
      for (let xx = Math.max(0, Math.round(x)); xx < Math.min(size, Math.round(x + w)); xx += 1) {
        const i = (yy * size + xx) * 4;
        px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
      }
    }
  };
  /** 점 그림(스프라이트·글리프)을 scale 배로 찍는다. on(ch) 이 색을 돌려주면 칠한다 */
  const stamp = (rows, x, y, scale, on) => {
    rows.forEach((row, ry) => {
      [...row].forEach((ch, rx) => {
        const color = on(ch);
        if (color) rect(x + rx * scale, y + ry * scale, scale, scale, color);
      });
    });
  };
  return { px, rect, stamp };
}

/**
 * 아이콘 한 장을 그린다.
 *
 * 자리는 전부 1024 기준으로 잡아두고 크기에 맞춰 줄인다 — 큰 것과 작은 것이
 * 같은 그림이어야 하므로 비율을 한 군데(u)에서만 정한다. 점 그림의 배율은
 * 정수로 떨어뜨린다 (반 칸짜리 픽셀이 생기면 도트가 뭉갠다).
 */
function render(size) {
  const u = size / 1024;
  const { px, rect, stamp } = canvas(size);
  const GROUND = 840 * u;

  rect(0, 0, size, size, BG);

  // 뒤에 깔리는 차트 막대 — 타이틀 화면과 같은 모양이다.
  // 주인공의 검은 다리와 겹치므로 배경치고는 밝게 둔다.
  const TOPS = [740, 600, 680, 470, 580, 420, 520, 370];
  const barW = size / TOPS.length;
  TOPS.forEach((top, i) => {
    rect(i * barW + 8 * u, top * u, barW - 16 * u, GROUND - top * u, BAR);
    rect(i * barW + 8 * u, top * u, barW - 16 * u, Math.max(2, 12 * u), BAR_TOP);
  });
  // 바닥. 배경색으로 두면 아래쪽이 텅 빈 하늘처럼 보인다
  rect(0, GROUND, size, size - GROUND, FLOOR);
  rect(0, GROUND, size, Math.max(2, 8 * u), BAR_TOP);

  // 주인공 — 달리는 프레임 그대로 (12×16). 발이 바닥선에 닿는다.
  const hero = PLAYER_SPRITES.runReachA;
  const heroScale = Math.max(1, Math.round(30 * u));
  stamp(
    hero.rows,
    (size - hero.w * heroScale) / 2,
    GROUND - hero.h * heroScale,
    heroScale,
    (ch) => hero.palette[ch] ?? null,
  );

  // 1위 — 게임 안에서 쓰는 5×7 글리프 그대로
  const sc = Math.max(1, Math.round(14 * u));
  const label = '#1';
  const labelW = label.length * 6 * sc - sc;
  [...label].forEach((ch, i) => {
    stamp(GLYPHS[ch], (size - labelW) / 2 + i * 6 * sc, 194 * u, sc, (d) => (d === '1' ? WARN : null));
  });

  return px;
}

/**
 * 마스커블 아이콘.
 *
 * 안드로이드는 이 아이콘을 제 마음대로(동그라미·네모·물방울) 잘라낸다. 가운데
 * 80% 원 밖은 잘려 없어질 수 있으므로, 같은 그림을 줄여서 가운데 놓고 둘레는
 * 배경색으로 채운다. 안 그러면 「#1」의 머리와 바닥선이 잘린다.
 */
function masked(size, inset = 0.72) {
  const inner = Math.round(size * inset);
  const art = render(inner);
  const { px, rect } = canvas(size);
  rect(0, 0, size, size, BG);
  const off = Math.round((size - inner) / 2);
  for (let y = 0; y < inner; y += 1) {
    art.copy(px, ((y + off) * size + off) * 4, y * inner * 4, (y + 1) * inner * 4);
  }
  return px;
}

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

function png(size, px) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 채널당 8비트
  ihdr[9] = 6; // RGBA
  // 줄마다 필터 바이트 0 을 끼운다 (PNG 규격)
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const OUTS = [
  ['docs/icon-192.png', 192, render(192)],
  ['docs/icon-512.png', 512, render(512)],
  ['docs/icon-maskable.png', 512, masked(512)],
  ['chartrun/tools/apk/icon.png', 1024, render(1024)],
];

await mkdir(join(REPO, 'docs'), { recursive: true });
for (const [path, size, px] of OUTS) {
  const bytes = png(size, px);
  await writeFile(join(REPO, path), bytes);
  console.log(`  ${path} (${size}×${size}, ${(bytes.length / 1024).toFixed(1)} KB)`);
}
