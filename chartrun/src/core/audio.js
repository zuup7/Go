// 오디오 파일 없이 WebAudio 로 직접 만드는 칩튠.
// 브라우저 정책상 첫 사용자 입력 뒤에야 소리가 난다 — resume() 을 그때 부른다.

const midi = (n) => 440 * 2 ** ((n - 69) / 12);
const _ = null; // 쉼표

/** 8분음표 32칸짜리 루프들 */
const TRACKS = {
  stage: {
    bpm: 148,
    lead: [
      69, _, 72, 74, 76, _, 74, 72, 69, _, 67, 69, 71, _, _, _,
      69, _, 72, 74, 76, _, 79, 76, 74, _, 72, 71, 69, _, _, _,
    ],
    bass: [
      45, _, 45, _, 52, _, 52, _, 41, _, 41, _, 48, _, 48, _,
      45, _, 45, _, 52, _, 52, _, 43, _, 43, _, 40, _, 40, _,
    ],
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0],
  },
  boss: {
    bpm: 172,
    lead: [
      69, 69, 72, 69, 75, _, 74, _, 69, 69, 72, 69, 77, _, 76, _,
      69, 69, 72, 69, 79, _, 78, 77, 76, _, 74, _, 72, _, 71, _,
    ],
    bass: [
      33, 33, _, 33, 36, _, 33, _, 33, 33, _, 33, 38, _, 37, _,
      33, 33, _, 33, 36, _, 33, _, 40, _, 39, _, 38, _, 37, _,
    ],
    kick: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1],
  },
  /** 엔딩 1부 — 차트를 타고 1위까지 올라간다 */
  victory: {
    bpm: 130,
    lead: [
      72, _, 76, _, 79, _, 84, _, 83, _, 79, _, 81, _, _, _,
      74, _, 77, _, 81, _, 86, _, 84, _, 81, _, 79, _, _, _,
    ],
    bass: [
      48, _, 55, _, 48, _, 55, _, 53, _, 60, _, 53, _, _, _,
      50, _, 57, _, 50, _, 57, _, 55, _, 62, _, 55, _, _, _,
    ],
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0],
  },
  /**
   * 엔딩 2부 — 결혼식. 느리고 따뜻하게.
   * 드럼도 하이햇도 없다. 칩튠 특유의 치찰음이 들어가면 식장이 아니라 던전이 된다.
   */
  wedding: {
    bpm: 76,
    hat: false,
    leadType: 'triangle',
    lead: [
      79, _, _, _, 84, _, _, _, 84, _, 83, _, 81, _, _, _,
      79, _, _, _, 81, _, _, _, 83, _, 81, _, 79, _, _, _,
    ],
    bass: [
      48, _, 55, _, 52, _, 55, _, 53, _, 60, _, 57, _, _, _,
      47, _, 55, _, 52, _, 55, _, 43, _, 55, _, 48, _, _, _,
    ],
  },
};

export function createAudio(muted = false) {
  let ctx = null;
  let master = null;
  let bgmGain = null;
  let sfxGain = null;
  let current = null;
  let timer = 0;
  let blocked = false;
  let state = { muted };

  function ensure() {
    if (ctx || blocked) return ctx;
    const Ctor = typeof AudioContext !== 'undefined' ? AudioContext : window.webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      // 제한된 iframe 등에서 막힐 수 있다. 소리만 포기하고 게임은 계속 돌아간다.
      blocked = true;
      return null;
    }
    master = ctx.createGain();
    master.gain.value = state.muted ? 0 : 0.5;
    master.connect(ctx.destination);
    bgmGain = ctx.createGain();
    bgmGain.gain.value = 0.16;
    bgmGain.connect(master);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.3;
    sfxGain.connect(master);
    return ctx;
  }

  function tone(freq, at, dur, { type = 'square', gain = 0.3, out = sfxGain, slide = 0 } = {}) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), at + dur);
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(gain, at + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(env).connect(out ?? sfxGain);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  function noise(at, dur, { gain = 0.25, out = sfxGain, highpass = 0 } = {}) {
    if (!ctx) return;
    const frames = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const env = ctx.createGain();
    env.gain.value = gain;
    let node = src.connect(env);
    if (highpass) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = highpass;
      node = env.connect(filter);
      filter.connect(out ?? sfxGain);
    } else {
      env.connect(out ?? sfxGain);
    }
    src.start(at);
  }

  /** 한 루프(32칸)를 통째로 예약하고, 끝나기 전에 다음 루프를 예약한다 */
  function scheduleLoop(name) {
    if (!ctx || state.muted) return;
    const track = TRACKS[name];
    const step = 60 / track.bpm / 2;
    const start = ctx.currentTime + 0.06;
    for (let i = 0; i < 32; i++) {
      const at = start + i * step;
      if (track.lead[i] != null) {
        // 느린 곡(hat 없음)은 음을 길게 끌어야 뚝뚝 끊기지 않고 선율로 들린다
        const hold = track.hat === false ? 1.7 : 0.9;
        tone(midi(track.lead[i]), at, step * hold, {
          type: track.leadType ?? 'square',
          gain: 0.22,
          out: bgmGain,
        });
      }
      if (track.bass[i] != null) {
        tone(midi(track.bass[i]), at, step * 1.1, { type: 'triangle', gain: 0.3, out: bgmGain });
      }
      if (track.kick?.[i]) noise(at, 0.05, { gain: 0.18, out: bgmGain });
      // 하이햇. 결혼식 곡에서는 이 치찰음이 분위기를 다 깬다 — hat:false 면 뺀다.
      if (track.hat !== false && i % 2 === 1) {
        noise(at, 0.02, { gain: 0.05, out: bgmGain, highpass: 6000 });
      }
    }
    const loopMs = step * 32 * 1000;
    timer = setTimeout(() => {
      if (current === name) scheduleLoop(name);
    }, loopMs - 60);
  }

  const SFX = {
    jump: () => tone(520, ctx.currentTime, 0.16, { gain: 0.22, slide: 1.9 }),
    stomp: () => {
      tone(320, ctx.currentTime, 0.1, { gain: 0.26, slide: 0.35 });
      noise(ctx.currentTime, 0.08, { gain: 0.2 });
    },
    coin: () => {
      tone(midi(88), ctx.currentTime, 0.06, { gain: 0.22 });
      tone(midi(93), ctx.currentTime + 0.06, 0.14, { gain: 0.22 });
    },
    power: () => {
      [69, 73, 76, 81].forEach((n, i) =>
        tone(midi(n), ctx.currentTime + i * 0.06, 0.14, { gain: 0.22 }),
      );
    },
    hurt: () => tone(200, ctx.currentTime, 0.22, { type: 'sawtooth', gain: 0.24, slide: 0.5 }),
    death: () => {
      [72, 67, 63, 55, 48].forEach((n, i) =>
        tone(midi(n), ctx.currentTime + i * 0.09, 0.16, { type: 'square', gain: 0.24 }),
      );
    },
    trap: () => {
      tone(150, ctx.currentTime, 0.28, { type: 'sawtooth', gain: 0.26, slide: 0.6 });
      noise(ctx.currentTime, 0.2, { gain: 0.2 });
    },
    crumble: () => noise(ctx.currentTime, 0.12, { gain: 0.16, highpass: 1200 }),
    checkpoint: () => {
      [69, 76, 81].forEach((n, i) => tone(midi(n), ctx.currentTime + i * 0.08, 0.2, { gain: 0.22 }));
    },
    clear: () => {
      [72, 76, 79, 84, 88].forEach((n, i) =>
        tone(midi(n), ctx.currentTime + i * 0.11, 0.26, { gain: 0.24 }),
      );
    },
    bosshit: () => {
      tone(140, ctx.currentTime, 0.24, { type: 'sawtooth', gain: 0.3, slide: 0.4 });
      noise(ctx.currentTime, 0.16, { gain: 0.24 });
    },
    phase: () => {
      [45, 52, 57, 64].forEach((n) => tone(midi(n), ctx.currentTime, 0.7, { type: 'sawtooth', gain: 0.18 }));
      noise(ctx.currentTime, 0.5, { gain: 0.2 });
    },
    bossdown: () => {
      [84, 79, 76, 72, 67, 60, 55, 48].forEach((n, i) =>
        tone(midi(n), ctx.currentTime + i * 0.11, 0.22, { gain: 0.24 }),
      );
    },
    ending: () => {
      [72, 76, 79, 84, 79, 84, 88, 91].forEach((n, i) =>
        tone(midi(n), ctx.currentTime + i * 0.14, 0.3, { gain: 0.24 }),
      );
    },

    // ── 컷신 ──────────────────────────────────────────────
    // 언제 울릴지는 여기가 아니라 타임라인이 정한다 (data/cutSound.js).

    /** 앨범들이 빨려 들어온다 — 위로 빨려 올라가는 소리 */
    gather: () => tone(180, ctx.currentTime, 0.7, { type: 'triangle', gain: 0.16, slide: 3.2 }),
    /** 소용돌이 — 두 음을 살짝 어긋나게 올려 어지럽게 */
    swirl: () => {
      tone(300, ctx.currentTime, 0.9, { type: 'sawtooth', gain: 0.12, slide: 2.2 });
      tone(307, ctx.currentTime, 0.9, { type: 'sawtooth', gain: 0.12, slide: 2.1 });
    },
    /** 하나로 뭉치는 순간의 묵직한 착지 */
    thud: () => {
      tone(110, ctx.currentTime, 0.45, { type: 'sawtooth', gain: 0.3, slide: 0.4 });
      noise(ctx.currentTime, 0.3, { gain: 0.22 });
    },
    flash: () => noise(ctx.currentTime, 0.35, { gain: 0.26, highpass: 2500 }),
    /** 보스가 드러난다 */
    roar: () => {
      tone(70, ctx.currentTime, 1.1, { type: 'sawtooth', gain: 0.3, slide: 1.6 });
      noise(ctx.currentTime, 0.9, { gain: 0.2 });
    },

    rumble: () => {
      tone(48, ctx.currentTime, 0.9, { type: 'triangle', gain: 0.3 });
      noise(ctx.currentTime, 0.8, { gain: 0.16 });
    },
    crack: () => {
      tone(190, ctx.currentTime, 0.3, { type: 'sawtooth', gain: 0.26, slide: 0.45 });
      noise(ctx.currentTime, 0.22, { gain: 0.2, highpass: 900 });
    },
    /** 유리처럼 쪼개진다 */
    split: () => {
      [96, 91, 88, 84].forEach((n, i) =>
        tone(midi(n), ctx.currentTime + i * 0.05, 0.12, { gain: 0.18 }),
      );
      noise(ctx.currentTime, 0.4, { gain: 0.22, highpass: 3000 });
    },
    /** 제목이 쿵 하고 박힌다 */
    title: () => {
      tone(90, ctx.currentTime, 0.5, { type: 'sawtooth', gain: 0.3, slide: 0.5 });
      noise(ctx.currentTime, 0.25, { gain: 0.18 });
    },
    blip: () => tone(midi(84), ctx.currentTime, 0.07, { gain: 0.2 }),
    /** 차트를 조작하는 소리 — 일부러 어긋난 음을 끊어친다 */
    rig: () => {
      [77, 74, 78, 73, 79].forEach((n, i) =>
        tone(midi(n), ctx.currentTime + i * 0.07, 0.06, { type: 'sawtooth', gain: 0.2 }),
      );
    },

    /** 보스가 터진다 — 이 게임에서 제일 큰 소리 */
    burst: () => {
      tone(120, ctx.currentTime, 0.9, { type: 'sawtooth', gain: 0.32, slide: 0.25 });
      noise(ctx.currentTime, 0.7, { gain: 0.3 });
      noise(ctx.currentTime + 0.05, 0.5, { gain: 0.2, highpass: 1800 });
    },
    /** 앨범 열일곱 장이 사방으로 흩어진다 */
    scatter: () => {
      [88, 81, 91, 84, 78, 86].forEach((n, i) =>
        tone(midi(n), ctx.currentTime + i * 0.05, 0.1, { gain: 0.16 }),
      );
    },
    /** 흩어진 앨범이 차트 순위표로 줄을 선다 — 한 칸씩 올라가는 블립 */
    chartline: () => {
      for (let i = 0; i < 8; i++) {
        tone(midi(64 + i * 3), ctx.currentTime + i * 0.08, 0.09, { gain: 0.17 });
      }
    },
    /** 1위 자리로 올라선다 */
    climb: () => {
      [72, 76, 79, 83, 86, 91].forEach((n, i) =>
        tone(midi(n), ctx.currentTime + i * 0.07, 0.16, { gain: 0.22 }),
      );
    },
    /** 왕관 — 짧은 팡파르 */
    crown: () => {
      [79, 79, 79, 84].forEach((n, i) =>
        tone(midi(n), ctx.currentTime + i * 0.12, i === 3 ? 0.5 : 0.1, { gain: 0.24 }),
      );
    },

    /** 식장 종. sine 두 개를 겹쳐 여운을 길게 */
    bell: () => {
      tone(midi(84), ctx.currentTime, 1.4, { type: 'sine', gain: 0.26 });
      tone(midi(91), ctx.currentTime + 0.02, 1.1, { type: 'sine', gain: 0.14 });
      tone(midi(96), ctx.currentTime + 0.04, 0.7, { type: 'sine', gain: 0.08 });
    },
    /** 공주가 걸어 들어온다 — 부드러운 3화음 */
    chime: () => {
      [84, 88, 91].forEach((n, i) =>
        tone(midi(n), ctx.currentTime + i * 0.09, 0.7, { type: 'triangle', gain: 0.16 }),
      );
    },
    /** 반지 — 높고 맑게 딩 */
    ring: () => {
      tone(midi(96), ctx.currentTime, 1.2, { type: 'sine', gain: 0.26 });
      tone(midi(103), ctx.currentTime + 0.03, 0.8, { type: 'sine', gain: 0.12 });
    },
    /** 키스 — 두 음이 위로 붙었다가 반짝 퍼진다 */
    kiss: () => {
      tone(midi(81), ctx.currentTime, 0.5, { type: 'triangle', gain: 0.2 });
      tone(midi(88), ctx.currentTime + 0.12, 0.9, { type: 'triangle', gain: 0.22 });
      [93, 96, 100].forEach((n, i) =>
        tone(midi(n), ctx.currentTime + 0.3 + i * 0.08, 0.5, { type: 'sine', gain: 0.12 }),
      );
    },
  };

  return {
    get muted() {
      return state.muted;
    },
    /**
     * 낼 수 있는 소리 이름들. 소리를 내지 않으므로 브라우저 밖에서도 부를 수 있다 —
     * data/cutSound.js 가 없는 이름을 가리키고 있지 않은지 테스트가 이걸로 대조한다.
     */
    names() {
      return { sfx: Object.keys(SFX), bgm: Object.keys(TRACKS) };
    },
    /** 첫 입력 때 부른다 */
    unlock() {
      ensure();
      // resume() 은 거절될 수 있다. 콘솔만 더럽히고 게임과는 상관없으니 삼킨다.
      if (ctx?.state === 'suspended') ctx.resume().catch(() => {});
    },
    play(name) {
      if (state.muted) return;
      ensure();
      if (!ctx) return;
      SFX[name]?.();
    },
    bgm(name) {
      ensure();
      if (!ctx || current === name) return;
      clearTimeout(timer);
      current = name;
      if (name && !state.muted) scheduleLoop(name);
    },
    stopBgm() {
      clearTimeout(timer);
      current = null;
    },
    setMuted(value) {
      state.muted = value;
      ensure();
      if (master) master.gain.value = value ? 0 : 0.5;
      if (!value && current) scheduleLoop(current);
      return state.muted;
    },
    toggleMute() {
      return this.setMuted(!state.muted);
    },
  };
}
