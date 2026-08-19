// 인생 이벤트. 매년 나이와 처지에 맞는 것 하나가 가중치에 따라 등장한다.
//
// text/label 안의 {me} {partner} {child} {village} 는 엔진이 치환한다.
// choice 는 두 형태 중 하나:
//   1) { label, effects, result }                          — 즉시 확정
//   2) { label, check: { stat, difficulty }, success, fail } — 스탯 판정
// effects 키: money / happiness / stats{} / affection / addTrait / education
//             lifespan / childHappiness / childStats{} / promote / villageFame / expenseUp
// tag: 'absurd' 는 병맛 이벤트 (화면에서 따로 표시된다)
export const EVENTS = [
  // ══ 유아기 (0~4세) ══════════════════════════════════════
  {
    id: 'first_word', icon: '👶', title: '첫 마디', weight: 4, minAge: 1, maxAge: 4, once: true,
    text: '{me}이(가) 처음으로 말을 했습니다. 무슨 말이었을까요?',
    choices: [
      { label: '"엄마!"', result: '가족 모두가 울고 웃었습니다.', effects: { happiness: 6, stats: { charm: 3 } } },
      { label: '"이거 뭐야?"', result: '호기심 많은 아이로 자랄 것 같습니다.', effects: { stats: { intellect: 4 }, happiness: 3 } },
      { label: '"안 해!"', result: '벌써부터 자기 주장이 뚜렷합니다.', effects: { stats: { fitness: 3 }, addTrait: 'stubborn' } },
    ],
  },
  {
    id: 'first_step', icon: '🦶', title: '첫걸음', weight: 4, minAge: 1, maxAge: 3, once: true,
    text: '{me}이(가) 소파를 짚고 일어섰습니다.',
    choices: [
      { label: '손을 잡아준다', result: '세 걸음 만에 품에 안겼습니다.', effects: { happiness: 6, stats: { charm: 2 } } },
      { label: '멀리서 기다린다', result: '혼자 다섯 걸음을 걸어왔습니다!', effects: { stats: { fitness: 5 }, happiness: 4 } },
    ],
  },
  {
    id: 'night_cry', icon: '🌙', title: '밤울음', weight: 3, minAge: 0, maxAge: 3,
    text: '{me}이(가) 새벽 세 시마다 웁니다. 온 집이 잠을 못 잡니다.',
    choices: [
      { label: '업고 마을을 한 바퀴 돈다', result: '별을 보다 잠들었습니다.', effects: { happiness: 3, stats: { health: 2 } } },
      { label: '자장가를 지어 부른다', result: '엉터리 가사인데 잘 통합니다.', effects: { stats: { creativity: 4 }, happiness: 2 } },
      { label: '어른이 번갈아 지킨다', cost: 100, result: '온 가족이 초췌해졌지만 버텼습니다.', effects: { stats: { health: -2 }, happiness: 4 } },
    ],
  },
  {
    id: 'toy_choice', icon: '🧸', title: '첫 장난감', weight: 3, minAge: 2, maxAge: 5,
    text: '{me}이(가) 유독 손에서 놓지 않는 물건이 생겼습니다.',
    choices: [
      { label: '블록을 사준다', cost: 80, result: '탑을 쌓았다 부수기를 백 번 반복합니다.', effects: { stats: { intellect: 4, creativity: 2 } } },
      { label: '공을 사준다', cost: 60, result: '집 안이 운동장이 되었습니다.', effects: { stats: { fitness: 4 }, happiness: 2 } },
      { label: '아무거나 쥐여준다', result: '결국 냄비 뚜껑이 제일 재미있답니다.', effects: { happiness: 3, stats: { creativity: 2 } } },
    ],
  },

  // ══ 아동기 (5~12세) ════════════════════════════════════
  {
    id: 'scraped_knee', icon: '🩹', title: '넘어진 무릎', weight: 4, minAge: 5, maxAge: 11,
    text: '뛰어놀다 크게 넘어졌습니다. {me}은(는) 울음을 참는 중입니다.',
    choices: [
      { label: '툭툭 털고 다시 뛴다', result: '무릎은 아팠지만 마음은 단단해졌습니다.', effects: { stats: { fitness: 3, health: 1 }, happiness: -1 } },
      { label: '집으로 돌아가 쉰다', result: '따뜻한 손길에 금세 나았습니다.', effects: { stats: { health: 3 }, happiness: 2 } },
    ],
  },
  {
    id: 'talent_found', icon: '✨', title: '숨겨진 재능', weight: 4, minAge: 6, maxAge: 15, once: true,
    text: '{me}에게서 남다른 무언가가 보입니다. 무엇을 밀어줄까요?',
    choices: [
      { label: '악기를 배우게 한다', cost: 200, result: '작은 손이 건반 위를 달립니다.',
        effects: { stats: { creativity: 8 }, happiness: 3, flag: 'music' },
        echo: { delay: [8, 16], icon: '🎹', text: '어릴 적 배운 건반이 {actor}의 무대가 되었습니다. 첫 공연에 마을이 다 왔습니다.',
                effects: { money: 900, stats: { creativity: 8, charm: 5 }, villageFame: 6, happiness: 8 } } },
      { label: '운동부에 보낸다', cost: 150, result: '흙투성이가 되어 웃으며 돌아옵니다.',
        effects: { stats: { fitness: 8, health: 2 }, flag: 'sport' },
        echo: { delay: [7, 15], icon: '🏅', text: '{actor}이(가) 그때 시작한 운동으로 상을 받았습니다. 몸도 마음도 튼튼합니다.',
                effects: { stats: { fitness: 6, health: 6 }, lifespan: 3, money: 500, villageFame: 4 } } },
      { label: '책을 잔뜩 사준다', cost: 120, result: '밤늦게까지 불이 꺼지지 않습니다.',
        effects: { stats: { intellect: 8 }, flag: 'books' },
        echo: { delay: [8, 16], icon: '📚', text: '그때 읽은 책들이 {actor}의 길이 되었습니다. 배움의 속도가 남다릅니다.',
                effects: { stats: { intellect: 8 }, education: 3, addTrait: 'diligent' } } },
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
  {
    id: 'first_friend', icon: '🧒', title: '단짝', weight: 3, minAge: 6, maxAge: 14,
    text: '{me}에게 늘 붙어다니는 친구가 생겼습니다.',
    choices: [
      { label: '집에 초대한다', cost: 50, result: '떡볶이를 나눠 먹으며 우정이 깊어졌습니다.', effects: { stats: { charm: 5 }, happiness: 5 } },
      { label: '같이 학원에 보낸다', cost: 250, result: '경쟁하듯 공부가 늘었습니다.', effects: { stats: { intellect: 6 }, education: 1 } },
      { label: '스스로 어울리게 둔다', result: '둘만의 비밀 기지가 생겼답니다.', effects: { stats: { creativity: 4 }, happiness: 3 } },
    ],
  },
  {
    id: 'lost_pet', icon: '🐕', title: '잃어버린 강아지', weight: 2, minAge: 6, maxAge: 16,
    text: '이웃집 강아지가 사라졌습니다. {me}이(가) 찾아보겠다고 나섭니다.',
    choices: [
      {
        label: '온 마을을 뒤진다', check: { stat: 'fitness', difficulty: 40 },
        success: { text: '개울가에서 떨고 있던 강아지를 찾았습니다!', effects: { happiness: 8, stats: { fitness: 3 }, villageFame: 3, money: 150 } },
        fail: { text: '못 찾았지만 다음 날 스스로 돌아왔습니다.', effects: { happiness: 1, stats: { fitness: 2 } } },
      },
      { label: '전단지를 만든다', cost: 40, result: '그림 솜씨가 늘었습니다.', effects: { stats: { creativity: 4 }, villageFame: 2 } },
    ],
  },
  {
    id: 'piggy_bank', icon: '🐷', title: '돼지 저금통', weight: 3, minAge: 7, maxAge: 15,
    text: '{me}이(가) 모은 저금통이 꽉 찼습니다.',
    choices: [
      { label: '갖고 싶던 걸 사게 한다', result: '스스로 번 돈으로 산 첫 물건입니다.', effects: { happiness: 6, stats: { charm: 2 } } },
      { label: '살림에 보탠다', result: '어린 마음이 기특합니다.', effects: { money: 120, happiness: 2, addTrait: 'frugal' } },
      { label: '더 모으라고 한다', result: '통장이라는 걸 처음 만들었습니다.', effects: { money: 60, stats: { intellect: 3 } } },
    ],
  },
  {
    id: 'stage_fright', icon: '🎤', title: '학예회', weight: 3, minAge: 7, maxAge: 14,
    text: '학예회 무대에 설 차례입니다. {me}은(는) 커튼 뒤에서 굳어 있습니다.',
    choices: [
      {
        label: '등을 떠민다', check: { stat: 'charm', difficulty: 42 },
        success: { text: '박수가 쏟아졌습니다. 무대 체질인가 봅니다.', effects: { stats: { charm: 7 }, happiness: 7 } },
        fail: { text: '가사를 잊었지만 끝까지 서 있었습니다.', effects: { stats: { charm: 3 }, happiness: -2 } },
      },
      { label: '무대 뒤 일을 맡긴다', result: '조명 담당이 적성에 맞았습니다.', effects: { stats: { creativity: 5 }, happiness: 2 } },
    ],
  },
  {
    id: 'bully', icon: '😠', title: '괴롭힘', weight: 2, minAge: 8, maxAge: 17,
    text: '{me}이(가) 학교에서 힘든 일을 겪고 있는 것 같습니다.',
    choices: [
      { label: '학교와 함께 해결한다', result: '어른들이 나서자 상황이 정리되었습니다.', effects: { happiness: 4, stats: { intellect: 2 } } },
      { label: '맞설 힘을 길러준다', cost: 200, result: '체육관에 다니며 어깨가 펴졌습니다.', effects: { stats: { fitness: 6 }, happiness: 2 } },
      { label: '매일 이야기를 들어준다', result: '털어놓는 것만으로 짐이 가벼워졌습니다.', effects: { happiness: 6, stats: { charm: 3 } } },
    ],
  },

  // ══ 청소년기 (13~18세) ═════════════════════════════════
  {
    id: 'first_love', icon: '💗', title: '첫사랑', weight: 4, minAge: 14, maxAge: 19, once: true,
    text: '{me}의 마음속에 누군가가 자리 잡았습니다.',
    choices: [
      {
        label: '용기를 낸다', check: { stat: 'charm', difficulty: 50 },
        success: { text: '풋풋한 계절이 시작되었습니다.', effects: { happiness: 8, stats: { charm: 4 } },
          echo: { delay: [6, 14], icon: '💌', text: '그때의 용기가 {actor}에게 남았습니다. 사람 앞에서 주저하지 않습니다.',
                  effects: { stats: { charm: 8 }, happiness: 6, affection: 10 } } },
        fail: { text: '거절당했지만, 이런 마음도 처음입니다.', effects: { happiness: -4, stats: { charm: 2 } } },
      },
      { label: '일기에만 적어둔다', result: '언젠가 꺼내볼 페이지가 생겼습니다.', effects: { stats: { creativity: 4 }, happiness: 1 } },
    ],
  },
  {
    id: 'exam_night', icon: '📖', title: '시험 전날', weight: 4, minAge: 15, maxAge: 19,
    text: '중요한 시험이 코앞입니다.',
    choices: [
      { label: '밤을 새워 공부한다', result: '눈은 빨갛지만 머리는 맑습니다.', effects: { stats: { intellect: 6, health: -3 }, education: 1, happiness: -2 } },
      { label: '푹 자고 컨디션을 챙긴다', result: '아는 문제는 다 맞혔습니다.', effects: { stats: { intellect: 2, health: 3 }, happiness: 2 } },
      { label: '친구들과 놀러 나간다', result: '성적표는 잊기로 했습니다.',
        effects: { stats: { charm: 5 }, happiness: 5, education: -1 },
        echo: { delay: [5, 12], icon: '🪃', tone: 'bad', text: '그때 미룬 공부가 {actor}의 발목을 잡았습니다. 원하던 자리를 놓쳤습니다.',
                effects: { happiness: -8, money: -400 } } },
    ],
  },
  {
    id: 'part_time', icon: '🧋', title: '첫 아르바이트', weight: 3, minAge: 17, maxAge: 24,
    text: '{village}의 가게에서 사람을 구합니다.',
    choices: [
      { label: '일해본다', result: '처음 번 돈의 무게를 알게 되었습니다.', effects: { money: 250, stats: { charm: 3, fitness: 2 }, happiness: -1 } },
      { label: '공부에 집중한다', result: '지금은 때가 아닙니다.', effects: { stats: { intellect: 4 }, education: 1 } },
    ],
  },
  {
    id: 'band', icon: '🎸', title: '밴드 결성', weight: 3, minAge: 14, maxAge: 22,
    text: '친구들이 밴드를 하자고 합니다. 악기는 아무도 못 다룹니다.',
    choices: [
      { label: '보컬을 맡는다', result: '목이 쉬도록 소리쳤습니다.', effects: { stats: { charm: 6, creativity: 3 }, happiness: 6 } },
      { label: '중고 기타를 산다', cost: 180, result: '손끝에 굳은살이 배겼습니다.', effects: { stats: { creativity: 7 }, happiness: 4 } },
      { label: '거절하고 공부한다', result: '창밖으로 합주 소리가 들려옵니다.', effects: { stats: { intellect: 5 }, happiness: -3, education: 1 } },
    ],
  },
  {
    id: 'growth_spurt', icon: '📏', title: '키가 자란다', weight: 3, minAge: 13, maxAge: 18,
    text: '한 해 사이에 옷이 다 작아졌습니다.',
    choices: [
      { label: '잘 먹인다', cost: 150, result: '문지방을 넘을 때마다 조심해야 합니다.', effects: { stats: { fitness: 5, health: 4 } } },
      { label: '운동을 시킨다', result: '뼈마디가 쑤시지만 몸이 단단해졌습니다.', effects: { stats: { fitness: 6, health: 2 }, happiness: -1 } },
    ],
  },
  {
    id: 'rebel', icon: '🔥', title: '사춘기', weight: 4, minAge: 13, maxAge: 18,
    text: '{me}이(가) 방문을 쾅 닫았습니다. 요즘 말이 통하지 않습니다.',
    choices: [
      { label: '혼자만의 시간을 준다', result: '며칠 뒤 슬그머니 나와 밥을 먹었습니다.', effects: { happiness: 3, stats: { creativity: 3 } } },
      { label: '진지하게 마주 앉는다', check: { stat: 'charm', difficulty: 48 }, success: { text: '처음으로 속마음을 들었습니다.', effects: { happiness: 7, stats: { charm: 4 } } }, fail: { text: '말이 더 엇나갔습니다.', effects: { happiness: -5 } } },
      { label: '엄하게 다스린다', result: '조용해졌지만 눈빛이 남았습니다.',
        effects: { education: 1, happiness: -4, stats: { intellect: 3 } },
        echo: { delay: [6, 14], icon: '🚪', tone: 'bad', text: '{actor}은(는) 그해의 말들을 오래 기억했습니다. 집에 잘 들르지 않습니다.',
                effects: { happiness: -8, familyHappiness: -4 } } },
    ],
  },
  {
    id: 'career_dream', icon: '🌠', title: '되고 싶은 것', weight: 3, minAge: 15, maxAge: 20,
    text: '{me}이(가) 장래 희망을 이야기합니다.',
    choices: [
      { label: '학원에 보낸다', cost: 400, result: '목표가 생기자 눈빛이 달라졌습니다.', effects: { stats: { intellect: 6 }, education: 2, happiness: 3 } },
      { label: '현장을 보여준다', cost: 150, result: '직접 보고 오더니 더 굳어졌습니다.', effects: { stats: { creativity: 5, charm: 2 }, happiness: 5 } },
      { label: '알아서 하라고 한다', result: '스스로 길을 찾기 시작했습니다.', effects: { stats: { intellect: 3, fitness: 2 } } },
    ],
  },
  {
    id: 'driving', icon: '🚗', title: '운전면허', weight: 3, minAge: 18, maxAge: 30, once: true,
    text: '면허를 딸 나이가 되었습니다.',
    choices: [
      {
        label: '학원에 등록한다', cost: 300, check: { stat: 'fitness', difficulty: 40 },
        success: { text: '한 번에 붙었습니다!', effects: { happiness: 5, stats: { fitness: 3 } } },
        fail: { text: '세 번 만에 겨우 붙었습니다.', effects: { money: -200, happiness: 2 } },
      },
      { label: '나중으로 미룬다', result: '아직은 두 발이면 충분합니다.', effects: { stats: { fitness: 2 } } },
    ],
  },
  {
    id: 'graduation', icon: '🎓', title: '졸업식', weight: 3, minAge: 18, maxAge: 19, once: true,
    text: '교복을 입는 마지막 날입니다.',
    choices: [
      { label: '가족사진을 찍는다', cost: 80, result: '거실에 오래 걸릴 사진이 생겼습니다.', effects: { happiness: 8, stats: { charm: 2 } } },
      { label: '친구들과 밤새 논다', result: '해 뜨는 걸 같이 봤습니다.', effects: { happiness: 7, stats: { charm: 4, health: -2 } } },
      { label: '바로 일자리를 알아본다', result: '어른의 시간이 하루 먼저 시작됐습니다.', effects: { money: 200, stats: { intellect: 2 }, happiness: -2 } },
    ],
  },

  // ══ 청년기 (19~34세) ═══════════════════════════════════
  {
    id: 'first_salary', icon: '💵', title: '첫 월급', weight: 4, minAge: 19, maxAge: 40, needsJob: true, once: true,
    text: '통장에 처음으로 월급이 들어왔습니다.',
    choices: [
      { label: '부모님께 선물한다', cost: 200, result: '받는 쪽이 더 울었습니다.', effects: { happiness: 10, stats: { charm: 3 } } },
      { label: '전부 저축한다', result: '숫자가 늘어나는 재미를 알았습니다.', effects: { money: 300, addTrait: 'frugal' } },
      { label: '나에게 쓴다', cost: 150, result: '갖고 싶던 걸 드디어 샀습니다.', effects: { happiness: 8, stats: { charm: 2 } } },
    ],
  },
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
        success: { text: '판단이 맞아떨어졌습니다!', effects: { money: 2400, happiness: 6, flag: 'investor' },
          echo: { delay: [6, 14], icon: '📈', text: '그때 묻어둔 돈이 몇 곱절로 돌아왔습니다.', effects: { money: 4200, happiness: 6 } } },
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
    id: 'move_out', icon: '📦', title: '독립', weight: 3, minAge: 20, maxAge: 32, once: true,
    text: '내 이름으로 된 공간이 갖고 싶어집니다.',
    choices: [
      { label: '작은 방을 얻는다', cost: 900, result: '좁지만 온전히 내 것입니다.', effects: { happiness: 8, stats: { creativity: 3 }, expenseUp: 1 } },
      { label: '가족과 더 지낸다', result: '아직은 밥값이 아깝지 않습니다.', effects: { money: 400, happiness: 2 } },
    ],
  },
  {
    id: 'side_hustle', icon: '💡', title: '부업', weight: 3, minAge: 21, maxAge: 55,
    text: '퇴근 후에 뭔가 해볼 수 있을 것 같습니다.',
    choices: [
      {
        label: '작은 가게를 열어본다', cost: 600, check: { stat: 'creativity', difficulty: 55 },
        success: { text: '입소문이 나기 시작했습니다!',
          effects: { money: 1600, happiness: 5, villageFame: 4, flag: 'business' },
          echo: { delay: [5, 12], icon: '🏪', text: '{actor}의 가게가 자리를 잡았습니다. 2호점 이야기가 나옵니다.',
                  effects: { money: 3200, villageFame: 6, happiness: 8 } } },
        fail: { text: '재고만 쌓였습니다.', effects: { money: 100, happiness: -4, stats: { health: -2 } } },
      },
      { label: '자격증을 딴다', cost: 250, result: '이력서 한 줄이 늘었습니다.', effects: { stats: { intellect: 5 }, education: 1, promote: 1 } },
      { label: '푹 쉰다', result: '체력이 곧 자산입니다.', effects: { stats: { health: 4 }, happiness: 3 } },
    ],
  },
  {
    id: 'burnout', icon: '😮‍💨', title: '번아웃', weight: 3, minAge: 25, maxAge: 60, needsJob: true,
    text: '{me}은(는) 요즘 아무것도 하고 싶지 않습니다.',
    choices: [
      { label: '긴 휴가를 낸다', cost: 400, result: '바다를 보고 왔습니다. 숨이 트입니다.', effects: { happiness: 10, stats: { health: 4 } } },
      { label: '버티며 일한다', result: '해내긴 했지만 몸이 상했습니다.',
        effects: { money: 400, happiness: -6, stats: { health: -5 } },
        echo: { delay: [6, 14], icon: '🏥', tone: 'bad', text: '그해 무리한 대가가 {actor}에게 돌아왔습니다. 병원 신세를 졌습니다.',
                effects: { stats: { health: -10 }, lifespan: -4, money: -600 } } },
      { label: '일을 줄이고 가족과 지낸다', result: '아이가 자라는 걸 처음으로 자세히 봤습니다.',
        effects: { happiness: 6, childHappiness: 6, money: -200 },
        echo: { delay: [8, 16], icon: '🏡', text: '그때 함께한 시간을 아이가 기억합니다. 어른이 되어서도 {actor} 곁을 지킵니다.',
                effects: { familyHappiness: 10, childStats: { charm: 6 } } } },
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
  {
    id: 'marathon', icon: '🏃', title: '마라톤 대회', weight: 2, minAge: 20, maxAge: 55,
    text: '{village} 마라톤 대회 신청서가 붙었습니다.',
    choices: [
      {
        label: '완주에 도전한다', cost: 50, check: { stat: 'fitness', difficulty: 55 },
        success: { text: '완주 메달을 목에 걸었습니다!', effects: { stats: { fitness: 6, health: 4 }, happiness: 8, villageFame: 3 } },
        fail: { text: '절반에서 포기했지만 다리는 튼튼해졌습니다.', effects: { stats: { fitness: 3 }, happiness: -1 } },
      },
      { label: '자원봉사로 참여한다', result: '물을 나눠주며 마을 사람들과 친해졌습니다.', effects: { stats: { charm: 4 }, villageFame: 3, happiness: 3 } },
    ],
  },
  {
    id: 'health_scare', icon: '🫀', title: '몸이 보내는 신호', weight: 3, minAge: 28, maxAge: 60,
    text: '계단만 올라도 숨이 찹니다.',
    choices: [
      { label: '병원에서 정밀검사', cost: 350, result: '큰일은 아니었지만 경고를 받았습니다.', effects: { stats: { health: 6 }, lifespan: 2, happiness: -1 } },
      { label: '운동을 시작한다', result: '새벽 공기가 나쁘지 않습니다.', effects: { stats: { fitness: 5, health: 3 } } },
      { label: '기분 탓이라 여긴다', result: '피로가 쌓여갑니다.', effects: { stats: { health: -4 }, lifespan: -1, money: 150 } },
    ],
  },

  // ══ 중년기 (35~59세) ═══════════════════════════════════
  {
    id: 'health_check', icon: '🩺', title: '건강검진', weight: 4, minAge: 40,
    text: '검진 결과지를 받았습니다.',
    choices: [
      { label: '생활 습관을 바꾼다', cost: 200, result: '아침 산책이 습관이 되었습니다.',
        effects: { stats: { health: 7, fitness: 3 }, lifespan: 2 },
        echo: { delay: [6, 14], icon: '🌿', text: '{actor}의 아침 산책은 십 년째입니다. 또래보다 훨씬 정정합니다.',
                effects: { stats: { health: 8, fitness: 5 }, lifespan: 4, happiness: 6 } } },
      { label: '괜찮겠지 하고 넘긴다', result: '결과지는 서랍 속으로 들어갔습니다.',
        effects: { stats: { health: -4 }, lifespan: -2, money: 100 },
        echo: { delay: [3, 9], icon: '🚑', tone: 'bad', text: '서랍 속 결과지가 결국 {actor}를 병원으로 데려갔습니다.',
                effects: { stats: { health: -12 }, lifespan: -5, money: -900 } } },
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
    id: 'promotion_race', icon: '🪜', title: '승진 경쟁', weight: 3, minAge: 32, maxAge: 58, needsJob: true,
    text: '자리 하나를 두고 경쟁이 붙었습니다.',
    choices: [
      {
        label: '실력으로 붙는다', check: { stat: 'intellect', difficulty: 62 },
        success: { text: '모두가 인정하는 결과였습니다.', effects: { promote: 2, happiness: 6, money: 400 } },
        fail: { text: '이번엔 아니었습니다.', effects: { happiness: -6, stats: { health: -2 } } },
      },
      {
        label: '사람을 챙긴다', check: { stat: 'charm', difficulty: 55 },
        success: { text: '주변이 밀어줬습니다.', effects: { promote: 1, happiness: 5, villageFame: 2 } },
        fail: { text: '술자리만 늘었습니다.', effects: { stats: { health: -3 }, money: -150 } },
      },
      { label: '경쟁에서 빠진다', result: '대신 정시에 퇴근했습니다.', effects: { happiness: 4, childHappiness: 4 } },
    ],
  },
  {
    id: 'parents_care', icon: '🍵', title: '부모님', weight: 3, minAge: 35, maxAge: 65,
    text: '어른들이 부쩍 약해지셨습니다.',
    choices: [
      { label: '병원비를 대드린다', cost: 600, result: '해드릴 수 있는 게 있어 다행입니다.', effects: { happiness: 6, lifespan: 1 } },
      { label: '주말마다 찾아뵌다', result: '얼굴 보는 게 최고라 하십니다.',
        effects: { happiness: 7, stats: { charm: 2 }, money: -100 },
        echo: { delay: [5, 12], icon: '🎁', text: '어른들이 {actor} 앞으로 남겨둔 것이 있었습니다. 통장과 편지 한 장.',
                effects: { money: 1600, happiness: 8 } } },
      { label: '지금은 여력이 없다', result: '마음에 짐이 남았습니다.',
        effects: { happiness: -6, money: 200 },
        echo: { delay: [4, 10], icon: '🌧️', tone: 'bad', text: '그때 하지 못한 일이 {actor}의 마음에 오래 남았습니다.',
                effects: { happiness: -10, stats: { health: -3 } } } },
    ],
  },
  {
    id: 'midlife_car', icon: '🏎️', title: '충동구매', weight: 2, minAge: 38, maxAge: 58,
    text: '쇼윈도의 빨간 차가 자꾸 아른거립니다.',
    choices: [
      { label: '질러버린다', cost: 2500, result: '주말마다 세차를 합니다. 행복합니다.', effects: { happiness: 14, stats: { charm: 4 }, expenseUp: 2 } },
      { label: '가족 여행으로 돌린다', cost: 700, result: '온 가족의 사진이 남았습니다.', effects: { happiness: 8, childHappiness: 8, affection: 8 } },
      { label: '참는다', result: '통장 잔고를 보며 위안을 삼습니다.', effects: { money: 300, happiness: -2 } },
    ],
  },
  {
    id: 'mentor', icon: '🧑‍🏫', title: '후배가 생겼다', weight: 3, minAge: 35, maxAge: 62, needsJob: true,
    text: '{me}에게 배우겠다는 사람이 나타났습니다.',
    choices: [
      { label: '정성껏 가르친다', result: '가르치며 오히려 더 배웠습니다.', effects: { stats: { intellect: 4, charm: 4 }, happiness: 5, villageFame: 3 } },
      { label: '내 일에 집중한다', result: '실적은 좋았지만 조금 외로웠습니다.', effects: { promote: 1, money: 300, happiness: -2 } },
    ],
  },
  {
    id: 'village_office', icon: '🗳️', title: '마을 대표 선거', weight: 2, minAge: 35, maxAge: 70,
    text: '{village} 대표를 뽑는다며 {me}에게 나가보라고 합니다.',
    choices: [
      {
        label: '출마한다', cost: 300, check: { stat: 'charm', difficulty: 60 },
        success: { text: '{village}의 새 대표가 되었습니다!', effects: { villageFame: 12, happiness: 10, stats: { charm: 5 } } },
        fail: { text: '아쉽게 졌지만 이름은 알렸습니다.', effects: { villageFame: 4, happiness: -3 } },
      },
      { label: '뒤에서 돕는다', result: '조용한 공로자가 되었습니다.', effects: { villageFame: 5, happiness: 3 } },
    ],
  },

  // ══ 노년기 (60세~) ═════════════════════════════════════
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
    id: 'grandchild', icon: '🧸', title: '손주', weight: 4, minAge: 55, needsGrandchild: true,
    text: '작은 손이 {me}의 손가락을 꼭 쥐었습니다.',
    choices: [
      { label: '온종일 놀아준다', result: '허리는 아프지만 하루가 짧았습니다.', effects: { happiness: 12, stats: { health: -1 } } },
      { label: '용돈을 쥐여준다', cost: 150, result: '"할머니 할아버지 최고!"', effects: { happiness: 7, childHappiness: 5 } },
      { label: '옛날 이야기를 들려준다', result: '가문의 이야기가 한 세대를 더 건넜습니다.', effects: { happiness: 8, villageFame: 2 } },
    ],
  },
  {
    id: 'retirement_hobby', icon: '🎣', title: '은퇴 후의 하루', weight: 3, minAge: 60,
    text: '일하지 않는 시간이 이렇게 길 줄 몰랐습니다.',
    choices: [
      { label: '텃밭을 가꾼다', cost: 100, result: '흙을 만지면 마음이 가라앉습니다.', effects: { stats: { health: 4 }, happiness: 6, money: 80 } },
      { label: '서예를 배운다', cost: 150, result: '붓끝이 떨리지만 즐겁습니다.', effects: { stats: { creativity: 5 }, happiness: 5 } },
      { label: '마을 아이들을 가르친다', result: '{village}에서 가장 인기 있는 어른이 되었습니다.', effects: { villageFame: 6, happiness: 7, stats: { charm: 3 } } },
    ],
  },
  {
    id: 'old_photos', icon: '📷', title: '오래된 사진첩', weight: 3, minAge: 58,
    text: '먼지 쌓인 사진첩을 펼쳤습니다.',
    choices: [
      { label: '가족과 함께 본다', result: '모두가 자기 어릴 적 사진에 웃었습니다.', effects: { happiness: 8, childHappiness: 6 } },
      { label: '정리해 액자로 만든다', cost: 120, result: '거실 벽이 가족의 연표가 되었습니다.', effects: { happiness: 6, villageFame: 2 } },
    ],
  },
  {
    id: 'last_wish', icon: '🌾', title: '해보고 싶던 것', weight: 3, minAge: 65,
    text: '살면서 꼭 한 번은 해보고 싶던 일이 있습니다.',
    choices: [
      { label: '기차를 타고 끝까지 가본다', cost: 400, result: '창밖으로 평생의 계절이 지나갔습니다.', effects: { happiness: 14, stats: { creativity: 4 } } },
      { label: '가족 모두를 부른다', cost: 600, result: '온 가족이 한자리에 모였습니다.', effects: { happiness: 12, childHappiness: 10, villageFame: 4 } },
      { label: '조용히 지낸다', result: '평온한 하루도 소원 중 하나였습니다.', effects: { happiness: 6, stats: { health: 3 }, lifespan: 1 } },
    ],
  },

  // ══ 배우자 · 자녀 ══════════════════════════════════════
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
      { label: '설거지를 대신 한다', result: '말없이 그릇 부딪히는 소리만 났지만, 풀렸습니다.', effects: { affection: 6, happiness: 1 } },
    ],
  },
  {
    id: 'child_dream', icon: '🌟', title: '아이의 꿈', weight: 4, minAge: 25, needsChild: true,
    text: '{child}이(가) 되고 싶은 것이 생겼다고 합니다.',
    choices: [
      { label: '전폭적으로 지원한다', cost: 400, result: '{child}의 눈이 반짝입니다.',
        effects: { childHappiness: 10, childStats: { creativity: 5, intellect: 3 }, happiness: 4, flag: 'supported' },
        echo: { delay: [8, 18], icon: '🌟', text: '{actor}이(가) 밀어준 그 꿈이 열매를 맺었습니다. 집안에 좋은 소식이 들어왔습니다.',
                effects: { money: 2200, villageFame: 8, familyHappiness: 8 } } },
      { label: '현실적인 조언을 해준다', result: '{child}은(는) 잠시 시무룩했습니다.',
        effects: { childStats: { intellect: 6 }, childHappiness: -4 },
        echo: { delay: [7, 15], icon: '🧭', text: '{actor}의 현실적인 말이 아이를 단단하게 만들었습니다. 안정된 길을 찾았습니다.',
                effects: { money: 1100, childStats: { intellect: 5 } } } },
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
    id: 'family_photo', icon: '📸', title: '가족사진', weight: 3, minAge: 22, needsPartner: true,
    text: '온 가족이 모였습니다. 사진관에 갈까요?',
    choices: [
      { label: '제대로 한 장 남긴다', cost: 150, result: '거실 벽에 오래 걸릴 사진이 생겼습니다.', effects: { happiness: 6, childHappiness: 5, affection: 5 } },
      { label: '마당에서 대충 찍는다', result: '흔들렸지만 다들 웃고 있습니다.', effects: { happiness: 3, childHappiness: 3 } },
    ],
  },
  {
    id: 'child_school', icon: '🎒', title: '입학식', weight: 3, minAge: 25, needsChild: true,
    text: '{child}이(가) 새 가방을 메고 섰습니다.',
    choices: [
      { label: '좋은 학용품을 사준다', cost: 200, result: '가방보다 큰 자신감이 생겼습니다.', effects: { childStats: { intellect: 5 }, childHappiness: 6 } },
      { label: '직접 데려다준다', result: '교문 앞에서 손을 오래 흔들었습니다.', effects: { childHappiness: 8, happiness: 5 } },
    ],
  },
  {
    id: 'partner_dream', icon: '🕊️', title: '배우자의 꿈', weight: 3, minAge: 25, needsPartner: true,
    text: '{partner}이(가) 오래 접어두었던 이야기를 꺼냅니다.',
    choices: [
      { label: '전부 응원한다', cost: 500, result: '{partner}의 표정이 십 년은 젊어졌습니다.', effects: { affection: 15, happiness: 6 } },
      { label: '함께 계획을 세운다', result: '둘이 머리를 맞대니 길이 보입니다.', effects: { affection: 10, stats: { intellect: 3 }, happiness: 4 } },
      { label: '지금은 어렵다고 말한다', result: '{partner}은(는) 알겠다고만 했습니다.', effects: { affection: -10, money: 300 } },
    ],
  },

  // ══ 마을 · 공동체 ══════════════════════════════════════
  {
    id: 'village_festival', icon: '🎪', title: '{village} 축제', weight: 3, minAge: 12,
    text: '마을에 축제가 열렸습니다.',
    choices: [
      { label: '무대에 오른다', check: { stat: 'charm', difficulty: 55 }, success: { text: '마을의 스타가 되었습니다!', effects: { happiness: 8, stats: { charm: 5 }, money: 200, villageFame: 5 } }, fail: { text: '박수는 받았지만 얼굴이 화끈했습니다.', effects: { happiness: 2, stats: { charm: 2 } } } },
      { label: '먹거리 장사를 한다', cost: 100, result: '재료비를 빼고도 남았습니다.', effects: { money: 400, stats: { fitness: -1 } } },
      { label: '가족과 구경만 한다', result: '솜사탕이 달았습니다.', effects: { happiness: 5, childHappiness: 5 } },
    ],
  },
  {
    id: 'neighbor_help', icon: '🤝', title: '이웃의 부탁', weight: 3, minAge: 18,
    text: '{village} 이웃이 도움을 청합니다.',
    choices: [
      { label: '기꺼이 돕는다', result: '마을에 {actor}의 편이 늘었습니다.',
        effects: { happiness: 4, stats: { charm: 3 }, villageFame: 2, flag: 'goodneighbor' },
        echo: { delay: [3, 9], icon: '🤝', text: '그때 도운 이웃이 {actor}에게 크게 보답했습니다.',
                effects: { money: 1200, villageFame: 5, happiness: 6 } } },
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
  {
    id: 'quiet_year', icon: '🍵', title: '조용한 한 해', weight: 4, minAge: 5,
    text: '특별한 일 없이 계절이 지나갔습니다.',
    choices: [
      { label: '평범함에 감사한다', result: '이런 해도 인생의 일부입니다.', effects: { happiness: 3, stats: { health: 1 } } },
      { label: '뭔가 새로 배워본다', cost: 100, result: '작은 취미가 하나 늘었습니다.', effects: { stats: { creativity: 3, intellect: 2 } } },
    ],
  },

  // ══ 병맛 이벤트 🤪 ═════════════════════════════════════
  {
    id: 'absurd_pigeon', icon: '🐦', title: '비둘기와의 눈싸움', tag: 'absurd', weight: 2, minAge: 5,
    text: '{village} 정류장 비둘기가 {me}을(를) 노려봅니다. 물러설 수 없습니다.',
    choices: [
      {
        label: '눈을 부릅뜬다', check: { stat: 'fitness', difficulty: 45 },
        success: { text: '비둘기가 먼저 고개를 돌렸습니다. 승리입니다.', effects: { happiness: 7, stats: { fitness: 3, charm: 2 } } },
        fail: { text: '비둘기 열두 마리가 추가로 몰려왔습니다. 도망쳤습니다.', effects: { happiness: -3, stats: { fitness: 2 } } },
      },
      { label: '과자를 바친다', cost: 20, result: '비둘기 왕국의 명예 시민이 되었습니다.', effects: { happiness: 4, villageFame: 2 } },
    ],
  },
  {
    id: 'absurd_alien', icon: '🛸', title: '밭에 착륙한 UFO', tag: 'absurd', weight: 2, minAge: 10,
    text: '외계인이 내려와 {village}의 김치 담그는 법을 알려달라고 합니다.',
    choices: [
      { label: '정성껏 알려준다', result: '답례로 이상한 금속 덩어리를 받았습니다. 비쌌습니다.', effects: { money: 1500, happiness: 9, stats: { creativity: 5 } } },
      { label: '같이 타고 한 바퀴 돈다', check: { stat: 'health', difficulty: 50 },
        success: { text: '우주에서 본 지구가 예뻤습니다. 무사 귀환.',
          effects: { happiness: 15, stats: { creativity: 8 }, lifespan: 1, flag: 'ufo' },
          echo: { delay: [5, 15], icon: '🛸', text: '그날의 손님이 {actor}를 다시 찾아왔습니다. 이번엔 선물을 잔뜩 들고서.',
                  effects: { money: 3000, stats: { creativity: 6 }, villageFame: 10 } } },
        fail: { text: '멀미로 사흘을 앓았습니다.', effects: { stats: { health: -5 }, happiness: 3 } } },
      { label: '못 본 척한다', result: '다음 날 밭에 완벽한 원이 생겼습니다. 관광객이 왔습니다.', effects: { money: 600, villageFame: 8 } },
    ],
  },
  {
    id: 'absurd_ancestor', icon: '👻', title: '조상님의 현몽', tag: 'absurd', weight: 2, minAge: 18,
    text: '꿈에 조상님이 나타나 "장독대 밑을 파보거라" 하고는 사라졌습니다.',
    choices: [
      {
        label: '삽을 든다', cost: 50, check: { stat: 'creativity', difficulty: 55 },
        success: { text: '정말로 항아리가 나왔습니다. 안에는 엽전이 가득!', effects: { money: 2000, happiness: 12, villageFame: 5 } },
        fail: { text: '수도관을 터뜨렸습니다. 수리비가 나갔습니다.', effects: { money: -300, happiness: -5, stats: { fitness: 2 } } },
      },
      { label: '무시하고 잔다', result: '다음 날 조상님이 다시 나와 잔소리를 했습니다.', effects: { happiness: -3, stats: { intellect: 2 } } },
    ],
  },
  {
    id: 'absurd_bread', icon: '🍞', title: '식빵 대란', tag: 'absurd', weight: 2, minAge: 12,
    text: '{village} 빵집에서 한정판 식빵을 내놨습니다. 줄이 마을을 두 바퀴 감았습니다.',
    choices: [
      { label: '새벽부터 줄을 선다', cost: 30, check: { stat: 'fitness', difficulty: 50 }, success: { text: '마지막 한 봉지를 사수했습니다. 인생 최고의 맛.', effects: { happiness: 10, stats: { fitness: 3 }, childHappiness: 6 } }, fail: { text: '눈앞에서 품절. 대신 단팥빵을 샀습니다.', effects: { happiness: -2, stats: { fitness: 2 } } } },
      { label: '직접 만들어본다', cost: 60, result: '벽돌이 나왔습니다. 가족이 예의상 먹었습니다.', effects: { stats: { creativity: 4 }, happiness: 2, childHappiness: -2 } },
      { label: '줄 선 사람들에게 커피를 판다', cost: 40, result: '빵보다 커피가 남는 장사였습니다.', effects: { money: 350, villageFame: 3 } },
    ],
  },
  {
    id: 'absurd_dance', icon: '🕺', title: '전국 이상한 춤 대회', tag: 'absurd', weight: 2, minAge: 14,
    text: 'TV에서 이상한 춤 대회 참가자를 모집합니다. 상금이 꽤 큽니다.',
    choices: [
      {
        label: '가문의 춤을 선보인다', check: { stat: 'charm', difficulty: 58 },
        success: { text: '심사위원이 기립했습니다. 우승!', effects: { money: 2200, happiness: 14, villageFame: 10, stats: { charm: 6 } } },
        fail: { text: '예선 탈락. 그런데 영상이 퍼져 유명해졌습니다.', effects: { villageFame: 6, happiness: 3, stats: { charm: 3 } } },
      },
      { label: '가족을 총출동시킨다', cost: 100, result: '단체상을 받았습니다. 가족 모두 어깨가 아픕니다.', effects: { money: 700, happiness: 8, childHappiness: 8, stats: { fitness: -1 } } },
      { label: '채널을 돌린다', result: '나중에 우승자가 이웃이었다는 걸 알았습니다.', effects: { happiness: -2, money: 50 } },
    ],
  },
  {
    id: 'absurd_chicken', icon: '🐔', title: '닭이 사장이 되었다', tag: 'absurd', weight: 2, minAge: 19, needsJob: true,
    text: '회사가 이상한 실험을 합니다. 이번 달 팀장은 닭입니다.',
    choices: [
      { label: '성실히 따른다', result: '닭의 지시는 무작위였지만 성과는 좋았습니다.', effects: { promote: 1, money: 300, happiness: -2 } },
      { label: '닭과 친해진다', result: '모이를 나눠주자 닭이 {me}만 따릅니다. 사내 정치 승리.', effects: { promote: 1, stats: { charm: 5 }, happiness: 6 } },
      { label: '사직서를 쓴다', result: '쓰다가 말았습니다. 월세가 있으니까요.', effects: { happiness: -4, stats: { intellect: 3 } } },
    ],
  },
  {
    id: 'absurd_time', icon: '⏰', title: '어제가 두 번 왔다', tag: 'absurd', weight: 2, minAge: 15,
    text: '{me}은(는) 오늘이 어제와 똑같다는 걸 알아챘습니다. 달력도 그대로입니다.',
    choices: [
      { label: '하루를 다시 산다', result: '어제 못한 말을 오늘 했습니다. 마음이 개운합니다.', effects: { happiness: 9, affection: 8, stats: { charm: 3 } } },
      { label: '복권 번호를 외워둔다', result: '다음 날 번호가 바뀌어 있었습니다. 우주의 규칙은 엄격합니다.', effects: { happiness: -3, stats: { intellect: 5 } } },
      { label: '아무에게도 말하지 않는다', result: '가끔 그런 날이 또 옵니다. 이제 익숙합니다.', effects: { stats: { creativity: 6 }, happiness: 3 } },
    ],
  },
  {
    id: 'absurd_soup', icon: '🍲', title: '국물 맛의 비밀', tag: 'absurd', weight: 2, minAge: 20,
    text: '{me}이(가) 끓인 국이 이상하게 맛있습니다. 마을 사람들이 비법을 캐묻습니다.',
    choices: [
      { label: '비법을 판다', result: '비법은 "그냥 대충"이었지만 아무도 안 믿었습니다.', effects: { money: 900, villageFame: 6, happiness: 5 } },
      { label: '식당을 연다', cost: 800, check: { stat: 'creativity', difficulty: 50 },
        success: { text: '줄 서는 집이 되었습니다!',
          effects: { money: 2600, villageFame: 10, happiness: 10, flag: 'business' },
          echo: { delay: [5, 13], icon: '🍜', text: '{actor}의 국물이 {village}의 이름이 되었습니다. 방송에도 나왔습니다.',
                  effects: { money: 3600, villageFame: 12, familyHappiness: 6 } } },
        fail: { text: '이상하게 밖에서는 그 맛이 안 났습니다.', effects: { money: 200, happiness: -5 } } },
      { label: '가족에게만 끓여준다', result: '가족의 표정이 곧 별점 다섯 개였습니다.', effects: { happiness: 7, childHappiness: 8, affection: 6 } },
    ],
  },
  {
    id: 'absurd_mud', icon: '🥔', title: '감자가 너무 많이 났다', tag: 'absurd', weight: 2, minAge: 15,
    text: '텃밭에서 감자가 이백 킬로 났습니다. 아무도 이유를 모릅니다.',
    choices: [
      { label: '마을에 다 나눠준다', result: '한 달간 모든 집에서 감자 냄새가 났습니다. 인심을 얻었습니다.', effects: { villageFame: 9, happiness: 6 } },
      { label: '감자 축제를 연다', cost: 200, result: '"제1회 감자의 날"이 마을 연례행사가 되었습니다.',
        effects: { money: 800, villageFame: 12, happiness: 8, flag: 'potato' },
        echo: { delay: [6, 14], icon: '🥔', text: '감자의 날이 {village}의 대표 축제가 되었습니다. 관광객이 몰려옵니다.',
                effects: { money: 2600, villageFame: 15, familyHappiness: 6 } } },
      { label: '전부 판다', result: '감자값이 폭락한 날이었습니다. 그래도 팔았습니다.', effects: { money: 500, happiness: -1 } },
    ],
  },
  {
    id: 'absurd_robot', icon: '🤖', title: '택배 로봇의 고백', tag: 'absurd', weight: 2, minAge: 18,
    text: '택배 로봇이 문 앞에서 말합니다. "이 집만 오면 배터리가 두근거립니다."',
    choices: [
      { label: '충전해준다', cost: 30, result: '로봇이 그날부터 우리 집 택배만 먼저 배달합니다.', effects: { happiness: 6, money: 100, stats: { charm: 3 } } },
      { label: '수리 센터에 알린다', result: '고장이 아니라 신기능이었답니다. 감사장을 받았습니다.', effects: { villageFame: 4, stats: { intellect: 4 } } },
      { label: '가족으로 받아들인다', result: '로봇이 설거지를 시작했습니다. 생활비가 줄었습니다.', effects: { happiness: 8, childHappiness: 6, money: 200 } },
    ],
  },
  {
    id: 'absurd_ghost_exam', icon: '📝', title: '꿈에서 본 시험 문제', tag: 'absurd', weight: 2, minAge: 13, maxAge: 26,
    text: '꿈에서 본 시험 문제가 실제로 나왔습니다. 정답까지 기억납니다.',
    choices: [
      { label: '그대로 쓴다', result: '만점을 받았지만 아무에게도 설명할 수 없었습니다.', effects: { stats: { intellect: 8 }, education: 2, happiness: 5 } },
      { label: '내 실력으로 푼다', result: '점수는 낮았지만 마음이 편했습니다.', effects: { stats: { intellect: 4 }, happiness: 6, addTrait: 'diligent' } },
    ],
  },
  {
    id: 'absurd_neighbor_king', icon: '👑', title: '옆집이 왕족이었다', tag: 'absurd', weight: 2, minAge: 20,
    text: '늘 인사하던 옆집 할아버지가 사실 먼 나라 왕족이었다고 합니다.',
    choices: [
      { label: '축하 잔치를 열어준다', cost: 300, result: '답례로 훈장과 봉투를 받았습니다.', effects: { money: 1400, villageFame: 8, happiness: 8 } },
      { label: '평소처럼 대한다', result: '"자네가 제일 편하다"며 자주 놀러 오십니다.', effects: { happiness: 9, stats: { charm: 5 }, lifespan: 1 } },
    ],
  },
  {
    id: 'absurd_dog_mayor', icon: '🐕‍🦺', title: '개가 마을 대표로 뽑혔다', tag: 'absurd', weight: 2, minAge: 16,
    text: '장난으로 낸 후보가 당선됐습니다. {village}의 새 대표는 진돗개입니다.',
    choices: [
      { label: '비서를 자원한다', result: '실무는 {me}가 다 했지만 마을이 잘 굴러갔습니다.', effects: { villageFame: 10, stats: { intellect: 4 }, happiness: 5 } },
      { label: '반대 시위를 한다', result: '개가 꼬리를 흔들자 시위대가 해산했습니다.', effects: { happiness: -2, stats: { charm: 3 } } },
      { label: '기념품을 만들어 판다', cost: 100, result: '대표견 굿즈가 불티나게 팔렸습니다.', effects: { money: 900, villageFame: 5 } },
    ],
  },
  {
    id: 'absurd_rain_fish', icon: '🐟', title: '하늘에서 생선이', tag: 'absurd', weight: 2, minAge: 8,
    text: '소나기와 함께 고등어가 쏟아졌습니다. 기상청도 설명을 못 합니다.',
    choices: [
      { label: '주워서 굽는다', result: '온 마을이 고등어 파티를 했습니다.', effects: { happiness: 8, childHappiness: 6, money: 150, stats: { health: 2 } } },
      { label: '연구소에 신고한다', result: '연구비 명목으로 사례금을 받았습니다.', effects: { money: 700, stats: { intellect: 5 }, villageFame: 4 } },
      { label: '우산을 쓰고 지나간다', result: '모두가 뛰어다니는 걸 구경했습니다. 이것도 나쁘지 않습니다.', effects: { happiness: 4, stats: { creativity: 3 } } },
    ],
  },
  {
    id: 'absurd_family_curse', icon: '🧿', title: '가문의 저주(?)', tag: 'absurd', weight: 2, minAge: 25, needsChild: true,
    text: '점집에서 "이 가문은 삼대째 양말을 한 짝씩 잃는다"는 저주를 알려줬습니다.',
    choices: [
      { label: '굿을 한다', cost: 400, result: '그날 이후 양말이 짝을 맞춥니다. 원인은 세탁기였습니다.', effects: { happiness: 7, villageFame: 3, stats: { health: 2 } } },
      { label: '한 짝 양말을 유행시킨다', result: '{village} 젊은이들이 따라 하기 시작했습니다.', effects: { villageFame: 8, stats: { charm: 5 }, money: 300 } },
      { label: '아이에게 물려준다', result: '"이건 우리 집 전통이야"라고 진지하게 말했습니다.', effects: { childHappiness: 6, childStats: { creativity: 5 }, happiness: 4 } },
    ],
  },

  // ══ 가족 구성원 이야기 ══════════════════════════════════
  {
    id: 'sibling_fight', icon: '🥊', title: '형제자매 싸움', weight: 3, minAge: 6, maxAge: 19, needsSibling: true,
    text: '{actor}({relation})이(가) 형제와 크게 다투고 방문을 잠갔습니다.',
    choices: [
      { label: '둘을 마주 앉힌다', result: '서로 미안하다는 말이 나오는 데 한 시간이 걸렸습니다.', effects: { happiness: 5, familyHappiness: 3, stats: { charm: 4 } } },
      { label: '각자 두게 한다', result: '며칠 뒤 아무 일 없다는 듯 같이 놀고 있었습니다.', effects: { happiness: 2, stats: { fitness: 2 } } },
      { label: '{actor} 편을 들어준다', result: '{actor}은(는) 든든해했지만 다른 아이가 서운해했습니다.',
        effects: { happiness: 7, familyHappiness: -3 },
        echo: { delay: [8, 16], icon: '⚖️', tone: 'bad', text: '그때의 편애를 형제들이 기억합니다. 가족 모임이 어색해졌습니다.', effects: { familyHappiness: -8 } } },
    ],
  },
  {
    id: 'elder_wisdom', icon: '🍵', title: '어른의 한마디', weight: 3, minAge: 62, actor: 'any',
    text: '{actor}({relation})이(가) 젊은 식구들을 불러 앉혔습니다.',
    choices: [
      { label: '살아온 이야기를 들려준다', result: '아이들이 처음으로 조용히 들었습니다.',
        effects: { familyHappiness: 6, childStats: { intellect: 4, charm: 4 } },
        echo: { delay: [10, 20], icon: '📜', text: '{actor}의 이야기가 집안의 규칙이 되었습니다. 후손들이 그대로 삽니다.', effects: { familyHappiness: 8, villageFame: 5 } } },
      { label: '통장을 꺼낸다', cost: 0, result: '"이건 너희 몫이다." 아무도 몰랐던 돈이었습니다.', effects: { money: 1400, familyHappiness: 5 } },
      { label: '잔소리로 끝난다', result: '다들 슬금슬금 자리를 떴습니다.', effects: { happiness: -2, familyHappiness: -2 } },
    ],
  },
  {
    id: 'grandkid_school', icon: '🎒', title: '손주의 첫 등교', weight: 3, minAge: 50, needsGrandchild: true,
    text: '{actor}({relation})이(가) 손주의 첫 등굣길을 배웅합니다.',
    choices: [
      { label: '교문까지 따라간다', result: '손주가 뒤돌아 손을 흔들었습니다.', effects: { happiness: 10, familyHappiness: 4 } },
      { label: '용돈을 쥐여준다', cost: 100, result: '학교에서 제일 부자가 되었습니다.', effects: { happiness: 6, familyHappiness: 5 } },
    ],
  },
  {
    id: 'holiday', icon: '🥮', title: '명절', weight: 4, minAge: 18,
    text: '온 가족이 모이는 날입니다. {actor}({relation})이(가) 준비를 맡았습니다.',
    choices: [
      { label: '푸짐하게 차린다', cost: 300, result: '상다리가 부러질 뻔했습니다.', effects: { familyHappiness: 8, happiness: 4, stats: { charm: 2 } } },
      { label: '간소하게 모인다', result: '설거지가 금방 끝나 다들 좋아했습니다.', effects: { familyHappiness: 4, money: 150 } },
      { label: '올해는 건너뛴다', result: '각자의 사정이 있었습니다.',
        effects: { money: 300, familyHappiness: -5 },
        echo: { delay: [4, 10], icon: '🍂', tone: 'bad', text: '모이지 않는 해가 늘었습니다. 가족들이 서로 소식을 모릅니다.', effects: { familyHappiness: -6 } } },
    ],
  },
  {
    id: 'family_debt', icon: '📉', title: '가족 회의', weight: 3, minAge: 25, needsPartner: true,
    text: '살림이 빠듯합니다. {actor}({relation})이(가) 가족을 불러 모았습니다.',
    choices: [
      { label: '모두 허리띠를 졸라맨다', result: '아이들까지 용돈을 줄이겠다고 했습니다.',
        effects: { money: 900, familyHappiness: -4 },
        echo: { delay: [5, 12], icon: '🪙', text: '그때 함께 아낀 습관이 남았습니다. 이 집은 웬만해선 흔들리지 않습니다.', effects: { money: 1500, addTrait: 'frugal' } } },
      { label: '{actor}이(가) 일을 더 한다', result: '밤늦게 돌아오는 날이 늘었습니다.', effects: { money: 700, stats: { health: -4 }, happiness: -3 } },
      { label: '집안의 물건을 판다', result: '아끼던 것들이 하나둘 사라졌습니다.', effects: { money: 1200, happiness: -5, familyHappiness: -2 } },
    ],
  },
  {
    id: 'moving_day', icon: '🚚', title: '이사', weight: 2, minAge: 24, needsPartner: true,
    text: '{actor}({relation})의 가족이 새집을 알아봅니다.',
    choices: [
      { label: '{village} 좋은 자리로 옮긴다', cost: 1200, result: '창밖으로 마을이 다 보입니다.',
        effects: { familyHappiness: 8, happiness: 5, villageFame: 3 },
        echo: { delay: [6, 14], icon: '🏡', text: '그때 산 집값이 크게 올랐습니다.', effects: { money: 2800 } } },
      { label: '지금 집을 고친다', cost: 400, result: '삐걱대던 곳이 사라졌습니다.', effects: { familyHappiness: 5, happiness: 3 } },
      { label: '그냥 산다', result: '익숙한 게 최고입니다.', effects: { money: 200, happiness: 1 } },
    ],
  },
  {
    id: 'pet_farewell', icon: '🐾', title: '오래된 친구', weight: 2, minAge: 10,
    text: '{actor}({relation})이(가) 오래 키운 동물이 많이 늙었습니다.',
    choices: [
      { label: '마지막까지 곁을 지킨다', result: '{actor}은(는) 그날을 오래 기억할 것입니다.', effects: { happiness: -6, familyHappiness: 4, stats: { charm: 4 } } },
      { label: '치료에 힘쓴다', cost: 500, result: '한 해를 더 함께 지냈습니다.', effects: { happiness: 4, familyHappiness: 3 } },
    ],
  },
  {
    id: 'family_trip', icon: '🚌', title: '가족 여행', weight: 3, minAge: 22, needsChild: true,
    text: '{actor}({relation})이(가) 온 가족 여행을 제안했습니다.',
    choices: [
      { label: '멀리 떠난다', cost: 900, result: '사진이 이백 장 넘게 남았습니다.',
        effects: { familyHappiness: 12, happiness: 8, affection: 8 },
        echo: { delay: [8, 18], icon: '📷', text: '그때 여행 사진이 집안의 보물이 되었습니다. 아이들이 그 이야기를 하며 자랐습니다.', effects: { familyHappiness: 8, childStats: { charm: 5 } } } },
      { label: '가까운 데로 다녀온다', cost: 200, result: '차로 한 시간, 그래도 좋았습니다.', effects: { familyHappiness: 6, happiness: 4 } },
      { label: '다음으로 미룬다', result: '"다음에 꼭 가자"는 말만 남았습니다.', effects: { money: 200, familyHappiness: -3 } },
    ],
  },
  {
    id: 'sibling_business', icon: '🧾', title: '가족의 동업 제안', weight: 2, minAge: 24, maxAge: 60,
    text: '{actor}({relation})이(가) 집안 돈으로 사업을 해보자고 합니다.',
    choices: [
      {
        label: '함께 시작한다', cost: 1000, check: { stat: 'intellect', difficulty: 58 },
        success: { text: '가족이 함께 만든 첫 성과입니다.',
          effects: { money: 2800, familyHappiness: 8, flag: 'business' },
          echo: { delay: [6, 14], icon: '🏢', text: '가족 사업이 자리를 잡았습니다. 이제 식구들이 돌아가며 일합니다.', effects: { money: 4000, villageFame: 8 } } },
        fail: { text: '돈도 사이도 상했습니다.', effects: { money: 200, familyHappiness: -8, happiness: -6 } },
      },
      { label: '조금만 빌려준다', cost: 400, result: '반은 돌려받았습니다.', effects: { money: 300, familyHappiness: 2 } },
      { label: '거절한다', result: '{actor}은(는) 서운해했습니다.', effects: { familyHappiness: -3, money: 100 } },
    ],
  },
  {
    id: 'reunion', icon: '🏫', title: '동창회', weight: 2, minAge: 30, maxAge: 70,
    text: '{actor}({relation})에게 동창회 연락이 왔습니다.',
    choices: [
      { label: '차려입고 나간다', cost: 150, result: '다들 여전했습니다. 명함도 몇 장 받았습니다.',
        effects: { happiness: 6, stats: { charm: 4 } },
        echo: { delay: [3, 8], icon: '📇', text: '그날 받은 명함 한 장이 {actor}에게 좋은 기회를 물어왔습니다.', effects: { money: 1400, promote: 1 } } },
      { label: '가지 않는다', result: '집에서 오래된 사진첩을 봤습니다.', effects: { happiness: 2, familyHappiness: 2 } },
    ],
  },

  // ══ 나비효과 후속 (예전 선택이 열어주는 이벤트) ═══════════
  {
    id: 'music_recital', icon: '🎻', title: '가문의 연주회', weight: 3, minAge: 12, requiresFlag: 'music',
    text: '악기를 배운 사람이 집안에 여럿입니다. {actor}({relation})이(가) 함께 무대에 서자고 합니다.',
    choices: [
      { label: '가족 연주회를 연다', cost: 200, result: '{village} 사람들이 다 왔습니다. 박수가 길었습니다.', effects: { money: 700, villageFame: 10, familyHappiness: 10, stats: { creativity: 6 } } },
      { label: '집에서만 연주한다', result: '거실이 작은 공연장이 되었습니다.', effects: { familyHappiness: 7, stats: { creativity: 4 } } },
    ],
  },
  {
    id: 'business_expand', icon: '🏬', title: '2호점', weight: 3, minAge: 25, requiresFlag: 'business',
    text: '집안 사업이 잘됩니다. {actor}({relation})이(가) 하나 더 내자고 합니다.',
    choices: [
      {
        label: '크게 확장한다', cost: 1800, check: { stat: 'charm', difficulty: 60 },
        success: { text: '두 번째 가게도 자리를 잡았습니다.', effects: { money: 4200, villageFame: 8, happiness: 8 } },
        fail: { text: '무리한 확장이었습니다.', effects: { money: 300, happiness: -8, familyHappiness: -4 } },
      },
      { label: '지금 규모를 지킨다', result: '단골이 더 늘었습니다.', effects: { money: 1200, happiness: 4 } },
    ],
  },
  {
    id: 'ufo_return', icon: '👽', title: '다시 온 손님', tag: 'absurd', weight: 2, minAge: 12, requiresFlag: 'ufo',
    text: '밤하늘에 그때 그 불빛이 다시 떴습니다. {actor}({relation})의 이름을 부릅니다.',
    choices: [
      { label: '가족을 다 데리고 나간다', result: '온 가족이 우주에서 기념사진을 찍었습니다. 아무도 안 믿습니다.', effects: { familyHappiness: 15, villageFame: 12, stats: { creativity: 8 } } },
      { label: '이번엔 사양한다', result: '대신 밭에 이상한 작물이 자랐습니다. 비싸게 팔렸습니다.', effects: { money: 2200, happiness: 5 } },
    ],
  },
  {
    id: 'potato_decade', icon: '🎊', title: '감자의 날 10주년', tag: 'absurd', weight: 2, minAge: 15, requiresFlag: 'potato',
    text: '{village} 감자 축제가 열 돌을 맞았습니다. {actor}({relation})이(가) 명예 위원장입니다.',
    choices: [
      { label: '역대급으로 연다', cost: 600, result: '전국에서 감자를 들고 사람들이 왔습니다.', effects: { money: 3200, villageFame: 18, familyHappiness: 10 } },
      { label: '조용히 기념한다', result: '마을 사람들끼리 감자를 나눠 먹었습니다.', effects: { villageFame: 6, familyHappiness: 6 } },
    ],
  },
  {
    id: 'neighbor_return', icon: '💐', title: '돌아온 인심', weight: 3, minAge: 20, requiresFlag: 'goodneighbor',
    text: '{actor}({relation})이(가) 도왔던 사람들이 이번엔 먼저 찾아왔습니다.',
    choices: [
      { label: '고맙게 받는다', result: '마당에 채소와 선물이 쌓였습니다.', effects: { money: 900, familyHappiness: 6, happiness: 6 } },
      { label: '마을에 다시 나눈다', result: '{village}에서 이 집을 모르는 사람이 없습니다.', effects: { villageFame: 12, familyHappiness: 5 } },
    ],
  },
];

export const EVENT_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
