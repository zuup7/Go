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
    /**
     * 명반 — 금박 이중 테두리 + 검은 LP + 수상 인장.
     * 사진이 없는 유일한 앨범이라, 무늬만으로 "이건 급이 다르다"가 읽혀야 한다.
     */
    case 'legend': {
      // 금박 이중 테두리
      px(0, 0, main, BASE, 1);
      px(0, BASE - 1, main, BASE, 1);
      px(0, 0, main, 1, BASE);
      px(BASE - 1, 0, main, 1, BASE);
      px(2, 2, main, BASE - 4, 1);
      px(2, BASE - 3, main, BASE - 4, 1);
      px(2, 2, main, 1, BASE - 4);
      px(BASE - 3, 2, main, 1, BASE - 4);
      // 가운데 LP — 검은 원반에 금 홈 하나, 가운데는 금 라벨
      for (let y = 3; y < BASE - 3; y++) {
        for (let x = 3; x < BASE - 3; x++) {
          const d = Math.hypot(x - 7.5, y - 7.5);
          if (d > 4) continue;
          if (d < 1.2) px(x, y, main);
          else if (d > 3 && d < 3.7) px(x, y, main);
          else px(x, y, '#0b0a09');
        }
      }
      // 왼쪽 위 모서리에만 짧은 광택 — 대각선을 길게 그으면 원반을 가로질러 그림이 깨진다
      px(3, 1, accent, 3, 1);
      px(1, 3, accent, 1, 3);
      // 오른쪽 아래 수상 인장 (원반 위에 붙은 스티커처럼 맨 마지막에)
      px(BASE - 6, BASE - 6, main, 4, 4);
      px(BASE - 5, BASE - 5, accent, 2, 2);
      break;
    }
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

  // 여러 대 맞아야 죽는 놈 — 남은 대수를 위에 점으로 보여준다.
  // 표시가 없으면 밟았는데 안 죽는 게 **단단해서인지 무적이라서인지** 알 수가 없다.
  // 밟을 수 없는 놈(가시)은 애초에 대수가 뜻이 없으므로 빼둔다 — 있으면 오히려 거짓말이 된다.
  if (e.stompable && e.def.hp > 1) {
    const pip = Math.max(2, Math.round(size / 8));
    const gap = pip + 2;
    const left = Math.round(size / 2 - (e.def.hp * gap - 2) / 2);
    for (let i = 0; i < e.def.hp; i++) {
      const alive = i < e.hp;
      ctx.fillStyle = alive ? '#ffd166' : 'rgba(0,0,0,0.45)';
      ctx.fillRect(left + i * gap, -pip - 2, pip, pip);
      if (alive) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillRect(left + i * gap, -pip - 2, pip, 1);
      }
    }
    // 아직 한 대도 안 맞았으면 금테를 두른다 — 한 대 먹이면 테가 벗겨져서 진행이 보인다
    if (e.hp >= e.def.hp) {
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 1;
      ctx.strokeRect(-0.5, -0.5, size + 1, size + 1);
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
