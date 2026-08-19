// 유전자로 얼굴을 그린다. 부모를 닮은 아이가 한눈에 보이도록.
const escapeAttr = (value) => String(value).replace(/[<>"&]/g, '');

/** 나이가 들면 머리가 하얘진다 */
function hairColorFor(person) {
  const base = person.genes.hairColor ?? '#3a2a1c';
  if (person.age < 50) return base;
  const grayness = Math.min(0.85, (person.age - 50) / 35);
  return mix(base, '#cfcac4', grayness);
}

function mix(hexA, hexB, t) {
  const parse = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [r1, g1, b1] = parse(hexA);
  const [r2, g2, b2] = parse(hexB);
  const to = (a, b) => Math.round(a + (b - a) * t).toString(16).padStart(2, '0');
  return `#${to(r1, r2)}${to(g1, g2)}${to(b1, b2)}`;
}

function faceShape(shape) {
  switch (shape) {
    case 'oval': return '<ellipse cx="50" cy="54" rx="23" ry="29" />';
    case 'square': return '<rect x="26" y="26" width="48" height="54" rx="14" />';
    case 'heart': return '<path d="M50 84 C30 70 24 54 26 42 C28 30 42 24 50 32 C58 24 72 30 74 42 C76 54 70 70 50 84 Z" />';
    case 'round':
    default: return '<ellipse cx="50" cy="54" rx="26" ry="27" />';
  }
}

function hair(style, color, age) {
  const c = escapeAttr(color);
  // 어린아이가 대머리로 보이지 않도록
  const effective = style === 'bald' && age < 35 ? 'short' : style;
  switch (effective) {
    case 'bald':
      return `<path d="M27 46 C30 30 70 30 73 46 C70 40 30 40 27 46 Z" fill="${c}" opacity="0.35" />`;
    case 'buzz':
      return `<path d="M25 48 C26 28 74 28 75 48 C68 38 32 38 25 48 Z" fill="${c}" />`;
    case 'bob':
      return `<path d="M23 52 C22 26 78 26 77 52 L77 62 L69 62 L69 44 C60 38 40 38 31 44 L31 62 L23 62 Z" fill="${c}" />`;
    case 'long':
      return `<path d="M22 52 C21 24 79 24 78 52 L78 92 L68 92 L68 46 C60 39 40 39 32 46 L32 92 L22 92 Z" fill="${c}" />`;
    case 'curly':
      return `<g fill="${c}"><circle cx="34" cy="34" r="11"/><circle cx="50" cy="28" r="12"/><circle cx="66" cy="34" r="11"/><circle cx="28" cy="46" r="9"/><circle cx="72" cy="46" r="9"/></g>`;
    case 'ponytail':
      return `<g fill="${c}"><path d="M24 50 C24 26 76 26 76 50 C68 40 32 40 24 50 Z"/><circle cx="79" cy="58" r="10"/><rect x="70" y="46" width="10" height="16" rx="5"/></g>`;
    case 'wave':
      return `<path d="M23 52 C23 26 77 26 77 52 C72 46 66 52 60 46 C54 40 46 40 40 46 C34 52 28 46 23 52 Z" fill="${c}" />`;
    case 'short':
    default:
      return `<path d="M24 50 C24 26 76 26 76 50 C70 40 30 40 24 50 Z" fill="${c}" />`;
  }
}

/**
 * 인물 아바타 SVG 문자열.
 * @param {object} person
 * @param {number} size 픽셀
 */
export function avatarSvg(person, size = 72) {
  const genes = person.genes ?? {};
  const skin = escapeAttr(genes.skin ?? '#f7cfa8');
  const eye = escapeAttr(genes.eyeColor ?? '#3a2a1c');
  const blush = escapeAttr(genes.blush ?? '#f2a3a3');
  const hairCol = hairColorFor(person);
  const baby = person.age <= 3;
  const eyeY = baby ? 58 : 55;
  const smile = (person.happiness ?? 60) >= 55;
  const mouth = smile
    ? `<path d="M42 ${eyeY + 12} Q50 ${eyeY + 19} 58 ${eyeY + 12}" stroke="#8a4a44" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
    : `<path d="M42 ${eyeY + 16} Q50 ${eyeY + 10} 58 ${eyeY + 16}" stroke="#8a4a44" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  const freckles = genes.freckles
    ? `<g fill="#b9764f" opacity="0.55"><circle cx="36" cy="${eyeY + 7}" r="1.5"/><circle cx="41" cy="${eyeY + 9}" r="1.3"/><circle cx="59" cy="${eyeY + 7}" r="1.5"/><circle cx="64" cy="${eyeY + 9}" r="1.3"/></g>`
    : '';
  const glasses = person.stats?.intellect >= 85
    ? `<g fill="none" stroke="#4b4b4b" stroke-width="1.8" opacity="0.8"><circle cx="39" cy="${eyeY}" r="8"/><circle cx="61" cy="${eyeY}" r="8"/><path d="M47 ${eyeY} h6"/></g>`
    : '';
  const wrinkles = person.age >= 62
    ? `<g stroke="#00000022" stroke-width="1.4" fill="none"><path d="M31 ${eyeY - 6} q4 -3 8 -1"/><path d="M61 ${eyeY - 7} q4 -2 8 1"/></g>`
    : '';

  return `<svg class="avatar-svg" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="${escapeAttr(person.givenName ?? '')} 초상">
  <g fill="${skin}">${faceShape(genes.face ?? 'round')}</g>
  <ellipse cx="24" cy="56" rx="5" ry="7" fill="${skin}"/>
  <ellipse cx="76" cy="56" rx="5" ry="7" fill="${skin}"/>
  ${hair(genes.hairStyle ?? 'short', hairCol, person.age ?? 20)}
  <g>
    <ellipse cx="39" cy="${eyeY}" rx="4.6" ry="5.2" fill="#ffffff"/>
    <ellipse cx="61" cy="${eyeY}" rx="4.6" ry="5.2" fill="#ffffff"/>
    <circle cx="39" cy="${eyeY}" r="2.8" fill="${eye}"/>
    <circle cx="61" cy="${eyeY}" r="2.8" fill="${eye}"/>
    <circle cx="40" cy="${eyeY - 1}" r="0.9" fill="#ffffff"/>
    <circle cx="62" cy="${eyeY - 1}" r="0.9" fill="#ffffff"/>
  </g>
  ${glasses}
  <ellipse cx="31" cy="${eyeY + 8}" rx="5" ry="3" fill="${blush}" opacity="0.45"/>
  <ellipse cx="69" cy="${eyeY + 8}" rx="5" ry="3" fill="${blush}" opacity="0.45"/>
  ${freckles}
  ${wrinkles}
  ${mouth}
</svg>`;
}
