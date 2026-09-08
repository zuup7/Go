// 키보드 + 터치 입력. 매 프레임 "이번에 새로 눌렸는가"까지 알려준다.
const KEYMAP = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'jump',
  KeyW: 'jump',
  Space: 'jump',
  KeyZ: 'jump',
  KeyX: 'throw',
  KeyJ: 'throw',
  ArrowDown: 'throw',
  KeyS: 'throw',
  KeyR: 'restart',
  Escape: 'pause',
  KeyP: 'pause',
  KeyM: 'mute',
  Enter: 'confirm',
  NumpadEnter: 'confirm',
};

export function createInput(target = window) {
  const held = new Set();
  const pressedNow = new Set();

  const press = (action) => {
    if (!held.has(action)) pressedNow.add(action);
    held.add(action);
  };
  const release = (action) => {
    held.delete(action);
  };

  const onKeyDown = (e) => {
    const action = KEYMAP[e.code];
    if (!action) return;
    if (e.repeat) return;
    e.preventDefault();
    press(action);
  };
  const onKeyUp = (e) => {
    const action = KEYMAP[e.code];
    if (!action) return;
    e.preventDefault();
    release(action);
  };
  const onBlur = () => {
    held.clear();
  };

  target.addEventListener('keydown', onKeyDown, { passive: false });
  target.addEventListener('keyup', onKeyUp, { passive: false });
  target.addEventListener('blur', onBlur);

  const input = {
    left: false,
    right: false,
    jump: false,
    jumpPressed: false,
    /** 메뉴에서 칸을 옮길 때 쓴다 — 누르고 있는 동안 계속이 아니라 누른 순간 한 번 */
    leftPressed: false,
    rightPressed: false,
    throwPressed: false,
    confirmPressed: false,
    restartPressed: false,
    pausePressed: false,
    mutePressed: false,
    anyPressed: false,

    /** 프레임 시작에 호출 — 눌림 상태를 스냅샷으로 굳힌다 */
    sample() {
      input.left = held.has('left');
      input.right = held.has('right');
      input.jump = held.has('jump');
      input.jumpPressed = pressedNow.has('jump');
      input.leftPressed = pressedNow.has('left');
      input.rightPressed = pressedNow.has('right');
      input.throwPressed = pressedNow.has('throw');
      input.confirmPressed = pressedNow.has('confirm') || pressedNow.has('jump');
      input.restartPressed = pressedNow.has('restart');
      input.pausePressed = pressedNow.has('pause');
      input.mutePressed = pressedNow.has('mute');
      input.anyPressed = pressedNow.size > 0;
      pressedNow.clear();
    },

    /** 터치 버튼에서 부른다 */
    setVirtual(action, down) {
      if (down) press(action);
      else release(action);
    },

    destroy() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', onBlur);
    },
  };

  return input;
}

/**
 * 터치 버튼을 입력에 연결한다.
 *
 * 그냥 버튼마다 pointerdown/up 을 다는 것으로는 부족하다. 엄지를 ◀ 에서 ▶ 로
 * 미끄러뜨리면 새 버튼은 눌린 줄도 모르고, 원래 버튼은 눌린 채로 남는다.
 * 그래서 손가락(pointerId) 마다 "지금 어느 버튼 위인가"를 추적하고,
 * 같은 동작을 두 손가락이 눌러도 세어서 하나가 떨어질 때 꺼지지 않게 한다.
 */
export function bindTouchButtons(root, input) {
  /** pointerId → 지금 그 손가락이 누르고 있는 버튼 */
  const under = new Map();
  /** action → 그 동작을 누르고 있는 손가락 수 */
  const count = new Map();

  const usable = (el) =>
    el && el.dataset?.action && !el.disabled && !el.hidden && el.offsetParent !== null ? el : null;

  const buttonAt = (x, y) => usable(document.elementFromPoint(x, y)?.closest?.('[data-action]'));

  const push = (button) => {
    const action = button.dataset.action;
    const next = (count.get(action) ?? 0) + 1;
    count.set(action, next);
    button.classList.add('is-down');
    if (next === 1) {
      input.setVirtual(action, true);
      // 손끝에 닿는 느낌 — 화면 버튼은 이게 없으면 눌렸는지 확신이 안 선다
      try {
        navigator.vibrate?.(8);
      } catch {
        /* 진동을 막아둔 기기도 있다 */
      }
    }
  };

  const pop = (button) => {
    const action = button.dataset.action;
    const next = Math.max(0, (count.get(action) ?? 0) - 1);
    count.set(action, next);
    button.classList.remove('is-down');
    if (next === 0) input.setVirtual(action, false);
  };

  const moveTo = (pointerId, button) => {
    const prev = under.get(pointerId) ?? null;
    if (prev === button) return;
    if (prev) pop(prev);
    if (button) {
      under.set(pointerId, button);
      push(button);
    } else {
      under.delete(pointerId);
    }
  };

  const onDown = (e) => {
    const button = buttonAt(e.clientX, e.clientY);
    if (!button) return;
    e.preventDefault();
    // 캡처를 놓아야 손가락이 다른 버튼으로 넘어가는 걸 알 수 있다
    if (e.pointerId !== undefined) root.releasePointerCapture?.(e.pointerId);
    moveTo(e.pointerId, button);
  };

  const onMove = (e) => {
    if (!under.has(e.pointerId)) return;
    e.preventDefault();
    moveTo(e.pointerId, buttonAt(e.clientX, e.clientY));
  };

  const onUp = (e) => {
    if (!under.has(e.pointerId)) return;
    e.preventDefault();
    moveTo(e.pointerId, null);
  };

  root.addEventListener('pointerdown', onDown);
  root.addEventListener('pointermove', onMove);
  root.addEventListener('pointerup', onUp);
  root.addEventListener('pointercancel', onUp);
  root.addEventListener('contextmenu', (e) => e.preventDefault());
  // 손가락이 화면 밖으로 나가도 버튼이 눌린 채로 남지 않게
  window.addEventListener('pointerup', onUp);
  window.addEventListener('blur', () => {
    for (const id of [...under.keys()]) moveTo(id, null);
  });
}
