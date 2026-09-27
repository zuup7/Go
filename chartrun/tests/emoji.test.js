// 화면에 컬러 이모지를 두지 않는다.
//
// 픽셀로 찍은 게임인데 조작 버튼과 스테이지 카드만 안드로이드 기본 이모지로 나오면
// 크기도 색도 게임과 따로 논다. 한 번 걷어내도 다음에 또 하나씩 들어오므로 규칙으로 박는다.
//
// 걸리는 범위는 **그림문자뿐**이다 (U+1F000~U+1FAFF, 그리고 이모지 모양을 강제하는
// U+FE0F). 도트 폰트가 활자로 그려주는 ⏸ ⚙ ✥ ◀ ▶ ♪ ✕ ✓ ★ ♛ × 는
// Misc Symbols / Dingbats 라 이 범위 밖이고, 화면과 안 겉돌아서 그대로 쓴다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = join(dirname(fileURLToPath(import.meta.url)), '..');

/** 그림문자 한 글자 (U+FE0F 는 앞 글자를 이모지 모양으로 바꾸는 표식이다) */
const PICTOGRAPH = /[\u{1F000}-\u{1FAFF}\u{FE0F}]/gu;

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path, out);
    else if (entry.name.endsWith('.js')) out.push(path);
  }
  return out;
}

test('화면에 나가는 파일에 컬러 이모지가 없다', async () => {
  const files = [join(BASE, 'index.html'), ...(await walk(join(BASE, 'src')))];
  const found = [];
  for (const path of files) {
    const text = await readFile(path, 'utf8');
    text.split('\n').forEach((line, i) => {
      const hits = line.match(PICTOGRAPH);
      // 주석까지 본다 — 주석에 💨 라고 적혀 있으면 다음 사람이 버튼에도 그걸 쓴다
      if (hits) found.push(`${relative(BASE, path)}:${i + 1}  ${[...new Set(hits)].join('')}`);
    });
  }
  assert.deepEqual(found, [], `그림문자가 남아 있다:\n${found.join('\n')}`);
});
