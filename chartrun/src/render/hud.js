// 화면에 나오는 글자는 여기가 전부고, 전부 "정보"다 —
// 순위, 재생수, 차트아웃 횟수, 시간, 스테이지 번호. 대사나 농담은 두지 않는다.
import { timeText } from '../core/util.js';
import { STAGES, NOTE_TOTAL } from '../data/stages.js';
import { KEYPAD } from '../core/devmode.js';
import { LOOK_SLOTS } from '../data/looks.js';
import { owns, FX_SLOTS } from '../data/effects.js';
import { ACTIONS } from '../core/input.js';
import {
  PAUSE_ROWS,
  stageTable,
  selectItems,
  cutPreviews,
  titleRows,
  inCutscene,
  notesFound,
  shopItems,
  shopPointsText,
} from '../core/game.js';

/** 천 단위 구분. 세 자리마다 쉼표가 찍혀야 여섯 자리 점수가 한눈에 읽힌다 */
const won = (n) => Number(n).toLocaleString('ko-KR');

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function createHud(root) {
  const el = {
    rank: root.querySelector('#rank'),
    plays: root.querySelector('#plays'),
    chartOuts: root.querySelector('#chartouts'),
    time: root.querySelector('#time'),
    bossPhase: root.querySelector('#boss-phase'),
    ammo: root.querySelector('#ammo'),
    center: root.querySelector('#center'),
    hud: root.querySelector('#hud'),
  };

  let lastCenter = '';
  let countRaf = 0;

  /**
   * 숫자가 굴러 올라간다 (`data-count` 가 붙은 칸).
   *
   * **패널 문자열은 안 건드린다.** setCenter 는 글자가 바뀔 때마다 innerHTML 을
   * 통째로 갈아끼우므로, 굴러가는 값을 문자열에 넣으면 매 프레임 패널이 다시
   * 그려지고 줄이 차례로 뜨는 연출도 매번 처음부터 돈다. 그래서 다 그린 **뒤에**
   * 그 칸만 따로 만진다. 중간에 멈춰도 HTML 에는 이미 최종값이 적혀 있다.
   */
  const COUNT_MS = 600;
  function startCountUp() {
    cancelAnimationFrame(countRaf);
    const node = el.center.querySelector('[data-count]');
    if (!node) return;
    const target = Number(node.dataset.count);
    if (!Number.isFinite(target) || target <= 0) return;
    const t0 = performance.now();
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / COUNT_MS);
      // 끝에서 느려진다 — 마지막 자리가 또박또박 멈추는 게 보여야 한다
      const eased = 1 - (1 - k) ** 3;
      node.textContent = won(Math.round(target * eased));
      if (k < 1) countRaf = requestAnimationFrame(tick);
    };
    countRaf = requestAnimationFrame(tick);
  }

  const setCenter = (html) => {
    if (html === lastCenter) return;
    lastCenter = html;
    el.center.innerHTML = html;
    el.center.hidden = !html;
    // 목록이 화면보다 길면 굴러간다. innerHTML 을 통째로 갈아끼우므로 굴린 자리는
    // 매번 처음으로 돌아간다 — 고른 줄을 다시 화면 안으로 끌어와야 한다.
    //
    // **꾸미기(.looks)도 같이 본다.** 화면 이름을 하나만 적어두면 다음 화면을
    // 만들 때 또 빠진다 — 「뒤로」가 죽은 채로 나갔던 것과 같은 실수다.
    el.center.querySelector('.slots li.on, .looks li.on')?.scrollIntoView({ block: 'nearest' });
    startCountUp();
  };

  /**
   * 개발자 모드 숫자판.
   *
   * 버튼에 핸들러를 직접 달지 않는다 — setCenter() 가 내용이 바뀔 때마다 innerHTML 을
   * 통째로 갈아끼우므로 핸들러가 날아간다. ui/app.js 가 #center 에 위임 리스너를 하나 단다.
   */
  function keypadPanel(pad) {
    const dots = [0, 1, 2, 3]
      .map((i) => `<i class="${i < pad.buf.length ? 'on' : ''}"></i>`)
      .join('');
    const key = (k, label, cls = '') =>
      `<button type="button" class="${cls}" data-key="${k}">${label}</button>`;
    return `
      <div class="panel keypad-panel">
        <h2>개발자 모드</h2>
        <div class="dots ${pad.bad ? 'bad' : ''}">${dots}</div>
        <div class="keypad">
          ${KEYPAD.map((k) => {
            if (k === 'back') return key('back', '←', 'wide');
            if (k === 'close') return key('close', '닫기', 'wide');
            return key(k, k);
          }).join('')}
        </div>
      </div>`;
  }

  /**
   * 일시정지 메뉴.
   *
   * 줄마다 data-key 를 달아 **탭으로도 고를 수 있게** 한다 — 폰에는 ◀▶ 도 엔터도 없다.
   * (숫자판과 같은 이유로 핸들러는 안 달고 ui/app.js 가 #center 에 위임한다)
   */
  function pausePanel(game, volume, muted) {
    const label = {
      resume: '이어하기',
      retry: '체크포인트부터 다시',
      // 음소거와 크기는 **따로 보여준다.** 둘은 각각 소리를 죽일 수 있어서,
      // 하나로 합치면 「소리 100%」인데 안 들리는 상태를 설명할 길이 없다.
      volume: `소리 ${Math.round(volume * 100)}%`,
      mute: muted ? '음소거 켜짐' : '음소거 꺼짐',
      title: '타이틀로',
    };
    return `
      <div class="panel pause-panel">
        <h2>일시정지</h2>
        <ul class="menu">
          ${PAUSE_ROWS.map(
            (row, i) =>
              `<li class="${i === game.pauseIndex ? 'on' : ''}" data-key="pause:${row}">${label[row]}</li>`,
          ).join('')}
        </ul>
        <p class="press">◀▶ 로 고르고 점프로 확인 · 눌러도 된다</p>
      </div>`;
  }

  /**
   * 처음 하는 사람에게 버튼이 뭔지 알려준다. 폰에서는 index.html 의 조작 설명이
   * 숨겨져 있어서(`body.handheld .help`) 보스전에 튀어나오는 두 버튼이 뭔지 알 길이 없다.
   * 첫 판을 시작하면(save.seenHelp) 다시 안 뜬다.
   *
   * **버튼에 적힌 글자 그대로**(ACTIONS 의 face) 적는다 — 안내를 보고 화면에서
   * 그 글자를 찾아야 하니, 여기 따로 적으면 언젠가 둘이 어긋난다.
   */
  const face = (action) => esc(ACTIONS[action].face);
  const firstHelp = () => `
    <ul class="first-help">
      <li><b>${face('left')} ${face('right')}</b> 이동</li>
      <li><b>${face('jump')}</b> 길게 누르면 높이 뛴다</li>
      <li><b>${face('dash')}</b> · <b>${face('throw')}</b> 던지기 — 보스전에서만 나온다</li>
      <li><b>${face('pause')}</b> 화면 오른쪽 위</li>
    </ul>`;

  function centerFor(game, ui) {
    if (ui?.keypad) return keypadPanel(ui.keypad);
    switch (game.scene) {
      case 'title': {
        // 줄 목록은 core 가 갖고 있다 — 여기 또 적으면 화면은 셋인데 고르기는
        // 둘에서 도는 꼴이 된다. 줄이 하나뿐이면 메뉴 없이 예전 그대로.
        // (줄에 data-key 를 달아 탭으로도 되게 한다 — 선택 목록·일시정지 메뉴와 같은 이유)
        const rows = titleRows(game);
        const menu =
          rows.length > 1
            ? `<ul class="menu">
              ${rows
                .map(
                  (r, i) =>
                    `<li class="${i === game.titleIndex ? 'on' : ''}" data-key="title:${i}">${esc(r.label)}</li>`,
                )
                .join('')}
            </ul>
            <p class="press">◀▶ 로 고르고 점프로 확인 · 눌러도 된다</p>`
            : '<p class="press">아무 키나 / 점프 버튼으로 시작</p>';
        return `
          <div class="panel title-panel">
            <h1 data-key="logo" class="${(ui?.taps?.length ?? 0) >= 2 ? 'tapped' : ''}">차트런${
              game.save.clearedHard ? ' <span class="crown">♛</span>' : ''
            }</h1>
            ${menu}
            <p class="record">BEST #${game.save.bestRank} · ${
              game.save.bestTimeMs == null ? '--:--' : timeText(game.save.bestTimeMs)
            }${
              game.save.bestHardTimeMs == null
                ? ''
                : ` · ★ ${timeText(game.save.bestHardTimeMs)}`
            }</p>
            ${game.save.seenHelp ? '' : firstHelp()}
            ${game.saveBroken ? '<p class="warn">이 기기에서는 기록이 안 남습니다</p>' : ''}
            <button type="button" class="dev-open" data-key="open" aria-label="개발자 모드">DEV</button>
          </div>`;
      }
      /**
       * 꾸미기. 줄마다 「◀ 이름 ▶」이고, 고르고 있는 줄만 밝다.
       * 캔버스가 주인공을 크게 그려주므로 **여기서는 이름만** 말한다.
       */
      case 'look': {
        const look = game.save.look ?? {};
        return `
          <div class="panel look-panel">
            <h2>꾸미기</h2>
            <ul class="looks">
              ${LOOK_SLOTS.map((slot, i) => {
                const item = slot.items[look[slot.key] ?? 0] ?? slot.items[0];
                return `<li class="${i === game.lookIndex ? 'on' : ''}">
                  <span class="look-name">${esc(slot.label)}</span>
                  <button type="button" data-key="look:${slot.key}:-1">◀</button>
                  <b>${esc(item.label)}</b>
                  <button type="button" data-key="look:${slot.key}:1">▶</button>
                </li>`;
              }).join('')}
            </ul>
            <p class="press">◀▶ 로 바꾸고 점프로 다음 줄 · 눌러도 된다</p>
            <button type="button" class="back-btn" data-key="look:back">뒤로</button>
          </div>`;
      }
      /**
       * 상점. 컷신 보기와 같은 목록 꼴이고, 칸마다 값 또는 ✓ 가 붙는다.
       * 목록도 점수도 core 가 갖고 있다 — 여기 또 적으면 화면과 실제로 팔리는 게 어긋난다.
       */
      case 'shop': {
        const left = shopPointsText(game);
        return `
          <div class="panel select-panel shop-panel">
            <h2>상점</h2>
            <p class="shop-points ${game.shopDenied > 0 ? 'denied' : ''}">
              남은 점수 <b>${left}</b> · 완주 ${game.save.clears ?? 0}회
            </p>
            <div class="shop-cols">
              ${FX_SLOTS.map(
                (slot) => `
                <section>
                  <h3>${esc(slot.label)}</h3>
                  <ul class="slots shop-slots">
                    ${shopItems()
                      .map((item, i) => [item, i])
                      .filter(([item]) => item.slot === slot.key)
                      .map(([item, i]) => {
                        const has = owns(game.save, item.uid);
                        const on = game.save.fx?.[item.slot] === item.id;
                        const tag = on ? '★' : has ? '✓' : `${item.cost}`;
                        const cls = [
                          i === game.shopIndex ? 'on' : '',
                          has ? 'has' : 'buy',
                          on ? 'worn' : '',
                        ]
                          .filter(Boolean)
                          .join(' ');
                        return `<li class="${cls}" data-key="shop:${i}">${esc(item.label)}<i>${tag}</i></li>`;
                      })
                      .join('')}
                  </ul>
                </section>`,
              ).join('')}
            </div>
            <p class="press">깨면 점수가 는다 · 점프로 사고 끼운다</p>
            <button type="button" class="back-btn" data-key="shop:back">뒤로</button>
          </div>`;
      }
      case 'cutList': {
        // 목록은 core 가 갖고 있다 — 여기 또 적으면 화면과 실제로 트는 게 어긋난다
        return `
          <div class="panel select-panel">
            <h2>컷신 보기</h2>
            <ul class="slots cut-slots">
              ${cutPreviews()
                .map(
                  (c, i) =>
                    `<li class="${i === game.cutIndex ? 'on' : ''}" data-key="cut:${i}">${esc(c.label)}</li>`,
                )
                .join('')}
            </ul>
            <p class="press">◀▶ 로 고르고 점프로 재생 · 눌러도 된다</p>
            <button type="button" class="back-btn" data-key="cut:back">뒤로</button>
          </div>`;
      }
      case 'select': {
        // 칸 목록은 core 가 갖고 있다 — 여기 또 적으면 둘이 어긋나서
        // "화면은 맞는데 엉뚱한 판이 시작되는" 상태가 된다.
        // 고르는 쪽(updateGame)과 **같은 함수**를 써야 한다
        const slots = selectItems(game);
        // 줄과 「뒤로」에 data-key 를 달아 **탭으로도** 되게 한다 — 폰에는 R 키가 없어서
        // 이게 없으면 이 화면에 들어온 뒤 타이틀로 돌아갈 방법이 아예 없다.
        // (일시정지 메뉴와 같은 방식이고, 핸들러는 ui/app.js 가 #center 에 위임한다)
        return `
          <div class="panel select-panel">
            <h2>스테이지 선택</h2>
            <ul class="slots">
              ${slots
                .map(
                  (s, i) =>
                    `<li class="${i === game.selectIndex ? 'on' : ''}" data-key="slot:${i}">${esc(s.label)}</li>`,
                )
                .join('')}
            </ul>
            <p class="press">◀▶ 로 고르고 점프로 시작 · 눌러도 된다</p>
            <button type="button" class="back-btn" data-key="slot:back">뒤로</button>
          </div>`;
      }
      case 'gallery':
        // 그림은 전부 캔버스가 그린다 (앨범 열일곱 장). 여기서 패널을 띄우면
        // 가운데가 통째로 가려지므로 **나가는 버튼 하나만** 화면 아래에 둔다.
        return `
          <div class="gallery-bar">
            <button type="button" class="back-btn" data-key="gallery:back">뒤로</button>
          </div>`;
      case 'stageIntro': {
        // **하드모드에서는 하드 표를 봐야 한다** — STAGES 를 직접 보면 이름이 어긋난다
        const stage = stageTable(game)[game.stageIndex];
        // 판 번호만 적는다 — 어느 판인지는 뒤에 깔린 화면(초원·숲·건물 안)이 이미 말한다
        return `
          <div class="panel">
            <h2>STAGE ${stage.number}</h2>
          </div>`;
      }
      case 'death':
        return '<div class="panel death"><h2>차트아웃</h2></div>';
      case 'stageClear': {
        const stage = stageTable(game)[game.stageIndex];
        return `
          <div class="panel good">
            <h2>STAGE ${stage.number} ✓</h2>
            <p class="big-rank">#${game.rank}</p>
          </div>`;
      }
      case 'ending': {
        const e = game.ending ?? {};
        // 신기록인지는 **core 가 저장 전에 정해둔 값**을 읽는다 (finishRun 의 fresh).
        // 여기서 game.save 와 견주면 안 된다 — 저장이 이 화면보다 먼저 끝나서
        // 방금 세운 기록을 자기 자신과 견주게 된다. 예전엔 그래서 한 번도 안 떴다.
        const fresh = !!e.fresh;
        return `
          <div class="panel ending">
            <h1>${e.hard ? '#1 ★' : '#1'}</h1>
            <ul class="stats">
              <li><span>TIME</span><b>${timeText(e.timeMs ?? 0)}${fresh ? ' <i class="fresh">신기록</i>' : ''}</b></li>
              <li><span>차트아웃</span><b>${e.chartOuts ?? 0}</b></li>
              <li><span>물리친 앨범</span><b>${e.defeated ?? 0}</b></li>
              <li><span>찾은 함정</span><b>${game.save.revealedTraps?.length ?? 0}</b></li>
              <li><span>재생수</span><b>${e.plays ?? 0}</b></li>
              <li><span>SCORE</span><b data-count="${e.score ?? 0}">${won(e.score ?? 0)}</b></li>
              ${
                // 2회차 칸. 깬 사람은 ♛, **이번에 막 열린 사람에게는 열렸다고 알린다** —
                // 예전에는 여기서 아무 말도 안 해서 2회차가 있는 줄도 몰랐다.
                game.save.clearedHard || e.hard
                  ? '<li><span>2회차</span><b>클리어 ♛</b></li>'
                  : '<li><span>2회차</span><b class="opened">열림</b></li>'
              }
            </ul>
            <p class="press">${
              // 한 바퀴 돈 사람은 타이틀이 아니라 **2회차 입구**로 간다 (core 의 returnToHub).
              // 예전 글은 「처음으로」였는데, 그건 사실이 아니라 영문 모르고 초원에 서게 된다.
              game.save.clearedOnce || e.hard
                ? '아무 키나 누르면 2회차 입구로'
                : '아무 키나 누르면 처음으로'
            }</p>
          </div>`;
      }
      default:
        return '';
    }
  }

  return {
    update(game, ui) {
      const rank = game.scene === 'title' ? game.save.bestRank : game.rank;
      el.rank.textContent = `#${rank}`;
      // 음표는 **몇 개 중 몇 개**로 보여준다. 그냥 올라가는 숫자였을 때는 모으는 게
      // 목표라는 걸 알 길이 없었다. 하드 판에는 음표가 하나도 없어서(NOTE_TOTAL 은
      // 1회차 것이다) 거기서는 이 칸을 아예 걷는다 — 영영 안 오르는 숫자는 고장으로 보인다.
      // 보스 아레나에는 음표가 **하나도 없다** — 하드와 같은 이유로 여기서도 걷는다.
      // 안 오르는 숫자를 띄워두면 화면만 복잡해진다.
      el.plays.hidden = game.hard || game.scene === 'boss';
      el.plays.textContent = `♪ ${notesFound(game)}/${NOTE_TOTAL}`;
      el.chartOuts.textContent = `✕ ${game.chartOuts}`;
      el.time.textContent = timeText(game.elapsedMs);

      // 컷신 중에는 HUD 를 걷는다 — 좁은 화면에서 큰 제목과 겹친다
      // 컷신 판단은 core 의 inCutscene 하나뿐이다 — 여기 또 적었더니 잡히는
      // 컷신(caught)을 빼먹어서 그 컷신에서만 HUD 가 화면 위에 남아 있었다
      const inCut = inCutscene(game);
      // 엔딩도 숨긴다 — 통계표가 TIME·차트아웃·#1 을 이미 말하고 있는데 HUD 가
      // 위에 남아 같은 값을 한 번 더 보여주고 있었다.
      el.hud.hidden =
        game.scene === 'title' ||
        game.scene === 'look' ||
        game.scene === 'shop' ||
        game.scene === 'select' ||
        game.scene === 'gallery' ||
        game.scene === 'ending' ||
        inCut;

      // 체력계는 캔버스가 그린다 (보스 바로 아래, 눈금까지). 여기서는 페이즈만.
      const showBoss = game.scene === 'boss' && game.boss && !inCut;
      el.bossPhase.hidden = !showBoss;
      if (showBoss) el.bossPhase.textContent = `PHASE ${game.boss.phaseId}`;
      el.ammo.hidden = inCut || !(game.player?.ammo > 0);

      if (game.paused) setCenter(pausePanel(game, ui?.volume ?? 1, !!ui?.muted));
      else setCenter(centerFor(game, ui));
    },
  };
}
