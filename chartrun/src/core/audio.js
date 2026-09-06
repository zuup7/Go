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
        tone(midi(track.lead[i]), at, step * 0.9, { type: 'square', gain: 0.22, out: bgmGain });
      }
      if (track.bass[i] != null) {
        tone(midi(track.bass[i]), at, step * 1.1, { type: 'triangle', gain: 0.3, out: bgmGain });
      }
      if (track.kick[i]) noise(at, 0.05, { gain: 0.18, out: bgmGain });
      if (i % 2 === 1) noise(at, 0.02, { gain: 0.05, out: bgmGain, highpass: 6000 });
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
  };

  return {
    get muted() {
      return state.muted;
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
