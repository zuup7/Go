// 화면에 나오는 글자는 여기가 전부고, 전부 "정보"다 —
// 순위, 재생수, 차트아웃 횟수, 시간, 스테이지 번호. 대사나 농담은 두지 않는다.
import { timeText } from '../core/util.js';
import { beatRecord } from '../core/save.js';
import { STAGES } from '../data/stages.js';
import { KEYPAD } from '../core/devmode.js';
import { PAUSE_ROWS } from '../core/game.js';

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function createHud(root) {
  const el = {
    rank: root.querySelector('#rank'),
    plays: root.querySelector('#plays'),
    chartOuts: root.querySelector('#chartouts'),
    time: root.querySelector('#time'),
    bossBar: root.querySelector('#boss-bar'),
    bossFill: root.querySelector('#boss-fill'),
    bossPhase: root.querySelector('#boss-phase'),
    ammo: root.querySelector('#ammo'),
    center: root.querySelector('#center'),
    hud: root.querySelector('#hud'),
  };

  let lastCenter = '';

  const setCenter = (html) => {
    if (html === lastCenter) return;
    lastCenter = html;
    el.center.innerHTML = html;
    el.center.hidden = !html;
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
  function pausePanel(game, volume) {
    const label = {
      resume: '이어하기',
      retry: '체크포인트부터 다시',
      volume: `소리 ${Math.round(volume * 100)}%`,
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

  function centerFor(game, ui) {
    if (ui?.keypad) return keypadPanel(ui.keypad);
    switch (game.scene) {
      case 'title': {
        // 개발자 모드가 꺼져 있으면 예전 그대로 — 고를 것 없이 바로 시작한다
        const menu = game.dev
          ? `<ul class="menu">
              <li class="${game.titleIndex === 0 ? 'on' : ''}">처음부터</li>
              <li class="${game.titleIndex === 1 ? 'on' : ''}">스테이지 선택</li>
            </ul>
            <p class="press">◀▶ 로 고르고 점프로 확인</p>`
          : '<p class="press">아무 키나 / 점프 버튼으로 시작</p>';
        return `
          <div class="panel title-panel">
            <h1>차트런</h1>
            ${menu}
            <p class="record">BEST #${game.save.bestRank} · ${
              game.save.bestTimeMs == null ? '--:--' : timeText(game.save.bestTimeMs)
            }</p>
            <button type="button" class="dev-open" data-key="open" aria-label="개발자 모드">⚙</button>
          </div>`;
      }
      case 'select': {
        const slots = [
          ...STAGES.map((s) => ({ icon: s.icon, label: `STAGE ${s.number}` })),
          { icon: '👑', label: '보스전' },
          { icon: '🎬', label: '오프닝 다시 보기' },
          { icon: '🚪', label: '개발자 모드 끄기' },
        ];
        return `
          <div class="panel select-panel">
            <h2>스테이지 선택</h2>
            <ul class="slots">
              ${slots
                .map(
                  (s, i) => `<li class="${i === game.selectIndex ? 'on' : ''}">
                    <span class="slot-icon">${esc(s.icon)}</span>
                    <span class="slot-label">${esc(s.label)}</span>
                  </li>`,
                )
                .join('')}
            </ul>
            <p class="press">◀▶ 로 고르고 점프로 시작 · R 로 뒤로</p>
          </div>`;
      }
      case 'stageIntro': {
        const stage = STAGES[game.stageIndex];
        return `
          <div class="panel">
            <p class="stage-icon">${esc(stage.icon)}</p>
            <h2>STAGE ${stage.number}</h2>
          </div>`;
      }
      case 'death':
        return '<div class="panel death"><h2>차트아웃</h2></div>';
      case 'stageClear': {
        const stage = STAGES[game.stageIndex];
        return `
          <div class="panel good">
            <h2>STAGE ${stage.number} ✓</h2>
            <p class="big-rank">#${game.rank}</p>
          </div>`;
      }
      case 'ending': {
        const e = game.ending ?? {};
        // 기록은 저장하기 전에 판정해야 한다 — 저장하고 나면 항상 "안 깼다" 가 된다.
        // (game.save 는 아직 이번 판이 반영되기 전 상태다)
        const fresh = beatRecord(game.save, e.timeMs);
        return `
          <div class="panel ending">
            <h1>#1</h1>
            <ul class="stats">
              <li><span>TIME</span><b>${timeText(e.timeMs ?? 0)}${fresh ? ' <i class="fresh">신기록</i>' : ''}</b></li>
              <li><span>차트아웃</span><b>${e.chartOuts ?? 0}</b></li>
              <li><span>물리친 앨범</span><b>${e.defeated ?? 0}</b></li>
              <li><span>찾은 함정</span><b>${game.save.revealedTraps?.length ?? 0}</b></li>
              <li><span>재생수</span><b>${e.plays ?? 0}</b></li>
              <li><span>SCORE</span><b>${(e.score ?? 0).toLocaleString('ko-KR')}</b></li>
            </ul>
            <p class="press">아무 키나 누르면 처음으로</p>
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
      el.plays.textContent = `♪ ${game.plays}`;
      el.chartOuts.textContent = `✕ ${game.chartOuts}`;
      el.time.textContent = timeText(game.elapsedMs);

      // 컷신 중에는 HUD 를 걷는다 — 좁은 화면에서 큰 제목과 겹친다
      const inCut = game.scene === 'cutscene' || game.scene === 'intro' || !!game.bossCut;
      el.hud.hidden = game.scene === 'title' || game.scene === 'select' || inCut;

      const showBoss = game.scene === 'boss' && game.boss && !inCut;
      el.bossBar.hidden = !showBoss;
      el.bossPhase.hidden = !showBoss;
      if (showBoss) {
        const ratio = game.boss.hp / game.boss.maxHp;
        el.bossFill.style.width = `${Math.max(0, ratio * 100)}%`;
        el.bossPhase.textContent = `PHASE ${game.boss.phaseId}`;
      }
      el.ammo.hidden = inCut || !(game.player?.ammo > 0);

      if (game.paused) setCenter(pausePanel(game, ui?.volume ?? 1));
      else setCenter(centerFor(game, ui));
    },
  };
}
