// 문자열로 그린 픽셀 스프라이트를 캔버스에 한 번만 구워두고 재사용한다.
//
//   sprite([
//     '..11..',
//     '.1221.',
//   ], { '1': '#000', '2': '#fff' })
//
// '.' 은 투명. 이미지 파일이 하나도 필요 없다.

const cache = new WeakMap();

export function sprite(rows, palette) {
  return { rows, palette, w: Math.max(...rows.map((r) => r.length)), h: rows.length };
}

export function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

function paint(spr, flip) {
  const canvas = makeCanvas(spr.w, spr.h);
  const ctx = canvas.getContext('2d');
  for (let y = 0; y < spr.rows.length; y++) {
    const row = spr.rows[y];
    for (let x = 0; x < row.length; x++) {
      const color = spr.palette[row[x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(flip ? spr.w - 1 - x : x, y, 1, 1);
    }
  }
  return canvas;
}

/** 구운 캔버스를 돌려준다 (좌우 반전본도 따로 캐시) */
export function bake(spr, flip = false) {
  let entry = cache.get(spr);
  if (!entry) {
    entry = {};
    cache.set(spr, entry);
  }
  const key = flip ? 'flip' : 'normal';
  if (!entry[key]) entry[key] = paint(spr, flip);
  return entry[key];
}

export function drawSprite(ctx, spr, x, y, flip = false) {
  ctx.drawImage(bake(spr, flip), Math.round(x), Math.round(y));
}

/** 픽셀이 흐려지지 않게 */
export function crisp(ctx) {
  ctx.imageSmoothingEnabled = false;
  return ctx;
}
