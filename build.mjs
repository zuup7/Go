// 의존성 없는 한 파일 빌드.
// 모든 모듈 소스를 HTML 에 담고, 브라우저에서 blob URL 로 이어 붙여 실행한다.
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join, dirname, relative, resolve, posix } from 'node:path';

const ROOT = process.cwd();
const ENTRY = 'src/ui/app.js';
const OUT = 'dist/play.html';

/** src 아래 모든 .js 수집 */
async function collect(dir, found = []) {
  for (const entry of await readdir(join(ROOT, dir), { withFileTypes: true })) {
    const path = posix.join(dir, entry.name);
    if (entry.isDirectory()) await collect(path, found);
    else if (entry.name.endsWith('.js')) found.push(path);
  }
  return found;
}

const IMPORT_RE = /(?:^|\n)\s*import\s[^;]*?from\s+['"]([^'"]+)['"]/g;

function importsOf(code) {
  return [...code.matchAll(IMPORT_RE)].map((m) => m[1]).filter((spec) => spec.startsWith('.'));
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

const files = await collect('src');
const sources = new Map();
const graph = new Map();
for (const path of files) {
  const code = await readFile(join(ROOT, path), 'utf8');
  sources.set(path, code);
  graph.set(path, importsOf(code).map((spec) => ({ spec, path: resolveSpec(path, spec) })));
}

const order = topoSort(ENTRY, graph);
const bundle = order.map((path) => ({
  path,
  code: sources.get(path),
  deps: (graph.get(path) ?? []).map((d) => [d.spec, d.path]),
}));

const css = await readFile(join(ROOT, 'assets/style.css'), 'utf8');
const html = await readFile(join(ROOT, 'index.html'), 'utf8');
const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? 'Family Go!';
const favicon = html.match(/<link rel="icon"[\s\S]*?\/>/)?.[0]?.trim() ?? '';

const payload = JSON.stringify(bundle).replaceAll('<\/', '<\\/').replaceAll('<script', '<\\script');

const out = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${title}</title>
<meta name="description" content="가족을 만들고, 인생을 선택하며, 세대를 이어가는 나만의 이야기를 만들어보세요." />
${favicon}
<style>
${css}
</style>
</head>
<body>
<div id="app" class="app"><noscript>이 게임을 즐기려면 자바스크립트가 필요합니다.</noscript></div>
<div id="modal-root"></div>
<script type="application/json" id="bundle">${payload}</script>
<script type="module">
// 번들된 모듈들을 순서대로 blob URL 로 만들어 연결한다.
const modules = JSON.parse(document.getElementById('bundle').textContent);
const urls = {};
for (const { path, code, deps } of modules) {
  let source = code;
  for (const [spec, depPath] of deps) {
    const url = urls[depPath];
    source = source.split(\`'\${spec}'\`).join(\`'\${url}'\`).split(\`"\${spec}"\`).join(\`"\${url}"\`);
  }
  urls[path] = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
}
await import(urls['${ENTRY}']);
</script>
</body>
</html>
`;

await mkdir(join(ROOT, 'dist'), { recursive: true });
await writeFile(join(ROOT, OUT), out, 'utf8');
console.log(`${OUT} (${(out.length / 1024).toFixed(1)} KB, 모듈 ${bundle.length}개)`);
