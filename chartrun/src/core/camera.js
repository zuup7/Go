// 플레이어를 따라가는 카메라. 화면 흔들림도 여기서.
import { clamp } from './util.js';

export function createCamera(viewW, viewH) {
  return { x: 0, y: 0, viewW, viewH, shake: 0, shakeX: 0, shakeY: 0 };
}

/** 플레이어보다 살짝 앞을 보여준다 — 달리는 게임이라 앞이 넓어야 편하다 */
export function updateCamera(cam, target, world, dt) {
  const lead = clamp(target.vx / 112, -1, 1) * 34;
  const wantX = target.x + target.w / 2 + lead - cam.viewW / 2;
  const wantY = target.y + target.h / 2 - cam.viewH * 0.58;

  cam.x += (wantX - cam.x) * Math.min(1, dt * 7);
  cam.y += (wantY - cam.y) * Math.min(1, dt * 5);

  cam.x = clamp(cam.x, 0, Math.max(0, world.pixelWidth - cam.viewW));
  cam.y = clamp(cam.y, 0, Math.max(0, world.pixelHeight - cam.viewH));

  if (cam.shake > 0) {
    cam.shake = Math.max(0, cam.shake - dt * 2.4);
    const power = cam.shake * 5;
    cam.shakeX = (Math.random() * 2 - 1) * power;
    cam.shakeY = (Math.random() * 2 - 1) * power;
  } else {
    cam.shakeX = 0;
    cam.shakeY = 0;
  }
}

export const shakeCamera = (cam, amount = 1) => {
  cam.shake = Math.min(2, cam.shake + amount);
};

/** 그릴 때 쓰는 최종 오프셋 (정수로 맞춰야 픽셀이 안 흐려진다) */
export const cameraOffset = (cam) => ({
  x: Math.round(cam.x + cam.shakeX),
  y: Math.round(cam.y + cam.shakeY),
});
