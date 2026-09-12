/**
 * The 레인지 퀴즈's real question bank (WP-L2). One `QuizQuestion` per hand class, for one
 * fixed `RangeQuery` — never a hand-typed list, never an authored answer key. Every answer
 * this module produces is `hasHandClass(resolution.range, handClass.index)`, read straight
 * off `resolveRange`'s real result, which is itself read straight off `strategy-core`'s
 * `RFI_RANGES` (CLAUDE.md rule 2).
 *
 * ## Following the WP-L1 generator contract exactly (`docs/reports/WP_L1_QUIZ_ENGINE.md` §6)
 *
 * 1. Build from the real domain call — `resolveRange`, once per `RangeQuery`, never per
 *    candidate.
 * 2. `generateRangeMembershipQuestion` returns `QuizQuestion | null`: `null` for the one case
 *    `resolveRange` cannot answer (`UNSUPPORTED`), a real question otherwise.
 * 3. `buildRangeQuestions` runs every candidate through `compactQuestions` before a session
 *    ever sees the array — an unsupported query (today, only `heroPosition: 'BB'` at
 *    `RFI`/100bb/6-max) produces zero questions, never a fabricated one.
 * 4. `excludeMixedQuestions` runs too, though it is a proven no-op today — see the module doc
 *    below on why this dataset can never actually produce a `'MIXED'` question.
 * 5. `RANGE_QUIZ_SEED` is a fixed literal, committed here, never `Date.now()`/`Math.random()`.
 *
 * ## Why this quiz can never produce a `'MIXED'` question (ruling 29)
 *
 * `RFI_RANGES`' values are `HandClassSet` (`packages/strategy-core/src/preflop/notation.ts`):
 * a `Uint8Array` of 169 entries, each exactly `0` or `1` — plain set membership, not a
 * per-class frequency. `hasHandClass` can only ever answer `true` or `false`. There is no
 * third state this dataset can express for a single hand class, so
 * `generateRangeMembershipQuestion` can only ever build `{ kind: 'SINGLE', ... }` —
 * `'MIXED'` is not a case this generator declines to model, it is a case the DATA cannot
 * produce. `rangeQuestions.test.ts` proves this over the real, full 169-class bank for every
 * shipped position, and `excludeMixedQuestions` is still run in the pipeline (step 4 above)
 * so the day a future stack depth or spot ships as weighted data instead of a bare set, this
 * generator's honesty does not silently regress — it would need to start building `'MIXED'`
 * questions instead of assuming they cannot occur, and the exclusion path is already wired
 * end to end and already tested by WP-L1's `engine.test.ts`.
 *
 * The hand-ranking quiz (WP-L3) is the one that actually exercises `'MIXED'` — a real board
 * that makes two hands chop. This module's job re: mixed frequency is to prove absence, not
 * presence.
 *
 * ## Explanation copy never becomes strategy advice (ruling 30's discipline, applied here)
 *
 * `explanationFor` states only membership — reusing `features/range/copy.ts`'s own fixed
 * `IN_RANGE_LABEL`/`OUT_OF_RANGE_LABEL` strings rather than composing a new claim — and
 * points at the 13x13 chart (`relatedTool: 'range'`) and the glossary's `term-range` entry
 * (`relatedConcept`). It never says a hand should be opened, is correct, or how often.
 */
import {
  HAND_CLASSES,
  hasHandClass,
  STRATEGY_POSITIONS,
  type HandClass,
  type StrategyPosition,
} from '@gto-self/strategy-core';
import {
  describeHandClassKorean,
  describeRangeConditions,
  handClassReading,
  IN_RANGE_LABEL,
  OUT_OF_RANGE_LABEL,
  POSITION_LABEL,
  RANGE_LABEL,
  resolveRange,
  type RangeQuery,
  type RangeResolution,
  type RangeSpot,
  type RangeStackDepth,
  type RangeTableSize,
} from '../range/index.js';
import { compactQuestions, excludeMixedQuestions } from './engine.js';
import type { QuizQuestion } from './types.js';

/** The one point in the whole `RangeQuery` space this quiz asks about. Every other spot,
 *  stack depth and table size is `docs/FISHTILT_STATE.md`'s "everything else" — 준비 중, not
 *  offered here at all (`RANGE_QUIZ_SUPPORTED_POSITIONS` below only ever varies the position
 *  axis). */
export const RANGE_QUIZ_SPOT: RangeSpot = 'RFI';
export const RANGE_QUIZ_STACK_DEPTH: RangeStackDepth = 100;
export const RANGE_QUIZ_TABLE_SIZE: RangeTableSize = 6;

/** Fixed in source, never `Date.now()`/`Math.random()` — the whole reproducibility
 *  guarantee (WP-L1 brief, `rng.ts`'s module doc) depends on this literal never changing. */
export const RANGE_QUIZ_SEED = 574_301;

/** "Ten questions by default" (build spec). */
export const RANGE_QUIZ_QUESTION_LIMIT = 10;

/** The full `RangeQuery` for one position, at this quiz's one fixed spot/stack/table size. */
export function rangeQuizQuery(heroPosition: StrategyPosition): RangeQuery {
  return {
    heroPosition,
    spot: RANGE_QUIZ_SPOT,
    stackDepth: RANGE_QUIZ_STACK_DEPTH,
    tableSize: RANGE_QUIZ_TABLE_SIZE,
  };
}

/**
 * Computed, never hand-typed: exactly the positions for which `resolveRange` actually
 * resolves to `'RANGE'` at this quiz's fixed spot/stack/table size. Today that is
 * `UTG`/`HJ`/`CO`/`BTN`/`SB` — `BB` is excluded because `resolveRange` reports
 * `BB_HAS_NO_RFI_RANGE`, a rule of the game, not a missing dataset (settled decision 2) — but
 * this list is never restated as a literal, so it can never drift from `resolve.ts`'s own
 * answer.
 */
export const RANGE_QUIZ_SUPPORTED_POSITIONS: readonly StrategyPosition[] =
  STRATEGY_POSITIONS.filter((position) => resolveRange(rangeQuizQuery(position)).kind === 'RANGE');

/** Total. Whether `query` is one this quiz can actually build questions for — the same
 *  truth `resolveRange` already computes, named here so a UI selector and a test can both
 *  ask the one question ("can I start?") without re-deriving `resolveRange`'s own logic. */
export function isSupportedRangeQuizQuery(query: RangeQuery): boolean {
  return resolveRange(query).kind === 'RANGE';
}

function explanationFor(query: RangeQuery, handClass: HandClass, included: boolean): string {
  const conditions = `${POSITION_LABEL[query.heroPosition]} · ${describeRangeConditions(query)}`;
  const membership = included ? IN_RANGE_LABEL : OUT_OF_RANGE_LABEL;
  return (
    `${handClass.key} (${handClassReading(handClass)}, ${describeHandClassKorean(handClass)})는 ` +
    `${conditions} 기준 ${RANGE_LABEL}에서 ${membership}. 13×13 표에서 전체 범위를 직접 확인해보세요.`
  );
}

/**
 * Total. `null` exactly when `resolution` is `'UNSUPPORTED'` — the WP-L1 generator contract
 * (§6, step 2). Never called with a fresh `resolveRange` per hand class; `buildRangeQuestions`
 * resolves the query once and reuses the same `resolution` for all 169 classes.
 */
export function generateRangeMembershipQuestion(
  resolution: RangeResolution,
  handClass: HandClass,
): QuizQuestion | null {
  if (resolution.kind === 'UNSUPPORTED') return null;

  const included = hasHandClass(resolution.range, handClass.index);
  const correctAnswerId = included ? 'INCLUDE' : 'EXCLUDE';

  return {
    id: `practiceRange:${resolution.query.heroPosition}:${resolution.query.spot}:${resolution.query.stackDepth}:${resolution.query.tableSize}:${handClass.key}`,
    type: 'RANGE_MEMBERSHIP',
    prompt: `${handClass.key} — 현재 범위에 포함될까요?`,
    visual: { kind: 'HAND_CLASS', key: handClass.key },
    answers: [
      { id: 'INCLUDE', label: '포함' },
      { id: 'EXCLUDE', label: '제외' },
    ],
    correctness: { kind: 'SINGLE', correctAnswerId },
    explanation: explanationFor(resolution.query, handClass, included),
    relatedTool: 'range',
    relatedConcept: 'term-range',
  };
}

/**
 * The whole question bank for one `RangeQuery`: one question per hand class (up to 169), run
 * through `compactQuestions` (drops the `UNSUPPORTED` case's `null`s — here, all-or-nothing,
 * since every hand class shares the same `resolveRange` call) and `excludeMixedQuestions`
 * (a proven no-op against this dataset — see the module doc). Hand to `<Quiz questions={...}
 * seed={RANGE_QUIZ_SEED} limit={RANGE_QUIZ_QUESTION_LIMIT} />`; `Quiz` does the seeded
 * shuffle and the 10-question cap itself.
 */
export function buildRangeQuestions(query: RangeQuery): readonly QuizQuestion[] {
  const resolution = resolveRange(query);
  const candidates = HAND_CLASSES.map((handClass) =>
    generateRangeMembershipQuestion(resolution, handClass),
  );
  return excludeMixedQuestions(compactQuestions(candidates));
}
