/**
 * 웹폰트 서브셋을 받아서 assets/fonts.css 로 굽는다.
 *
 *   node chartrun/tools/make-fonts.mjs            # 이미 받아둔 woff2 로 fonts.css 만 다시 굽기
 *   node chartrun/tools/make-fonts.mjs --fetch    # 구글에서 서브셋부터 다시 받기 (네트워크 필요)
 *
 * 왜 심어야 하나: APK/오프라인에서는 fonts.googleapis.com 이 안 열린다. 그러면
 * 픽셀 게임인데 글자만 시스템 고딕으로 나온다. 그래서 **게임이 실제로 쓰는 글자만**
 * 서브셋해서 base64 로 CSS 에 박아둔다.
 *
 * 받은 결과(woff2 둘)와 구운 CSS 는 **저장소에 커밋한다.** 빌드가 네트워크를 타면
 * 인터넷 없는 데서 빌드가 깨지기 때문이다.
 */
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = join(HERE, '..');
const FONT_DIR = join(BASE, 'assets/fonts');

/** JS 주석을 걷어낸다. 주석 속 글자까지 서브셋에 넣으면 요청이 길어져 잘린다(아래 참고) */
const stripComments = (code) =>
  code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

/** HTML 은 태그를 걷어내고 글자만 남긴다 */
const stripTags = (html) => html.replace(/<[^>]*>/g, ' ');

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path, out);
    else if (/\.(js|html)$/.test(entry.name)) out.push(path);
  }
  return out;
}

/** 화면(DOM)에 닿을 수 있는 글자를 모은다 */
async function usedChars() {
  const files = [join(BASE, 'index.html'), ...(await walk(join(BASE, 'src')))];
  const chars = new Set();
  for (const path of files) {
    const raw = await readFile(path, 'utf8');
    const text = path.endsWith('.html') ? stripTags(raw) : stripComments(raw);
    for (const ch of text) if (ch.codePointAt(0) > 0x20) chars.add(ch);
  }
  return chars;
}

const isAscii = (ch) => ch.codePointAt(0) < 0x80;

const FONTS = [
  // DotGothic16 이 글꼴 스택 맨 앞이다. 서브셋에 있는 글자만 이 폰트로 찍히고
  // 나머지(한글)는 자동으로 다음 폰트로 떨어진다 — 서브셋이 곧 분담표다.
  { family: 'DotGothic16', query: 'DotGothic16', file: 'dotgothic16-subset.woff2', take: isAscii },
  { family: 'Gowun Dodum', query: 'Gowun+Dodum', file: 'gowundodum-subset.woff2', take: (ch) => !isAscii(ch) },
];

async function fetchSubsets(chars) {
  await mkdir(FONT_DIR, { recursive: true });
  for (const font of FONTS) {
    const text = [...chars].filter(font.take).sort().join('');
    const url = `https://fonts.googleapis.com/css2?family=${font.query}&display=swap&text=${encodeURIComponent(text)}`;
    const css = await (await fetch(url, { headers: { 'user-agent': UA } })).text();
    // 주소가 .woff2 로 끝나지 않는다 (/l/font?kit=... 꼴이다) — format('woff2') 로 찾는다
    const srcs = [...css.matchAll(/url\((https:[^)]+)\)\s*format\('woff2'\)/g)].map((m) => m[1]);
    if (srcs.length !== 1) {
      throw new Error(`${font.family}: woff2 주소가 ${srcs.length}개다 (1개여야 한다)\n${css.slice(0, 500)}`);
    }
    const src = srcs[0];
    const bytes = Buffer.from(await (await fetch(src)).arrayBuffer());
    // 구글은 text= 가 길면 **말없이 잘린 폰트**를 준다 (812자를 넣었더니 자당 9바이트가
    // 왔다 — 글자가 거의 안 들어 있다는 뜻이다). 조용히 깨지면 못 잡으니 여기서 던진다.
    const per = bytes.length / text.length;
    if (per < 30) throw new Error(`${font.file}: ${text.length}자에 ${bytes.length}바이트 — 잘린 것 같다`);
    await writeFile(join(FONT_DIR, font.file), bytes);
    console.log(`  ${font.file}  ${text.length}자  ${(bytes.length / 1024).toFixed(1)}KB`);
  }
}

// woff2 를 주는 최신 브라우저인 척해야 한다. user-agent 가 없으면 구글이 ttf 를 준다.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function bakeCss() {
  const faces = [];
  for (const font of FONTS) {
    const bytes = await readFile(join(FONT_DIR, font.file));
    faces.push(`@font-face {
  font-family: '${font.family}';
  font-style: normal;
  font-weight: 400;
  font-display: block;
  src: url(data:font/woff2;base64,${bytes.toString('base64')}) format('woff2');
}`);
  }
  const out = `/* 자동 생성 — 고치지 말 것. \`node chartrun/tools/make-fonts.mjs\` 가 굽는다.
   게임이 실제로 쓰는 글자만 담은 서브셋이다. 네트워크 없이도 글자가 안 깨지도록
   base64 로 박아 넣었다 (assets/fonts/*.woff2 가 원본). */
${faces.join('\n\n')}
`;
  await writeFile(join(BASE, 'assets/fonts.css'), out, 'utf8');
  console.log(`  assets/fonts.css (${(out.length / 1024).toFixed(1)} KB)`);
}

const chars = await usedChars();
console.log(`화면에 닿는 글자 ${chars.size}자`);
if (process.argv.includes('--fetch')) await fetchSubsets(chars);
await bakeCss();
