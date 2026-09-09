// 컷신 단계마다 어떤 소리를 낼지.
//
// 이 표를 ui/app.js 안에 두면, 타임라인에 단계를 새로 넣었을 때 소리를 조용히 빠뜨린다.
// 데이터로 빼두면 테스트가 "표에 빠진 단계"를 잡아낸다 (tests/cutsound.test.js).
//
// sfx  효과음 이름 (core/audio.js 의 SFX 키)
// bgm  이 단계부터 갈아탈 곡 이름 (core/audio.js 의 TRACKS 키)
//
// 시각은 여기 없다. 언제 울릴지는 타임라인이 정하고, 게임이 'cutbeat' 로 알려준다.

export const CUT_SOUND = {
  /**
   * 오프닝 — 방구석에서 만든 노래가 차트 밑바닥에 걸린다.
   * 앞부분을 일부러 조용하게 둬야 차트가 내려올 때 한 방이 산다.
   */
  intro: {
    room: {},
    note: { sfx: 'coin' },
    upload: { sfx: 'gather' },
    chart: { sfx: 'blip' },
    bottom: { sfx: 'thud' },
    look: { sfx: 'rumble' },
    block: { sfx: 'title' },
    snatch: { sfx: 'trap' },
    reach: { sfx: 'hurt' },
    grab: { sfx: 'power' },
    // 여기서 스테이지 브금으로 갈아탄다 — 스테이지 1이 시작될 때 이미 흐르고 있다
    run: { sfx: 'climb', bgm: 'stage' },
    end: {},
  },

  /**
   * 2회차 시작 — 다 이룬 자리가 갈라지고, 밟아 없앴던 것들이 진화해서 돌아온다.
   * 앞은 조용하다가 graves 에서부터 불길해진다. stand 에서 판 브금으로 갈아탄다 —
   * 마이크를 다시 쥐는 순간 이미 달리기가 시작된 것이다.
   */
  hardopen: {
    after: {},
    crack: { sfx: 'crack' },
    graves: { sfx: 'blip' },
    evolve: { sfx: 'roar' },
    taken: { sfx: 'trap' },
    drop: { sfx: 'thud' },
    stand: { sfx: 'power', bgm: 'stage' },
    end: {},
  },

  /**
   * 2회차 엔딩 — 차트가 무대가 된다. 결혼식 곡이 아니라 **승리 곡**이다.
   * 1회차는 사적인 결말(결혼식)이었고 여기는 가수로서의 결말이라 곡도 달라야 한다.
   */
  hardEnd: {
    free: { sfx: 'burst' },
    calm: { sfx: 'scatter' },
    stage: { sfx: 'chartline', bgm: 'victory' },
    crowd: { sfx: 'chime' },
    duet: { sfx: 'power' },
    encore: { sfx: 'climb' },
    star: { sfx: 'crown' },
    end: {},
  },

  /** 합체 컷신 — 앨범 열일곱 장이 하나로 뭉친다 */
  merge: {
    gather: { sfx: 'gather' },
    swirl: { sfx: 'swirl' },
    merge: { sfx: 'thud' },
    flash: { sfx: 'flash' },
    reveal: { sfx: 'roar', bgm: 'boss' },
    end: {},
  },

  /** 2페이즈 — 보스가 네 조각으로 갈라진다 */
  phase2: {
    shake: { sfx: 'rumble' },
    crack: { sfx: 'crack' },
    split: { sfx: 'split' },
    title: { sfx: 'title' },
    end: {},
  },

  /** 3페이즈 — 차트를 조작해 1위를 빼앗고, 그 힘으로 합체한다 */
  phase3: {
    shake: { sfx: 'rumble' },
    chart: { sfx: 'blip' },
    rig: { sfx: 'rig' },
    call: { sfx: 'gather' }, // 조각들이 불려온다
    assemble: { sfx: 'thud' }, // 부위가 하나씩 꽂힌다
    lock: { sfx: 'thud' }, // 마지막 철컥 — 머리가 얹힌다
    core: { sfx: 'roar' }, // 코어 점화
    title: { sfx: 'title' },
    end: {},
  },

  /**
   * 엔딩 — 1부는 차트를 타고 올라가는 승리, 2부는 결혼식.
   * aisle 에서 웨딩 마치로 갈아탄다.
   */
  phase4: {
    shake: { sfx: 'rumble' },
    overheat: { sfx: 'gather' },
    rise: { sfx: 'thud' },
    core: { sfx: 'flash' },
    title: { sfx: 'title' },
    end: {},
  },
  /** 하드 3페이즈 — 껍질을 찢고 공룡로봇으로 변신한다 */
  hard3: {
    shake: { sfx: 'rumble' },
    graves: { sfx: 'blip' },
    swarm: { sfx: 'scatter' },
    shell: { sfx: 'crack' },
    hatch: { sfx: 'split' },
    roar: { sfx: 'roar', bgm: 'boss' },
    title: { sfx: 'title' },
    end: {},
  },
  /** 보스가 쓰러질 때 — 박혀 있던 앨범이 하나씩 떨어져 나간다 */
  bossdown: {
    stagger: { sfx: 'thud' },
    shed: { sfx: 'scatter' },
    kneel: { sfx: 'crack' },
    burst: { sfx: 'burst' },
    end: {},
  },
  /**
   * 추격 판에서 잡혔을 때. 시작할 때 음악을 끄므로 **끝에서 반드시 다시 켠다** —
   * 'stage' 는 판을 새로 불러올 때만 나오는 소식이라, 여기서 안 켜면
   * 한 번 잡힌 뒤로 그 판이 끝까지 조용해진다.
   */
  caught: {
    shadow: { sfx: 'rumble' },
    grab: { sfx: 'thud' },
    black: { sfx: 'death' },
    end: { bgm: 'stage' },
  },
  ending: {
    crack: { sfx: 'crack' },
    burst: { sfx: 'burst' },
    scatter: { sfx: 'scatter' },
    chartline: { sfx: 'chartline' },
    empty: {}, // 1위 자리가 비는 순간 — 여기는 조용해야 다음이 산다
    climb: { sfx: 'climb', bgm: 'victory' },
    crown: { sfx: 'crown' },
    aisle: { sfx: 'bell', bgm: 'wedding' },
    bride: { sfx: 'chime' },
    vow: { sfx: 'chime' },
    ring: { sfx: 'ring' },
    kiss: { sfx: 'kiss' },
    end: {},
  },
};

/** 이 단계에서 낼 소리 (없으면 undefined) */
export const soundFor = (cut, kind) => CUT_SOUND[cut]?.[kind];
