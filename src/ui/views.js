// 화면 조각들. 모두 문자열 HTML 을 돌려주고, 클릭은 data-act 로 위임된다.
import { portrait } from './avatar.js';
import { familyTree } from './tree.js';
import { fullName } from '../core/person.js';
import { STAT_KEYS, STAT_LABELS, EDUCATION_LABELS, won, stageOf } from '../core/util.js';
import { TRAIT_BY_ID, commonTraits } from '../data/traits.js';
import { JOB_BY_ID } from '../data/jobs.js';
import { BUILDINGS, buildCost } from '../data/buildings.js';
import { villageLevel, villageTitle, buildStatus, villageMaintenance } from '../core/village.js';
import { MAX_JOB_LEVEL, salaryOf } from '../core/economy.js';
import * as G from '../core/game.js';

const esc = (text) => String(text).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const traitBadges = (person) => person.traits
  .map((id) => TRAIT_BY_ID[id])
  .filter(Boolean)
  .map((t) => `<span class="badge" title="${esc(t.desc)}">${t.icon} ${esc(t.label)}</span>`)
  .join('');

const jobLabel = (person) => {
  if (!person.jobId) return person.age >= 19 ? '무직' : '학생';
  const job = JOB_BY_ID[person.jobId];
  return `${job.icon} ${job.label} ${person.jobLevel}호봉`;
};

// ── 타이틀 ────────────────────────────────────────────────

export function titleScreen({ canContinue, draft }) {
  const traitPills = commonTraits().slice(0, 10).map((t) => `
    <button class="pill ${draft.traitId === t.id ? 'on' : ''}" data-act="draft-trait" data-id="${t.id}" title="${esc(t.desc)}">
      ${t.icon} ${esc(t.label)}
    </button>`).join('');

  return `
  <div class="title-screen">
    <div class="logo">🏡</div>
    <h1>Family Go!</h1>
    <p class="tag">대를 잇는 인생 시뮬레이션</p>
    <div class="card form-grid">
      <div class="row-2">
        <div>
          <label>성</label>
          <input id="in-family" value="${esc(draft.familyName)}" placeholder="비우면 랜덤" maxlength="2" />
        </div>
        <div>
          <label>이름</label>
          <input id="in-given" value="${esc(draft.givenName)}" placeholder="비우면 랜덤" maxlength="6" />
        </div>
      </div>
      <div>
        <label>성별</label>
        <div class="pill-row">
          <button class="pill ${draft.gender === 'female' ? 'on' : ''}" data-act="draft-gender" data-id="female">👧 여성</button>
          <button class="pill ${draft.gender === 'male' ? 'on' : ''}" data-act="draft-gender" data-id="male">👦 남성</button>
          <button class="pill ${!draft.gender ? 'on' : ''}" data-act="draft-gender" data-id="">🎲 랜덤</button>
        </div>
      </div>
      <div>
        <label>타고난 성격 (비우면 랜덤)</label>
        <div class="pill-row">${traitPills}</div>
      </div>
      <div>
        <label>마을 이름</label>
        <input id="in-village" value="${esc(draft.villageName)}" placeholder="비우면 랜덤" maxlength="10" />
      </div>
      <button class="primary wide" data-act="new-game">새 인생 시작하기</button>
      ${canContinue ? '<button class="ghost wide" data-act="continue">이어서 하기</button>' : ''}
    </div>
    <p class="muted">한 명에서 시작해 사랑, 결혼, 자녀, 마을을 거쳐 여러 세대의 가족 이야기를 만들어보세요.</p>
  </div>`;
}

// ── 상단바 / 주인공 ───────────────────────────────────────

export function topBar(state) {
  const level = villageLevel(state.village);
  return `
  <div class="topbar">
    <div class="stat-chip"><span class="k">연도</span><span class="v">${state.year}년</span></div>
    <div class="stat-chip"><span class="k">세대</span><span class="v">${state.generation}대</span></div>
    <div class="stat-chip"><span class="k">자금</span><span class="v">${won(state.money)}</span></div>
    <div class="stat-chip"><span class="k">${esc(state.village.name)}</span><span class="v">${villageTitle(level)} Lv.${level}</span></div>
  </div>`;
}

export function heroCard(state) {
  const me = G.player(state);
  const partner = G.partnerOf(state);
  const stage = stageOf(me.age);
  const bars = STAT_KEYS.map((key) => `
    <div class="bar-row">
      <span>${STAT_LABELS[key]}</span>
      <span class="bar ${key}"><i style="width:${Math.round(me.stats[key])}%"></i></span>
      <span class="muted">${Math.round(me.stats[key])}</span>
    </div>`).join('');

  return `
  <div class="card">
    <div class="hero">
      ${portrait(me, 88, { ageTag: true })}
      <div class="hero-info">
        <div class="name-line">
          <span class="name">${esc(fullName(me))}</span>
          <span class="muted">${me.age}세 · ${stage.label} · ${me.gender === 'female' ? '여' : '남'}</span>
        </div>
        <div class="muted">${jobLabel(me)} · ${EDUCATION_LABELS[me.education]}${partner ? ` · 💞 ${esc(fullName(partner))}` : ''}</div>
        <div class="badges">${traitBadges(me)}</div>
      </div>
    </div>
    <div class="bars">
      ${bars}
      <div class="bar-row">
        <span>행복</span>
        <span class="bar happy"><i style="width:${Math.round(me.happiness)}%"></i></span>
        <span class="muted">${Math.round(me.happiness)}</span>
      </div>
    </div>
  </div>`;
}

export const TABS = [
  { id: 'life', label: '🌤 인생' },
  { id: 'love', label: '💞 인연' },
  { id: 'career', label: '💼 직업' },
  { id: 'family', label: '🌳 가족' },
  { id: 'village', label: '🏙 마을' },
  { id: 'achieve', label: '🏅 업적' },
  { id: 'legacy', label: '📜 유산' },
];

export const tabsBar = (active) => `
  <div class="tabs">
    ${TABS.map((t) => `<button data-act="tab" data-id="${t.id}" class="${active === t.id ? 'on' : ''}">${t.label}</button>`).join('')}
  </div>`;

// ── 인생 탭 ───────────────────────────────────────────────

export function lifeTab(state) {
  const me = G.player(state);
  const finance = G.financeSummary(state);
  const activities = G.availableActivities(state).map((a) => `
    <button class="pill ${state.activity === a.id ? 'on' : ''}" data-act="activity" data-id="${a.id}" title="${esc(a.desc)}">
      ${a.icon} ${a.label}
    </button>`).join('');

  const blocked = !G.canAdvance(state);
  const blockReason = state.rewardQueue?.length
    ? '먼저 보상을 선택하세요'
    : state.pending && !state.pending.resolved
      ? '먼저 이번 이벤트를 마무리하세요'
      : '지금은 한 해를 보낼 수 없습니다';
  return `
  <div class="card">
    <div class="section-head"><h2>올해는 무엇을 할까요?</h2><span class="muted">${state.year}년 · ${me.age}세</span></div>
    <div class="pill-row">${activities}</div>
    <p class="muted" style="margin-top:10px">${esc(G.ACTIVITY_BY_ID[state.activity]?.desc ?? '')}</p>
    <button class="primary wide" data-act="advance" ${blocked ? 'disabled' : ''}>
      ${blocked ? blockReason : '한 해를 보낸다 →'}
    </button>
    <div class="auto-bar">
      <button class="pill ${state.auto?.running ? 'on' : ''}" data-act="auto-toggle">
        ${state.auto?.running ? '⏸ 자동 진행 중' : '▶ 자동으로 흘려보내기'}
      </button>
      ${[['slow', '🐢 느리게'], ['normal', '🚶 보통'], ['fast', '🐇 빠르게']].map(([id, label]) => `
        <button class="pill small ${state.auto?.speed === id ? 'on' : ''}" data-act="auto-speed" data-id="${id}">${label}</button>`).join('')}
    </div>
    <p class="muted auto-hint">
      자동으로 두면 해가 저절로 흐르고, 가족들이 일해 돈을 벌다가 사건이 생기면 멈춥니다.
    </p>
  </div>

  <div class="card">
    <h3>살림살이 (연간)</h3>
    <div class="list">
      <div class="item"><span class="grow"><span class="t">수입</span><span class="s">일하는 가족 ${finance.earners}명${finance.support ? ` + 분가한 가족 ${won(finance.support)}` : ''} + 마을 수익</span></span><span>${won(finance.income)}</span></div>
      <div class="item"><span class="grow"><span class="t">지출</span><span class="s">생활비 + 마을 관리비 ${won(finance.maintenance)}</span></span><span>-${won(finance.expense)}</span></div>
      <div class="item"><span class="grow"><span class="t">한 해 수지</span></span>
        <strong style="color:${finance.net >= 0 ? 'var(--green)' : 'var(--bad)'}">${finance.net >= 0 ? '+' : ''}${won(finance.net)}</strong>
      </div>
    </div>
  </div>

  ${state.echoes?.length ? `
  <div class="card">
    <h3>🦋 씨앗이 된 선택</h3>
    <p class="muted">언젠가 돌아올 선택 ${state.echoes.length}가지가 자라고 있습니다.</p>
    <div class="list">
      ${state.echoes.slice(0, 4).map((echo) => `
        <div class="item">
          <span class="grow">
            <span class="t">${esc(fillEcho(state, echo.fromTitle))}</span>
            <span class="s">"${esc(fillEcho(state, echo.fromLabel))}" · ${Math.max(1, echo.dueYear - state.year)}년쯤 뒤</span>
          </span>
        </div>`).join('')}
    </div>
  </div>` : ''}

  <div class="card">
    <h3>인생 기록</h3>
    <div class="log">
      ${state.log.slice(0, 40).map((l) => `
        <div class="log-line ${l.tone}"><span class="y">${l.year}</span><span>${l.icon} ${esc(l.text)}</span></div>`).join('')}
    </div>
  </div>`;
}

const fillEcho = (state, text) => G.fillText(state, text);

// ── 인연 탭 ───────────────────────────────────────────────

export function loveTab(state) {
  const me = G.player(state);
  const partner = G.partnerOf(state);
  const kids = G.childrenOf(state, me);

  if (me.age < 18) {
    return `<div class="card"><h2>💞 인연</h2><p class="muted">아직은 이릅니다. 18세부터 새로운 사람을 만날 수 있어요.</p></div>`;
  }

  if (!partner) {
    const list = G.candidates(state);
    const cards = list.map((c) => `
      <div class="item">
        ${portrait(c, 58, { ageTag: true })}
        <span class="grow">
          <span class="t">${esc(fullName(c))} <span class="muted">${c.age}세</span></span>
          <span class="s">${traitBadges(c) || '평범한 사람'}</span>
          <span class="s">호감도 ${Math.round(c.affection)} / 100</span>
          <span class="bar happy" style="margin-top:4px"><i style="width:${Math.round(c.affection)}%"></i></span>
        </span>
        <span style="display:grid;gap:6px">
          <button data-act="date" data-id="${c.id}" ${state.turnFlags.romanceUsed ? 'disabled' : ''}>데이트 (${won(G.DATE_COST)})</button>
          <button class="primary" data-act="propose" data-id="${c.id}" ${c.affection < 70 || state.money < G.MARRIAGE_COST ? 'disabled' : ''}>청혼 (${won(G.MARRIAGE_COST)})</button>
        </span>
      </div>`).join('');

    return `
    <div class="card">
      <div class="section-head"><h2>💞 인연 만들기</h2><span class="muted">호감도 70 이상이면 청혼할 수 있어요</span></div>
      <button class="wide" data-act="meet" ${state.turnFlags.metThisYear || me.partnerId ? 'disabled' : ''}>
        ${state.turnFlags.metThisYear ? '올해는 이미 만남을 가졌습니다' : `새로운 사람 만나기 (${won(G.MEET_COST)})`}
      </button>
      <div class="list" style="margin-top:12px">${cards || '<p class="muted">아직 만난 사람이 없습니다.</p>'}</div>
    </div>`;
  }

  const birth = G.canHaveChild(state);
  return `
  <div class="card">
    <h2>💞 우리 가족</h2>
    <div class="item">
      ${portrait(partner, 64, { ageTag: true })}
      <span class="grow">
        <span class="t">${esc(fullName(partner))} <span class="muted">${partner.age}세 · ${jobLabel(partner)}</span></span>
        <span class="s">${traitBadges(partner)}</span>
        <span class="s">애정 ${Math.round(partner.affection)} / 100</span>
        <span class="bar happy" style="margin-top:4px"><i style="width:${Math.round(partner.affection)}%"></i></span>
      </span>
    </div>
    <button class="primary wide" style="margin-top:12px" data-act="have-child" ${birth.ok ? '' : 'disabled'}>
      ${birth.ok ? `아이를 갖는다 (${won(G.CHILD_COST_ONCE)})` : esc(birth.reason)}
    </button>
  </div>

  <div class="card">
    <h3>자녀 ${kids.length}명</h3>
    <div class="people-row">
      ${kids.length ? kids.map((k) => personCard(state, k)).join('') : '<p class="muted">아직 아이가 없습니다.</p>'}
    </div>
  </div>`;
}

// ── 직업 탭 ───────────────────────────────────────────────

export function careerTab(state) {
  const me = G.player(state);
  const options = G.jobOptions(state);
  const items = options.map((job) => {
    const reason = me.education < job.edu
      ? `${EDUCATION_LABELS[job.edu]} 이상 필요`
      : Object.entries(job.req).filter(([k, v]) => me.stats[k] < v).map(([k, v]) => `${STAT_LABELS[k]} ${v}`).join(', ');
    return `
    <div class="item ${job.eligible ? '' : 'locked'}">
      <span style="font-size:1.6rem">${job.icon}</span>
      <span class="grow">
        <span class="t">${job.label} ${job.current ? '<span class="badge accent">현재</span>' : ''}</span>
        <span class="s">예상 연봉 ${won(job.expected)} · ${EDUCATION_LABELS[job.edu]}${reason && !job.eligible ? ` · 부족: ${esc(reason)}` : ''}</span>
      </span>
      <button data-act="take-job" data-id="${job.id}" ${job.eligible && !job.current && me.age >= 19 ? '' : 'disabled'}>
        ${job.current ? '재직 중' : '지원'}
      </button>
    </div>`;
  }).join('');

  return `
  <div class="card">
    <div class="section-head"><h2>💼 직업</h2><span class="muted">${jobLabel(me)}</span></div>
    <p class="muted">
      학력 ${EDUCATION_LABELS[me.education]} · 호봉 ${me.jobLevel}/${MAX_JOB_LEVEL}
      ${me.jobId ? ` · 현재 연봉 ${won(salaryOf(me, G.financeSummary(state).bonuses))}` : ''}
    </p>
    ${me.age >= 55 && me.jobId ? '<button class="ghost wide" data-act="retire">은퇴하기</button>' : ''}
  </div>
  <div class="card"><div class="list">${items}</div></div>`;
}

// ── 가족 탭 ───────────────────────────────────────────────

export function personCard(state, person) {
  const me = G.player(state);
  const classes = ['person-card'];
  if (person.id === me.id) classes.push('me');
  if (!person.alive) classes.push('dead');
  const meta = person.alive
    ? `${person.age}세 · ${person.jobId ? JOB_BY_ID[person.jobId].label : (person.age >= 19 ? '무직' : '학생')}`
    : `${person.birthYear}–${person.deathYear}`;
  return `
    <button class="${classes.join(' ')}" data-act="person" data-id="${person.id}">
      ${portrait(person, 60, { ageTag: true })}
      <div class="pname">${esc(fullName(person))}</div>
      <div class="pmeta">${meta}</div>
      <div class="pmeta">${person.traits.map((id) => TRAIT_BY_ID[id]?.icon ?? '').join('')}</div>
    </button>`;
}

export function familyTab(state) {
  const living = G.allPeople(state).filter((p) => p.alive && p.inFamily).length;
  const total = G.allPeople(state).length;
  return `
  <div class="card">
    <div class="section-head">
      <h2>🌳 족보</h2>
      <span class="muted">${state.generation}대 · 생존 ${living}명 / 기록 ${total}명</span>
    </div>
    <p class="muted">인물을 누르면 자세히 볼 수 있습니다. 옆으로 밀어 넓게 볼 수 있어요.</p>
    ${familyTree(state)}
  </div>`;
}

// ── 마을 탭 ───────────────────────────────────────────────

export function villageTab(state) {
  const level = villageLevel(state.village);
  const items = BUILDINGS.map((building) => {
    const current = state.village.buildings[building.id] ?? 0;
    const status = buildStatus(state.village, building.id, state.money);
    const cost = status.cost ?? buildCost(building, current);
    const effect = current > 0 ? describeEffect(building.effect(current)) : '';
    return `
    <div class="item ${status.ok ? '' : 'locked'}">
      <span style="font-size:1.7rem">${building.icon}</span>
      <span class="grow">
        <span class="t">${building.label} ${current ? `<span class="badge">Lv.${current}</span>` : ''}</span>
        <span class="s">${esc(building.desc)}</span>
        ${effect ? `<span class="s">현재 효과: ${effect}</span>` : ''}
      </span>
      <button data-act="build" data-id="${building.id}" ${status.ok ? '' : 'disabled'}>
        ${status.maxed ? '최대' : `${current ? '증축' : '건설'} ${won(cost)}`}
      </button>
    </div>`;
  }).join('');

  return `
  <div class="card">
    <div class="section-head">
      <h2>🏙 ${esc(state.village.name)}</h2>
      <span class="muted">${villageTitle(level)} · Lv.${level} · 명성 ${Math.round(state.village.fame ?? 0)}</span>
    </div>
    <p class="muted">건물은 매년 ${won(villageMaintenance(state.village))}의 관리비가 듭니다.</p>
  </div>
  <div class="card"><div class="list">${items}</div></div>`;
}

function describeEffect(effect) {
  const parts = [];
  if (effect.income) parts.push(`수입 +${won(effect.income)}`);
  if (effect.incomeRate) parts.push(`소득 +${Math.round(effect.incomeRate * 100)}%`);
  if (effect.expenseRate) parts.push(`생활비 ${Math.round(effect.expenseRate * 100)}%`);
  if (effect.happiness) parts.push(`행복 +${effect.happiness.toFixed(1)}`);
  if (effect.lifespan) parts.push(`수명 +${effect.lifespan.toFixed(1)}`);
  if (effect.romance) parts.push('인연 확률 ↑');
  for (const [key, value] of Object.entries(effect.grow ?? {})) {
    parts.push(`${STAT_LABELS[key]} 성장 +${value.toFixed(1)}`);
  }
  return parts.join(' · ');
}

// ── 유산 탭 ───────────────────────────────────────────────

export function legacyTab(state) {
  const me = G.player(state);
  const succession = G.canSucceed(state);
  const heirs = succession.ok ? succession.heirs : [];
  const living = G.allPeople(state).filter((p) => p.alive && p.inFamily).length;

  return `
  <div class="card">
    <h2>📜 가문의 유산</h2>
    <div class="list">
      <div class="item"><span class="grow"><span class="t">세대</span></span><span>${state.generation}대</span></div>
      <div class="item"><span class="grow"><span class="t">함께 사는 가족</span></span><span>${living}명</span></div>
      <div class="item"><span class="grow"><span class="t">태어난 아이</span></span><span>${state.stats.born}명</span></div>
      <div class="item"><span class="grow"><span class="t">지은 건물</span></span><span>${state.stats.buildingsBuilt}채</span></div>
      <div class="item"><span class="grow"><span class="t">최고 자산</span></span><span>${won(state.stats.peakMoney)}</span></div>
      <div class="item"><span class="grow"><span class="t">현재 유산 점수</span></span><strong>${G.legacyScore(state).toLocaleString('ko-KR')}점</strong></div>
    </div>
  </div>

  <div class="card">
    <h3>대를 잇기</h3>
    <p class="muted">
      ${succession.ok
        ? `${esc(fullName(me))}이(가) 물러나고 다음 세대가 이야기를 이어갑니다. 자산의 90%가 전해지고, 물러난 분은 가족과 함께 지냅니다.`
        : esc(succession.reason)}
    </p>
    <div class="list">
      ${heirs.map((h) => `
        <div class="item">
          ${portrait(h, 54, { ageTag: true })}
          <span class="grow"><span class="t">${esc(fullName(h))}</span><span class="s">${h.age}세 · ${jobLabel(h)} · ${h.generation}대</span></span>
          <button class="primary" data-act="succeed" data-id="${h.id}">이 사람에게</button>
        </div>`).join('')}
    </div>
  </div>

  <div class="card">
    <h3>게임 관리</h3>
    <p class="muted">이 브라우저에 자동 저장됩니다. 다른 기기로 옮기려면 저장 데이터를 복사해 두세요.</p>
    <div class="footer-actions">
      <button data-act="save">💾 지금 저장</button>
      <button data-act="copy-save">📋 저장 데이터 복사</button>
      <button data-act="open-import">📥 불러오기</button>
      <button class="ghost" data-act="restart">🔄 새로 시작</button>
    </div>
  </div>`;
}

// ── 모달 ─────────────────────────────────────────────────

export function eventModal(state, event) {
  if (event.resolved) {
    return modal(`
      ${event.tag === 'absurd' ? '<span class="tag-absurd">🤪 병맛 사건</span>' : ''}
      <div class="icon">${event.icon}</div>
      <h2>${esc(event.title)}</h2>
      <p class="muted">${esc(event.resolved.label)}</p>
      <div class="result-box">${esc(event.resolved.text)}</div>
      <button class="primary wide" data-act="event-close">계속하기</button>`, event.tag === 'absurd' ? 'absurd' : '');
  }
  const choices = event.choices.map((choice) => `
    <button class="choice" data-act="event-choice" data-id="${choice.index}" ${choice.affordable ? '' : 'disabled'}>
      ${esc(choice.label)}
      <span class="c-sub">
        ${choice.cost ? `비용 ${won(choice.cost)}${choice.affordable ? '' : ' (자금 부족)'}` : ''}
        ${choice.odds != null ? `${choice.cost ? ' · ' : ''}${STAT_LABELS[choice.checkLabel]} 판정 · 성공률 ${choice.odds}%` : ''}
        ${choice.echoHint ? `${choice.cost || choice.odds != null ? ' · ' : ''}<span class="echo-hint">🦋 훗날에 영향</span>` : ''}
      </span>
    </button>`).join('');

  return modal(`
    ${event.tag === 'absurd' ? '<span class="tag-absurd">🤪 병맛 사건</span>' : ''}
    <div class="event-head">
      ${event.actorPerson ? portrait(event.actorPerson, 62, { ageTag: true }) : `<div class="icon">${event.icon}</div>`}
      <div class="event-who">
        <span class="badge accent">${event.icon} ${esc(event.relation ?? '가족')}</span>
        <h2>${esc(event.title)}</h2>
      </div>
    </div>
    <p>${esc(event.text)}</p>
    <div class="choice-grid">${choices}</div>`, event.tag === 'absurd' ? 'absurd' : '');
}

export function successionModal(state) {
  const heirs = state.succession.heirIds.map((id) => state.people[id]).filter(Boolean);
  return modal(`
    <div class="icon">🕯️</div>
    <h2>가문을 이어갈 사람</h2>
    <p>주인공이 세상을 떠났습니다. 이야기를 이어갈 사람을 선택하세요. (자산의 70%가 상속됩니다)</p>
    <div class="list">
      ${heirs.map((h) => `
        <div class="item">
          ${portrait(h, 54, { ageTag: true })}
          <span class="grow"><span class="t">${esc(fullName(h))}</span><span class="s">${h.age}세 · ${h.generation}대 · ${jobLabel(h)}</span></span>
          <button class="primary" data-act="choose-heir" data-id="${h.id}">선택</button>
        </div>`).join('')}
    </div>`);
}

export function echoModal(state, notice) {
  return modal(`
    <span class="tag-echo">🦋 나비효과</span>
    <div class="echo-head">
      ${notice.person ? portrait(notice.person, 64, { ageTag: true }) : ''}
      <div>
        <div class="muted">${notice.years}년 전의 선택</div>
        <h2>${esc(notice.fromTitle)}</h2>
        <div class="muted">"${esc(notice.fromLabel)}"</div>
      </div>
    </div>
    <div class="result-box ${notice.tone === 'bad' ? 'bad' : ''}">${notice.icon} ${esc(notice.text)}</div>
    <button class="primary wide" data-act="echo-close">그렇게 되었습니다</button>`, 'echo');
}

export function rewardModal(state, choice) {
  const cards = choice.options.map((option) => `
    <div class="reward-card ${option.kind}">
      <span class="reward-crown">👑</span>
      <span class="reward-icon">${option.icon}</span>
      <span class="reward-text">
        <span class="reward-title">${esc(option.title)}</span>
        <span class="reward-label">${esc(option.label)}</span>
      </span>
      <button class="primary reward-pick" data-act="take-reward" data-id="${option.id}">선택</button>
    </div>`).join('');

  return modal(`
    <div class="reward-head">
      <span class="tag-achieve">🏅 업적 달성</span>
      <div class="icon">${choice.achievement.icon}</div>
      <h2>${esc(choice.achievement.title)}</h2>
      <p class="muted">${esc(choice.achievement.desc)}</p>
    </div>
    <h3 class="reward-heading">보상 선택</h3>
    <div class="reward-grid">${cards}</div>
    ${choice.remaining > 1 ? `<p class="muted">고를 보상이 ${choice.remaining - 1}개 더 남았습니다.</p>` : ''}`, 'reward');
}

export function achievementsTab(state) {
  const list = G.achievements(state);
  const done = list.filter((a) => a.done).length;
  const tierLabel = { 1: '동', 2: '은', 3: '금' };

  const items = list.map((achievement) => {
    const progress = achievement.progress;
    const ratio = progress ? Math.min(1, progress.current / progress.goal) : achievement.done ? 1 : 0;
    return `
    <div class="item achieve ${achievement.done ? 'done' : ''}">
      <span class="achieve-icon">${achievement.done ? achievement.icon : '🔒'}</span>
      <span class="grow">
        <span class="t">${esc(achievement.title)} <span class="badge tier${achievement.tier}">${tierLabel[achievement.tier]}</span></span>
        <span class="s">${esc(achievement.desc)}</span>
        ${progress && !achievement.done ? `
          <span class="bar happy" style="margin-top:5px"><i style="width:${Math.round(ratio * 100)}%"></i></span>
          <span class="s">${Math.round(progress.current).toLocaleString('ko-KR')} / ${progress.goal.toLocaleString('ko-KR')}</span>` : ''}
      </span>
      ${achievement.done ? '<span class="achieve-check">✔</span>' : ''}
    </div>`;
  }).join('');

  return `
  <div class="card">
    <div class="section-head">
      <h2>🏅 업적</h2>
      <span class="muted">${done} / ${list.length} 달성</span>
    </div>
    <span class="bar happy"><i style="width:${Math.round((done / list.length) * 100)}%"></i></span>
    <p class="muted" style="margin-top:8px">업적을 달성할 때마다 보상 카드 3장 중 하나를 고를 수 있습니다.</p>
  </div>
  <div class="card"><div class="list">${items}</div></div>`;
}

export function endModal(state) {
  return modal(`
    <div class="icon">📜</div>
    <h2>이야기의 끝</h2>
    <p>${esc(state.ended.reason)}</p>
    <div class="result-box">
      <strong>${state.generation}대 · ${state.ended.year}년</strong><br/>
      유산 점수 <strong>${state.ended.score.toLocaleString('ko-KR')}점</strong><br/>
      태어난 아이 ${state.stats.born}명 · 지은 건물 ${state.stats.buildingsBuilt}채
    </div>
    <button class="primary wide" data-act="restart">새로운 가문 시작하기</button>`);
}

export function personModal(state, person) {
  const bars = STAT_KEYS.map((key) => `
    <div class="bar-row">
      <span>${STAT_LABELS[key]}</span>
      <span class="bar ${key}"><i style="width:${Math.round(person.stats[key])}%"></i></span>
      <span class="muted">${Math.round(person.stats[key])}</span>
    </div>`).join('');
  const parents = person.parents.map((id) => state.people[id]).filter(Boolean);
  const kids = person.children.map((id) => state.people[id]).filter(Boolean);

  return modal(`
    <div style="display:flex;gap:14px;align-items:center">
      ${portrait(person, 84, { ageTag: true })}
      <div>
        <h2 style="margin-bottom:2px">${esc(fullName(person))}</h2>
        <div class="muted">${person.alive ? `${person.age}세 · ${stageOf(person.age).label}` : `${person.birthYear}–${person.deathYear} · 향년 ${person.age}세`}</div>
        <div class="muted">${jobLabel(person)} · ${EDUCATION_LABELS[person.education]} · ${person.generation}대</div>
      </div>
    </div>
    <div class="badges" style="margin-top:10px">${traitBadges(person)}</div>
    <div class="bars" style="margin-top:12px">
      ${bars}
      <div class="bar-row"><span>행복</span><span class="bar happy"><i style="width:${Math.round(person.happiness)}%"></i></span><span class="muted">${Math.round(person.happiness)}</span></div>
    </div>
    <p class="muted" style="margin-top:12px">
      ${parents.length ? `부모: ${parents.map((p) => esc(fullName(p))).join(', ')}<br/>` : ''}
      ${kids.length ? `자녀: ${kids.map((k) => esc(fullName(k))).join(', ')}` : ''}
    </p>
    <button class="wide" data-act="close-modal">닫기</button>`);
}

export function importModal(error) {
  return modal(`
    <div class="icon">📥</div>
    <h2>저장 데이터 불러오기</h2>
    <p class="muted">복사해 둔 저장 데이터를 아래에 붙여넣으세요. 지금 진행 중인 이야기는 덮어씁니다.</p>
    <textarea id="import-text" rows="6" placeholder='{"version":1,...}'></textarea>
    ${error ? `<div class="result-box">${esc(error)}</div>` : ''}
    <div class="footer-actions">
      <button class="primary" data-act="do-import">불러오기</button>
      <button class="ghost" data-act="close-modal">닫기</button>
    </div>`);
}

const modal = (inner, extra = '') => `<div class="modal-bg"><div class="modal ${extra}">${inner}</div></div>`;
