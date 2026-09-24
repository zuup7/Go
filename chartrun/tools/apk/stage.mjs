/**
 * APK 로 쌀 것들을 www/ 에 모은다 — `npm run build:apk` 이 build.mjs 다음에 부른다.
 *
 * Capacitor 는 **폴더 하나**를 통째로 넣는다 (capacitor.config.json 의 webDir).
 * 우리 빌드는 파일 하나(dist/app.html)라서, 그걸 index.html 이라는 이름으로 옮겨 둔다.
 */
import { copyFile, mkdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = join(HERE, '../../dist/app.html');
const www = join(HERE, 'www');

await mkdir(www, { recursive: true });
await copyFile(src, join(www, 'index.html'));
const { size } = await stat(join(www, 'index.html'));
console.log(`  tools/apk/www/index.html (${(size / 1024).toFixed(1)} KB) — 이 폴더째 APK 에 들어간다`);
