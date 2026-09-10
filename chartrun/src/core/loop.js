// 고정 타임스텝 루프. 논리는 항상 60Hz 로 돌고, 그리기만 화면 주사율을 따른다.
export const STEP = 1 / 60;
const MAX_CATCHUP = 5;

export function createLoop({ update, render }) {
  let raf = 0;
  let last = 0;
  let acc = 0;
  let running = false;

  const frame = (now) => {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const delta = Math.min((now - last) / 1000, 0.25);
    last = now;
    acc += delta;
    let steps = 0;
    while (acc >= STEP && steps < MAX_CATCHUP) {
      update(STEP);
      acc -= STEP;
      steps += 1;
    }
    if (steps >= MAX_CATCHUP) acc = 0;
    render(acc / STEP);
  };

  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      acc = 0;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    get running() {
      return running;
    },
  };
}
