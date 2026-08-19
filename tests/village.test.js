import test from 'node:test';
import assert from 'node:assert/strict';
import { createVillage, build, buildStatus, villageBonuses, villageLevel, villageTitle, villageMaintenance, MAINTENANCE_PER_LEVEL } from '../src/core/village.js';
import { BUILDING_BY_ID, buildCost } from '../src/data/buildings.js';

test('새 마을은 집 한 채로 시작한다', () => {
  const village = createVillage('햇살마을');
  assert.equal(village.buildings.house, 1);
  assert.equal(villageLevel(village), 1);
  assert.equal(villageTitle(1), '조용한 마을');
});

test('돈이 모자라면 지을 수 없다', () => {
  const village = createVillage('테스트');
  const result = build(village, 'shop', 10);
  assert.equal(result.ok, false);
  assert.equal(village.buildings.shop, undefined);
});

test('건설하면 레벨이 오르고 비용이 청구된다', () => {
  const village = createVillage('테스트');
  const cost = buildCost(BUILDING_BY_ID.shop, 0);
  const result = build(village, 'shop', 99999);
  assert.equal(result.ok, true);
  assert.equal(result.spent, cost);
  assert.equal(village.buildings.shop, 1);
  assert.ok(buildCost(BUILDING_BY_ID.shop, 1) > cost, '증축은 더 비싸다');
});

test('마을 등급이 낮으면 고급 건물이 잠긴다', () => {
  const village = createVillage('테스트');
  const status = buildStatus(village, 'theater', 999999);
  assert.equal(status.ok, false);
  assert.match(status.reason, /등급/);
});

test('최대 레벨을 넘겨 지을 수 없다', () => {
  const village = createVillage('테스트');
  const max = BUILDING_BY_ID.garden.maxLevel;
  for (let i = 0; i < max; i++) assert.equal(build(village, 'garden', 999999).ok, true);
  const over = buildStatus(village, 'garden', 999999);
  assert.equal(over.ok, false);
  assert.equal(over.maxed, true);
});

test('건물 효과가 합산된다', () => {
  const village = createVillage('테스트');
  build(village, 'garden', 999999);
  build(village, 'park', 999999);
  const bonuses = villageBonuses(village);
  assert.ok(bonuses.expenseRate < 0, '텃밭이 생활비를 줄인다');
  assert.ok(bonuses.happiness > 0, '공원과 집이 행복을 준다');
  assert.ok(bonuses.grow.fitness > 0, '공원이 체력 성장을 돕는다');
});

test('관리비는 총 레벨에 비례한다', () => {
  const village = createVillage('테스트');
  const before = villageMaintenance(village);
  build(village, 'garden', 999999);
  assert.equal(villageMaintenance(village) - before, MAINTENANCE_PER_LEVEL);
});
