// 의존성 없는 한 파일 빌드.
// 모든 모듈을 IIFE 로 감싸 하나의 인라인 <script> 로 이어 붙인다.
//
//   node build.mjs                       → 루트(Family Go!) 를 dist/play.html 로
//   node build.mjs chartrun              → chartrun/ 을 chartrun/dist/play.html 로
//   node build.mjs chartrun --artifact   → 아티팩트용 조각 chartrun/dist/artifact.html 로
//
// 프로젝트는 index.html / assets/style.css / src/ui/app.js 구조만 지키면 된다.
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join, posix } from 'node:path';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const ARTIFACT = args.includes('--artifact');
const BASE = (args.find((a) => !a.startsWith('--')) ?? '.').replace(/\/+$/, '');
const at = (path) => (BASE === '.' ? path : posix.join(BASE, path));

const ENTRY = at('src/ui/app.js');
const OUT = at(ARTIFACT ? 'dist/artifact.html' : 'dist/play.html');

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
const script = ['const __m = {};', ...order.map((path) => wrapModule(path, sources.get(path)))]
  .join('\n')
  .replaceAll('</script', '<\\/script')
  .replaceAll('<!--', '<\\!--');

const css = await readFile(join(ROOT, at('assets/style.css')), 'utf8');
const html = await readFile(join(ROOT, at('index.html')), 'utf8');

const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '게임';
const description = html.match(/<meta\s+name="description"[\s\S]*?\/>/)?.[0] ?? '';
// index.html 의 <link> 중 로컬 스타일시트만 빼고 그대로 옮긴다 (아이콘, 웹폰트)
const links = [...html.matchAll(/<link\b[\s\S]*?\/>/g)]
  .map((m) => m[0].trim())
  .filter((tag) => !tag.includes('assets/style.css'))
  .join('\n');
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
${css}
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
${links}
<style>
${css}
</style>
</head>
<body>
${body}
<script type="module">
${script}
</script>
</body>
</html>
`;

await mkdir(join(ROOT, at('dist')), { recursive: true });
await writeFile(join(ROOT, OUT), out, 'utf8');
console.log(`${OUT} (${(out.length / 1024).toFixed(1)} KB, 모듈 ${order.length}개)`);
