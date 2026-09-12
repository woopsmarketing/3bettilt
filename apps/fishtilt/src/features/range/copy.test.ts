import { describe, expect, it } from 'vitest';
import { HAND_CLASSES, handClassByKey, STRATEGY_POSITIONS } from '@gto-self/strategy-core';
import {
  RANGE_SPOTS,
  RANGE_STACK_DEPTHS,
  RANGE_TABLE_SIZES,
  type RangeUnsupportedReason,
} from './types.js';
import {
  describeHandClassKorean,
  describeRangeConditions,
  handClassAccessibleName,
  handClassReading,
  IN_RANGE_LABEL,
  OUT_OF_RANGE_LABEL,
  POSITION_GLOSS,
  POSITION_LABEL,
  RANK_READING,
  josaIran,
  positionAccessibleName,
  positionLegendEntry,
  RANGE_LABEL,
  RANGE_PROVENANCE_SENTENCE,
  SPOT_LABEL,
  stackDepthLabel,
  TABLE_SIZE_LABEL,
  UNSUPPORTED_REASON_LABEL,
} from './copy.js';

const UNSUPPORTED_REASONS: readonly RangeUnsupportedReason[] = [
  'SPOT_NOT_SHIPPED',
  'STACK_DEPTH_NOT_SHIPPED',
  'TABLE_SIZE_NOT_SHIPPED',
  'BB_HAS_NO_RFI_RANGE',
];

describe('RANGE_LABEL', () => {
  it('is the single fixed term the audit specifies, and never mentions GTO', () => {
    expect(RANGE_LABEL).toBe('학습용 기본 레인지');
    expect(RANGE_LABEL.toUpperCase()).not.toContain('GTO');
  });
});

/*
 * WP-Q2 / P2-m1. `/tools/range` hard-coded `${RANGE_LABEL}이란` and rendered
 * "학습용 기본 레인지이란" in an `<h2>` on the flagship page. Korean picks 이란/란 by whether
 * the preceding syllable carries a 받침, so the particle is computed from the label and the
 * heading cannot silently regress if the label is ever reworded.
 */
describe('josaIran', () => {
  it('picks 란 after a bare vowel and 이란 after a final consonant', () => {
    expect(josaIran('학습용 기본 레인지')).toBe('란');
    expect(josaIran('레인지')).toBe('란');
    expect(josaIran('팟')).toBe('이란');
    expect(josaIran('아웃')).toBe('이란');
  });

  it('gives the label 3BetTilt actually ships the right particle', () => {
    expect(`${RANGE_LABEL}${josaIran(RANGE_LABEL)}`).toBe('학습용 기본 레인지란');
  });

  it('falls back to 란 for a non-Hangul ending rather than throwing', () => {
    expect(josaIran('RFI')).toBe('란');
    expect(josaIran('')).toBe('란');
  });
});

/*
 * WP-Q2 / P1-F7 (MASTER decision D2). Three surfaces described this data three different
 * ways, two of them wrong. `packages/strategy-core/src/preflop/tables.ts` states in its own
 * comment that UTG/HJ/CO/BTN are transcribed VERBATIM from ONE public chart — single-sourced
 * — and that only SB is recomputed here (`trimSbCompositeToRaiseOnly`). The three-way
 * corroboration is real but is about the PERCENTAGES, not the lists.
 */
describe('RANGE_PROVENANCE_SENTENCE', () => {
  it('names the situation the table is for, through the label constants', () => {
    // Owner-approved meaning (Stage 3): 6-max · 100BB · First In. Asserted through the same
    // formatters the filters render with, so a vocabulary change cannot strand the sentence.
    expect(RANGE_PROVENANCE_SENTENCE).toContain(`${TABLE_SIZE_LABEL[6]} 테이블`);
    expect(RANGE_PROVENANCE_SENTENCE).toContain(stackDepthLabel(100));
    expect(RANGE_PROVENANCE_SENTENCE).toContain(SPOT_LABEL.RFI);
  });

  it('says the table is not the answer for every situation', () => {
    expect(RANGE_PROVENANCE_SENTENCE).toContain('모든 상황의 정답을 뜻하지 않');
    expect(RANGE_PROVENANCE_SENTENCE).toContain('게임 조건과 상대에 따라');
  });

  it('claims no corroboration and describes no external source', () => {
    // The old sentence ended with "the share this list covers matches two other sources" and
    // opened by describing where the lists were copied from. Neither is a claim this site
    // makes any more (WP-S3-01a).
    expect(RANGE_PROVENANCE_SENTENCE).not.toContain('다른 두 자료');
    expect(RANGE_PROVENANCE_SENTENCE).not.toContain('교차 검증');
    expect(RANGE_PROVENANCE_SENTENCE).not.toContain('여러');
    expect(RANGE_PROVENANCE_SENTENCE).not.toContain('한 곳');
    expect(RANGE_PROVENANCE_SENTENCE).not.toContain('그대로 옮긴');
    expect(RANGE_PROVENANCE_SENTENCE).not.toContain('교육 자료');
  });

  it('says SB is the part this project recomputed, and why', () => {
    expect(RANGE_PROVENANCE_SENTENCE).toContain('SB');
    expect(RANGE_PROVENANCE_SENTENCE).toContain('레이즈와 림프를 합친');
    expect(RANGE_PROVENANCE_SENTENCE).toContain('다시 계산');
  });

  it('does not claim the lists were computed here, and names no source site', () => {
    expect(RANGE_PROVENANCE_SENTENCE).not.toContain('베낀 것이 아니라');
    expect(RANGE_PROVENANCE_SENTENCE).not.toMatch(/PokerCoaching|\.com/iu);
    expect(RANGE_PROVENANCE_SENTENCE.toUpperCase()).not.toContain('GTO');
  });

  it('names the range with the site’s one label', () => {
    expect(RANGE_PROVENANCE_SENTENCE).toContain(RANGE_LABEL);
  });
});

describe('POSITION_LABEL', () => {
  it('covers every StrategyPosition as an identity map', () => {
    for (const position of STRATEGY_POSITIONS) {
      expect(POSITION_LABEL[position]).toBe(position);
    }
  });
});

describe('SPOT_LABEL', () => {
  it('covers every RangeSpot with non-empty Korean copy', () => {
    for (const spot of RANGE_SPOTS) {
      expect(SPOT_LABEL[spot].length).toBeGreaterThan(0);
    }
  });

  it('puts easy Korean first and the Latin/English term second, per §6.3', () => {
    expect(SPOT_LABEL.RFI).toBe('아무도 참여하지 않았을 때 (First In)');
    expect(SPOT_LABEL.RFI.indexOf('아무도')).toBeLessThan(SPOT_LABEL.RFI.indexOf('First In'));
  });
});

describe('TABLE_SIZE_LABEL', () => {
  it('covers every RangeTableSize', () => {
    for (const size of RANGE_TABLE_SIZES) {
      expect(TABLE_SIZE_LABEL[size].length).toBeGreaterThan(0);
    }
  });
});

describe('stackDepthLabel', () => {
  it('renders every RangeStackDepth as "<n>BB"', () => {
    for (const depth of RANGE_STACK_DEPTHS) {
      expect(stackDepthLabel(depth)).toBe(`${depth}BB`);
    }
  });
});

describe('describeRangeConditions', () => {
  it('matches the exact dot-separated shape the audit gives for its example', () => {
    const text = describeRangeConditions({
      heroPosition: 'BTN',
      spot: 'RFI',
      stackDepth: 100,
      tableSize: 6,
    });
    expect(text).toBe('6인 · 100BB · 아무도 참여하지 않았을 때 (First In)');
  });
});

describe('UNSUPPORTED_REASON_LABEL', () => {
  it('covers every RangeUnsupportedReason with non-empty Korean copy', () => {
    for (const reason of UNSUPPORTED_REASONS) {
      expect(UNSUPPORTED_REASON_LABEL[reason].length).toBeGreaterThan(0);
    }
  });

  it('renders the BB case as the documented explanation, not a generic error', () => {
    expect(UNSUPPORTED_REASON_LABEL.BB_HAS_NO_RFI_RANGE).toContain(
      '빅블라인드는 첫 번째로 오픈하는 자리가 아닙니다',
    );
  });
});

describe('describeHandClassKorean', () => {
  it('reads a suited class exactly as the audit’s own example', () => {
    const aqs = HAND_CLASSES.find((handClass) => handClass.key === 'AQs');
    expect(aqs).toBeDefined();
    if (!aqs) return;
    expect(describeHandClassKorean(aqs)).toBe('같은 무늬의 A와 Q');
  });

  it('reads an offsuit class distinctly from suited', () => {
    const aqo = HAND_CLASSES.find((handClass) => handClass.key === 'AQo');
    expect(aqo).toBeDefined();
    if (!aqo) return;
    expect(describeHandClassKorean(aqo)).toBe('다른 무늬의 A와 Q');
  });

  it('reads a pair distinctly and spells "T" out as "10"', () => {
    const tt = HAND_CLASSES.find((handClass) => handClass.key === 'TT');
    expect(tt).toBeDefined();
    if (!tt) return;
    expect(describeHandClassKorean(tt)).toBe('같은 숫자 두 장 (10 페어)');
  });

  it('produces a reading for all 169 classes without throwing', () => {
    for (const handClass of HAND_CLASSES) {
      expect(describeHandClassKorean(handClass).length).toBeGreaterThan(0);
    }
  });

  it('picks 와/과 by how the written rank is read, on every one of the 169', () => {
    /*
     * The particle was a hard-coded `와`, and the test above passed the whole time because
     * `.length > 0` is true of broken Korean too. 48 classes rendered `10와 9`, `8와 7`,
     * `7와 6`, `6와 5`, `3와 2` — on eight prerendered pages, every matrix cell and every quiz
     * explanation. `/hands/t9s` showed hand-written `10과 9` beside computed `10와 9`.
     *
     * The batchim-final set is written out here rather than imported, so this checks the
     * source's answer instead of restating it: 삼, 육, 칠, 팔, 십 all end in a consonant and
     * take 과; 이, 사, 오, 구 and the letter names 에이/제이/큐/케이 do not and take 와.
     */
    const TAKES_GWA = new Set(['3', '6', '7', '8', '10']);
    const offenders: string[] = [];
    for (const handClass of HAND_CLASSES) {
      if (handClass.kind === 'PAIR') continue;
      const text = describeHandClassKorean(handClass);
      const high = RANK_READING[handClass.highRank];
      const expected = TAKES_GWA.has(high) ? `${high}과 ` : `${high}와 `;
      if (!text.includes(expected)) offenders.push(`${handClass.key}: ${text}`);
    }
    expect(offenders).toEqual([]);
  });

  it('spells the five batchim-final ranks out, so the rule is readable not just computed', () => {
    const cases: readonly (readonly [string, string])[] = [
      ['T9s', '같은 무늬의 10과 9'],
      ['87o', '다른 무늬의 8과 7'],
      ['76s', '같은 무늬의 7과 6'],
      ['65o', '다른 무늬의 6과 5'],
      ['32s', '같은 무늬의 3과 2'],
      ['A5s', '같은 무늬의 A와 5'],
      ['K9o', '다른 무늬의 K와 9'],
      ['54s', '같은 무늬의 5와 4'],
    ];
    for (const [key, expected] of cases) {
      const handClass = HAND_CLASSES.find((candidate) => candidate.key === key);
      expect(handClass, `${key} is not a hand class`).toBeDefined();
      if (!handClass) continue;
      expect(describeHandClassKorean(handClass), key).toBe(expected);
    }
  });
});

describe('membership copy', () => {
  it('states in-range and out-of-range distinctly in words, not just via colour', () => {
    expect(IN_RANGE_LABEL).not.toBe(OUT_OF_RANGE_LABEL);
    expect(IN_RANGE_LABEL).toContain('포함되어 있어요');
    expect(OUT_OF_RANGE_LABEL).toContain('포함되어 있지 않아요');
  });
});

/** `handClassByKey` is total over the 169 real keys but typed as partial; fail loudly. */
const byKey = (key: string) => {
  const handClass = handClassByKey(key);
  if (handClass === undefined) throw new Error(`no hand class for key ${key}`);
  return handClass;
};

describe('handClassReading', () => {
  it('gives the spoken reading the build spec shows beside the key', () => {
    // §21's own example: "AKs · 에이스 킹 수티드".
    expect(handClassReading(byKey('AKs'))).toBe('에이스 킹 수티드');
    expect(handClassReading(byKey('AKo'))).toBe('에이스 킹 오프수트');
    expect(handClassReading(byKey('AA'))).toBe('포켓 에이스');
  });

  it('says the ten as 텐, never as the written "10" or "T"', () => {
    expect(handClassReading(byKey('TT'))).toBe('포켓 텐');
    expect(handClassReading(byKey('T9s'))).toBe('텐 나인 수티드');
  });

  it('reads every one of the 169 classes without falling through', () => {
    // A rank with no spoken form would surface as "undefined" inside the string rather
    // than throwing, so the check is on the content, not on the absence of an exception.
    for (const handClass of HAND_CLASSES) {
      const reading = handClassReading(handClass);
      expect(reading).not.toContain('undefined');
      expect(reading.trim()).not.toBe('');
    }
  });

  it('leaves the Latin key itself untouched — the reading is an addition (ADR-0053)', () => {
    const handClass = byKey('AQs');
    expect(handClass.key).toBe('AQs');
    expect(handClassReading(handClass)).not.toBe(handClass.key);
  });
});

describe('position gloss (ruling 65)', () => {
  it('glosses every position — a new seat cannot ship unexplained', () => {
    for (const position of STRATEGY_POSITIONS) {
      const gloss = POSITION_GLOSS[position];
      expect(gloss.trim()).not.toBe('');
      // The gloss is the Korean name, never a re-spelling of the abbreviation.
      expect(gloss).not.toBe(position);
      expect(gloss).toMatch(/[가-힣]/u);
    }
  });

  it('keeps the abbreviation in the accessible name rather than replacing it (ADR-0053)', () => {
    for (const position of STRATEGY_POSITIONS) {
      const name = positionAccessibleName(position);
      expect(name).toContain(POSITION_LABEL[position]);
      expect(name).toContain(POSITION_GLOSS[position]);
      // The whole point of the ruling: the name is never the bare abbreviation.
      expect(name).not.toBe(position);
    }
  });

  it("follows §48's own good pattern — Korean gloss, abbreviation in brackets", () => {
    expect(positionAccessibleName('UTG')).toBe('언더더건(UTG) 자리');
    expect(positionAccessibleName('BB')).toBe('빅 블라인드(BB) 자리');
  });

  it('states each legend entry as abbreviation then gloss', () => {
    for (const position of STRATEGY_POSITIONS) {
      expect(positionLegendEntry(position)).toBe(
        `${POSITION_LABEL[position]} ${POSITION_GLOSS[position]}`,
      );
    }
  });
});

describe('handClassAccessibleName', () => {
  it('announces the key first and then a Korean reading, for all 169 classes', () => {
    for (const handClass of HAND_CLASSES) {
      const name = handClassAccessibleName(handClass);
      expect(name.startsWith(`${handClass.key} `)).toBe(true);
      // Everything after the key is the spoken reading — Korean, never more notation.
      expect(name.slice(handClass.key.length + 1)).toMatch(/[가-힣]/u);
      expect(name).not.toContain('undefined');
    }
  });

  it('is the key plus its reading, not a replacement for the key (ADR-0053)', () => {
    expect(handClassAccessibleName(byKey('AKs'))).toBe('AKs 에이스 킹 수티드');
  });
});
