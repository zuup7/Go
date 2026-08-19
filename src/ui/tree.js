// 족보 트리: 세대를 위에서 아래로, 부부는 나란히, 부모와 자식은 선으로 잇는다.
import { portrait } from './avatar.js';
import { fullName } from '../core/person.js';
import * as G from '../core/game.js';

const CARD_W = 104;     // 인물 카드 너비
const CARD_H = 116;     // 인물 카드 높이
const PAIR_GAP = 26;    // 부부 사이 (하트 자리)
const SIB_GAP = 22;     // 형제 사이
const ROW_GAP = 62;     // 세대 사이 (선이 지나는 공간)
const ROW_H = CARD_H + ROW_GAP;

const esc = (text) => String(text).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

/**
 * 가문을 부부 단위(unit)의 트리로 만든다.
 * 핏줄인 사람이 기준이고, 배우자는 옆에 붙는다.
 */
function buildUnits(state) {
  const people = G.allPeople(state);
  const byId = state.people;
  const inTree = people.filter((p) => p.inFamily || p.bloodline || p.partnerId);
  const used = new Set();
  const units = new Map();   // 핏줄 id → unit

  for (const person of inTree) {
    if (!person.bloodline || used.has(person.id)) continue;
    const spouse = person.partnerId ? byId[person.partnerId] : null;
    const members = spouse ? [person, spouse] : [person];
    for (const m of members) used.add(m.id);
    units.set(person.id, {
      id: person.id,
      members,
      anchor: person,
      children: [],
      width: members.length * CARD_W + (members.length - 1) * PAIR_GAP,
    });
  }

  // 결혼으로 들어온 사람 중 짝이 없는 경우(사별 등)도 자기 자리를 갖는다
  for (const person of inTree) {
    if (used.has(person.id)) continue;
    if (!person.inFamily) continue;
    units.set(person.id, {
      id: person.id, members: [person], anchor: person, children: [], width: CARD_W,
    });
    used.add(person.id);
  }

  // 부모-자식 연결
  const roots = [];
  for (const unit of units.values()) {
    const parentId = unit.anchor.parents.find((id) => units.has(id));
    const parentUnit = parentId ? units.get(parentId) : null;
    if (parentUnit && parentUnit !== unit) parentUnit.children.push(unit);
    else roots.push(unit);
  }
  for (const unit of units.values()) {
    unit.children.sort((a, b) => a.anchor.birthYear - b.anchor.birthYear);
  }
  roots.sort((a, b) => a.anchor.generation - b.anchor.generation || a.anchor.birthYear - b.anchor.birthYear);
  return roots;
}

/** 겹치지 않게 자리를 잡는다 (자식들을 먼저 놓고 부모를 그 가운데로) */
function layout(roots) {
  const nextX = [];       // 세대별로 다음에 쓸 수 있는 x
  const place = (unit, depth) => {
    unit.depth = depth;
    nextX[depth] = nextX[depth] ?? 0;

    if (!unit.children.length) {
      unit.x = nextX[depth];
    } else {
      for (const child of unit.children) place(child, depth + 1);
      const first = unit.children[0];
      const last = unit.children[unit.children.length - 1];
      const center = (first.x + last.x + last.width) / 2;
      unit.x = Math.max(nextX[depth], center - unit.width / 2);
      const drift = unit.x + unit.width / 2 - center;
      if (drift > 0) shift(unit.children, drift);   // 부모가 밀리면 자식도 함께
    }
    nextX[depth] = unit.x + unit.width + SIB_GAP;
  };

  const shift = (units, dx) => {
    for (const unit of units) {
      unit.x += dx;
      nextX[unit.depth] = Math.max(nextX[unit.depth] ?? 0, unit.x + unit.width + SIB_GAP);
      shift(unit.children, dx);
    }
  };

  for (const root of roots) place(root, 0);

  const all = [];
  const walk = (unit) => { all.push(unit); unit.children.forEach(walk); };
  roots.forEach(walk);
  const width = Math.max(...all.map((u) => u.x + u.width), CARD_W) + 20;
  const depth = Math.max(...all.map((u) => u.depth)) + 1;
  return { units: all, width, height: depth * ROW_H };
}

const unitCenter = (unit) => unit.x + unit.width / 2;
const unitTop = (unit) => unit.depth * ROW_H;

/** 부모와 자식을 잇는 선 */
function connectors(units) {
  const paths = [];
  for (const unit of units) {
    if (!unit.children.length) continue;
    const startX = unitCenter(unit);
    const startY = unitTop(unit) + CARD_H;
    const busY = startY + ROW_GAP / 2;
    paths.push(`M ${startX} ${startY} V ${busY}`);
    const xs = unit.children.map(unitCenter);
    paths.push(`M ${Math.min(...xs)} ${busY} H ${Math.max(...xs)}`);
    for (const child of unit.children) {
      paths.push(`M ${unitCenter(child)} ${busY} V ${unitTop(child)}`);
    }
  }
  return paths;
}

function personNode(state, person, x, y) {
  const me = G.player(state);
  const classes = ['tree-card'];
  if (person.id === me?.id) classes.push('me');
  if (!person.alive) classes.push('gone');
  const relation = G.relationOf(state, person);
  return `
    <button class="${classes.join(' ')}" style="left:${x}px; top:${y}px" data-act="person" data-id="${person.id}">
      ${portrait(person, 52, { ageTag: person.alive })}
      <span class="tree-name">${esc(fullName(person))}</span>
      <span class="tree-meta">${person.alive ? esc(relation) : `${person.birthYear}–${person.deathYear}`}</span>
    </button>`;
}

/** 족보 트리 HTML */
export function familyTree(state) {
  const roots = buildUnits(state);
  if (!roots.length) return '<p class="muted">아직 가족이 없습니다.</p>';
  const { units, width, height } = layout(roots);

  const nodes = units.map((unit) => {
    const y = unitTop(unit);
    let x = unit.x;
    const cards = unit.members.map((person) => {
      const html = personNode(state, person, x, y);
      x += CARD_W + PAIR_GAP;
      return html;
    }).join('');
    const heart = unit.members.length > 1
      ? `<span class="tree-heart" style="left:${unit.x + CARD_W}px; top:${y + 30}px">💞</span>`
      : '';
    return cards + heart;
  }).join('');

  const paths = connectors(units)
    .map((d) => `<path d="${d}" />`)
    .join('');

  return `
    <div class="tree-scroll">
      <div class="tree-canvas" style="width:${width}px; height:${height}px">
        <svg class="tree-lines" width="${width}" height="${height}" aria-hidden="true">${paths}</svg>
        ${nodes}
      </div>
    </div>`;
}
