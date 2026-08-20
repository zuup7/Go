// 효과를 사람이 읽을 수 있는 배지로 바꾼다. "뭐가 바뀌었는지" 바로 보이도록.
import { STAT_LABELS } from '../core/util.js';
import { TRAIT_BY_ID } from '../data/traits.js';

const STAT_ICONS = {
  health: '❤️', intellect: '🧠', charm: '✨', creativity: '🎨', fitness: '💪',
};

const chip = (icon, label, value) => {
  const tone = value == null ? 'flat' : value >= 0 ? 'up' : 'down';
  const sign = value == null ? '' : value > 0 ? '+' : '';
  return { icon, label, text: value == null ? label : `${label} ${sign}${Math.round(value * 10) / 10}`, tone };
};

/** 효과 객체 → 배지 목록 */
export function describeEffects(effects = {}, { cost = 0 } = {}) {
  const chips = [];
  if (cost) chips.push(chip('💸', '비용', -cost));
  if (effects.money) chips.push(chip('💰', '자금', effects.money));
  if (effects.happiness) chips.push(chip('😊', '행복', effects.happiness));
  for (const [key, value] of Object.entries(effects.stats ?? {})) {
    chips.push(chip(STAT_ICONS[key] ?? '📊', STAT_LABELS[key] ?? key, value));
  }
  if (effects.familyHappiness) chips.push(chip('🫂', '가족 행복', effects.familyHappiness));
  if (effects.childHappiness) chips.push(chip('🧒', '아이 행복', effects.childHappiness));
  for (const [key, value] of Object.entries(effects.childStats ?? {})) {
    chips.push(chip('🧒', `아이 ${STAT_LABELS[key] ?? key}`, value));
  }
  if (effects.affection) chips.push(chip('💞', '애정', effects.affection));
  if (effects.education) chips.push(chip('🎓', '학업', effects.education * 8));
  if (effects.lifespan) chips.push(chip('🕰️', '수명', effects.lifespan));
  if (effects.villageFame) chips.push(chip('📣', '명성', effects.villageFame));
  if (effects.promote) chips.push(chip('📈', '승진', effects.promote));
  if (effects.expenseUp) chips.push(chip('🧾', '생활비', effects.expenseUp));
  if (effects.addTrait) {
    const trait = TRAIT_BY_ID[effects.addTrait];
    if (trait) chips.push(chip(trait.icon, `특성 ${trait.label}`, null));
  }
  if (effects.flag) chips.push(chip('🌱', '흔적을 남김', null));
  return chips;
}

/** 배지 HTML */
export function effectChips(effects, options) {
  const chips = describeEffects(effects, options);
  if (!chips.length) return '';
  return `<div class="chips">${chips.map((c) => (
    `<span class="chip ${c.tone}">${c.icon} ${c.text}</span>`
  )).join('')}</div>`;
}

/** 선택지 미리보기용: 무엇이 걸려 있는지 아주 짧게 */
export function stakePreview(choice) {
  const effects = choice.effects ?? choice.success?.effects ?? {};
  const chips = describeEffects(effects).slice(0, 3);
  return chips.map((c) => `<span class="chip ${c.tone} tiny">${c.icon} ${c.text}</span>`).join('');
}
