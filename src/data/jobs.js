// 직업 목록. edu 는 필요한 최소 학력(0 무학 ~ 4 대학원졸), req 는 최소 스탯.
// salary 는 연봉(만원), growth 는 승진 1단계당 상승률.
export const JOBS = [
  { id: 'farmer', label: '농부', icon: '🌾', edu: 0, req: { fitness: 20 }, salary: 2200, growth: 0.06, stat: 'fitness', happiness: 1 },
  { id: 'clerk', label: '상점 점원', icon: '🏪', edu: 1, req: { charm: 20 }, salary: 2400, growth: 0.06, stat: 'charm' },
  { id: 'cook', label: '요리사', icon: '🍳', edu: 1, req: { creativity: 30 }, salary: 2900, growth: 0.08, stat: 'creativity' },
  { id: 'builder', label: '목수', icon: '🔨', edu: 1, req: { fitness: 40 }, salary: 3200, growth: 0.07, stat: 'fitness' },
  { id: 'driver', label: '운전기사', icon: '🚚', edu: 1, req: { health: 35 }, salary: 3000, growth: 0.05, stat: 'health' },
  { id: 'athlete', label: '운동선수', icon: '🏅', edu: 1, req: { fitness: 70, health: 55 }, salary: 5200, growth: 0.14, stat: 'fitness', happiness: 1 },
  { id: 'idol', label: '아이돌', icon: '🎤', edu: 1, req: { charm: 75, creativity: 50 }, salary: 6000, growth: 0.16, stat: 'charm' },
  { id: 'artist', label: '화가', icon: '🎨', edu: 2, req: { creativity: 60 }, salary: 3000, growth: 0.11, stat: 'creativity', happiness: 2 },
  { id: 'nurse', label: '간호사', icon: '💊', edu: 3, req: { intellect: 55, health: 45 }, salary: 4200, growth: 0.08, stat: 'health', happiness: 1 },
  { id: 'teacher', label: '교사', icon: '🏫', edu: 3, req: { intellect: 60, charm: 40 }, salary: 4000, growth: 0.08, stat: 'intellect', happiness: 1 },
  { id: 'engineer', label: '엔지니어', icon: '⚙️', edu: 3, req: { intellect: 65 }, salary: 5000, growth: 0.11, stat: 'intellect' },
  { id: 'designer', label: '디자이너', icon: '🖌️', edu: 3, req: { creativity: 65, intellect: 45 }, salary: 4600, growth: 0.10, stat: 'creativity' },
  { id: 'merchant', label: '사업가', icon: '📈', edu: 2, req: { charm: 55, intellect: 50 }, salary: 4400, growth: 0.16, stat: 'charm' },
  { id: 'doctor', label: '의사', icon: '🩺', edu: 4, req: { intellect: 80, health: 55 }, salary: 7800, growth: 0.10, stat: 'intellect' },
  { id: 'professor', label: '교수', icon: '🎓', edu: 4, req: { intellect: 85, creativity: 55 }, salary: 6800, growth: 0.09, stat: 'intellect', happiness: 1 },
];

export const JOB_BY_ID = Object.fromEntries(JOBS.map((j) => [j.id, j]));

/** 지원 가능 여부 */
export function canApply(person, job) {
  if (person.education < job.edu) return false;
  return Object.entries(job.req).every(([key, min]) => person.stats[key] >= min);
}
