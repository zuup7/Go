// 유전자로 초상화를 그린다. 부모를 닮은 아이가 한눈에 보이도록.
// 머리(뒷머리/앞머리) · 얼굴 · 표정 · 옷을 겹쳐 그리는 치비 스타일.

const esc = (value) => String(value).replace(/[<>"&]/g, '');

/** id 로 안정적인 해시 (옷 색처럼 유전과 무관한 요소에 쓴다) */
function hashOf(text) {
  let hash = 0;
  for (let i = 0; i < String(text).length; i++) hash = (hash * 31 + String(text).charCodeAt(i)) >>> 0;
  return hash;
}

const OUTFITS = [
  ['#e8927c', '#d1725c'], ['#7fb3d5', '#5f93b5'], ['#8fbf8f', '#6f9f6f'],
  ['#c8a2c8', '#a882a8'], ['#f0c05a', '#d0a03a'], ['#e79db5', '#c77d95'],
  ['#9aa7d8', '#7a87b8'], ['#79c2bc', '#59a29c'],
];

function mix(hexA, hexB, t) {
  const parse = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [r1, g1, b1] = parse(hexA);
  const [r2, g2, b2] = parse(hexB);
  const to = (a, b) => Math.round(a + (b - a) * t).toString(16).padStart(2, '0');
  return `#${to(r1, r2)}${to(g1, g2)}${to(b1, b2)}`;
}

const darken = (hex, t = 0.25) => mix(hex, '#000000', t);

/** 나이가 들면 머리가 하얘진다 */
function hairColorFor(person) {
  const base = person.genes?.hairColor ?? '#3a2a1c';
  if (person.age < 48) return base;
  return mix(base, '#e2ddd6', Math.min(0.9, (person.age - 48) / 32));
}

// ── 얼굴형 ────────────────────────────────────────────────

function headPath(shape) {
  switch (shape) {
    case 'oval': return '<ellipse cx="60" cy="56" rx="30" ry="35" />';
    case 'square': return '<rect x="29" y="24" width="62" height="66" rx="22" />';
    case 'heart': return '<path d="M60 92 C34 76 27 56 30 42 C33 28 50 24 60 34 C70 24 87 28 90 42 C93 56 86 76 60 92 Z" />';
    case 'round':
    default: return '<ellipse cx="60" cy="56" rx="33" ry="32" />';
  }
}

// ── 머리 ─────────────────────────────────────────────────

/** 얼굴 뒤에 깔리는 머리 (긴 머리, 묶은 머리 등) */
function hairBack(style, color) {
  const dark = darken(color, 0.18);
  switch (style) {
    case 'long':
      return `<path d="M24 52 C24 20 96 20 96 52 L96 104 L84 104 L84 56 L36 56 L36 104 L24 104 Z" fill="${dark}"/>`;
    case 'wave':
      return `<path d="M25 54 C25 22 95 22 95 54 L95 92 Q84 100 82 88 L82 58 L38 58 L38 88 Q36 100 25 92 Z" fill="${dark}"/>`;
    case 'ponytail':
      return `<g fill="${dark}"><ellipse cx="97" cy="66" rx="11" ry="17"/><path d="M92 78 q10 14 4 24 q-8 -8 -10 -18 Z"/></g>`;
    case 'twintail':
      return `<g fill="${dark}"><ellipse cx="21" cy="66" rx="10" ry="16"/><ellipse cx="99" cy="66" rx="10" ry="16"/></g>`;
    case 'bun':
      return `<circle cx="60" cy="18" r="12" fill="${dark}"/>`;
    case 'afro':
      return `<circle cx="60" cy="48" r="42" fill="${dark}"/>`;
    case 'bob':
      return `<path d="M26 52 C26 22 94 22 94 52 L94 74 L84 74 L84 54 L36 54 L36 74 L26 74 Z" fill="${dark}"/>`;
    default:
      return '';
  }
}

/** 얼굴 위에 얹히는 앞머리 */
function hairFront(style, color, age) {
  const c = esc(color);
  const effective = style === 'bald' && age < 40 ? 'short' : style;
  switch (effective) {
    case 'bald':
      return `<path d="M30 46 C34 26 86 26 90 46 C82 38 38 38 30 46 Z" fill="${c}" opacity=".35"/>`;
    case 'buzz':
      return `<path d="M28 54 C27 24 93 24 92 54 C86 40 74 36 60 36 C46 36 34 40 28 54 Z" fill="${c}"/>`;
    case 'curly':
    case 'afro':
      return `<g fill="${c}"><circle cx="38" cy="34" r="13"/><circle cx="58" cy="26" r="15"/><circle cx="80" cy="34" r="13"/><circle cx="30" cy="48" r="11"/><circle cx="90" cy="48" r="11"/></g>`;
    case 'long':
    case 'wave':
      return `<path d="M25 70 C24 22 96 22 95 70 C92 52 88 42 82 44 C74 38 64 44 56 46 C48 47 42 42 36 38 C30 44 27 54 25 70 Z" fill="${c}"/>`;
    case 'bob':
      return `<path d="M25 68 C24 22 96 22 95 68 C92 50 88 42 84 44 C76 36 44 36 36 44 C32 42 28 50 25 68 Z" fill="${c}"/>`;
    case 'ponytail':
    case 'twintail':
    case 'bun':
      return `<path d="M27 60 C26 22 94 22 93 60 C90 46 84 40 78 42 C72 34 48 34 42 42 C36 40 30 46 27 60 Z" fill="${c}"/>`;
    case 'short':
    default:
      return `<path d="M27 60 C26 22 94 22 93 60 C89 46 82 38 68 38 C54 38 40 42 27 60 Z" fill="${c}"/>`;
  }
}

/** 아기는 머리숱 대신 배냇머리 한 가닥 */
const babyCurl = (color) =>
  `<path d="M60 24 q2 -12 12 -10 q-8 3 -6 11 Z" fill="${esc(color)}"/>`;

// ── 표정 ─────────────────────────────────────────────────

function mouthOf(happiness, age) {
  if (age <= 2) return '<ellipse cx="60" cy="74" rx="5" ry="4.5" fill="#b8595a"/>';
  if (happiness >= 80) return '<path d="M50 70 q10 13 20 0 q-10 5 -20 0 Z" fill="#b8595a" stroke="#8a4a44" stroke-width="1.5" stroke-linejoin="round"/>';
  if (happiness >= 55) return '<path d="M51 71 Q60 79 69 71" stroke="#8a4a44" stroke-width="2.6" fill="none" stroke-linecap="round"/>';
  if (happiness >= 32) return '<path d="M52 74 h16" stroke="#8a4a44" stroke-width="2.6" fill="none" stroke-linecap="round"/>';
  return '<path d="M51 77 Q60 69 69 77" stroke="#8a4a44" stroke-width="2.6" fill="none" stroke-linecap="round"/>';
}

function browsOf(happiness, color) {
  const c = esc(color);
  if (happiness >= 70) return `<g stroke="${c}" stroke-width="3" stroke-linecap="round" fill="none"><path d="M40 44 q6 -4 12 -1"/><path d="M68 43 q6 -3 12 1"/></g>`;
  if (happiness >= 35) return `<g stroke="${c}" stroke-width="3" stroke-linecap="round" fill="none"><path d="M40 45 h12"/><path d="M68 45 h12"/></g>`;
  return `<g stroke="${c}" stroke-width="3" stroke-linecap="round" fill="none"><path d="M40 42 q6 3 12 4"/><path d="M80 42 q-6 3 -12 4"/></g>`;
}

function eyesOf(person, eye) {
  const baby = person.age <= 2;
  const rx = baby ? 8 : 7.2;
  const ry = baby ? 9 : 8.4;
  const y = baby ? 60 : 57;
  const iris = baby ? 5 : 4.6;
  const closed = !person.alive;
  if (closed) {
    return `<g stroke="#6b5b4f" stroke-width="2.6" fill="none" stroke-linecap="round">
      <path d="M38 ${y} q7 6 14 0"/><path d="M68 ${y} q7 6 14 0"/></g>`;
  }
  const one = (cx) => `
    <ellipse cx="${cx}" cy="${y}" rx="${rx}" ry="${ry}" fill="#ffffff"/>
    <circle cx="${cx}" cy="${y + 0.6}" r="${iris}" fill="${eye}"/>
    <circle cx="${cx}" cy="${y + 0.6}" r="${iris * 0.5}" fill="#2a1f18"/>
    <circle cx="${cx - 1.8}" cy="${y - 2.4}" r="1.9" fill="#ffffff"/>
    <circle cx="${cx + 2.2}" cy="${y + 2.6}" r="1" fill="#ffffff" opacity=".8"/>`;
  return `<g>${one(45)}${one(75)}</g>`;
}

// ── 옷 ───────────────────────────────────────────────────

function outfitOf(person) {
  const [main, shade] = OUTFITS[hashOf(person.id ?? person.givenName ?? 'x') % OUTFITS.length];
  const collar = person.age >= 19 ? `<path d="M52 96 l8 8 l8 -8 l-4 -3 l-4 4 l-4 -4 Z" fill="#ffffff" opacity=".85"/>` : '';
  return `
    <path d="M60 88 q-6 0 -8 6 l-2 6 h20 l-2 -6 q-2 -6 -8 -6 Z" fill="${person.genes?.skin ?? '#f7cfa8'}"/>
    <path d="M28 120 q2 -22 32 -25 q30 3 32 25 Z" fill="${main}"/>
    <path d="M28 120 q1 -12 10 -18 l4 18 Z" fill="${shade}"/>
    <path d="M92 120 q-1 -12 -10 -18 l-4 18 Z" fill="${shade}"/>
    ${collar}`;
}

// ── 초상화 ───────────────────────────────────────────────

/** 인물 초상 SVG */
export function avatarSvg(person, size = 72) {
  const genes = person.genes ?? {};
  const skin = esc(genes.skin ?? '#f7cfa8');
  const skinShade = darken(skin, 0.12);
  const eye = esc(genes.eyeColor ?? '#3a2a1c');
  const blush = esc(genes.blush ?? '#f2a3a3');
  const hair = hairColorFor(person);
  const style = genes.hairStyle ?? 'short';
  const baby = person.age <= 2;
  const happiness = person.alive ? (person.happiness ?? 60) : 40;

  const freckles = genes.freckles
    ? `<g fill="#b9764f" opacity=".5"><circle cx="41" cy="66" r="1.7"/><circle cx="46" cy="69" r="1.4"/><circle cx="74" cy="66" r="1.7"/><circle cx="79" cy="69" r="1.4"/></g>`
    : '';
  const glasses = (person.stats?.intellect ?? 0) >= 85
    ? `<g fill="none" stroke="#4b4b4b" stroke-width="2.2" opacity=".85"><rect x="35" y="49" width="20" height="17" rx="8"/><rect x="65" y="49" width="20" height="17" rx="8"/><path d="M55 57 h10"/></g>`
    : '';
  const wrinkles = person.age >= 62
    ? `<g stroke="#00000022" stroke-width="1.6" fill="none" stroke-linecap="round"><path d="M34 47 q5 -4 10 -2"/><path d="M86 47 q-5 -4 -10 -2"/><path d="M40 78 q6 3 10 1"/></g>`
    : '';
  const beard = person.gender === 'male' && person.age >= 45 && hashOf(person.id ?? '') % 3 === 0
    ? `<path d="M38 66 q0 26 22 26 q22 0 22 -26 q-6 18 -22 18 q-16 0 -22 -18 Z" fill="${hair}" opacity=".9"/>`
    : '';

  return `<svg class="avatar-svg" viewBox="0 0 120 120" width="${size}" height="${size}" role="img" aria-label="${esc(person.givenName ?? '')} 초상">
  ${baby ? '' : hairBack(style, hair)}
  ${outfitOf(person)}
  <g fill="${skin}">${headPath(genes.face ?? 'round')}</g>
  <ellipse cx="27" cy="60" rx="6" ry="8" fill="${skinShade}"/>
  <ellipse cx="93" cy="60" rx="6" ry="8" fill="${skinShade}"/>
  ${baby ? babyCurl(hair) : hairFront(style, hair, person.age ?? 20)}
  ${beard}
  ${browsOf(happiness, darken(hair, 0.2))}
  ${eyesOf(person, eye)}
  ${glasses}
  <path d="M60 64 q-2 4 1 5" stroke="${skinShade}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <ellipse cx="34" cy="70" rx="7" ry="4.4" fill="${blush}" opacity=".5"/>
  <ellipse cx="86" cy="70" rx="7" ry="4.4" fill="${blush}" opacity=".5"/>
  ${freckles}
  ${wrinkles}
  ${mouthOf(happiness, person.age ?? 20)}
</svg>`;
}

/** 기분/상태를 나타내는 뱃지 이모지 */
export function moodEmoji(person) {
  if (!person.alive) return '🕯️';
  if (person.age <= 2) return '👶';
  const happiness = person.happiness ?? 60;
  if (happiness >= 88) return '😍';
  if (happiness >= 68) return '😊';
  if (happiness >= 45) return '🙂';
  if (happiness >= 25) return '😟';
  return '😭';
}

/**
 * 링과 상태 뱃지까지 붙인 초상화 카드.
 * @param {object} person
 * @param {number} size 지름(px)
 * @param {{badge?: string, ring?: boolean, ageTag?: boolean}} options
 */
export function portrait(person, size = 72, options = {}) {
  const { badge = moodEmoji(person), ring = true, ageTag = false } = options;
  const classes = ['portrait'];
  classes.push(person.gender === 'male' ? 'male' : 'female');
  if (!person.alive) classes.push('gone');
  if (!ring) classes.push('plain');
  return `<span class="${classes.join(' ')}" style="--portrait-size:${size}px">
    ${avatarSvg(person, size)}
    ${badge ? `<span class="portrait-badge" aria-hidden="true">${badge}</span>` : ''}
    ${ageTag && person.alive ? `<span class="portrait-age">${person.age}</span>` : ''}
  </span>`;
}
