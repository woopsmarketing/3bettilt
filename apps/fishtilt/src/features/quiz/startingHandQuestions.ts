/**
 * Question bank for the 시작 핸드 퀴즈 (`/practice/starting-hand-quiz`, WP-L3).
 *
 * "강한지"는 `/tools/starting-hand`가 이미 쓰고 있는 지표와 정확히 같습니다: 상대가 무작위 아무
 * 두 장을 들고 있다고 가정하고 프리플랍에서 올인해 끝까지 갔을 때 팟에서 가져갈 것으로 기대되는
 * 몫(비기는 경우는 절반) —
 * `@gto-self/learn-core`의 `HAND_STRENGTH` 데이터셋 (`HAND_STRENGTH_RANK_BASIS`,
 * `packages/learn-core/src/strength/model.ts`). 이 파일은 "강도"에 대한 두 번째 정의를 만들지
 * 않습니다: 모든 숫자와 모든 승자는 생성 시점에 `handStrengthForKey`/`handStrengthTied`에서
 * 읽어오며, 어디에도 타이핑되지 않습니다 (CLAUDE.md rule 2).
 *
 * ## Ties
 *
 * The shipped dataset's `exactTies` is empty today — it is an EXACT enumeration and no two
 * of the 169 classes happen to be bit-identical (`docs/reports/WP_L1_QUIZ_ENGINE.md` §9's
 * own "known limitation" says the same thing). So no pairing built from live data below is
 * ever actually a tie. The generator still calls `handStrengthTied` on every pairing and
 * would emit a `MIXED` question if a future regeneration ever produced one — ruling 29
 * requires this branch to exist, not to be exercised by data that does not currently contain
 * it. `startingHandQuestions.test.ts` proves the branch itself with a locally constructed
 * `HandStrengthEntry`-shaped fixture (two equal `equity` values), per
 * `docs/FISHTILT_STATE.md` ruling 26 — never by mining live data for an untied pair that
 * merely looks close.
 *
 * ## This is a strength comparison, not advice
 *
 * The explanation states each hand's value on the metric and, in one clause, what the
 * metric means — never that a hand should be played, raised, folded or is "worth" playing.
 * `startingHandQuestions.test.ts` also asserts the explanation copy contains no such verb.
 */
import { handClassByKey } from '@gto-self/strategy-core';
import { handStrengthForKey, handStrengthTied, type HandStrengthEntry } from '@gto-self/learn-core';
import { handClassReading } from '../range/index.js';
import { equityLabel, STRENGTH_METRIC_LABEL } from '../strength/index.js';
import { compactQuestions } from './engine.js';
import type { QuizQuestion } from './types.js';

/** Fixed so the quiz is reproducible on every machine, forever — see `rng.ts`'s module doc.
 *  Never `Date.now()`/`Math.random()`. */
export const STARTING_HAND_QUIZ_SEED = 20260906;

/** The content id of the lesson this quiz links back to. */
const STARTING_HAND_LESSON_ID = 'starting-hand-ranking';

/** The `/tools/starting-hand` route id — the same dataset, shown in full. */
const STARTING_HAND_TOOL_ID = 'toolStartingHand';

/**
 * One clause naming what the metric means, so "더 강하다" is never a bare claim. Not a
 * second definition of the metric — the SAME basis `features/strength/copy.ts`'s
 * `METHODOLOGY_SENTENCE` states at paragraph length; this is the one-clause version this
 * quiz's shorter explanation needs, and both ultimately name the same
 * `HAND_STRENGTH_RANK_BASIS` ('HEADS_UP_ALLIN_EQUITY_VS_RANDOM_HAND').
 *
 * It says 몫, not 이기는 비율: `HandStrengthEntry.equity` is hero's expected share of the pot
 * with ties split (`packages/learn-core/src/strength/model.ts`), and the two quantities differ
 * by more than the two decimals `equityLabel` prints.
 */
const METRIC_CLAUSE =
  '상대가 무작위 아무 두 장을 들고 있다고 가정하고 프리플랍에서 올인해 끝까지 갔을 때 팟에서 가져갈 것으로 기대되는 몫, 비기는 경우는 절반';

/**
 * Eleven curated class-key pairs. Every pairing is resolved through `handStrengthForKey` at
 * generation time — nothing here asserts which one is stronger. `A2o`/`76s` is drawn
 * directly from `packages/learn-core/src/strength/model.ts`'s own module doc ("`76s` beats a
 * random hand less often than `A2o` does") — the illustrative case for why this ranking is
 * not playability, stated as a real number comparison rather than repeated as prose.
 */
const KEY_PAIRS: readonly (readonly [string, string])[] = [
  ['AA', '72o'],
  ['KK', 'AKo'],
  ['AKs', 'AKo'],
  ['A2o', '76s'],
  ['QQ', 'JJ'],
  ['AKo', 'QQ'],
  ['32o', '72o'],
  ['JTs', 'JTo'],
  ['22', 'K2o'],
  ['87s', 'T5o'],
  ['AJo', 'KQo'],
];

/** `'AKs'` -> `"AKs (에이스 킹 수티드)"`. Falls back to the bare key for an unknown one
 *  (unreachable for the curated pairs above, but `handClassByKey` is still a lookup, not an
 *  assumption). */
function keyLabel(key: string): string {
  const handClass = handClassByKey(key);
  return handClass === undefined ? key : `${key} (${handClassReading(handClass)})`;
}

/**
 * Total. Builds the shared "here is the number" clause both branches of the explanation
 * need, so the tied and non-tied sentences cannot silently disagree on which two numbers
 * they are talking about.
 */
function valuesSentence(a: HandStrengthEntry, b: HandStrengthEntry): string {
  return `${STRENGTH_METRIC_LABEL}(${METRIC_CLAUSE})로 비교하면 ${keyLabel(a.key)}는 ${equityLabel(a)}, ${keyLabel(b.key)}는 ${equityLabel(b)}입니다.`;
}

function explanationFor(a: HandStrengthEntry, b: HandStrengthEntry, tied: boolean): string {
  const shared = valuesSentence(a, b);
  if (tied) {
    return `${shared} 두 핸드의 값이 완전히 같아서 어느 쪽이 더 강하다고 말할 수 없는 동률입니다.`;
  }
  const strongerLabel = a.equity > b.equity ? 'A' : 'B';
  return `${shared} 핸드 ${strongerLabel}의 값이 더 높아서 핸드 ${strongerLabel}가 더 강합니다.`;
}

/**
 * Builds one question from two ALREADY-RESOLVED entries. This is the one place the question
 * shape is assembled — `buildQuestion` (real class keys) and
 * `buildStartingHandQuestionFromEntries` (the test's locally constructed tie fixture, ruling
 * 26) both delegate here rather than each assembling their own copy of the same object.
 */
function questionFromEntries(entryA: HandStrengthEntry, entryB: HandStrengthEntry): QuizQuestion {
  const tied = handStrengthTied(entryA, entryB);
  return {
    id: `starting-hand-${entryA.key}-vs-${entryB.key}`,
    type: 'STARTING_HAND_STRENGTH',
    prompt: '어느 쪽이 더 강할까요?',
    answers: [
      { id: 'A', label: entryA.key, visual: { kind: 'HAND_CLASS', key: entryA.key } },
      { id: 'B', label: entryB.key, visual: { kind: 'HAND_CLASS', key: entryB.key } },
      { id: 'TIE', label: '동률' },
    ],
    correctness: tied
      ? { kind: 'MIXED', correctAnswerIds: ['TIE'] }
      : { kind: 'SINGLE', correctAnswerId: entryA.equity > entryB.equity ? 'A' : 'B' },
    explanation: explanationFor(entryA, entryB, tied),
    relatedConcept: STARTING_HAND_LESSON_ID,
    relatedTool: STARTING_HAND_TOOL_ID,
  };
}

/**
 * `QuizQuestion | null` per the generator contract (`docs/reports/WP_L1_QUIZ_ENGINE.md` §6):
 * `null` only for a class key `handStrengthForKey` cannot resolve — unreachable for the
 * curated pairs above (proven by `startingHandQuestions.test.ts`), but the seam stays real
 * rather than assumed, exactly like `resolveRange`'s `UNSUPPORTED` in the range quiz.
 */
function buildQuestion(keyA: string, keyB: string): QuizQuestion | null {
  const resultA = handStrengthForKey(keyA);
  const resultB = handStrengthForKey(keyB);
  if (!resultA.ok || !resultB.ok) return null;
  return questionFromEntries(resultA.value, resultB.value);
}

/**
 * The 시작 핸드 퀴즈's whole question bank, built from the curated pairs above. Run through
 * `compactQuestions` per the generator contract, even though no pairing above is expected to
 * be dropped — an unknown class key is a fixture bug, and `startingHandQuestions.test.ts`
 * checks the bank's length rather than trusting that silently.
 */
export const STARTING_HAND_QUESTIONS: readonly QuizQuestion[] = compactQuestions(
  KEY_PAIRS.map(([keyA, keyB]) => buildQuestion(keyA, keyB)),
);

/**
 * Exported for `startingHandQuestions.test.ts` only: lets the test build a `MIXED` question
 * from a locally constructed tie (ruling 26 — two `HandStrengthEntry`-shaped fixtures with
 * equal `equity`, since the shipped dataset's `exactTies` is empty today) through the SAME
 * assembly path production questions go through, rather than duplicating it in the test.
 */
export function buildStartingHandQuestionFromEntries(
  entryA: HandStrengthEntry,
  entryB: HandStrengthEntry,
): QuizQuestion {
  return questionFromEntries(entryA, entryB);
}
