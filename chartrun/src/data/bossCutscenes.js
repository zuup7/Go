// 보스전 중간에 끼어드는 컷신들.
// data/cutscene.js 의 합체 컷신과 똑같은 타임라인 모양이라 헬퍼를 그대로 쓴다.
//
// 대사는 없다. 무슨 일이 벌어지는지는 화면이 말한다.
// at: 컷신 시작으로부터의 초.  kind 는 컷신마다 다르고 render/sceneCuts.js 가 해석한다.
import { lengthOf } from './cutscene.js';

/** 2페이즈 — 하나였던 보스가 네 조각으로 갈라진다 */
export const PHASE2_CUT = [
  { at: 0.0, kind: 'shake' },
  { at: 1.0, kind: 'crack' },
  { at: 1.8, kind: 'split' },
  { at: 3.2, kind: 'title' },
  { at: 4.4, kind: 'end' },
];

/**
 * 3페이즈 — 차트를 조작해 1위를 빼앗고, 그 힘으로 합체한다.
 *
 * 2페이즈에서 넷으로 쪼개졌던 조각이 도로 불려와 로봇으로 조립된다.
 * 조작(chart·rig)이 합체의 이유다 — 순서를 바꾸면 왜 갑자기 합체하는지가 사라진다.
 */
export const PHASE3_CUT = [
  { at: 0.0, kind: 'shake' },
  { at: 0.7, kind: 'chart' }, // 가짜 실시간 차트가 뜬다
  { at: 1.6, kind: 'rig' }, // 꼴찌였던 보스가 1위로 솟는다
  { at: 2.8, kind: 'call' }, // 흩어진 조각들이 사방에서 불려온다
  { at: 4.0, kind: 'assemble' }, // 다리·몸통·견갑·팔이 하나씩 꽂힌다
  { at: 6.0, kind: 'lock' }, // 머리와 크레스트 — 마지막 철컥
  { at: 6.8, kind: 'core' }, // 가슴 코어에 불이 들어오고 바이저가 켜진다
  { at: 7.8, kind: 'title' },
  { at: 9.2, kind: 'end' },
];

/**
 * 3페이즈 · 하드 (**공룡로봇 합체**).
 *
 * 이야기가 여기서 드러난다 — 1회차에서 우리가 밟아 없앤 앨범들이
 * **돌아와 새 몸으로 조립되는** 것이다.
 *
 * 보통 모드의 3페이즈도 조각을 불러 모아 **로봇**을 만든다. 여기도 같은
 * 「합체」지만 만들어지는 것이 **짐승**이다 — 같은 공장에서 나온 다른 물건으로
 * 보여야 2회차가 1회차의 연장으로 읽힌다.
 *
 * 예전에는 껍질에 금이 가고 **안에서 찢고 나오는** 이야기였다. 그건 기계가
 * 아니라 알에서 깨는 그림이라, 조립해서 만든 로봇과 세계가 어긋났다.
 */
export const HARD3_CUT = [
  { at: 0.0, kind: 'shake' },
  { at: 0.8, kind: 'graves' }, // 밟혀 사라졌던 앨범들이 바닥에서 떠오른다
  { at: 2.0, kind: 'swarm' }, // 대형을 이뤄 모인다
  { at: 3.2, kind: 'split' }, // 싸우던 진화 원반이 갈라져 부품이 된다
  // 부품이 공중에 멈춰 선다. **아무 소리도 없다** — 이 한 박자가 있어야 다음이 산다.
  { at: 4.2, kind: 'still' },
  { at: 4.8, kind: 'assemble' }, // 뒷다리·몸통·꼬리·앞발이 하나씩 철컥 꽂힌다
  { at: 6.8, kind: 'lock' }, // 목과 머리 — 마지막 철컥
  { at: 7.5, kind: 'core' }, // 가슴 코어에 불이 들어오고 바이저가 켜진다
  { at: 8.3, kind: 'roar' }, // 고개를 들고 **입을 벌려** 포효한다
  { at: 9.1, kind: 'title' },
  { at: 10.5, kind: 'end' },
];

/**
 * 보스가 쓰러질 때 (**죽는 컷신**) — **폭주해서 제 안으로 무너진다.**
 *
 * 예전에는 비틀거리다 무릎을 꿇고 펑 터졌다. 그런데 이 몸은 3페이즈에서
 * **조립해서 만든 기계**다 — 죽을 때만 생물처럼 무릎을 꿇는 게 어긋났고,
 * 마지막도 흰 원 하나에 별 몇 개라 「터졌다」 말고는 남는 게 없었다.
 *
 * 기계는 기계답게 죽는다. 이음새마다 빛이 새어 나오고, 점점 더 심하게 떨다가,
 * 딱 멈추고, 빛이 **밖이 아니라 안으로** 빨려 들어가며 제 안으로 무너진다.
 * 파편이 사방으로 안 튀어서 화면이 깔끔하고, 숙였던 힘이 어디로 갔는지가 보인다.
 */
export const BOSS_DOWN_CUT = [
  { at: 0.0, kind: 'stagger' }, // 비틀거린다. 이음새에서 불꽃이 튄다
  { at: 1.2, kind: 'seep' }, // 이음새마다 빛이 **새어 나온다** — 안에서 새는 것이다
  /**
   * 박혀 있던 앨범이 하나씩 튕겨 나간다.
   *
   * **이 비트는 반드시 남아야 한다.** 하드 엔딩이 「벌겋게 달았던 앨범들이 식어
   * 평범한 레코드로 돌아가고(calm) 열일곱 장이 관객이 된다(crowd)」로 시작하는데,
   * 죽을 때 앨범이 몸에서 빠져나와 있어야 그게 이어진다.
   * 다만 이유가 바뀌었다 — 떨어지는 게 아니라 **안에서 부푼 빛에 밀려** 나온다.
   */
  { at: 2.4, kind: 'shed' },
  { at: 3.6, kind: 'seize' }, // 관절이 굳는다. 떨림이 최고조
  // 무너지기 직전의 정적. 이 컷신은 **무음 위에서 돈다**(마지막 일격에 브금을 끊는다)
  // 라 한 박자 쉬는 게 특히 잘 듣는다.
  { at: 4.8, kind: 'still' },
  /**
   * 빛이 안으로 빨려 들고 몸이 제 안으로 **짓눌린다.**
   *
   * 여기서 끝나면 안 된다. 조용히 사라지니 최종보스를 이긴 맛이 없었다 —
   * 이건 끝이 아니라 **준비동작**이다. 한 점으로 모았다가 다음 비트에서 터뜨린다.
   */
  { at: 5.4, kind: 'implode' },
  { at: 6.0, kind: 'blast' }, // 모인 것이 한꺼번에 터져 나온다
  { at: 7.6, kind: 'end' },
];

/**
 * 4페이즈 (하드모드에만) — 이미 합체한 로봇이 한계를 넘는다.
 *
 * 새 몸을 그리지 않는다. 있는 로봇을 벌겋게 달구고 뒤의 거대 로봇이 일어서는 것으로
 * "한 단계 더"를 보여준다 — 여기서 또 새 형태를 만들면 3페이즈 합체가 시시해진다.
 */
export const PHASE4_CUT = [
  { at: 0.0, kind: 'shake' },
  { at: 0.8, kind: 'overheat' }, // 이음새마다 빛이 새어 나온다
  { at: 2.0, kind: 'rise' }, // 뒤의 거대 로봇이 일어선다
  { at: 3.4, kind: 'core' }, // 코어가 붉게 터진다
  { at: 4.4, kind: 'title' },
  { at: 5.8, kind: 'end' },
];

/**
 * 엔딩 — 보스가 터지고, 흩어진 앨범이 차트가 되고, 그 꼭대기에 내가 선다.
 * 그리고 차트가 결혼식장이 된다. 앨범 열일곱 장이 하객이다.
 */
export const ENDING_CUT = [
  { at: 0.0, kind: 'crack' },
  { at: 1.4, kind: 'burst' },
  { at: 2.0, kind: 'scatter' },
  { at: 3.2, kind: 'chartline' },
  { at: 4.8, kind: 'empty' },
  { at: 5.8, kind: 'climb' },
  { at: 6.8, kind: 'crown' },
  { at: 8.6, kind: 'aisle' }, // 차트 줄이 버진로드로 바뀐다
  { at: 10.0, kind: 'bride' }, // 공주가 걸어 들어온다
  { at: 12.0, kind: 'vow' }, // 꽃 아치 아래 마주 선다
  { at: 13.6, kind: 'ring' },
  { at: 15.0, kind: 'kiss' },
  { at: 18.0, kind: 'end' },
];

/**
 * **2회차 엔딩** — 진화가 풀리고, 차트가 무대가 된다.
 *
 * 1회차 엔딩은 결혼식이었다. 사적인 결말이라 같은 걸 또 보여주면 2회차에 남는 게 없다.
 * 여기는 **가수로서의 결말**이다 — 나를 막아섰던 열일곱 장이 이번엔 관객으로 앉고,
 * 내가 그 앞에 선다. #100 방구석에서 시작한 이야기가 여기서 닫힌다.
 *
 * 대사는 없다. 순서가 곧 이야기다 —
 * 풀려나고(free) → 진화가 식고(calm) → 차트가 무대가 되고(stage) →
 * 적이 관객이 되고(crowd) → 둘이 선다(duet) → 앙코르(encore) → ★(star).
 */
export const HARD_END_CUT = [
  { at: 0.0, kind: 'free' }, // 새장이 부서지고 그녀가 내려온다
  { at: 1.7, kind: 'calm' }, // 벌겋게 달았던 앨범들이 식어 평범한 레코드로 돌아간다
  { at: 3.4, kind: 'stage' }, // 차트 막대가 솟아 무대가 된다
  { at: 5.0, kind: 'crowd' }, // 열일곱 장이 무대 아래로 모여 앉는다
  { at: 6.6, kind: 'duet' }, // 둘이 무대에 선다. 마이크가 둘이다
  { at: 8.4, kind: 'encore' }, // 조명이 터지고 관객이 뛴다
  { at: 10.2, kind: 'star' }, // ★ — 두 번째 1위
  { at: 12.8, kind: 'end' },
];

export const BOSS_CUTS = {
  phase2: { timeline: PHASE2_CUT, title: 'PHASE 2' },
  phase3: { timeline: PHASE3_CUT, title: 'PHASE 3' },
  /** 하드모드의 3페이즈는 조립이 아니라 **변신**이다 */
  hard3: { timeline: HARD3_CUT, title: 'EVOLVED' },
  phase4: { timeline: PHASE4_CUT, title: 'FINAL' },
  bossdown: { timeline: BOSS_DOWN_CUT, title: null },
  ending: { timeline: ENDING_CUT, title: '#1' },
  /** 2회차 엔딩. 1회차와 **다른 결말**이라야 두 번 달린 값이 있다 */
  hardEnd: { timeline: HARD_END_CUT, title: '#1' },
};

export const bossCutLength = (id) => lengthOf(BOSS_CUTS[id].timeline);

/**
 * 단계 이름 → 시작 시각. 그리는 쪽(render/sceneCuts.js)이 이걸 읽어서 쓴다.
 * 시각을 그림 코드에 또 적어두면, 타임라인만 고쳤을 때 둘이 어긋나서
 * 연출이 엉뚱한 때에 나온다 — 한 곳에서만 정한다.
 */
const atOf = (timeline) => Object.fromEntries(timeline.map((s) => [s.kind, s.at]));

export const PHASE2_AT = atOf(PHASE2_CUT);
export const HARD3_AT = atOf(HARD3_CUT);
export const BOSS_DOWN_AT = atOf(BOSS_DOWN_CUT);
export const PHASE3_AT = atOf(PHASE3_CUT);
export const PHASE4_AT = atOf(PHASE4_CUT);
export const ENDING_AT = atOf(ENDING_CUT);
export const HARD_END_AT = atOf(HARD_END_CUT);

/**
 * 이 판이 볼 엔딩 컷신 id. **읽는 곳이 둘이다** — 쓰러지는 컷신 뒤에 이어 붙일 때와,
 * 그게 끝났는지 볼 때. 두 곳에 삼항연산자를 따로 적으면 하드에서 엔딩이 안 끝난다.
 */
export const endingCut = (hard) => (hard ? 'hardEnd' : 'ending');
/** 이 id 가 엔딩인가 (끝나면 통계 화면으로 간다) */
export const isEndingCut = (id) => id === 'ending' || id === 'hardEnd';

/**
 * 페이즈가 바뀔 때 틀 컷신 id (1페이즈는 시작이라 없다).
 *
 * 하드의 3페이즈만 다른 컷신을 쓴다 — 보통 모드는 조각을 모아 **조립**하고,
 * 하드는 껍질을 찢고 **공룡으로 변신**한다. 같은 컷신을 두 번 보여주면
 * 2회차에 새 볼거리가 없다.
 */
export const cutForPhase = (phaseId, hard = false) => {
  if (phaseId < 2 || phaseId > 4) return null;
  if (phaseId === 3 && hard) return 'hard3';
  return `phase${phaseId}`;
};
