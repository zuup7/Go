// ★ 앨범 커버를 그린다.
//
// album.art 에 사진 경로가 있고 로딩에 성공했으면 그 사진을 커버 자리에 그대로 쓰고,
// 없으면 album.cover 패턴을 코드로 그린다. 게임 로직은 여기에 전혀 의존하지 않는다.
import { makeCanvas } from './pixel.js';

const BASE = 16;
const covers = new Map();
const images = new Map();

/** 앨범 id 로부터 항상 같은 값이 나오는 작은 해시 (noise 패턴용) */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function patternPainter(album, ctx) {
  const [dark, main, accent] = album.palette;
  ctx.fillStyle = dark;
  ctx.fillRect(0, 0, BASE, BASE);
  const px = (x, y, c, w = 1, h = 1) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };

  switch (album.cover) {
    case 'stripes':
      for (let y = 0; y < BASE; y++) {
        for (let x = 0; x < BASE; x++) {
          if ((x + y) % 5 < 2) px(x, y, main);
          else if ((x + y) % 5 === 2) px(x, y, accent);
        }
      }
      break;
    case 'checker':
      for (let y = 0; y < BASE; y++) {
        for (let x = 0; x < BASE; x++) {
          if ((Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0) px(x, y, main);
        }
      }
      px(0, 0, accent, BASE, 1);
      px(0, BASE - 1, accent, BASE, 1);
      break;
    case 'radial':
      for (let y = 0; y < BASE; y++) {
        for (let x = 0; x < BASE; x++) {
          const d = Math.hypot(x - 7.5, y - 7.5);
          if (d < 2) px(x, y, accent);
          else if (Math.floor(d) % 3 === 0) px(x, y, main);
        }
      }
      break;
    case 'noise': {
      let seed = hash(album.id);
      for (let y = 0; y < BASE; y++) {
        for (let x = 0; x < BASE; x++) {
          seed = (seed * 1664525 + 1013904223) >>> 0;
          const v = seed % 100;
          if (v < 28) px(x, y, main);
          else if (v < 36) px(x, y, accent);
        }
      }
      break;
    }
    case 'face':
      px(3, 3, main, 10, 10);
      px(5, 6, dark, 2, 2);
      px(9, 6, dark, 2, 2);
      px(5, 10, accent, 6, 1);
      break;
    case 'vinyl':
      for (let y = 0; y < BASE; y++) {
        for (let x = 0; x < BASE; x++) {
          const d = Math.hypot(x - 7.5, y - 7.5);
          if (d > 7.5) continue;
          if (d < 1.6) px(x, y, accent);
          else if (Math.floor(d) % 2 === 0) px(x, y, main);
          else px(x, y, dark);
        }
      }
      break;
    case 'burst':
      for (let y = 0; y < BASE; y++) {
        for (let x = 0; x < BASE; x++) {
          const angle = Math.atan2(y - 7.5, x - 7.5);
          const spoke = Math.floor(((angle + Math.PI) / (Math.PI * 2)) * 12);
          if (spoke % 2 === 0) px(x, y, main);
        }
      }
      px(6, 6, accent, 4, 4);
      break;
    case 'wave':
    default:
      for (let x = 0; x < BASE; x++) {
        const y = Math.round(7.5 + Math.sin((x / BASE) * Math.PI * 2) * 4);
        px(x, y, main);
        px(x, y + 1, accent);
        px(x, Math.max(0, y - 4), main);
      }
      break;
  }

  // 커버 테두리
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, BASE - 1, BASE - 1);
}

/** 앨범 하나의 16×16 커버 캔버스 (사진이 있으면 사진) */
export function coverCanvas(album) {
  const image = images.get(album.id);
  const key = `${album.id}:${image ? 'art' : 'proc'}`;
  const cached = covers.get(key);
  if (cached) return cached;

  const canvas = makeCanvas(BASE, BASE);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  if (image) ctx.drawImage(image, 0, 0, BASE, BASE);
  else patternPainter(album, ctx);
  covers.set(key, canvas);
  return canvas;
}

/**
 * 앨범 사진을 미리 불러온다. 실패해도 조용히 넘어가고 절차적 커버가 쓰인다.
 * basePath 는 index.html 기준 경로.
 */
export function preloadAlbumArt(albums, basePath = '') {
  if (typeof Image === 'undefined') return;
  for (const album of albums) {
    if (!album.art) continue;
    const img = new Image();
    img.onload = () => {
      images.set(album.id, img);
      covers.clear();
    };
    img.onerror = () => {};
    img.src = basePath + album.art;
  }
}

/** 앨범 적 한 마리 그리기 — 커버 + 눈 + 다리 (+ 가시) */
export function drawAlbum(ctx, e, ox, oy, time) {
  const x = Math.round(e.x - ox);
  const y = Math.round(e.y - oy);
  const size = e.w;
  const squash = e.squash > 0 ? 1 - Math.min(0.5, e.squash) : 1;

  ctx.save();
  ctx.translate(x + size / 2, y + size);
  if (e.behavior === 'spinner') ctx.rotate(e.spin);
  ctx.scale(1, squash);
  ctx.translate(-size / 2, -size);

  // 다리 (걷는 느낌)
  if (e.behavior !== 'flyer' && e.behavior !== 'spinner') {
    const swing = Math.sin(time * 9 + e.x * 0.2) * 1.5;
    ctx.fillStyle = e.def.palette[2];
    ctx.fillRect(Math.round(2 + swing), size - 1, 2, 3);
    ctx.fillRect(Math.round(size - 4 - swing), size - 1, 2, 3);
  }

  ctx.drawImage(coverCanvas(e.def), 0, 0, BASE, BASE, 0, 0, size, size);

  // 위에 박힌 가시 — 밟으면 안 되는 놈
  if (!e.stompable) {
    ctx.fillStyle = '#f2f5ff';
    for (let i = 0; i < 3; i++) {
      const sx = 2 + i * (size - 5) * 0.5;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx + 2, -4);
      ctx.lineTo(sx + 4, 0);
      ctx.fill();
    }
  }

  // 눈 — 가끔 깜빡인다
  const blink = Math.sin(time * 2.3 + e.x) > 0.97;
  const eyeY = Math.round(size * 0.42);
  const eyeW = Math.max(2, Math.round(size / 6));
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(Math.round(size * 0.2), eyeY, eyeW, blink ? 1 : eyeW);
  ctx.fillRect(Math.round(size * 0.6), eyeY, eyeW, blink ? 1 : eyeW);
  if (!blink) {
    ctx.fillStyle = '#101018';
    const look = e.dir > 0 ? 1 : 0;
    ctx.fillRect(Math.round(size * 0.2) + look, eyeY + 1, 1, eyeW - 1);
    ctx.fillRect(Math.round(size * 0.6) + look, eyeY + 1, 1, eyeW - 1);
  }

  // 덤비기 직전이면 화난 눈썹 — 준비 중에는 깜빡여서 예고가 된다
  if (e.state === 'charge' || e.state === 'windup' || e.state === 'warn') {
    const blinkWarn = e.state !== 'charge' && Math.floor(time * 14) % 2 === 0;
    ctx.fillStyle = blinkWarn ? '#ffffff' : '#ff2e63';
    ctx.fillRect(Math.round(size * 0.18), eyeY - 2, eyeW + 1, 1);
    ctx.fillRect(Math.round(size * 0.58), eyeY - 2, eyeW + 1, 1);
  }

  ctx.restore();
}

/** 커버만 따로 (컷신·엔딩에서 씀) */
export function drawCoverAt(ctx, album, x, y, size) {
  ctx.drawImage(coverCanvas(album), 0, 0, BASE, BASE, Math.round(x), Math.round(y), size, size);
}
