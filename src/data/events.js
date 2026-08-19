// 인생 이벤트. 매년 한 개가 조건과 가중치에 따라 등장한다.
//
// text/label 안의 {me} {partner} {child} {village} 는 엔진이 치환한다.
// choice 는 두 형태 중 하나:
//   1) { label, effects, result }                      — 즉시 확정
//   2) { label, check: { stat, difficulty }, success, fail } — 스탯 판정
// effects 키: money / happiness / stats{} / affection / addTrait / education / lifespan / childHappiness
export const EVENTS = [
  // ── 유년기 ──────────────────────────────────────────────
  {
    id: 'first_word', icon: '👶', title: '첫 마디', weight: 3, minAge: 1, maxAge: 4, once: true,
    text: '{me}이(가) 처음으로 말을 했습니다. 무슨 말이었을까요?',
    choices: [
      { label: '"엄마!"', result: '가족 모두가 울고 웃었습니다.', effects: { happiness: 6, stats: { charm: 3 } } },
      { label: '"이거 뭐야?"', result: '호기심 많은 아이로 자랄 것 같습니다.', effects: { stats: { intellect: 4 }, happiness: 3 } },
    ],
  },
  {
    id: 'scraped_knee', icon: '🩹', title: '넘어진 무릎', weight: 4, minAge: 4, maxAge: 11,
    text: '뛰어놀다 크게 넘어졌습니다. {me}은(는) 울음을 참는 중입니다.',
    choices: [
      { label: '툭툭 털고 다시 뛴다', result: '무릎은 아팠지만 마음은 단단해졌습니다.', effects: { stats: { fitness: 3, health: 1 }, happiness: -1 } },
      { label: '집으로 돌아가 쉰다', result: '따뜻한 손길에 금세 나았습니다.', effects: { stats: { health: 3 }, happiness: 2 } },
    ],
  },
  {
    id: 'talent_found', icon: '✨', title: '숨겨진 재능', weight: 3, minAge: 6, maxAge: 15, once: true,
    text: '{me}에게서 남다른 무언가가 보입니다. 무엇을 밀어줄까요?',
    choices: [
      { label: '악기를 배우게 한다', cost: 200, result: '작은 손이 건반 위를 달립니다.', effects: { stats: { creativity: 8 }, happiness: 3 } },
      { label: '운동부에 보낸다', cost: 150, result: '흙투성이가 되어 웃으며 돌아옵니다.', effects: { stats: { fitness: 8, health: 2 } } },
      { label: '책을 잔뜩 사준다', cost: 120, result: '밤늦게까지 불이 꺼지지 않습니다.', effects: { stats: { intellect: 8 } } },
    ],
  },
  {
    id: 'school_contest', icon: '🏆', title: '학교 대회', weight: 3, minAge: 9, maxAge: 18,
    text: '학교에서 대회가 열립니다. {me}이(가) 나가볼까요?',
    choices: [
      {
        label: '참가한다', check: { stat: 'intellect', difficulty: 45 },
        success: { text: '상장을 들고 뛰어왔습니다!', effects: { stats: { intellect: 5, charm: 3 }, happiness: 6, money: 100 } },
        fail: { text: '아쉽게 떨어졌지만 배운 게 많습니다.', effects: { stats: { intellect: 2 }, happiness: -2 } },
      },
      { label: '조용히 응원만 한다', result: '무리하지 않는 것도 선택입니다.', effects: { happiness: 1 } },
    ],
  },
  // ── 청소년기 ────────────────────────────────────────────
  {
    id: 'first_love', icon: '💗', title: '첫사랑', weight: 3, minAge: 14, maxAge: 19, once: true,
    text: '{me}의 마음속에 누군가가 자리 잡았습니다.',
    choices: [
      {
        label: '용기를 낸다', check: { stat: 'charm', difficulty: 50 },
        success: { text: '풋풋한 계절이 시작되었습니다.', effects: { happiness: 8, stats: { charm: 4 } } },
        fail: { text: '거절당했지만, 이런 마음도 처음입니다.', effects: { happiness: -4, stats: { charm: 2 } } },
      },
      { label: '일기에만 적어둔다', result: '언젠가 꺼내볼 페이지가 생겼습니다.', effects: { stats: { creativity: 4 }, happiness: 1 } },
    ],
  },
  {
    id: 'exam_night', icon: '📖', title: '시험 전날', weight: 4, minAge: 15, maxAge: 19,
    text: '중요한 시험이 코앞입니다.',
    choices: [
      { label: '밤을 새워 공부한다', result: '눈은 빨갛지만 머리는 맑습니다.', effects: { stats: { intellect: 6, health: -3 }, happiness: -2 } },
      { label: '푹 자고 컨디션을 챙긴다', result: '아는 문제는 다 맞혔습니다.', effects: { stats: { intellect: 2, health: 3 }, happiness: 2 } },
      { label: '친구들과 놀러 나간다', result: '성적표는 잊기로 했습니다.', effects: { stats: { charm: 5 }, happiness: 5, education: -1 } },
    ],
  },
  {
    id: 'part_time', icon: '🧋', title: '첫 아르바이트', weight: 3, minAge: 17, maxAge: 24,
    text: '{village}의 가게에서 사람을 구합니다.',
    choices: [
      { label: '일해본다', result: '처음 번 돈의 무게를 알게 되었습니다.', effects: { money: 250, stats: { charm: 3, fitness: 2 }, happiness: -1 } },
      { label: '공부에 집중한다', result: '지금은 때가 아닙니다.', effects: { stats: { intellect: 4 } } },
    ],
  },
  // ── 청년기 ──────────────────────────────────────────────
  {
    id: 'job_offer', icon: '📮', title: '뜻밖의 제안', weight: 3, minAge: 22, maxAge: 45, needsJob: true,
    text: '{me}에게 더 좋은 조건의 자리를 제안받았습니다.',
    choices: [
      {
        label: '옮긴다', check: { stat: 'intellect', difficulty: 55 },
        success: { text: '새 자리에서 빠르게 자리 잡았습니다.', effects: { money: 600, happiness: 4, promote: 1 } },
        fail: { text: '적응이 쉽지 않았습니다.', effects: { happiness: -5, stats: { health: -2 } } },
      },
      { label: '지금 자리를 지킨다', result: '익숙한 것에도 힘이 있습니다.', effects: { happiness: 2, money: 100 } },
    ],
  },
  {
    id: 'investment', icon: '📊', title: '투자 권유', weight: 3, minAge: 22, maxAge: 60,
    text: '아는 사람이 솔깃한 이야기를 들고 왔습니다.',
    choices: [
      {
        label: '크게 투자한다', cost: 800, check: { stat: 'intellect', difficulty: 60 },
        success: { text: '판단이 맞아떨어졌습니다!', effects: { money: 2400, happiness: 6 } },
        fail: { text: '원금이 반토막 났습니다.', effects: { money: 200, happiness: -8 } },
      },
      { label: '조금만 넣어본다', cost: 200, result: '작게 넣고 작게 벌었습니다.', effects: { money: 320, happiness: 1 } },
      { label: '거절한다', result: '나중에 보니 다행이었습니다.', effects: { happiness: 1 } },
    ],
  },
  {
    id: 'old_friend', icon: '🍻', title: '오랜 친구', weight: 3, minAge: 20, maxAge: 70,
    text: '연락이 끊겼던 친구가 {village}에 찾아왔습니다.',
    choices: [
      { label: '밤새 이야기한다', result: '시간이 되돌아간 것 같았습니다.', effects: { happiness: 7, stats: { charm: 2, health: -1 } } },
      { label: '가족과의 저녁을 택한다', result: '식탁의 웃음소리가 길었습니다.', effects: { happiness: 4, childHappiness: 4 } },
    ],
  },
  {
    id: 'burnout', icon: '😮‍💨', title: '번아웃', weight: 3, minAge: 25, maxAge: 60, needsJob: true,
    text: '{me}은(는) 요즘 아무것도 하고 싶지 않습니다.',
    choices: [
      { label: '긴 휴가를 낸다', cost: 400, result: '바다를 보고 왔습니다. 숨이 트입니다.', effects: { happiness: 10, stats: { health: 4 } } },
      { label: '버티며 일한다', result: '해내긴 했지만 몸이 상했습니다.', effects: { money: 400, happiness: -6, stats: { health: -5 } } },
      { label: '일을 줄이고 가족과 지낸다', result: '아이가 자라는 걸 처음으로 자세히 봤습니다.', effects: { happiness: 6, childHappiness: 6, money: -200 } },
    ],
  },
  {
    id: 'lottery', icon: '🎟️', title: '복권', weight: 2, minAge: 20, maxAge: 80,
    text: '가게 앞 복권 판매대가 눈에 들어옵니다.',
    choices: [
      {
        label: '한 장 산다', cost: 10, check: { stat: 'creativity', difficulty: 95 },
        success: { text: '믿기지 않는 숫자가 맞았습니다!', effects: { money: 5000, happiness: 15 } },
        fail: { text: '역시나 꽝입니다.', effects: { happiness: -1 } },
      },
      { label: '지나친다', result: '주머니 사정은 그대로입니다.', effects: {} },
    ],
  },
  // ── 결혼/가족 ───────────────────────────────────────────
  {
    id: 'anniversary', icon: '💞', title: '결혼기념일', weight: 4, minAge: 20, needsPartner: true,
    text: '{partner}와(과)의 기념일입니다.',
    choices: [
      { label: '여행을 떠난다', cost: 500, result: '둘만의 시간이 오래 기억에 남았습니다.', effects: { happiness: 9, affection: 12 } },
      { label: '집에서 함께 요리한다', cost: 60, result: '서툰 요리였지만 완벽한 저녁이었습니다.', effects: { happiness: 5, affection: 8 } },
      { label: '깜빡했다', result: '{partner}의 표정이 굳었습니다.', effects: { happiness: -4, affection: -12 } },
    ],
  },
  {
    id: 'quarrel', icon: '⚡', title: '말다툼', weight: 3, minAge: 20, needsPartner: true,
    text: '사소한 일로 {partner}와(과) 크게 다투었습니다.',
    choices: [
      {
        label: '먼저 사과한다', check: { stat: 'charm', difficulty: 40 },
        success: { text: '서로의 마음을 한 겹 더 알게 되었습니다.', effects: { affection: 10, happiness: 3 } },
        fail: { text: '말이 더 꼬였습니다.', effects: { affection: -5, happiness: -3 } },
      },
      { label: '시간을 두고 기다린다', result: '며칠 뒤 아무 일 없던 듯 지나갔습니다.', effects: { affection: -2 } },
    ],
  },
  {
    id: 'child_dream', icon: '🌟', title: '아이의 꿈', weight: 4, minAge: 25, needsChild: true,
    text: '{child}이(가) 되고 싶은 것이 생겼다고 합니다.',
    choices: [
      { label: '전폭적으로 지원한다', cost: 400, result: '{child}의 눈이 반짝입니다.', effects: { childHappiness: 10, childStats: { creativity: 5, intellect: 3 }, happiness: 4 } },
      { label: '현실적인 조언을 해준다', result: '{child}은(는) 잠시 시무룩했습니다.', effects: { childStats: { intellect: 6 }, childHappiness: -4 } },
      { label: '스스로 해보게 둔다', result: '{child}은(는) 혼자 부딪히며 배웁니다.', effects: { childStats: { fitness: 3, creativity: 3 }, childHappiness: 2 } },
    ],
  },
  {
    id: 'child_sick', icon: '🤒', title: '아이가 아픕니다', weight: 3, minAge: 25, needsChild: true,
    text: '{child}이(가) 밤새 열이 났습니다.',
    choices: [
      { label: '큰 병원에 간다', cost: 350, result: '다음 날 아침 열이 내렸습니다.', effects: { childStats: { health: 5 }, childHappiness: 4, happiness: -2 } },
      { label: '밤새 곁을 지킨다', result: '{child}은(는) 그 밤을 오래 기억할 것입니다.', effects: { childHappiness: 8, childStats: { health: 2 }, happiness: -3, stats: { health: -2 } } },
    ],
  },
  {
    id: 'family_photo', icon: '📷', title: '가족사진', weight: 3, minAge: 22, needsPartner: true,
    text: '온 가족이 모였습니다. 사진관에 갈까요?',
    choices: [
      { label: '제대로 한 장 남긴다', cost: 150, result: '거실 벽에 오래 걸릴 사진이 생겼습니다.', effects: { happiness: 6, childHappiness: 5, affection: 5 } },
      { label: '마당에서 대충 찍는다', result: '흔들렸지만 다들 웃고 있습니다.', effects: { happiness: 3, childHappiness: 3 } },
    ],
  },
  // ── 마을/공동체 ─────────────────────────────────────────
  {
    id: 'village_festival', icon: '🎪', title: '{village} 축제', weight: 3, minAge: 12,
    text: '마을에 축제가 열렸습니다.',
    choices: [
      { label: '무대에 오른다', check: { stat: 'charm', difficulty: 55 }, success: { text: '마을의 스타가 되었습니다!', effects: { happiness: 8, stats: { charm: 5 }, money: 200 } }, fail: { text: '박수는 받았지만 얼굴이 화끈했습니다.', effects: { happiness: 2, stats: { charm: 2 } } } },
      { label: '먹거리 장사를 한다', cost: 100, result: '재료비를 빼고도 남았습니다.', effects: { money: 400, stats: { fitness: -1 } } },
      { label: '가족과 구경만 한다', result: '솜사탕이 달았습니다.', effects: { happiness: 5, childHappiness: 5 } },
    ],
  },
  {
    id: 'neighbor_help', icon: '🤝', title: '이웃의 부탁', weight: 3, minAge: 18,
    text: '{village} 이웃이 도움을 청합니다.',
    choices: [
      { label: '기꺼이 돕는다', result: '마을에 {me}의 편이 늘었습니다.', effects: { happiness: 4, stats: { charm: 3 }, villageFame: 2 } },
      { label: '돈으로 돕는다', cost: 200, result: '고맙다는 인사가 오래갔습니다.', effects: { happiness: 2, villageFame: 3 } },
      { label: '사정을 말하고 거절한다', result: '조금 미안한 마음이 남았습니다.', effects: { happiness: -2 } },
    ],
  },
  {
    id: 'stray_cat', icon: '🐈', title: '문 앞의 고양이', weight: 2, minAge: 6,
    text: '작은 고양이가 집 앞에 앉아 있습니다.',
    choices: [
      { label: '가족으로 맞이한다', cost: 80, result: '이름을 짓는 데 사흘이 걸렸습니다.', effects: { happiness: 8, childHappiness: 6, expenseUp: 1 } },
      { label: '밥만 챙겨준다', result: '가끔 들르는 사이가 되었습니다.', effects: { happiness: 3 } },
    ],
  },
  // ── 중년/노년 ───────────────────────────────────────────
  {
    id: 'health_check', icon: '🩺', title: '건강검진', weight: 4, minAge: 40,
    text: '검진 결과지를 받았습니다.',
    choices: [
      { label: '생활 습관을 바꾼다', cost: 200, result: '아침 산책이 습관이 되었습니다.', effects: { stats: { health: 7, fitness: 3 }, lifespan: 2 } },
      { label: '괜찮겠지 하고 넘긴다', result: '결과지는 서랍 속으로 들어갔습니다.', effects: { stats: { health: -4 }, lifespan: -2, money: 100 } },
    ],
  },
  {
    id: 'second_chance', icon: '🌅', title: '늦은 도전', weight: 3, minAge: 45, maxAge: 70,
    text: '{me}은(는) 오래 미뤄둔 일을 떠올렸습니다.',
    choices: [
      { label: '지금이라도 시작한다', cost: 300, result: '늦은 시작이 가장 즐거웠습니다.', effects: { happiness: 10, stats: { creativity: 6 }, addTrait: 'dreamer' } },
      { label: '가족을 위해 접어둔다', result: '대신 아이의 꿈을 응원했습니다.', effects: { childHappiness: 8, happiness: 2 } },
    ],
  },
  {
    id: 'legacy_talk', icon: '🕯️', title: '물려줄 것', weight: 3, minAge: 60, needsChild: true,
    text: '{me}은(는) {child}에게 무엇을 남길지 생각합니다.',
    choices: [
      { label: '재산을 정리해 물려준다', result: '숫자보다 마음이 먼저 전해졌습니다.', effects: { childHappiness: 6, inheritBonus: 0.1 } },
      { label: '살아온 이야기를 들려준다', result: '{child}은(는) 그날 밤을 평생 기억합니다.', effects: { childHappiness: 10, childStats: { intellect: 4, charm: 4 } } },
      { label: '집과 마을을 더 가꾼다', cost: 500, result: '다음 세대가 살아갈 자리가 넓어졌습니다.', effects: { villageFame: 5, happiness: 5 } },
    ],
  },
  {
    id: 'grandchild', icon: '🧸', title: '손주', weight: 3, minAge: 55, needsGrandchild: true,
    text: '작은 손이 {me}의 손가락을 꼭 쥐었습니다.',
    choices: [
      { label: '온종일 놀아준다', result: '허리는 아프지만 하루가 짧았습니다.', effects: { happiness: 12, stats: { health: -1 } } },
      { label: '용돈을 쥐여준다', cost: 150, result: '"할머니 할아버지 최고!"', effects: { happiness: 7, childHappiness: 5 } },
    ],
  },
  {
    id: 'quiet_year', icon: '🍵', title: '조용한 한 해', weight: 5, minAge: 5,
    text: '특별한 일 없이 계절이 지나갔습니다.',
    choices: [
      { label: '평범함에 감사한다', result: '이런 해도 인생의 일부입니다.', effects: { happiness: 3, stats: { health: 1 } } },
      { label: '뭔가 새로 배워본다', cost: 100, result: '작은 취미가 하나 늘었습니다.', effects: { stats: { creativity: 3, intellect: 2 } } },
    ],
  },
];

export const EVENT_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
