// 타일 격자 위의 AABB 물리. 캔버스도 DOM 도 모른다.
//
// body 는 { x, y, w, h, vx, vy } 를 가진 평범한 객체다.
// tileAt(tx, ty) 는 그 칸의 성질을 돌려준다: SOLID / ONEWAY / null.

export const TILE = 16;
export const SOLID = 'solid';
export const ONEWAY = 'oneway';

const EPS = 0.001;
/** 한 번에 이 픽셀보다 많이 움직이면 쪼개서 검사한다 (얇은 벽 통과 방지) */
const MAX_STEP = 8;

function stepX(body, dx, tileAt, res) {
  if (!dx) return;
  body.x += dx;
  const ty0 = Math.floor(body.y / TILE);
  const ty1 = Math.floor((body.y + body.h - EPS) / TILE);
  if (dx > 0) {
    const tx = Math.floor((body.x + body.w - EPS) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) {
      if (tileAt(tx, ty) === SOLID) {
        body.x = tx * TILE - body.w;
        body.vx = 0;
        res.hitRight = true;
        return;
      }
    }
  } else {
    const tx = Math.floor(body.x / TILE);
    for (let ty = ty0; ty <= ty1; ty++) {
      if (tileAt(tx, ty) === SOLID) {
        body.x = (tx + 1) * TILE;
        body.vx = 0;
        res.hitLeft = true;
        return;
      }
    }
  }
}

function stepY(body, dy, tileAt, res) {
  if (!dy) return;
  const prevBottom = body.y + body.h;
  body.y += dy;
  const tx0 = Math.floor(body.x / TILE);
  const tx1 = Math.floor((body.x + body.w - EPS) / TILE);
  if (dy > 0) {
    const ty = Math.floor((body.y + body.h - EPS) / TILE);
    for (let tx = tx0; tx <= tx1; tx++) {
      const kind = tileAt(tx, ty);
      // 관통 발판은 위에서 내려올 때만 막는다
      const blocks = kind === SOLID || (kind === ONEWAY && prevBottom <= ty * TILE + EPS);
      if (blocks) {
        body.y = ty * TILE - body.h;
        body.vy = 0;
        res.hitGround = true;
        res.groundTile = { tx, ty };
        return;
      }
    }
  } else {
    const ty = Math.floor(body.y / TILE);
    for (let tx = tx0; tx <= tx1; tx++) {
      if (tileAt(tx, ty) === SOLID) {
        body.y = (ty + 1) * TILE;
        body.vy = 0;
        res.hitCeil = true;
        res.ceilTile = { tx, ty };
        return;
      }
    }
  }
}

/** body 를 (dx, dy) 만큼 옮기고 부딪힌 면을 알려준다 */
export function moveBody(body, dx, dy, tileAt) {
  const res = {
    hitLeft: false,
    hitRight: false,
    hitGround: false,
    hitCeil: false,
    groundTile: null,
    ceilTile: null,
  };
  const far = Math.max(Math.abs(dx), Math.abs(dy));
  const steps = Math.max(1, Math.ceil(far / MAX_STEP));
  const sx = dx / steps;
  const sy = dy / steps;
  for (let i = 0; i < steps; i++) {
    stepX(body, sx, tileAt, res);
    stepY(body, sy, tileAt, res);
  }
  return res;
}

/** 발밑이 땅인가 (한 픽셀 아래를 훑어본다) */
export function groundedAt(body, tileAt) {
  const y = body.y + body.h + EPS;
  const ty = Math.floor(y / TILE);
  const tx0 = Math.floor(body.x / TILE);
  const tx1 = Math.floor((body.x + body.w - EPS) / TILE);
  for (let tx = tx0; tx <= tx1; tx++) {
    const kind = tileAt(tx, ty);
    if (kind === SOLID) return true;
    if (kind === ONEWAY && body.y + body.h <= ty * TILE + 1) return true;
  }
  return false;
}

/**
 * 점프 판정 도우미. 코요테 타임(발판을 떠난 직후)과 점프 버퍼(착지 직전 입력)를
 * 함께 본다 — 마리오처럼 관대한 조작감이 여기서 나온다.
 */
export const COYOTE_FRAMES = 6;
export const BUFFER_FRAMES = 6;

export function updateJumpAssist(state, { onGround, jumpPressed }) {
  state.coyote = onGround ? COYOTE_FRAMES : Math.max(0, state.coyote - 1);
  state.buffer = jumpPressed ? BUFFER_FRAMES : Math.max(0, state.buffer - 1);
  if (state.coyote > 0 && state.buffer > 0) {
    state.coyote = 0;
    state.buffer = 0;
    return true;
  }
  return false;
}

export const newJumpAssist = () => ({ coyote: 0, buffer: 0 });
