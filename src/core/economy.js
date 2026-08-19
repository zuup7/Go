// 살림살이: 버는 돈과 쓰는 돈.
import { JOB_BY_ID } from '../data/jobs.js';
import { traitEffects } from './genetics.js';

export const BASE_LIVING_COST = 1200;  // 성인 1인 연간 생활비(만원)
export const MAX_JOB_LEVEL = 10;       // 호봉 상한
export const CHILD_COST = 600;         // 아이 1인 추가 비용

/** 개인의 연봉 (직업 + 승진 + 특성 + 마을 보정) */
export function salaryOf(person, bonuses = {}) {
  if (!person.jobId || !person.alive) return 0;
  const job = JOB_BY_ID[person.jobId];
  if (!job) return 0;
  const traits = traitEffects(person.traits);
  const skill = person.stats[job.stat] ?? 50;
  const levelMul = 1 + job.growth * Math.min(MAX_JOB_LEVEL, person.jobLevel);
  const skillMul = 0.65 + skill / 100;
  const mul = 1 + traits.income + (bonuses.incomeRate ?? 0);
  return Math.round(job.salary * levelMul * skillMul * Math.max(0.3, mul));
}

/** 가구 전체 연 수입 */
export function householdIncome(members, bonuses = {}) {
  const wages = members.reduce((sum, person) => sum + salaryOf(person, bonuses), 0);
  return Math.round(wages + (bonuses.income ?? 0));
}

/** 가구 전체 연 지출 */
export function householdExpense(members, bonuses = {}, extraUpkeep = 0) {
  const adults = members.filter((p) => p.age >= 19).length;
  const kids = members.filter((p) => p.age < 19).length;
  const traitRate = members.reduce((sum, p) => sum + traitEffects(p.traits).expense, 0) / Math.max(1, members.length);
  const rate = Math.max(0.4, 1 + traitRate + (bonuses.expenseRate ?? 0));
  const base = adults * BASE_LIVING_COST + kids * CHILD_COST + extraUpkeep * 120;
  return Math.round(base * rate);
}

/** 승진 판정: 실력이 좋고 일에 집중할수록 잘 오른다 */
export function promotionChance(person, focused) {
  if (!person.jobId || person.jobLevel >= MAX_JOB_LEVEL) return 0;
  const job = JOB_BY_ID[person.jobId];
  const skill = person.stats[job.stat] ?? 50;
  const base = 0.10 + (skill - 45) / 260 + (focused ? 0.22 : 0);
  const fatigue = person.jobLevel * 0.012;
  return Math.max(0.02, Math.min(0.85, base - fatigue));
}
