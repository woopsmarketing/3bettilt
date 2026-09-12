# WP-L1 — Quiz engine + `/practice` hub

## 1. Scope

Built: the reusable quiz engine (`features/quiz/`), its UI layer (`components/Quiz*.tsx`),
the `/practice` hub page, and an e2e spec (written, not run). Flipped `routes.ts`'s
`practice` entry to `available: true` as the one permitted targeted edit. Did not touch
`src/content/**` and did not build the three quiz routes themselves (WP-L2/L3).

## 2. Files changed

| File | What |
| --- | --- |
| `src/features/quiz/types.ts` | Question/session/score model |
| `src/features/quiz/rng.ts` (+ test) | Seeded PRNG + deterministic shuffle |
| `src/features/quiz/engine.ts` (+ test) | Session, scoring, retry-wrong-only, mixed/UNSUPPORTED seams |
| `src/features/quiz/hub.ts` (+ test) | `/practice`'s 3 planned-quiz cards, resolved against `ROUTES` |
| `src/features/quiz/index.ts` | Barrel |
| `src/components/QuizVisual.tsx` (+ test) | `QuizVisual` → real cards via `PokerCards` |
| `src/components/QuizRelatedLinks.tsx` (+ test) | `relatedTool`/`relatedConcept` → `ToolCTA` / content link |
| `src/components/QuizQuestionCard.tsx` (+ test) | One question: prompt, visual, answers, feedback |
| `src/components/QuizResult.tsx` (+ test) | Score, missed items, `틀린 패 다시 풀기`, restart |
| `src/components/Quiz.tsx` (+ test) | Orchestrator: session state, current question, result |
| `src/app/practice/page.tsx` (+ test) | The hub — 3 cards, all `준비 중` today |
| `tests/e2e/practice.spec.ts` | Written, **not run** (orchestrator's gate) |
| `src/lib/routes.ts` | **One line**: `practice.available` `false` → `true` |
| `docs/reports/WP_L1_QUIZ_ENGINE.md` | This report |

## 3. Decisions

**MiniQuiz: left untouched, not absorbed, not wrapped.** Different job, not a smaller
version of the same job. `MiniQuiz` is an in-prose comprehension check with no state beyond
the page, no scoring, no retry, always-visible questions, 2-3 fixed items authored by hand
per lesson. This engine is a standalone, scored, retryable, cross-linked practice surface
drawing from a larger reproducibly-shuffled question bank, one question at a time, with a
non-binary (`MIXED`) correctness state `MiniQuizQuestion` has no room for. Forcing either
model into the other would either bloat `MiniQuiz` past its one job or strip this engine's
required features (scoring, retry-wrong-only, seeding, mixed correctness) to fit
`MiniQuizQuestion`'s shape. `MiniQuiz.tsx` and its 8 passing tests are unmodified.

**Seeding scheme.** `rng.ts`'s `createSeededRng` is a `mulberry32` PRNG (32-bit state, no
dependency). `shuffleWithSeed(items, seed)` is a deterministic Fisher-Yates over it.
`createQuizSession(questions, seed, limit?)` shuffles the whole bank with `seed`, then takes
the first `limit` (or all). Same `(questions, seed)` → byte-identical presented order,
forever, on every machine — proven by `rng.test.ts` and `engine.test.ts`'s reproducibility
tests. `retryWrongOnly` reuses `session.seed` to reshuffle just the missed subset, so a
retry is reproducible too.

**Practice-hub cards are NOT a `ROUTES` filter, unlike `/tools`.** `toolHubEntries` can
filter `ROUTES` because every tool it lists already has a registry entry. None of the three
quizzes do — `routes.ts` is edited by single-line targeted change only, one per WP, and
adding three placeholder entries is not this WP's targeted edit. So `features/quiz/hub.ts`
hand-writes the three planned entries and resolves each against `ROUTES` by `id` with
`Array#find` (never `routeById`, which throws on an unknown id). A quiz with no registry
entry renders identically to one whose entry says `available: false`. When WP-L2/L3 each
add their own single-line `routes.ts` entry and flip it, the hub turns that card into a live
link with **zero edits to any file this WP wrote** — same "flip the flag, not the page"
guarantee `ToolCTA` already relies on.

**Answering is one-shot, enforced by the UI, not the engine.** `answerQuestion` will happily
overwrite an existing answer (documented in its own comment); `QuizQuestionCard` disables
the buttons once answered. Kept the engine permissive on purpose — it is one fewer invariant
to prove, and no shipped UI needs to change an answer after seeing feedback.

**Current-question index is component state, not session state.** The engine only tracks
which questions are answered, not which one is on screen. After answering, the reader stays
on that question reading feedback until "다음 문제". That is a UI concern the pure session
type has no use for.

## 4. The question model

```ts
export type QuizVisual =
  | { readonly kind: 'HAND_CLASS'; readonly key: string }   // -> <PokerCards hand={key} />
  | { readonly kind: 'CARDS'; readonly notation: string };  // -> <PokerCards cards={notation} />

export interface QuizAnswerOption {
  readonly id: string;              // stable within the question, e.g. 'INCLUDE' / 'A' / 'TIE'
  readonly label: string;
  readonly visual?: QuizVisual;     // e.g. each hand-comparison option shows its own hand
}

export type QuizCorrectness =
  | { readonly kind: 'SINGLE'; readonly correctAnswerId: string }
  | { readonly kind: 'MIXED'; readonly correctAnswerIds: readonly string[] };

export interface QuizQuestion {
  readonly id: string;
  readonly type: string;            // free-form tag, e.g. 'RANGE_MEMBERSHIP' — engine never branches on it
  readonly prompt: string;
  readonly visual?: QuizVisual;
  readonly answers: readonly QuizAnswerOption[];   // >= 2, enforced at session creation
  readonly correctness: QuizCorrectness;
  readonly explanation: string;     // required
  readonly relatedTool?: string;    // a routes.ts id, resolved by the UI only
  readonly relatedConcept?: string; // a content id, resolved by the UI only
}
```

`QuizSession = { seed, questions, answered: ReadonlyMap<questionId, AnsweredQuestion> }`,
immutable — every engine function returns a new session.

## 5. Mixed frequency and `UNSUPPORTED`

| Case | Handling |
| --- | --- |
| A hand comparison / strength comparison is a real tie (`compareHands` returns `0`, or a future `handStrengthTied` pair) | Modelled as `correctness: { kind: 'MIXED', correctAnswerIds: [...] }`, typically pointing at a dedicated `'TIE'` answer option. Scored identically to `SINGLE` (`isAnswerCorrect` doesn't branch on `kind`) — "scored accordingly," never a fabricated winner. |
| A generator prefers not to ask about ties at all | `excludeMixedQuestions(questions)` drops every `MIXED` question, order-preserving — the "or be excluded" half of the brief. |
| `resolveRange` (or any other honest facade) returns `UNSUPPORTED` for a query | The generator contract is `QuizQuestion \| null`; `compactQuestions(candidates)` drops `null`/`undefined`, order-preserving, before the array reaches `createQuizSession`. Never a placeholder question. |

Proven in `engine.test.ts` with real domain calls, not literals: a board that is itself a
royal flush (`As Ks Qs Js Ts`) makes any two hole-card hands chop — `evaluateStrength` +
`compareHands` from `strategy-core` confirm the tie before the fixture is built, so a future
evaluator change that breaks the assumption fails the test loudly instead of silently
asserting a stale fact. The `UNSUPPORTED` case is proven against a real `resolveRange` call
(`{ spot: 'FACING_OPEN', ... }`) from `features/range`, not a mock.

## 6. The exact API WP-L2/L3 build against

```ts
import {
  // types.ts
  type QuizVisual, type QuizAnswerOption, type QuizCorrectness, type QuizQuestion,
  type AnsweredQuestion, type QuizSession, type QuizScore,
  // engine.ts
  acceptableAnswerIds, isAnswerCorrect, isMixedQuestion,
  excludeMixedQuestions, compactQuestions,
  createQuizSession, answerQuestion, isAnswered, isComplete,
  currentScore, wrongAnswers, retryWrongOnly,
  // rng.ts (rarely needed directly — createQuizSession already uses it)
  createSeededRng, shuffleWithSeed,
} from '../../features/quiz/index.js';

import { Quiz } from '../../components/Quiz.js';
// <Quiz questions={questionBank} seed={SOME_FIXED_SEED} limit={10} title="레인지 퀴즈" />
```

**Generator contract** (what a `/practice/*` page's question-bank builder must do):
1. Build each question from the real domain call (`resolveRange`, `evaluateHand`/
   `compareHands`, `handStrengthOf`/`handStrengthTied`) — never a typed-in number.
2. Return `QuizQuestion | null` per candidate; `null` for anything the domain call can't
   honestly answer (`UNSUPPORTED`, an unknown key, etc.).
3. Run the array through `compactQuestions` to drop the nulls.
4. Optionally `excludeMixedQuestions` if the quiz should never ask about a tie.
5. Hand the result plus a **fixed, committed seed** to `<Quiz questions={...} seed={...} />`.
   Pin the seed in source (not `Date.now()`/`Math.random()`) — that is what makes the quiz
   reproducible and debuggable.

**Route registration** (each of WP-L2/L3, on its own): add exactly one entry to
`src/lib/routes.ts` — id/path pairs this WP reserved and `features/quiz/hub.ts` already
looks for:

| id | path | label |
| --- | --- | --- |
| `practiceRange` | `/practice/range` | 레인지 퀴즈 |
| `practiceHandRanking` | `/practice/hand-ranking` | 족보 퀴즈 |
| `practiceStartingHand` | `/practice/starting-hand` | 시작 핸드 퀴즈 |

Use exactly these ids — `PRACTICE_QUIZ_ENTRIES` in `features/quiz/hub.ts` already names
them, and the hub card turns live with no further edit once the route says
`available: true`.

**Cross-links**: set `relatedTool` to a `routes.ts` id (e.g. `'toolEquity'`) and/or
`relatedConcept` to a content id (e.g. a glossary term's id) on any question; `Quiz`'s
question and result views resolve and render both automatically via `QuizRelatedLinks`.

## 7. Accessibility

- Every answer is a real `<button>`, `aria-pressed`, disabled (not removed) once answered,
  `min-h-11` (44px) touch target.
- Feedback (`정답이에요`/`아쉬워요` + explanation) is `role="status" aria-live="polite"`, and
  every correct/accepted option is marked with a glyph (`○`)/wrong pick (`×`) as well as
  colour, matching `MiniQuiz`'s existing non-colour-only convention.
- Focus is moved to the new question's `<h2>` (and to the result screen's `<h2>`) on mount —
  `QuizQuestionCard`/`QuizResult` are remounted per question/per screen via `key`, so a
  mount-only `useEffect` is the trigger; keyboard/screen-reader users land on new content
  automatically rather than staying focused on a stale, disabled button.
- Progress line (`N / total문제 · 맞힌 문제 M개`) is `aria-live="polite"`, same pattern
  `MiniQuiz` already uses.

## 8. Tests run

| Suite | Result |
| --- | --- |
| `pnpm vitest run --project fishtilt` (whole project) | **740 passed, 2 failed**, 742 total |
| — of which, files this WP owns | **75 passed, 0 failed** (9 new test files) |
| `pnpm typecheck` (all 13 workspace projects) | 0 errors |
| `npx eslint apps/fishtilt --max-warnings=0` | 0 errors, 0 warnings |
| `tests/e2e/practice.spec.ts` | Written only, **not run** (per instructions) |

**The 2 failures are not mine**, both in `src/content/content.test.ts`
(`apps/fishtilt/src/content/` is untracked in git — confirmed with `git status`/`git
ls-files` — i.e. currently being authored): one glossary term's prose is under the 400-char
minimum for several terms (`term-suited`, `term-offsuit`, ... 29 terms), and one relation
(`term-two-pair` → `term-one-pair`) isn't declared yet. Re-ran the file twice; identical,
stable failure both times. Matches `docs/FISHTILT_STATE.md` ruling 23's documented pattern
exactly (concurrent WP-J1/J2 glossary authoring mid-flight) — not a file this WP touched or
is allowed to touch.

## 9. Known limitations

- `Quiz`'s `questions`/`seed`/`limit` props are read once at mount (same idiom as
  `StartingHandExplorer`'s one-time URL read) — a page that needs to swap the question bank
  live would need to force a remount (e.g. a `key`), not just change props.
- No real quiz content ships in this WP — `engine.test.ts`'s `fixtureRangeMembershipQuestion`
  is test-local wiring proving the `UNSUPPORTED`-safe contract, not a shipped generator;
  WP-L2 owns the real one.
- The starting-hand strength dataset's `exactTies` is empty today, so the `MIXED` fixture
  this WP tests against is a hand-comparison tie (`compareHands` returning `0`), not a
  strength-ranking tie — the engine supports both identically, but only one is currently
  reproducible from live data.
- `practiceHubCards()` never throws for a quiz id `ROUTES` doesn't know about (by design —
  see decision 3), so a typo in a future `routes.ts` entry's id would silently leave a card
  looking "still planned" rather than failing loudly the way `toolHubEntries` does for tools.
  Acceptable for three hand-authored ids WP-L2/L3 are each told the exact string to use
  above; would need tightening if this pattern grows past three entries.
