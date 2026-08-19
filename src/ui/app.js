// 앱 진입점: 상태를 들고, 화면을 그리고, 클릭을 게임 함수로 연결한다.
import * as G from '../core/game.js';
import * as V from './views.js';
import { saveGame, loadGame, hasSave, clearSave, serialize, deserialize } from '../core/save.js';
import { fullName } from '../core/person.js';

const app = document.getElementById('app');
const modalRoot = document.getElementById('modal-root');

let state = null;
let tab = 'life';
let openPersonId = null;
let importOpen = null;   // null | { error }
let draft = { familyName: '', givenName: '', gender: '', traitId: '', villageName: '' };

// ── 렌더 ─────────────────────────────────────────────────

function render() {
  if (!state) {
    app.innerHTML = V.titleScreen({ canContinue: hasSave(), draft });
    modalRoot.innerHTML = '';
    return;
  }

  const body = {
    life: V.lifeTab,
    love: V.loveTab,
    career: V.careerTab,
    family: V.familyTab,
    village: V.villageTab,
    legacy: V.legacyTab,
  }[tab] ?? V.lifeTab;

  app.innerHTML = V.topBar(state) + V.heroCard(state) + V.tabsBar(tab) + body(state);
  renderModal();
}

function renderModal() {
  if (state?.ended) {
    modalRoot.innerHTML = V.endModal(state);
    return;
  }
  if (state?.succession) {
    modalRoot.innerHTML = V.successionModal(state);
    return;
  }
  if (importOpen) {
    modalRoot.innerHTML = V.importModal(importOpen.error);
    return;
  }
  if (openPersonId && state?.people[openPersonId]) {
    modalRoot.innerHTML = V.personModal(state, state.people[openPersonId]);
    return;
  }
  const event = state ? G.pendingEvent(state) : null;
  modalRoot.innerHTML = event ? V.eventModal(state, event) : '';
}

let toastTimer = null;
function toast(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 2200);
}

const autosave = () => { if (state) saveGame(state); };

/** 타이틀 화면의 입력값을 draft 로 옮긴다 (다시 그려도 지워지지 않도록) */
function captureDraft() {
  const get = (id) => document.getElementById(id)?.value?.trim() ?? '';
  draft.familyName = get('in-family');
  draft.givenName = get('in-given');
  draft.villageName = get('in-village');
}

// ── 액션 ─────────────────────────────────────────────────

const actions = {
  'draft-gender': (id) => { captureDraft(); draft.gender = id; render(); },
  'draft-trait': (id) => { captureDraft(); draft.traitId = draft.traitId === id ? '' : id; render(); },

  'new-game': () => {
    captureDraft();
    state = G.newGame({
      seed: Math.floor(Math.random() * 2 ** 31),
      familyName: draft.familyName || undefined,
      givenName: draft.givenName || undefined,
      gender: draft.gender || undefined,
      traitId: draft.traitId || undefined,
      villageName: draft.villageName || undefined,
    });
    tab = 'life';
    autosave();
    render();
  },

  continue: () => {
    const loaded = loadGame();
    if (!loaded) { toast('저장된 게임을 찾지 못했습니다.'); return; }
    state = loaded;
    tab = 'life';
    render();
  },

  tab: (id) => { tab = id; render(); },
  activity: (id) => { state.activity = id; render(); },

  advance: () => {
    G.advanceYear(state, state.activity);
    autosave();
    render();
  },

  'event-choice': (index) => {
    const result = G.resolveEvent(state, Number(index));
    if (!result) { toast('그 선택은 지금 할 수 없습니다.'); return; }
    autosave();
    render();
  },
  'event-close': () => { G.dismissEvent(state); render(); },

  meet: () => {
    const result = G.meetPeople(state);
    if (!result.ok) toast(result.reason);
    autosave();
    render();
  },
  date: (id) => {
    const result = G.date(state, id);
    if (!result.ok) toast(result.reason);
    autosave();
    render();
  },
  propose: (id) => {
    const result = G.propose(state, id);
    toast(result.ok ? '결혼했습니다! 💍' : result.reason);
    autosave();
    render();
  },
  'have-child': () => {
    const result = G.haveChild(state);
    toast(result.ok ? `${fullName(result.child)}이(가) 태어났습니다! 👶` : result.reason);
    autosave();
    render();
  },

  'take-job': (id) => {
    const result = G.takeJob(state, id);
    if (!result.ok) toast(result.reason);
    autosave();
    render();
  },
  retire: () => {
    const result = G.retire(state);
    if (!result.ok) toast(result.reason);
    autosave();
    render();
  },

  build: (id) => {
    const result = G.buildBuilding(state, id);
    if (!result.ok) toast(result.reason);
    autosave();
    render();
  },

  succeed: (id) => {
    const result = G.succeedTo(state, id);
    if (!result.ok) { toast(result.reason); return; }
    tab = 'life';
    autosave();
    render();
  },
  'choose-heir': (id) => {
    G.chooseHeir(state, id);
    tab = 'life';
    autosave();
    render();
  },

  person: (id) => { openPersonId = id; renderModal(); },
  'close-modal': () => { openPersonId = null; importOpen = null; renderModal(); },

  save: () => { toast(saveGame(state) ? '저장했습니다.' : '저장에 실패했습니다.'); },

  'copy-save': async () => {
    const text = serialize(state);
    try {
      await navigator.clipboard.writeText(text);
      toast('저장 데이터를 클립보드에 복사했습니다.');
    } catch {
      // 클립보드를 쓸 수 없는 환경에서는 직접 복사하도록 보여준다
      const box = document.createElement('textarea');
      box.value = text;
      box.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;height:120px;z-index:99';
      document.body.appendChild(box);
      box.select();
      toast('직접 복사한 뒤 화면을 다시 누르세요.');
      const remove = () => { box.remove(); document.removeEventListener('click', remove); };
      setTimeout(() => document.addEventListener('click', remove), 300);
    }
  },

  'open-import': () => { importOpen = { error: '' }; renderModal(); },

  'do-import': () => {
    const text = document.getElementById('import-text')?.value?.trim();
    if (!text) { importOpen = { error: '저장 데이터를 붙여넣어 주세요.' }; renderModal(); return; }
    try {
      state = deserialize(text);
      importOpen = null;
      tab = 'life';
      autosave();
      render();
      toast('이야기를 불러왔습니다.');
    } catch (error) {
      importOpen = { error: `불러오지 못했습니다: ${error.message}` };
      renderModal();
    }
  },
  restart: () => {
    if (!confirm('지금 가문의 이야기를 접고 새로 시작할까요?')) return;
    clearSave();
    state = null;
    openPersonId = null;
    importOpen = null;
    render();
  },
};

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-act]');
  if (!target) return;
  const action = actions[target.dataset.act];
  if (!action) return;
  event.preventDefault();
  action(target.dataset.id);
});

render();
