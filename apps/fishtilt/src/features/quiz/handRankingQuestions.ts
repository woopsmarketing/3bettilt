/**
 * Question bank for the 족보 퀴즈 (`/practice/hand-ranking-quiz`, WP-L3).
 *
 * Every fixture below is a hand-authored pair of concrete card sets — "a deck you control"
 * per the WP brief. The WINNER is never asserted here: `buildQuestion` calls
 * `evaluateHand`/`compareHands` from `@gto-self/strategy-core` at question-generation time
 * and reads the category, the deciding rank slot and the comparison result straight off
 * that output (CLAUDE.md rule 2). Card notation is parsed by `@gto-self/shared`'s
 * `parseCards`, the same parser `PokerCards`/`HandChecker` already use, so a malformed or
 * duplicated card in a fixture throws at import time rather than silently producing a wrong
 * question (CLAUDE.md rule 5) — `unwrap` is exactly that "throw, don't guess" seam.
 *
 * ## Ties are a genuine third answer, not an excluded edge case
 *
 * Every question offers `'무승부'` alongside the two hands. `compareHands` returning `0` (a
 * real chop) is modelled as `correctness: { kind: 'MIXED', correctAnswerIds: ['TIE'] }` —
 * never resolved into a fabricated winner — exactly the seam `features/quiz/types.ts`
 * documents and `engine.test.ts`'s own royal-flush-board fixture already proves for this
 * engine. Two fixtures below (`tie-straight-different-suits`, `board-plays-tie`) are
 * constructed so `compareHands` genuinely returns `0`, so the quiz actually exercises that
 * branch rather than only offering the option in principle.
 *
 * `board-plays-tie` is also this quiz's answer to the "board plays" trap: both hands are 7
 * cards (2 "hole" + the same 5 "board" cards), and neither hole pair improves on the board's
 * own made hand — so both evaluate to the identical straight and the pot chops. That is a
 * fact about the specific cards chosen, not a rule invented here; `handRankingQuestions.test.ts`
 * proves it by calling the same evaluator the question itself is built from.
 *
 * ## Which slot decided it
 *
 * `evaluateHand`'s `HandValue.ranks` is already ordered most-significant-first per category
 * (`CATEGORY_RANK_SLOTS` in `strategy-core`'s `evaluate.ts`) — slot 0 is always the
 * category-defining rank (the pair's rank, the trips' rank, the straight's top card, ...)
 * and every slot after it is a kicker in descending importance. `firstDifferingSlotIndex`
 * below just walks that array and reports which slot differs first; `SLOT_LABEL` names slot
 * 0 and the kicker slots in Korean for each category. Nothing here decides which slot
 * matters more than another — that ordering came out of the evaluator, not this file.
 */
import { cardsToString, parseCards, unwrap, type Card } from '@gto-self/shared';
import {
  compareHands,
  evaluateHand,
  type HandCategory,
  type HandValue,
} from '@gto-self/strategy-core';
import { HAND_CATEGORY_LABEL, handReading } from '../tools/handRank.js';
import type { QuizQuestion } from './types.js';

/** Fixed so the quiz is reproducible on every machine, forever — see `rng.ts`'s module doc.
 *  Never `Date.now()`/`Math.random()`. */
export const HAND_RANKING_QUIZ_SEED = 20260905;

/** The content id of the lesson this quiz links back to (`docs/FISHTILT_STATE.md` ruling
 *  11 — the id stays `hand-rankings`, only the URL slug changed). Resolved through
 *  `QuizRelatedLinks`/`hrefOfContent`, never typed as a path here. */
const HAND_RANKINGS_LESSON_ID = 'hand-rankings';

interface HandRankingFixture {
  readonly id: string;
  /** The cards actually evaluated for this side (5, 6 or 7 — `evaluateHand`'s own range).
   *  Parsed by `@gto-self/shared`'s `parseCards`. */
  readonly notationA: string;
  readonly notationB: string;
  /** An optional teaching addendum appended after the auto-generated comparison sentence.
   *  Used only where the interesting fact is not something a bare rank-slot comparison can
   *  say on its own (why the two 7-card hands above tie, specifically). Never overrides or
   *  contradicts the auto-generated sentence — it only adds color the evaluator's own
   *  output cannot phrase by itself. */
  readonly note?: string;
}

/**
 * Twelve curated pairs: the ranking traps a beginner actually gets wrong (build spec), plus
 * two genuine ties. Every hand below was hand-checked against `evaluateHand` while writing
 * this file (see `handRankingQuestions.test.ts`'s known-answer tests) — no accidental flush,
 * straight or pair sneaks into a fixture meant to be "just" a high card.
 */
const FIXTURES: readonly HandRankingFixture[] = [
  // Flush beats straight, however low the flush's top card looks next to the straight's.
  { id: 'flush-vs-straight', notationA: 'Ks 9s 7s 4s 2s', notationB: 'Th 9d 8c 7d 6h' },

  // Two big pairs still lose to a small trips — trips outranks two pair regardless of rank.
  { id: 'two-pair-vs-trips', notationA: 'Ks Kd 8c 8h 3s', notationB: '9d 9c 9s Qh Jd' },

  // Trips "looks" strong (three of the same card) but any straight beats it.
  { id: 'straight-vs-trips', notationA: '9s 9h 9d Kc 4d', notationB: '4s 5d 6c 7h 8d' },

  // Same pair (aces both sides), decided by the first kicker.
  { id: 'pair-kicker', notationA: 'As Ad Kc 8h 3s', notationB: 'Ah Ac Qd 8s 3d' },

  // Same two pair (kings and eights both sides), decided by the kicker.
  { id: 'two-pair-kicker', notationA: 'Ks Kd 8c 8h Qs', notationB: 'Kh Kc 8d 8s Js' },

  // The wheel (A-2-3-4-5) is the LOWEST straight — the ace plays low here, not high.
  {
    id: 'wheel-vs-six-high',
    notationA: 'As 2d 3c 4h 5s',
    notationB: '6d 5h 4c 3d 2h',
    note: '에이스가 들어 있다고 항상 가장 높은 스트레이트가 되는 것은 아닙니다. A-2-3-4-5는 에이스가 가장 낮은 숫자로 쓰이는 예외입니다.',
  },

  // Full houses compare by the TRIPS rank first, even against a numerically higher pair.
  { id: 'full-house-trips-rank', notationA: '8s 8h 8d Ks Kd', notationB: '6c 6d 6h As Ad' },

  // Even quads lose to a straight flush.
  { id: 'straight-flush-vs-quads', notationA: '9s 8s 7s 6s 5s', notationB: 'Ks Kd Kh Kc 2d' },

  // Quads beat a full house outright, regardless of rank.
  { id: 'quads-vs-full-house', notationA: '9s 9h 9d 9c Kc', notationB: 'Ks Kd Kh As Ad' },

  // High card is decided all the way down to the last (fifth) kicker.
  { id: 'high-card-kicker-chain', notationA: 'As Kd 8c 4h 2s', notationB: 'Ah Kc 8d 4s 3h' },

  // Flush vs flush: the top card decides, the same as a plain high-card comparison would.
  { id: 'flush-kicker', notationA: 'Qh 9h 7h 4h 2h', notationB: 'Jd 9d 7d 4d 2d' },

  // A genuine chop: two different broadway straights, same top rank, nothing left to break it.
  { id: 'tie-straight-different-suits', notationA: 'As Kd Qh Jc Ts', notationB: 'Ah Kc Qd Js Th' },

  // "The board plays": both players' best five cards ARE the shared board (a 9-high
  // straight); the two "hole" cards on each side never mattered, so it is a real chop.
  {
    id: 'board-plays-tie',
    notationA: '2h 3d 9s 8d 7h 6c 5s',
    notationB: 'Kh Qd 9s 8d 7h 6c 5s',
    note: '두 핸드 모두 마지막 다섯 장(9-8-7-6-5, 스트레이트)이 이미 완성된 최고의 패라서, 각자 고른 나머지 두 장은 승부에 전혀 영향을 주지 않습니다. 흔히 "보드가 플레이한다"고 부르는 상황입니다.',
  },
];

/** Slot 0 is always the category-defining rank; every slot after it is a kicker, in
 *  descending importance — see the module doc. Written down once per category so the
 *  explanation can name whichever slot actually differed, never a slot it merely guesses at. */
const SLOT_LABEL: Readonly<Record<HandCategory, readonly string[]>> = {
  HIGH_CARD: [
    '가장 높은 카드',
    '두 번째로 높은 카드',
    '세 번째로 높은 카드',
    '네 번째로 높은 카드',
    '다섯 번째로 높은 카드',
  ],
  PAIR: ['페어 숫자', '첫 번째 키커', '두 번째 키커', '세 번째 키커'],
  TWO_PAIR: ['높은 페어 숫자', '낮은 페어 숫자', '키커'],
  TRIPS: ['트리플 숫자', '첫 번째 키커', '두 번째 키커'],
  STRAIGHT: ['가장 높은 카드'],
  FLUSH: [
    '가장 높은 카드',
    '두 번째로 높은 카드',
    '세 번째로 높은 카드',
    '네 번째로 높은 카드',
    '다섯 번째로 높은 카드',
  ],
  FULL_HOUSE: ['트리플 숫자', '페어 숫자'],
  QUADS: ['포카드 숫자', '키커'],
  STRAIGHT_FLUSH: ['가장 높은 카드'],
};

/**
 * True when the last Hangul syllable of `text` has a 받침 (final consonant) — the same
 * technique `features/tools/handRank.ts`'s private `hasBatchim` uses, duplicated here for
 * the same reason (that module does not export it). Every hand-category label used below
 * ends without a batchim EXCEPT `트리플`, so this decides only the 이/가 particle after a
 * category name.
 */
function hasBatchim(text: string): boolean {
  const HANGUL_BASE = 0xac00;
  const HANGUL_LAST = 0xd7a3;
  const FINAL_CONSONANT_COUNT = 28;
  const last = text.codePointAt(text.length - 1);
  if (last === undefined || last < HANGUL_BASE || last > HANGUL_LAST) return false;
  return (last - HANGUL_BASE) % FINAL_CONSONANT_COUNT !== 0;
}

function josaIGa(word: string): '이' | '가' {
  return hasBatchim(word) ? '이' : '가';
}

/** Total. The first rank slot at which `a` and `b` disagree, or `-1` when every populated
 *  slot is identical (a genuine tie — only reachable when `a.category === b.category`,
 *  since a different category always packs a different value into the same bits). */
function firstDifferingSlotIndex(a: HandValue, b: HandValue): number {
  const length = Math.max(a.ranks.length, b.ranks.length);
  for (let index = 0; index < length; index += 1) {
    if (a.ranks[index] !== b.ranks[index]) return index;
  }
  return -1;
}

type Outcome = 'A' | 'B' | 'TIE';

function explanationFor(
  a: HandValue,
  b: HandValue,
  outcome: Outcome,
  note: string | undefined,
): string {
  const catA = HAND_CATEGORY_LABEL[a.category];
  const catB = HAND_CATEGORY_LABEL[b.category];
  const readingA = handReading(a);
  const readingB = handReading(b);
  const suffix = note !== undefined ? ` ${note}` : '';

  if (outcome === 'TIE') {
    return `핸드 A는 ${readingA}(${catA}), 핸드 B는 ${readingB}(${catB})입니다. 두 핸드의 강도를 가르는 차이가 전혀 없어서 무승부(팟 분할)입니다.${suffix}`;
  }

  const winnerLabel = outcome;
  if (a.category !== b.category) {
    const winnerCat = outcome === 'A' ? catA : catB;
    const loserCat = outcome === 'A' ? catB : catA;
    return `핸드 A는 ${readingA}(${catA}), 핸드 B는 ${readingB}(${catB})입니다. ${winnerCat}${josaIGa(winnerCat)} ${loserCat}보다 더 강한 족보라서 핸드 ${winnerLabel}가 이겼습니다.${suffix}`;
  }

  const slotIndex = firstDifferingSlotIndex(a, b);
  const slotLabel = SLOT_LABEL[a.category][slotIndex] ?? '순위를 가르는 카드';
  return `핸드 A는 ${readingA}, 핸드 B는 ${readingB}입니다. 둘 다 ${catA}이지만, ${slotLabel}가 더 높아서 핸드 ${winnerLabel}가 이겼습니다.${suffix}`;
}

function buildQuestion(fixture: HandRankingFixture): QuizQuestion {
  const cardsA: readonly Card[] = unwrap(parseCards(fixture.notationA));
  const cardsB: readonly Card[] = unwrap(parseCards(fixture.notationB));
  const valueA = evaluateHand(cardsA);
  const valueB = evaluateHand(cardsB);
  const cmp = compareHands(valueA.strength, valueB.strength);
  const outcome: Outcome = cmp === 1 ? 'A' : cmp === -1 ? 'B' : 'TIE';

  return {
    id: fixture.id,
    type: 'HAND_RANKING',
    prompt: '어느 쪽이 이길까요?',
    answers: [
      { id: 'A', label: '핸드 A', visual: { kind: 'CARDS', notation: cardsToString(cardsA) } },
      { id: 'B', label: '핸드 B', visual: { kind: 'CARDS', notation: cardsToString(cardsB) } },
      { id: 'TIE', label: '무승부' },
    ],
    correctness:
      outcome === 'TIE'
        ? { kind: 'MIXED', correctAnswerIds: ['TIE'] }
        : { kind: 'SINGLE', correctAnswerId: outcome },
    explanation: explanationFor(valueA, valueB, outcome, fixture.note),
    relatedConcept: HAND_RANKINGS_LESSON_ID,
  };
}

/**
 * The 족보 퀴즈's whole question bank. Every fixture always evaluates (there is no
 * `UNSUPPORTED` path here — the "deck" is fixed literals this file controls, not a user or
 * database query), so unlike `startingHandQuestions.ts` there is nothing for
 * `compactQuestions` to drop; `buildQuestion` is total over `FIXTURES` and a malformed
 * literal would throw at import time instead (CLAUDE.md rule 5), which is exactly what a
 * fixture bug should do rather than silently vanish from the bank.
 */
export const HAND_RANKING_QUESTIONS: readonly QuizQuestion[] = FIXTURES.map(buildQuestion);
