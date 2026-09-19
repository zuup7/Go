// 의존성 없는 한 파일 빌드.
// 모든 모듈을 IIFE 로 감싸 하나의 인라인 <script> 로 이어 붙인다.
//
//   node build.mjs                       → 루트(Family Go!) 를 dist/play.html 로
//   node build.mjs chartrun              → chartrun/ 을 chartrun/dist/play.html 로
//   node build.mjs chartrun --artifact   → 아티팩트용 조각 chartrun/dist/artifact.html 로
//   node build.mjs chartrun --kiosk      → 남에게 줄 판 (개발자 버튼 없음) chartrun/dist/app.html 로
//   node build.mjs chartrun --pwa        → 웹에 올릴 판 docs/ 로 (홈 화면에 깔린다)
//
// 프로젝트는 index.html / assets/style.css / src/ui/app.js 구조만 지키면 된다.
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join, posix } from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const ARTIFACT = args.includes('--artifact');
/**
 * 웹(GitHub Pages)에 올려 **홈 화면에 깔리게** 하는 판.
 * 게임은 그대로고 포장만 더 붙는다 — manifest, 서비스 워커, 아이콘.
 */
const PWA = args.includes('--pwa');
// 남에게 줄 판. 개발자 모드 버튼을 빼는 것 말고는 똑같다 (웹에 올리는 판도 마찬가지다).
const KIOSK = args.includes('--kiosk') || PWA;
const BASE = (args.find((a) => !a.startsWith('--')) ?? '.').replace(/\/+$/, '');
const at = (path) => (BASE === '.' ? path : posix.join(BASE, path));

const ENTRY = at('src/ui/app.js');
// PWA 만 저장소 맨 위 docs/ 로 나간다 — GitHub Pages 가 뿌릴 수 있는 폴더가
// 루트 아니면 /docs 둘뿐이다.
const OUT = PWA
  ? 'docs/index.html'
  : at(ARTIFACT ? 'dist/artifact.html' : KIOSK ? 'dist/app.html' : 'dist/play.html');

/** src 아래 모든 .js 수집 */
async function collect(dir, found = []) {
  for (const entry of await readdir(join(ROOT, dir), { withFileTypes: true })) {
    const path = posix.join(dir, entry.name);
    if (entry.isDirectory()) await collect(path, found);
    else if (entry.name.endsWith('.js')) found.push(path);
  }
  return found;
}

// import 문 하나를 통째로 잡는다 (여러 줄에 걸쳐도 된다)
const IMPORT_STMT = /(^|\n)([ \t]*)import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]\s*;?/g;

function importsOf(code) {
  return [...code.matchAll(IMPORT_STMT)].map((m) => m[4]).filter((spec) => spec.startsWith('.'));
}

/** './x.js' 를 프로젝트 기준 경로로 */
const resolveSpec = (fromPath, spec) =>
  posix.normalize(posix.join(posix.dirname(fromPath), spec));

/** 의존성이 먼저 오도록 정렬 */
function topoSort(entry, graph) {
  const order = [];
  const state = new Map();
  const visit = (path) => {
    if (state.get(path) === 'done') return;
    if (state.get(path) === 'visiting') throw new Error(`순환 참조: ${path}`);
    state.set(path, 'visiting');
    for (const dep of graph.get(path) ?? []) visit(dep.path);
    state.set(path, 'done');
    order.push(path);
  };
  visit(entry);
  return order;
}

// ── ESM → IIFE 변환 ────────────────────────────────────────────
// 지금 두 프로젝트가 쓰는 형태는 이게 전부다:
//   import { a, b as c } from './x.js'   /   import * as N from './x.js'
//   export const NAME = ...              /   export function NAME(...)
// 그 밖의 형태를 만나면 조용히 넘기지 말고 빌드를 멈춘다.
const EXPORT_DECL = /(^|\n)export\s+(const|function)\s+([A-Za-z_$][\w$]*)/g;
const UNSUPPORTED = /(^|\n)\s*export\s+(?!const\s|function\s)/;

function exportedNames(path, code) {
  const bad = code.match(UNSUPPORTED);
  if (bad) {
    throw new Error(
      `${path}: 이 번들러가 모르는 export 형태다 — "${bad[0].trim()}…". ` +
        'export const / export function 만 쓰거나 build.mjs 를 고쳐라.',
    );
  }
  return [...code.matchAll(EXPORT_DECL)].map((m) => m[3]);
}

/** import 문을 __m 레지스트리에서 꺼내는 const 선언으로 바꾼다 */
function rewriteImports(path, code) {
  return code.replace(IMPORT_STMT, (whole, lead, indent, clause, spec) => {
    if (!spec.startsWith('.')) {
      throw new Error(`${path}: 외부 모듈 import 는 지원하지 않는다 — '${spec}'`);
    }
    const key = resolveSpec(path, spec);
    const source = `__m[${JSON.stringify(key)}]`;
    const trimmed = clause.trim();

    const namespace = trimmed.match(/^\*\s+as\s+([A-Za-z_$][\w$]*)$/);
    if (namespace) return `${lead}${indent}const ${namespace[1]} = ${source};`;

    const named = trimmed.match(/^\{([\s\S]*)\}$/);
    if (named) {
      // { a, b as c } → { a, b: c }
      const fields = named[1]
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => part.replace(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/, '$1: $2'))
        .join(', ');
      return `${lead}${indent}const { ${fields} } = ${source};`;
    }

    throw new Error(`${path}: 이 번들러가 모르는 import 형태다 — "import ${trimmed} from '${spec}'"`);
  });
}

/** 모듈 하나를 자기 스코프를 가진 IIFE 로 */
function wrapModule(path, code) {
  const names = exportedNames(path, code);
  // 'export ' 만 떼고 선언은 그대로 둔다
  const body = rewriteImports(path, code).replace(EXPORT_DECL, '$1$2 $3');
  return `__m[${JSON.stringify(path)}] = (() => {\n${body}\nreturn { ${names.join(', ')} };\n})();`;
}

// ── 빌드 ───────────────────────────────────────────────────────
const files = await collect(at('src'));
const sources = new Map();
const graph = new Map();
for (const path of files) {
  const code = await readFile(join(ROOT, path), 'utf8');
  sources.set(path, code);
  graph.set(path, importsOf(code).map((spec) => ({ spec, path: resolveSpec(path, spec) })));
}

const order = topoSort(ENTRY, graph);
// 인라인 스크립트 안에 </script> 나 <!-- 가 들어가면 HTML 파싱이 깨진다
const script = await inlineAlbumArt(
  ['const __m = {};', ...order.map((path) => wrapModule(path, sources.get(path)))]
    .join('\n')
    .replaceAll('</script', '<\\/script')
    .replaceAll('<!--', '<\\!--'),
);

// 앨범 사진은 파일이 아니라 data: URI 로 박아 넣는다. 한 파일로 열었을 때
// assets/albums/*.png 를 찾아갈 곳이 없어서, 안 하면 사진만 조용히 사라진다.
async function inlineAlbumArt(code) {
  const dir = at('assets/albums');
  let files;
  try {
    files = await readdir(join(ROOT, dir));
  } catch {
    return code;
  }
  let out = code;
  let inlined = 0;
  for (const name of files.filter((f) => /\.(png|jpe?g|webp|gif)$/i.test(f))) {
    const ref = posix.join('assets/albums', name);
    if (!out.includes(ref)) continue;
    const bytes = await readFile(join(ROOT, dir, name));
    const type = name.toLowerCase().endsWith('.png') ? 'png' : name.toLowerCase().endsWith('.gif') ? 'gif' : name.toLowerCase().endsWith('.webp') ? 'webp' : 'jpeg';
    out = out.replaceAll(ref, `data:image/${type};base64,${bytes.toString('base64')}`);
    inlined += 1;
  }
  if (inlined) console.log(`  앨범 사진 ${inlined}장 심음`);
  return out;
}

const html = await readFile(join(ROOT, at('index.html')), 'utf8');

const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '게임';
const description = html.match(/<meta\s+name="description"[\s\S]*?\/>/)?.[0] ?? '';

const linkTags = [...html.matchAll(/<link\b[\s\S]*?\/>/g)].map((m) => m[0].trim());
const hrefOf = (tag) => tag.match(/href="([^"]*)"/)?.[1] ?? '';
const isLocalSheet = (tag) => tag.includes('rel="stylesheet"') && !/^https?:/.test(hrefOf(tag));
// 로컬 스타일시트는 <link> 대신 <style> 로 태워 넣는다. 한 파일로 열었을 때
// 옆에 파일이 없으니, 남겨두면 죽은 <link> 가 된다. 순서는 index.html 그대로다
// (차트런은 fonts.css → style.css 인데, 뒤집히면 --font 가 먼저 읽힌다).
const css = (
  await Promise.all(
    linkTags.filter(isLocalSheet).map((tag) => readFile(join(ROOT, at(hrefOf(tag))), 'utf8')),
  )
).join('\n');
// 나머지(아이콘, 바깥 웹폰트)는 그대로 옮긴다
const links = linkTags.filter((tag) => !isLocalSheet(tag)).join('\n');

// 남에게 줄 판에서는 개발자 모드 버튼(⚙)을 뺀다. 눌러서 비번을 맞출 일은 없지만
// 비번 화면이 뜨면 당황한다. CSS 한 줄로만 막는다 — JS 를 건드리면 개발·테스트 경로가
// 여기서부터 갈라진다.
const extraCss = KIOSK ? '\n/* --kiosk */\n.dev-open { display: none; }\n' : '';

/**
 * 홈 화면에 깔리기 위한 포장.
 *
 * 색과 이름은 **게임에서 읽어온다** — 여기 손으로 적으면 게임 색을 바꿨을 때
 * manifest 만 옛날 색으로 남는다.
 */
const themeColor = css.match(/--bg:\s*(#[0-9a-f]{3,8})/i)?.[1] ?? '#000000';
const pwaHead = PWA
  ? `
<link rel="manifest" href="manifest.webmanifest" />
<meta name="theme-color" content="${themeColor}" />
<!-- 아이폰은 manifest 를 거의 안 본다. 홈 화면에서 주소창 없이 열리려면 이 셋이 필요하다 -->
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="${title}" />
<link rel="apple-touch-icon" href="icon-192.png" />`
  : '';
/**
 * 서비스 워커. 없는 브라우저에서는 ?. 로 조용히 넘어가고, 게임은 그대로 돌아간다.
 *
 * `update()` 는 보험이다. 크롬은 페이지를 열 때 알아서 새 sw.js 를 확인하므로
 * 이 줄이 없어도 돌아가는 걸 확인했다. 다만 그 확인을 언제 할지는 브라우저 마음이라
 * (하루에 한 번만 보는 경우도 있다) 우리가 열 때마다 직접 시킨다 — sw.js 는 1KB 라 공짜다.
 *
 * 새 판은 **다음에 열 때** 보인다. 지금 열기는 이미 옛 판으로 그려진 뒤이고,
 * 새 판은 그 사이에 뒤에서 받아져 캐시에 들어간다.
 */
const pwaTail = PWA
  ? `
<script>navigator.serviceWorker?.register('sw.js').then((r) => r.update()).catch(() => {});</script>`
  : '';
// <body> 안쪽을 그대로 쓰되, 모듈 진입 <script src> 만 걷어낸다 (아래에서 번들로 대체)
const body = (html.match(/<body[^>]*>([\s\S]*)<\/body>/)?.[1] ?? '')
  .replace(/<script\b[^>]*\bsrc=[^>]*>\s*<\/script>/g, '')
  .trim();

// 아티팩트는 <!doctype>/<html>/<head>/<body> 를 직접 쓰면 안 된다.
// <title> 은 파일 앞부분(8KB)에서 찾으므로 맨 위에, 커다란 번들은 맨 뒤에 둔다.
const out = ARTIFACT
  ? `<title>${title}</title>
${links}
<style>
${css}${extraCss}
</style>
${body}
<script type="module">
${script}
</script>
`
  : `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${title}</title>
${description}
${links}${pwaHead}
<style>
${css}${extraCss}
</style>
</head>
<body>
${body}
<script type="module">
${script}
</script>${pwaTail}
</body>
</html>
`;

await mkdir(join(ROOT, PWA ? 'docs' : at('dist')), { recursive: true });
await writeFile(join(ROOT, OUT), out, 'utf8');
console.log(`${OUT} (${(Buffer.byteLength(out) / 1024).toFixed(1)} KB, 모듈 ${order.length}개)`);

if (PWA) await writePwaFiles(out);

/**
 * manifest 와 서비스 워커를 찍는다.
 *
 * 캐시 이름에 **빌드 내용의 해시**를 박는 게 핵심이다. 게임을 고쳐 다시 올렸는데
 * 이름이 그대로면 친구 폰에는 영영 옛 판이 남는다 — 서비스 워커의 제일 흔한 사고다.
 * 이름이 달라지면 새 워커가 깔리면서 옛 캐시를 지운다.
 */
async function writePwaFiles(html) {
  const files = [
    './',
    './index.html',
    './manifest.webmanifest',
    './icon-192.png',
    './icon-512.png',
    './icon-maskable.png',
  ];
  const icon = (src, sizes, purpose) => ({ src, sizes, type: 'image/png', purpose });
  const manifest = {
    name: title,
    short_name: title,
    description: description.match(/content="([^"]*)"/)?.[1] ?? '',
    id: './',
    start_url: './',
    scope: './',
    // 주소창 없이 꽉 차게. 가로로 들고 하는 게임이라 방향도 고정한다
    // (아이폰은 이 줄을 무시하지만, 세로로 들면 게임이 알아서 화면을 눕힌다)
    display: 'fullscreen',
    orientation: 'landscape',
    background_color: themeColor,
    theme_color: themeColor,
    lang: 'ko',
    icons: [
      icon('icon-192.png', '192x192', 'any'),
      icon('icon-512.png', '512x512', 'any'),
      // 안드로이드는 아이콘을 제 마음대로 잘라낸다. 여백을 더 준 판을 따로 준다
      icon('icon-maskable.png', '512x512', 'maskable'),
    ],
  };
  await writeFile(join(ROOT, 'docs/manifest.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  const hash = createHash('sha256').update(html).digest('hex').slice(0, 12);
  const sw = `// 자동 생성 — build.mjs --pwa 가 굽는다. 고치지 말 것.
//
// 한 번 받아두면 그 뒤로는 네트워크를 안 탄다 (비행기 모드에서도 열린다).
// 캐시 이름의 해시는 빌드 내용에서 나온다 — 게임이 바뀌면 이름이 달라지고,
// 새 워커가 깔리면서 옛 캐시를 통째로 지운다.
const CACHE = 'chartrun-${hash}';
const FILES = ${JSON.stringify(files)};

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // 캐시부터. 없으면 네트워크로 — 어차피 게임은 파일 하나라 캐시에 다 있다.
  e.respondWith(caches.match(e.request).then((hit) => hit ?? fetch(e.request)));
});
`;
  await writeFile(join(ROOT, 'docs/sw.js'), sw, 'utf8');
  console.log(`  docs/manifest.webmanifest · docs/sw.js (캐시 ${hash})`);
}
