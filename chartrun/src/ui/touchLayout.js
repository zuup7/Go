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
 *
 * 이 값이 너무 크면 **두 가지가 한꺼번에 망가진다.** 폰에서 게임 화면은 높이에
 * 딱 맞춰 그려지므로 남는 자리는 좌우 여백뿐인데(iPhone 12 기준 88px, Pixel 7 은
 * 104px, 위아래 여백은 어느 폰에서도 0 이다), 이 값이 그 여백을 통째로 먹으면
 *  1. 여백에 붙어 있는 ◀▶ 가 이미 한계선이라 **왼쪽으로 한 픽셀도 안 움직이고**
 *  2. 버튼이 갈 데가 없어서 **게임 화면 위로 밀려난다.**
 * 44 면 3버튼 내비게이션(48px 짜리도 절반은 비켜간다)과 닫기 X 를 피하면서
 * 여백 안에 들어간다.
 *
 * **CSS 도 같은 값을 쓴다** (`--rotated-side`). 여기가 원본이고 createTouchLayout 이
 * 화면에 얹는다 — 두 군데 적어두면 언젠가 어긋난다.
 */
export const ROTATED_SIDE = 44;

/** 버튼 크기 배율 — 이 밖으로는 못 나간다 */
export const MIN_SCALE = 0.7;
export const MAX_SCALE = 1.8;
export const SCALE_STEP = 0.1;

/**
 * 버튼 투명도 단계. 조작 버튼이 게임 화면을 덮고 있어서, 진하면 앞이 안 보이고
 * 흐리면 어디를 누르는지 모른다. 사람마다 갈리는 취향이라 고를 수 있게 둔다.
 */
export const ALPHA_STEPS = [0.4, 0.6, 0.8, 1];

/**
 * 처음 켰을 때의 투명도.
 *
 * 1 로 두면 버튼이 불투명한 상자라 폰에서 게임 화면을 가린다. 비쳐 보이게 두고,
 * 누르는 동안에만 진해진다 (`.touch button.is-down` 이 opacity 를 1 로 되돌린다).
 */
export const DEFAULT_ALPHA = 0.6;

/** 한 칸 다음. 끝에서 처음으로 돈다 (모르는 값은 indexOf 가 -1 이라 맨 앞으로 떨어진다). */
export const nextAlpha = (a) => ALPHA_STEPS[(ALPHA_STEPS.indexOf(a) + 1) % ALPHA_STEPS.length];

export const layoutMode = (rotated) => (rotated ? 'rotated' : 'landscape');

/**
 * 배율을 쓸 수 있는 값으로 만든다. 진짜 숫자가 아니면 1 로 본다.
 *
 * Number() 로 바꾸지 않는 게 중요하다 — null 은 0 이 돼버려서 "값이 없다"가
 * "제일 작게"로 둔갑한다. 옛 저장값에는 이 칸이 아예 없다.
 */
export function clampScale(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1;
  // 0.1 단위로 떨어뜨린다 — 더하다 보면 0.7000000000000001 같은 게 나온다
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(value * 10) / 10));
}

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

const emptyLayout = () => ({
  landscape: {},
  rotated: {},
  /** 모드별 전체 배율 */
  scale: { landscape: 1, rotated: 1 },
  /** 모드별 **버튼 하나하나**의 배율 (전체 배율에 곱해진다). 없으면 1 */
  size: { landscape: {}, rotated: {} },
  /** 모드별 투명도 — 기본이 진하면 버튼이 게임 화면을 가린다 */
  alpha: { landscape: DEFAULT_ALPHA, rotated: DEFAULT_ALPHA },
});

const storage = () => (typeof localStorage === 'undefined' ? null : localStorage);

/** 저장된 값이 우리가 아는 모양인지 걸러낸다 — 남이 써넣은 값일 수도 있다 */
export function sanitize(raw) {
  const out = emptyLayout();
  if (!raw || typeof raw !== 'object') return out;
  for (const mode of Object.keys(out.scale)) {
    // 크기·투명도 칸이 없는 옛 저장값도 그대로 읽힌다 — 없으면 기본값
    out.scale[mode] = clampScale(raw.scale?.[mode] ?? 1);
    const alpha = raw.alpha?.[mode];
    out.alpha[mode] = ALPHA_STEPS.includes(alpha) ? alpha : DEFAULT_ALPHA;
    const sizes = raw.size?.[mode];
    if (sizes && typeof sizes === 'object') {
      for (const [action, v] of Object.entries(sizes)) {
        if (typeof v === 'number' && Number.isFinite(v)) out.size[mode][action] = clampScale(v);
      }
    }
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
/** 편집 바에 보여줄 버튼 이름 */
const LABELS = { left: '◀', right: '▶', jump: '점프', throw: '마이크', dash: '대시', pause: '일시정지' };

export function createTouchLayout({ root, onEdit, isRotated }) {
  const buttons = [...root.querySelectorAll('[data-action]')];
  const handle = root.querySelector('#pad-edit');
  const bar = root.querySelector('#pad-bar');
  const doneBtn = root.querySelector('#pad-done');
  const resetBtn = root.querySelector('#pad-reset');
  const smallerBtn = root.querySelector('#pad-smaller');
  const allBtn = root.querySelector('#pad-all');
  const alphaBtn = root.querySelector('#pad-alpha');
  const mirrorBtn = root.querySelector('#pad-mirror');
  const biggerBtn = root.querySelector('#pad-bigger');
  const scaleText = root.querySelector('#pad-scale-text');

  // 여백 값의 원본은 JS 다. CSS 의 기본 자리(body.rotated .touch-left 등)도 같은
  // 값을 써야 해서 여기서 얹는다 — 두 군데 적어두면 언젠가 어긋난다.
  document.documentElement.style.setProperty('--rotated-side', `${ROTATED_SIDE}px`);

  let layout = loadLayout();
  let editing = false;
  /** −/+ 가 겨누는 버튼. null 이면 전체 */
  let selected = null;
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

  /**
   * 숨어 있는 버튼도 **잠깐 꺼내서** 자리를 잰다.
   *
   * 숨은 버튼은 크기가 0 이라 그대로 재면 화면 구석으로 눌려버리고, 그 자리가
   * 저장까지 되면 다시는 제자리로 안 돌아온다. 던지기(🎤)와 대시(💨)는 보스전에서만
   * 뜨므로, 판에서 열면 정확히 이 상황이 된다.
   */
  function measureHidden(list) {
    const was = list.map((el) => el.hidden);
    for (const el of list) el.hidden = false;
    const spots = readSpots(list);
    list.forEach((el, i) => {
      el.hidden = was[i];
    });
    return spots;
  }

  const scaleOf = () => clampScale(layout.scale?.[mode()] ?? 1);
  const sizeOf = (action) => clampScale(layout.size?.[mode()]?.[action] ?? 1);
  const alphaOf = () => {
    const a = layout.alpha?.[mode()];
    return ALPHA_STEPS.includes(a) ? a : DEFAULT_ALPHA;
  };

  /**
   * 크기와 투명도를 화면에 먹인다.
   *
   * 전체 배율은 body 에, 버튼별 배율은 그 버튼에 직접 얹는다 — 인라인 --pad-scale 이
   * body 것을 덮으므로, 얹을 때 **곱해서** 넣어야 전체 조절이 같이 먹는다.
   */
  function applyScale() {
    const scale = scaleOf();
    document.body.style.setProperty('--pad-scale', String(scale));
    document.body.style.setProperty('--pad-alpha', String(alphaOf()));
    for (const el of buttons) {
      const own = sizeOf(el.dataset.action);
      if (own === 1) el.style.removeProperty('--pad-scale');
      else el.style.setProperty('--pad-scale', String(Math.round(scale * own * 100) / 100));
    }
    refreshBar();
  }

  /** 편집 바의 글자 — 지금 뭘 조절하고 있는지 */
  function refreshBar() {
    if (scaleText) {
      const pct = Math.round((selected ? scaleOf() * sizeOf(selected) : scaleOf()) * 100);
      scaleText.textContent = `${selected ? LABELS[selected] ?? selected : '전체'} ${pct}%`;
    }
    if (alphaBtn) alphaBtn.textContent = `투명도 ${Math.round(alphaOf() * 100)}%`;
    for (const el of buttons) el.classList.toggle('is-picked', editing && el.dataset.action === selected);
  }

  /**
   * 저장된 자리를 지금 크기에 맞춰 다시 가둔다.
   *
   * 크기를 키우면 가장자리에 붙여둔 버튼이 화면 밖으로 삐져나가 아예 못 누르게 된다.
   * 크기가 바뀔 때마다 반드시 부른다.
   */
  function reclamp() {
    const spots = layout[mode()];
    if (!spots || Object.keys(spots).length === 0) return;
    const box = boxOf();
    for (const el of buttons) {
      const spot = spots[el.dataset.action];
      if (!spot) continue;
      spots[el.dataset.action] = clampSpot(spot.x * box.w, spot.y * box.h, {
        box,
        size: { w: el.offsetWidth, h: el.offsetHeight },
        mode: mode(),
      });
      place(el, spots[el.dataset.action]);
    }
  }

  /**
   * −/+ 한 번에 0.1씩. 버튼을 하나 골라뒀으면 **그 버튼만**, 아니면 전체.
   * 점프만 크게 쓰는 사람이 있고 방향키만 크게 쓰는 사람이 있다.
   */
  function changeScale(delta) {
    if (selected) {
      const now = sizeOf(selected);
      const next = clampScale(now + delta);
      if (next === now) return;
      layout.size[mode()][selected] = next;
    } else {
      const next = clampScale(scaleOf() + delta);
      if (next === scaleOf()) return;
      layout.scale[mode()] = next;
    }
    applyScale();
    reclamp(); // 크기가 바뀐 뒤의 offsetWidth 로 재야 하므로 순서가 중요하다
    writeLayout(layout);
  }

  /** 투명도 한 칸 */
  function cycleAlpha() {
    layout.alpha[mode()] = nextAlpha(alphaOf());
    applyScale();
    writeLayout(layout);
  }

  /**
   * 좌우 바꾸기 — 왼손잡이용. 자리를 비율로 들고 있어서 1 에서 빼면 그대로 거울이 된다.
   * 바꾼 뒤에는 반드시 다시 가둔다 (눕힌 화면은 좌우 여백이 84 라 그냥 뒤집으면 밖으로 나간다).
   */
  function mirror() {
    const spots = layout[mode()];
    if (!spots) return;
    for (const action of Object.keys(spots)) spots[action] = { ...spots[action], x: 1 - spots[action].x };
    for (const el of buttons) if (spots[el.dataset.action]) place(el, spots[el.dataset.action]);
    reclamp();
    writeLayout(layout);
  }

  /** 편집 중에 버튼을 집으면 그 버튼이 골라진다 (−/+ 가 그 버튼에만 먹는다) */
  function select(action) {
    selected = selected === action ? null : action;
    refreshBar();
  }

  /** 저장된 자리가 있으면 얹는다. 없으면 CSS 가 정한 기본 자리 그대로 둔다. */
  function apply() {
    applyScale();
    const spots = layout[mode()] ?? {};
    if (Object.keys(spots).length === 0) {
      toDefault();
      return;
    }
    // 일부만 저장돼 있으면 나머지는 기본 자리를 읽어서 채운다 (읽기가 먼저)
    toDefault();
    const measured = measureHidden(buttons.filter((el) => !spots[el.dataset.action]));
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
    selected = null;
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
      refreshBar();
    } else {
      for (const el of buttons) {
        if (el.dataset.wasHidden) el.hidden = true;
        delete el.dataset.wasHidden;
      }
      writeLayout(layout);
    }
    refreshBar();
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
      // 손가락은 브라우저가 알아서 붙잡아 주지만 **마우스는 안 붙잡는다** — 커서가
      // 버튼 밖으로 나가는 순간 pointermove 가 캔버스로 가버려서 끌기가 뚝 끊긴다.
      try {
        el.setPointerCapture?.(e.pointerId);
      } catch {
        /* 이미 놓친 포인터 */
      }
      dragging.set(e.pointerId, { el, dx: centre.x - at.x, dy: centre.y - at.y });
      el.classList.add('is-moving');
      // 집은 버튼이 −/+ 의 대상이 된다. 같은 걸 또 집으면 전체로 돌아간다.
      select(el.dataset.action);
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
  smallerBtn?.addEventListener('click', () => changeScale(-SCALE_STEP));
  biggerBtn?.addEventListener('click', () => changeScale(SCALE_STEP));
  allBtn?.addEventListener('click', () => {
    selected = null;
    refreshBar();
  });
  alphaBtn?.addEventListener('click', cycleAlpha);
  mirrorBtn?.addEventListener('click', mirror);
  resetBtn.addEventListener('click', () => {
    layout[mode()] = {};
    layout.scale[mode()] = 1;
    layout.size[mode()] = {};
    layout.alpha[mode()] = DEFAULT_ALPHA;
    selected = null;
    applyScale();
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
