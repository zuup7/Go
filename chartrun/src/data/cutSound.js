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
    assemble: { sfx: 'thud' }, // 딱딱 붙는다
    core: { sfx: 'roar' }, // 코어 점화
    title: { sfx: 'title' },
    end: {},
  },

  /**
   * 엔딩 — 1부는 차트를 타고 올라가는 승리, 2부는 결혼식.
   * aisle 에서 웨딩 마치로 갈아탄다.
   */
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
