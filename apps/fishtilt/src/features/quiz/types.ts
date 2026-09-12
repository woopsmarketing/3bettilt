/**
 * `features/quiz` — the reusable quiz engine three later work packages build the range
 * quiz, hand-ranking quiz and starting-hand quiz on top of (WP-L2/L3). Pure, React-free,
 * deterministic: nothing in this folder renders anything or calls `Math.random`.
 *
 * ## Where a question's DATA comes from is not this module's job
 *
 * This file only shapes a question that has already been decided. `resolveRange`,
 * `evaluateHand`/`compareHands` and `handStrengthOf`/`handStrengthTied` are the only places
 * a poker fact is allowed to originate (CLAUDE.md rule 2) — a `QuizQuestion` is the OUTPUT
 * of a generator that reads one of those, never a place a number is typed by hand. See
 * `engine.ts`'s module doc for `compactQuestions`, the seam that keeps an `UNSUPPORTED`
 * range query from ever becoming a fabricated question.
 *
 * ## Why `correctness` is not just one `correctAnswerId`
 *
 * Two of the three real quizzes can hit a genuinely non-binary outcome that this engine
 * must not flatten into a single invented winner:
 *
 *   - the hand-ranking quiz's two hands can literally split the pot — `compareHands`
 *     returns `0`, not `-1`/`1` — and forcing an answer to be "hand A" or "hand B" would
 *     assert a winner the rules of the game do not produce;
 *   - the starting-hand quiz's ranking is EXACT, but the dataset's own `exactTies` exists
 *     precisely because a future regeneration could produce a real tie, and `handStrengthTied`
 *     is how a generator finds out.
 *
 * `QuizCorrectness`'s `'MIXED'` branch is for exactly this: the honest answer is its own
 * answer option (a `'TIE'`-shaped `QuizAnswerOption`, typically), not a coin flip between the
 * two "normal" options. A generator that would rather not ask about a tie at all can drop
 * the question instead — `engine.ts`'s `excludeMixedQuestions` does that in one call — but
 * the engine itself always supports representing one honestly.
 *
 * ## `relatedTool`/`relatedConcept` are IDs, never resolved here
 *
 * `relatedTool` is a route id from `src/lib/routes.ts`; `relatedConcept` is a content id from
 * `src/content/`. Resolving either into an `href` (`toolHref`/`hrefOfContent`, both already
 * honest about a `PLANNED`/unavailable destination) is a UI concern — `components/
 * QuizRelatedLinks.tsx` does it — so this module never has to import the content graph or
 * the route registry, and stays usable from a plain unit test with no app-level fixtures.
 */

/** How a question's prompt (or an individual answer option) is illustrated. Both variants
 *  map straight onto `PokerCardsProps`'s two ways of asking for cards, so a component never
 *  has to invent a second way to turn a string into cards. */
export type QuizVisual =
  | { readonly kind: 'HAND_CLASS'; readonly key: string }
  | { readonly kind: 'CARDS'; readonly notation: string };

export interface QuizAnswerOption {
  /** Stable within the question, e.g. `'INCLUDE'`/`'EXCLUDE'`, `'A'`/`'B'`/`'TIE'`. Never
   *  reused for a different meaning across questions of the same `type`, since a caller may
   *  reasonably branch on it (e.g. always rendering the `'TIE'` id with its own icon). */
  readonly id: string;
  readonly label: string;
  readonly visual?: QuizVisual;
}

/**
 * `'SINGLE'` — the ordinary case, exactly one answer id is correct.
 *
 * `'MIXED'` — the honest answer is not a clean pick between the "normal" options. Scored
 * exactly the same way as `'SINGLE'` (`isAnswerCorrect` does not branch on `kind`), so a
 * `'MIXED'` question is never scored more leniently or excluded by the engine on its own —
 * it is simply a question whose correct answer(s) assert "this is genuinely mixed" rather
 * than crowning a winner. `correctAnswerIds` is a list (not one id) so a generator that
 * wants to accept more than one option as honest (rather than adding a dedicated third
 * option) can.
 */
export type QuizCorrectness =
  | { readonly kind: 'SINGLE'; readonly correctAnswerId: string }
  | { readonly kind: 'MIXED'; readonly correctAnswerIds: readonly string[] };

export interface QuizQuestion {
  /** Unique within the question bank it is drawn from. */
  readonly id: string;
  /** A free-form tag the concrete quiz assigns for its own filtering/analytics, e.g.
   *  `'RANGE_MEMBERSHIP'`. The engine never branches on it — see the module doc. */
  readonly type: string;
  readonly prompt: string;
  readonly visual?: QuizVisual;
  /** At least two options (`createQuizSession` throws otherwise). */
  readonly answers: readonly QuizAnswerOption[];
  readonly correctness: QuizCorrectness;
  /** Shown after answering, whether right or wrong or mixed. Required — a quiz that only
   *  says "wrong" teaches nothing (WP-L1 brief). */
  readonly explanation: string;
  /** A route id from `src/lib/routes.ts`, resolved by the UI layer only. */
  readonly relatedTool?: string;
  /** A content id from `src/content/`, resolved by the UI layer only. */
  readonly relatedConcept?: string;
}

/** One question's outcome once the reader has picked an answer. */
export interface AnsweredQuestion {
  readonly question: QuizQuestion;
  readonly answerId: string;
  readonly isCorrect: boolean;
}

/**
 * The whole state of one attempt at a set of questions. Immutable — every engine function
 * that changes it returns a new `QuizSession` rather than mutating this one, so a UI layer
 * can hold it in `useState` and rely on referential identity for re-renders.
 */
export interface QuizSession {
  /** The seed `questions` was shuffled with. Carried on the session (not just consumed at
   *  construction) so a caller can display it, log it, or rebuild the exact same session
   *  later — reproducibility is the whole point of taking a seed at all. */
  readonly seed: number;
  /** The presented order, fixed for the life of this session. */
  readonly questions: readonly QuizQuestion[];
  /** Keyed by `QuizQuestion.id`. */
  readonly answered: ReadonlyMap<string, AnsweredQuestion>;
}

export interface QuizScore {
  readonly totalQuestions: number;
  readonly answeredCount: number;
  readonly correctCount: number;
  readonly incorrectCount: number;
}
