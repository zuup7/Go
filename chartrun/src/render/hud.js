// 한글이 또렷하게 나와야 해서 HUD 와 화면 문구는 캔버스가 아니라 DOM 으로 그린다.
import { rankTitle } from '../core/chart.js';
import { timeText } from '../core/util.js';
import { STAGES } from '../data/stages.js';
import { BOSS_NAME, BOSS_TITLE } from '../data/bossData.js';
import { lineAt } from '../data/cutscene.js';

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function createHud(root) {
  const el = {
    rank: root.querySelector('#rank'),
    rankTitle: root.querySelector('#rank-title'),
    plays: root.querySelector('#plays'),
    chartOuts: root.querySelector('#chartouts'),
    time: root.querySelector('#time'),
    bossBar: root.querySelector('#boss-bar'),
    bossFill: root.querySelector('#boss-fill'),
    bossPhase: root.querySelector('#boss-phase'),
    banner: root.querySelector('#banner'),
    center: root.querySelector('#center'),
    caption: root.querySelector('#caption'),
    hud: root.querySelector('#hud'),
  };

  let lastCenter = '';
  let lastCaption = '';

  const setCenter = (html) => {
    if (html === lastCenter) return;
    lastCenter = html;
    el.center.innerHTML = html;
    el.center.hidden = !html;
  };

  const setCaption = (html) => {
    if (html === lastCaption) return;
    lastCaption = html;
    el.caption.innerHTML = html;
    el.caption.hidden = !html;
  };

  function centerFor(game) {
    switch (game.scene) {
      case 'title':
        return `
          <div class="panel title-panel">
            <p class="eyebrow">병맛 픽셀 러너</p>
            <h1>차트런</h1>
            <p class="tagline">100위에서 시작해 1위까지 달린다.<br />앨범 17장이 길을 막는다.</p>
            <p class="press">아무 키나 / 점프 버튼으로 시작</p>
            <p class="record">최고 기록 #${game.save.bestRank} · 누적 차트아웃 ${game.save.chartOuts}</p>
          </div>`;
      case 'stageIntro': {
        const stage = STAGES[game.stageIndex];
        return `
          <div class="panel">
            <p class="eyebrow">STAGE ${stage.number}</p>
            <h2>${stage.icon} ${esc(stage.name)}</h2>
            <p class="tagline">${esc(stage.subtitle)}</p>
          </div>`;
      }
      case 'death':
        return `
          <div class="panel death">
            <h2>차트아웃!</h2>
            <p class="tagline">${esc(game.deathMessage)}</p>
            <p class="press">체크포인트에서 다시 (목숨은 무한)</p>
          </div>`;
      case 'stageClear': {
        const stage = STAGES[game.stageIndex];
        return `
          <div class="panel good">
            <h2>${stage.icon} ${esc(stage.name)} 통과</h2>
            <p class="tagline">현재 순위 <b>#${game.rank}</b> · ${esc(rankTitle(game.rank))}</p>
          </div>`;
      }
      case 'ending': {
        const e = game.ending ?? {};
        return `
          <div class="panel ending">
            <p class="eyebrow">음원차트 실시간</p>
            <h1>#1</h1>
            <h2>당신의 노래</h2>
            <ul class="stats">
              <li><span>걸린 시간</span><b>${timeText(e.timeMs ?? 0)}</b></li>
              <li><span>차트아웃</span><b>${e.chartOuts ?? 0}회</b></li>
              <li><span>물리친 앨범</span><b>${e.defeated ?? 0}장</b></li>
              <li><span>모은 재생수</span><b>${e.plays ?? 0}</b></li>
              <li><span>점수</span><b>${(e.score ?? 0).toLocaleString('ko-KR')}</b></li>
            </ul>
            <p class="press">아무 키나 누르면 처음으로</p>
          </div>`;
      }
      default:
        return '';
    }
  }

  function captionFor(game) {
    if (game.scene === 'cutscene') {
      const line = lineAt(game.cutsceneTime);
      if (!line) return '';
      return `<div class="dialogue"><b>${esc(line.speaker)}</b><p>${esc(line.text)}</p></div>`;
    }
    if (game.scene === 'boss' && game.bossLine) {
      return `<div class="dialogue boss"><b>${esc(BOSS_NAME)}</b><p>${esc(game.bossLine.text)}</p></div>`;
    }
    return '';
  }

  return {
    update(game) {
      const rank = game.scene === 'title' ? game.save.bestRank : game.rank;
      el.rank.textContent = `#${rank}`;
      el.rankTitle.textContent = rankTitle(rank);
      el.plays.textContent = `♪ ${game.plays}`;
      el.chartOuts.textContent = `차트아웃 ${game.chartOuts}`;
      el.time.textContent = timeText(game.elapsedMs);
      el.hud.hidden = game.scene === 'title' || game.scene === 'cutscene';

      const showBoss = game.scene === 'boss' && game.boss;
      el.bossBar.hidden = !showBoss;
      if (showBoss) {
        const ratio = game.boss.hp / game.boss.maxHp;
        el.bossFill.style.width = `${Math.max(0, ratio * 100)}%`;
        el.bossPhase.textContent = `${BOSS_NAME} ${BOSS_TITLE} · ${game.boss.phaseId}페이즈`;
      }

      if (game.paused) {
        setCenter('<div class="panel"><h2>일시정지</h2><p class="press">Esc 로 계속</p></div>');
      } else {
        setCenter(centerFor(game));
      }
      setCaption(captionFor(game));

      if (game.banner) {
        el.banner.hidden = false;
        el.banner.textContent = game.banner.text;
        el.banner.dataset.kind = game.banner.kind;
        el.banner.style.opacity = String(Math.min(1, game.banner.life / 0.4));
      } else {
        el.banner.hidden = true;
      }
    },
  };
}
