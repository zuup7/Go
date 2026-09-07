// 화면에 나오는 글자는 여기가 전부고, 전부 "정보"다 —
// 순위, 재생수, 차트아웃 횟수, 시간, 스테이지 번호. 대사나 농담은 두지 않는다.
import { timeText } from '../core/util.js';
import { STAGES } from '../data/stages.js';

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

  function centerFor(game) {
    switch (game.scene) {
      case 'title':
        return `
          <div class="panel title-panel">
            <h1>차트런</h1>
            <p class="press">아무 키나 / 점프 버튼으로 시작</p>
            <p class="record">BEST #${game.save.bestRank}</p>
          </div>`;
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
        return `
          <div class="panel ending">
            <h1>#1</h1>
            <ul class="stats">
              <li><span>TIME</span><b>${timeText(e.timeMs ?? 0)}</b></li>
              <li><span>차트아웃</span><b>${e.chartOuts ?? 0}</b></li>
              <li><span>물리친 앨범</span><b>${e.defeated ?? 0}</b></li>
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
    update(game) {
      const rank = game.scene === 'title' ? game.save.bestRank : game.rank;
      el.rank.textContent = `#${rank}`;
      el.plays.textContent = `♪ ${game.plays}`;
      el.chartOuts.textContent = `✕ ${game.chartOuts}`;
      el.time.textContent = timeText(game.elapsedMs);

      // 컷신 중에는 HUD 를 걷는다 — 좁은 화면에서 큰 제목과 겹친다
      const inCut = game.scene === 'cutscene' || !!game.bossCut;
      el.hud.hidden = game.scene === 'title' || inCut;

      const showBoss = game.scene === 'boss' && game.boss && !inCut;
      el.bossBar.hidden = !showBoss;
      el.bossPhase.hidden = !showBoss;
      if (showBoss) {
        const ratio = game.boss.hp / game.boss.maxHp;
        el.bossFill.style.width = `${Math.max(0, ratio * 100)}%`;
        el.bossPhase.textContent = `PHASE ${game.boss.phaseId}`;
      }
      el.ammo.hidden = inCut || !(game.player?.ammo > 0);

      if (game.paused) setCenter('<div class="panel"><h2>PAUSE</h2></div>');
      else setCenter(centerFor(game));
    },
  };
}
