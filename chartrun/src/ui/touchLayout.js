// 화면 버튼 위치 커스텀.
//
// 손 크기도 잡는 법도 사람마다 달라서, 내가 정해놓은 자리가 남한테는 불편하다.
// 그래서 끌어다 놓을 수 있게 하고 기기에 저장한다.
//
// 자리는 픽셀이 아니라 **비율**로 저장한다 (버튼 한가운데 기준, 0~1).
// 그래야 화면 크기가 달라지거나 폰을 돌려도 대충 같은 자리에 남는다.
// 가로로 든 것과 세로로 눕힌 것은 좌표계가 아예 달라서 따로 저장한다.

export const LAYOUT_KEY = 'chartrun/touch-v1';

/** 화면 가장자리에서 이만큼은 떨어져 있어야 한다 */
const EDGE = 8;
/**
 * 눕힌 화면에서는 앱이 화면 위아래에 얹는 것들(닫기 X, 내비게이션 바)이
 * 좌표상으로는 좌우 끝이 된다. 거기로는 아예 못 옮기게 막는다.
 */
const ROTATED_SIDE = 84;

export const layoutMode = (rotated) => (rotated ? 'rotated' : 'landscape');

/** 이 모드에서 버튼이 들어갈 수 있는 여백 */
export function marginsFor(mode) {
  return mode === 'rotated' ? { x: ROTATED_SIDE, y: EDGE } : { x: EDGE, y: EDGE };
}

/**
 * 버튼 한가운데를 상자 안으로 밀어 넣는다. 반환은 비율.
 * box: 버튼이 놓이는 상자 크기, size: 버튼 크기, 둘 다 픽셀.
 */
export function clampSpot(x, y, { box, size, mode }) {
  const m = marginsFor(mode);
  const halfW = size.w / 2;
  const halfH = size.h / 2;
  const minX = m.x + halfW;
  const maxX = box.w - m.x - halfW;
  const minY = m.y + halfH;
  const maxY = box.h - m.y - halfH;
  // 상자가 버튼보다 좁으면 가운데에 둔다 (min > max 인 경우)
  const fit = (v, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));
  return {
    x: fit(x, minX, maxX) / box.w,
    y: fit(y, minY, maxY) / box.h,
  };
}

const emptyLayout = () => ({ landscape: {}, rotated: {} });

const storage = () => (typeof localStorage === 'undefined' ? null : localStorage);

/** 저장된 값이 우리가 아는 모양인지 걸러낸다 — 남이 써넣은 값일 수도 있다 */
export function sanitize(raw) {
  const out = emptyLayout();
  if (!raw || typeof raw !== 'object') return out;
  for (const mode of Object.keys(out)) {
    const spots = raw[mode];
    if (!spots || typeof spots !== 'object') continue;
    for (const [action, spot] of Object.entries(spots)) {
      const x = Number(spot?.x);
      const y = Number(spot?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (x < 0 || x > 1 || y < 0 || y > 1) continue;
      out[mode][action] = { x, y };
    }
  }
  return out;
}

export function loadLayout() {
  const store = storage();
  if (!store) return emptyLayout();
  try {
    return sanitize(JSON.parse(store.getItem(LAYOUT_KEY)));
  } catch {
    return emptyLayout();
  }
}

export function writeLayout(layout) {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(LAYOUT_KEY, JSON.stringify(layout));
    return true;
  } catch {
    return false;
  }
}

/**
 * 버튼 옮기기를 실제로 붙인다. DOM 은 여기서만 만진다.
 *
 * root      버튼들이 들어 있는 오버레이 (#touch)
 * onEdit    편집 모드가 켜지고 꺼질 때 (게임을 멈추라고 알려준다)
 * isRotated 지금 화면을 눕혀 놨는지
 */
export function createTouchLayout({ root, onEdit, isRotated }) {
  const buttons = [...root.querySelectorAll('[data-action]')];
  const handle = root.querySelector('#pad-edit');
  const bar = root.querySelector('#pad-bar');
  const doneBtn = root.querySelector('#pad-done');
  const resetBtn = root.querySelector('#pad-reset');

  let layout = loadLayout();
  let editing = false;
  /** 편집 중 드래그하는 버튼 (pointerId → { el, dx, dy }) */
  const dragging = new Map();

  const mode = () => layoutMode(isRotated());

  /**
   * 좌표를 매기는 상자의 크기.
   *
   * getBoundingClientRect() 가 아니라 offsetWidth/Height 여야 한다. 눕힌 화면에서
   * 앞의 것은 90도 돌아간 뒤의 "화면에서 차지하는 넓이"(390×844)를 주는데,
   * left/top 퍼센트가 재는 것은 돌기 전의 제 크기(844×390)다. 이걸 헷갈리면
   * 가로·세로가 뒤바뀐 채로 계산돼서 버튼들이 한 자리에 겹쳐버린다.
   */
  const boxOf = () => ({ w: root.offsetWidth, h: root.offsetHeight });

  /** 눕힌 화면에서는 화면 좌표와 버튼 좌표가 90도 틀어져 있다 */
  function pointerToBox(clientX, clientY) {
    const r = root.getBoundingClientRect();
    if (!isRotated()) return { x: clientX - r.left, y: clientY - r.top };
    // 시계방향 90도: 화면 아래쪽(+y)이 상자의 오른쪽(+x), 화면 오른쪽(+x)이 상자의 위(-y)
    const box = boxOf();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    return {
      x: clientY - cy + box.w / 2,
      y: -(clientX - cx) + box.h / 2,
    };
  }

  function place(el, spot) {
    el.style.left = `${spot.x * 100}%`;
    el.style.top = `${spot.y * 100}%`;
  }

  /** CSS 가 정한 기본 자리로 되돌린다 */
  function toDefault() {
    document.body.classList.remove('custom-pads');
    for (const el of buttons) {
      el.style.left = '';
      el.style.top = '';
    }
  }

  /**
   * 지금 보이는 자리를 전부 읽는다.
   *
   * 반드시 좌표 모드(custom-pads)로 바꾸기 **전에** 불러야 한다. 바꾸고 나면
   * 버튼들이 좌표 없이 붕 떠서, 원래 있던 자리가 아니라 무너진 자리를 읽게 된다.
   */
  const readSpots = (list) => new Map(list.map((el) => [el, spotOf(el)]));

  /** 저장된 자리가 있으면 얹는다. 없으면 CSS 가 정한 기본 자리 그대로 둔다. */
  function apply() {
    const spots = layout[mode()] ?? {};
    if (Object.keys(spots).length === 0) {
      toDefault();
      return;
    }
    // 일부만 저장돼 있으면 나머지는 기본 자리를 읽어서 채운다 (읽기가 먼저)
    toDefault();
    const measured = readSpots(buttons.filter((el) => !spots[el.dataset.action]));
    document.body.classList.add('custom-pads');
    for (const [el, spot] of measured) spots[el.dataset.action] = spot;
    for (const el of buttons) place(el, spots[el.dataset.action]);
  }

  /** 지금 화면에 보이는 자리를 비율로 읽어온다 */
  function spotOf(el) {
    const r = el.getBoundingClientRect();
    const box = boxOf();
    const p = pointerToBox(r.left + r.width / 2, r.top + r.height / 2);
    return clampSpot(p.x, p.y, { box, size: { w: el.offsetWidth, h: el.offsetHeight }, mode: mode() });
  }

  function setEditing(on) {
    if (editing === on) return;
    editing = on;
    dragging.clear();
    document.body.classList.toggle('pad-editing', on);
    bar.hidden = !on;
    handle.hidden = on;
    if (on) {
      // 편집 중에는 던지기 버튼도 보여야 옮길 수 있다 (크기를 재려면 보여야 한다)
      for (const el of buttons) el.dataset.wasHidden = el.hidden ? '1' : '';
      for (const el of buttons) el.hidden = false;
      // 지금 보이는 자리를 먼저 읽고, 그 다음에 좌표 모드로 바꾼다
      const current = readSpots(buttons);
      layout[mode()] = {};
      document.body.classList.add('custom-pads');
      for (const [el, spot] of current) {
        layout[mode()][el.dataset.action] = spot;
        place(el, spot);
      }
    } else {
      for (const el of buttons) {
        if (el.dataset.wasHidden) el.hidden = true;
        delete el.dataset.wasHidden;
      }
      writeLayout(layout);
    }
    onEdit?.(on);
  }

  // ── 드래그 ────────────────────────────────────────────────
  root.addEventListener(
    'pointerdown',
    (e) => {
      if (!editing) return;
      const el = e.target.closest?.('[data-action]');
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      const r = el.getBoundingClientRect();
      const centre = pointerToBox(r.left + r.width / 2, r.top + r.height / 2);
      const at = pointerToBox(e.clientX, e.clientY);
      dragging.set(e.pointerId, { el, dx: centre.x - at.x, dy: centre.y - at.y });
      el.classList.add('is-moving');
    },
    true,
  );

  const moveTo = (e) => {
    const drag = dragging.get(e.pointerId);
    if (!drag) return;
    e.preventDefault();
    const at = pointerToBox(e.clientX, e.clientY);
    const spot = clampSpot(at.x + drag.dx, at.y + drag.dy, {
      box: boxOf(),
      size: { w: drag.el.offsetWidth, h: drag.el.offsetHeight },
      mode: mode(),
    });
    layout[mode()][drag.el.dataset.action] = spot;
    place(drag.el, spot);
  };

  const drop = (e) => {
    const drag = dragging.get(e.pointerId);
    if (!drag) return;
    drag.el.classList.remove('is-moving');
    dragging.delete(e.pointerId);
  };

  root.addEventListener('pointermove', moveTo, true);
  root.addEventListener('pointerup', drop, true);
  root.addEventListener('pointercancel', drop, true);

  handle.addEventListener('click', () => setEditing(true));
  doneBtn.addEventListener('click', () => setEditing(false));
  resetBtn.addEventListener('click', () => {
    layout[mode()] = {};
    toDefault();
    writeLayout(layout);
    // 기본 자리를 다시 읽어서 편집을 이어간다
    if (editing) {
      editing = false;
      setEditing(true);
    }
  });

  return {
    apply,
    get editing() {
      return editing;
    },
    close: () => setEditing(false),
  };
}
