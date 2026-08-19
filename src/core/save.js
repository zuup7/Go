// 저장/불러오기 (브라우저 localStorage + JSON 내보내기)
import { rehydrate } from './game.js';

export const SAVE_KEY = 'family-go/save-v1';
export const SAVE_VERSION = 1;

const storage = () => (typeof localStorage === 'undefined' ? null : localStorage);

export function serialize(state) {
  return JSON.stringify({ version: SAVE_VERSION, savedAt: Date.now(), state });
}

export function deserialize(text) {
  const data = JSON.parse(text);
  if (!data?.state) throw new Error('저장 파일 형식이 올바르지 않습니다.');
  if (data.version !== SAVE_VERSION) throw new Error('저장 파일 버전이 다릅니다.');
  return rehydrate(data.state);
}

export function saveGame(state) {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(SAVE_KEY, serialize(state));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  const store = storage();
  if (!store) return null;
  const text = store.getItem(SAVE_KEY);
  if (!text) return null;
  try {
    return deserialize(text);
  } catch {
    return null;
  }
}

export function hasSave() {
  return Boolean(storage()?.getItem(SAVE_KEY));
}

export function clearSave() {
  storage()?.removeItem(SAVE_KEY);
}
