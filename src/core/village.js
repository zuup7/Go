// 마을: 건물을 짓고 올릴수록 가족 전체가 이득을 본다.
import { BUILDINGS, BUILDING_BY_ID, buildCost } from '../data/buildings.js';

/** 지어진 건물 레벨의 합으로 마을 등급이 정해진다 */
export function villageLevel(village) {
  const total = Object.values(village.buildings).reduce((a, b) => a + b, 0);
  return Math.max(1, Math.min(10, 1 + Math.floor(total / 3)));
}

export function villageTitle(level) {
  if (level >= 9) return '대도시';
  if (level >= 7) return '번화한 도시';
  if (level >= 5) return '작은 도시';
  if (level >= 3) return '활기찬 마을';
  return '조용한 마을';
}

/** 건물이 많을수록 관리에 돈이 든다 (연간, 만원) */
export const MAINTENANCE_PER_LEVEL = 110;

export function villageMaintenance(village) {
  const levels = Object.values(village.buildings).reduce((a, b) => a + b, 0);
  return levels * MAINTENANCE_PER_LEVEL;
}

/** 모든 건물 효과 합계 */
export function villageBonuses(village) {
  const total = { income: 0, incomeRate: 0, expenseRate: 0, happiness: 0, lifespan: 0, romance: 0, grow: {} };
  for (const [id, level] of Object.entries(village.buildings)) {
    const building = BUILDING_BY_ID[id];
    if (!building || level <= 0) continue;
    const effect = building.effect(level);
    for (const [key, value] of Object.entries(effect)) {
      if (key === 'grow') {
        for (const [statKey, statValue] of Object.entries(value)) {
          total.grow[statKey] = (total.grow[statKey] ?? 0) + statValue;
        }
      } else {
        total[key] = (total[key] ?? 0) + value;
      }
    }
  }
  total.happiness += (village.fame ?? 0) * 0.05;
  return total;
}

/** 지금 지을(올릴) 수 있는지 */
export function buildStatus(village, buildingId, money) {
  const building = BUILDING_BY_ID[buildingId];
  if (!building) return { ok: false, reason: '알 수 없는 건물' };
  const level = village.buildings[buildingId] ?? 0;
  if (level >= building.maxLevel) return { ok: false, reason: '최대 레벨', maxed: true, level };
  const cost = buildCost(building, level);
  const need = building.requires?.villageLevel ?? 0;
  if (villageLevel(village) < need) return { ok: false, reason: `마을 ${need}등급 필요`, cost, level };
  if (money < cost) return { ok: false, reason: '자금 부족', cost, level };
  return { ok: true, cost, level };
}

/** 건설/증축 실행. 성공하면 든 비용을 돌려준다. */
export function build(village, buildingId, money) {
  const status = buildStatus(village, buildingId, money);
  if (!status.ok) return { ok: false, reason: status.reason, spent: 0 };
  village.buildings[buildingId] = (village.buildings[buildingId] ?? 0) + 1;
  return { ok: true, spent: status.cost, level: village.buildings[buildingId] };
}

export function createVillage(name) {
  const village = { name, buildings: {}, fame: 0 };
  for (const building of BUILDINGS) {
    if (building.startLevel) village.buildings[building.id] = building.startLevel;
  }
  return village;
}
