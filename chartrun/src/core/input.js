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

/** 터치 버튼을 입력에 연결한다 */
export function bindTouchButtons(root, input) {
  const buttons = root.querySelectorAll('[data-action]');
  for (const button of buttons) {
    const action = button.dataset.action;
    const down = (e) => {
      e.preventDefault();
      button.classList.add('is-down');
      input.setVirtual(action, true);
    };
    const up = (e) => {
      e.preventDefault();
      button.classList.remove('is-down');
      input.setVirtual(action, false);
    };
    button.addEventListener('pointerdown', down);
    button.addEventListener('pointerup', up);
    button.addEventListener('pointercancel', up);
    button.addEventListener('pointerleave', up);
    button.addEventListener('contextmenu', (e) => e.preventDefault());
  }
}
