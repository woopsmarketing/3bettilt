import { describe, expect, it } from 'vitest';
import { COMBO_COUNT, HAND_CLASS_COUNT, handClassByKey } from '@gto-self/strategy-core';
import { HAND_STRENGTH, topHandsByShare } from '@gto-self/learn-core';
import { topSelectionForPercent } from './viewModel.js';
import {
  actualShareSentence,
  cumulativeShareLabel,
  equityLabel,
  METHODOLOGY_SENTENCE,
  PLAYABILITY_CAVEAT_SENTENCE,
  provenanceSentence,
  RANGE_DISTINCTION_SENTENCE,
  rankLabel,
  requestedTopPercentLabel,
  STARTING_HAND_VIEW_LABEL,
  STRATEGY_DISTINCTION_SENTENCE,
  tiesOverviewSentence,
  tieNote,
  topShareCutSentence,
  weakestIncludedLabel,
} from './copy.js';

describe('the two load-bearing sentences', () => {
  it('never mentions GTO anywhere in this file’s copy', () => {
    const strings = [
      METHODOLOGY_SENTENCE,
      STRATEGY_DISTINCTION_SENTENCE,
      RANGE_DISTINCTION_SENTENCE,
      PLAYABILITY_CAVEAT_SENTENCE,
      ...Object.values(STARTING_HAND_VIEW_LABEL),
    ];
    for (const value of strings) {
      expect(value.toUpperCase()).not.toContain('GTO');
    }
  });

  it('the methodology sentence names a random opponent and preflop showdown', () => {
    expect(METHODOLOGY_SENTENCE).toContain('무작위');
    expect(METHODOLOGY_SENTENCE).toContain('프리플랍');
    expect(METHODOLOGY_SENTENCE).toContain('올인');
  });

  it('the strategy-distinction sentence is exactly the WP brief wording', () => {
    expect(STRATEGY_DISTINCTION_SENTENCE).toBe(
      '이 순위는 포지션별 전략이 아니라 시작 패 자체의 기본 강도를 비교한 것입니다.',
    );
  });

  it('the range-distinction sentence names the Range Explorer’s own label', () => {
    expect(RANGE_DISTINCTION_SENTENCE).toContain('학습용 기본 레인지');
  });

  /*
   * WP-Q2 / P1-F4 (MASTER decision D1). `HandStrengthEntry.equity` is hero's EXPECTED SHARE
   * OF THE POT with ties split (`packages/learn-core/src/strength/model.ts`), not the
   * proportion of the time hero wins. The measured gap reaches ~2.9pp — far past the two
   * decimals `equityLabel` prints — so no sentence here may say 이기는 비율 / 이길 확률, and
   * the definitional one has to state the tie convention. Fails against the original copy.
   */
  it('never calls the metric the proportion of the time you win', () => {
    for (const sentence of [
      METHODOLOGY_SENTENCE,
      STRATEGY_DISTINCTION_SENTENCE,
      RANGE_DISTINCTION_SENTENCE,
      PLAYABILITY_CAVEAT_SENTENCE,
    ]) {
      expect(sentence).not.toContain('이기는 비율');
      expect(sentence).not.toContain('이길 확률');
    }
    expect(METHODOLOGY_SENTENCE).toContain('팟에서 가져갈 것으로 기대되는 몫');
    expect(METHODOLOGY_SENTENCE).toContain('비기는 경우는 절반만 이긴 것으로 계산에 들어갑니다');
  });

  /*
   * WP-Q2 / P2-M7 (MASTER decision D5). The caveat began with "그래서", whose antecedent sits
   * in a different card two columns away, and asserted which hands are hard to play and which
   * hands people like — unbacked strategy inside the sentence written to prevent exactly that.
   * The refusal itself stays; only the unbacked claims and the dangling connector go.
   */
  it('the playability caveat neither dangles nor smuggles in a strategy claim', () => {
    expect(PLAYABILITY_CAVEAT_SENTENCE.startsWith('그래서')).toBe(false);
    expect(PLAYABILITY_CAVEAT_SENTENCE).not.toContain('잘 플레이하기 어려운');
    expect(PLAYABILITY_CAVEAT_SENTENCE).not.toContain('사람들이 좋아하는');
    // P2-M5: the site canon is 수티드; this was the one 수트드 left anywhere in `src/**`.
    expect(PLAYABILITY_CAVEAT_SENTENCE).not.toContain('수트드');
    // D5: the caveat is still a caveat.
    expect(PLAYABILITY_CAVEAT_SENTENCE).toContain('뜻은 아니');
    expect(PLAYABILITY_CAVEAT_SENTENCE).toContain('범위 밖');
  });
});

describe('provenanceSentence', () => {
  it('reads its numbers from the metadata argument, not a frozen literal', () => {
    const sentence = provenanceSentence({
      method: 'EXACT',
      trialCount: 354489735600,
      enumeration: { boardsPerClass: 2118760, opponentHands: 1225 },
    });
    expect(sentence).toContain('2,118,760');
    expect(sentence).toContain('1,225');
    expect(sentence).toContain('354,489,735,600');
  });

  it('would change if a regenerated dataset changed the numbers', () => {
    const smaller = provenanceSentence({
      method: 'EXACT',
      trialCount: 1,
      enumeration: { boardsPerClass: 2, opponentHands: 3 },
    });
    expect(smaller).not.toContain('2,118,760');
    expect(smaller).toContain('총 1번의 승부');
  });

  it('matches the real shipped dataset when called with HAND_STRENGTH itself', () => {
    const sentence = provenanceSentence(HAND_STRENGTH);
    expect(sentence).toContain(HAND_STRENGTH.trialCount.toLocaleString('ko-KR'));
  });
});

describe('topShareCutSentence', () => {
  it('takes the class/combo counts as parameters read from strategy-core', () => {
    const sentence = topShareCutSentence(HAND_CLASS_COUNT, COMBO_COUNT);
    expect(sentence).toContain(String(HAND_CLASS_COUNT));
    expect(sentence).toContain(COMBO_COUNT.toLocaleString('ko-KR'));
  });

  /*
   * WP-Q2 / P1-F10. The sentence used to blame the overshoot on "페어처럼 조합 수가 적은 패부터
   * 먼저 포함되기 때문에". That is the wrong cause and points the wrong way: the overshoot is
   * bounded by the BOUNDARY class's own combo count, so a small boundary class makes it
   * SMALLER. Established here against `topHandsByShare` itself, not from the sentence.
   */
  it('the overshoot is bounded by the boundary class, and is largest at the BIGGEST one', () => {
    const worstBy: Record<number, number> = {};
    let largest = { overshoot: -1, combos: 0 };

    for (let step = 1; step <= 1000; step += 1) {
      const requested = step / 1000;
      const result = topHandsByShare(requested);
      if (!result.ok) throw new Error(`topHandsByShare rejected ${requested}`);
      const weakest = result.value.weakestIncluded;
      if (weakest === undefined) continue;
      const boundary = handClassByKey(weakest.key);
      if (boundary === undefined) throw new Error(`unknown boundary class ${weakest.key}`);

      const overshoot = result.value.actualShare - requested;
      // The factual half of the sentence, which was and stays correct.
      expect(overshoot).toBeGreaterThanOrEqual(0);
      // A class is atomic at the cut, so the spill can never exceed that class's own share.
      expect(overshoot).toBeLessThanOrEqual(boundary.comboCount / COMBO_COUNT + 1e-12);

      const combos = boundary.comboCount;
      worstBy[combos] = Math.max(worstBy[combos] ?? 0, overshoot);
      if (overshoot > largest.overshoot) largest = { overshoot, combos };
    }

    // 12-combo offsuit classes produce the biggest overshoot; 4-combo suited ones the
    // smallest — the opposite of "조합 수가 적은 패부터 먼저 포함되기 때문에".
    expect(largest.combos).toBe(12);
    expect(worstBy[4]).toBeLessThan(worstBy[12] ?? 0);

    const sentence = topShareCutSentence(HAND_CLASS_COUNT, COMBO_COUNT);
    expect(sentence).not.toContain('페어처럼 조합 수가 적은 패부터 먼저 포함되기 때문에');
    expect(sentence).toContain('쪼개지지 않고 통째로만');
    expect(sentence).toContain('조합 수가 많은 핸드에서 끊길수록');
  });
});

describe('tiesOverviewSentence', () => {
  it('states there are no ties for an empty list', () => {
    expect(tiesOverviewSentence([])).toContain('하나도 없습니다');
  });

  it('names the pairs and their count for a non-empty list', () => {
    const sentence = tiesOverviewSentence(['AKs = AKo']);
    expect(sentence).toContain('1쌍');
    expect(sentence).toContain('AKs = AKo');
  });

  it('matches the real shipped dataset’s exactTies (currently empty)', () => {
    expect(tiesOverviewSentence(HAND_STRENGTH.exactTies)).toContain('하나도 없습니다');
  });
});

describe('per-hand labels', () => {
  const aa = HAND_STRENGTH.entries[0];
  if (aa === undefined) throw new Error('HAND_STRENGTH.entries is unexpectedly empty');

  it('rankLabel reads the total from its parameter, not a literal', () => {
    expect(rankLabel(aa, HAND_STRENGTH.entries.length)).toBe('169개 중 1위');
    expect(rankLabel(aa, 10)).toBe('10개 중 1위');
  });

  it('cumulativeShareLabel and equityLabel format AA’s known values', () => {
    expect(cumulativeShareLabel(aa)).toBe('상위 0.45%');
    expect(equityLabel(aa)).toBe('85.20%');
  });

  it('tieNote is null when neither neighbour is tied', () => {
    expect(tieNote({ tiedWithStronger: false, tiedWithWeaker: false })).toBeNull();
  });

  it('tieNote explains a tie when either neighbour is tied', () => {
    expect(tieNote({ tiedWithStronger: true, tiedWithWeaker: false })).toContain('공동 순위');
    expect(tieNote({ tiedWithStronger: false, tiedWithWeaker: true })).toContain('공동 순위');
  });
});

describe('requestedTopPercentLabel', () => {
  it('shows the raw requested percent', () => {
    expect(requestedTopPercentLabel(15)).toBe('상위 15%');
  });
});

describe('actualShareSentence and weakestIncludedLabel', () => {
  it('reports what the cut actually returned, which is always >= the request', () => {
    const selection = topSelectionForPercent(15);
    const sentence = actualShareSentence(selection);
    expect(sentence).toContain(`${selection.classCount}개 핸드`);
    expect(sentence).toContain(selection.comboCount.toLocaleString('ko-KR'));

    const label = weakestIncludedLabel(selection);
    expect(label).not.toBeNull();
    const weakestKey = selection.weakestIncluded?.key;
    expect(weakestKey).toBeDefined();
    if (weakestKey !== undefined) {
      expect(label).toContain(weakestKey);
      const handClass = handClassByKey(weakestKey);
      expect(handClass).toBeDefined();
    }
  });
});
