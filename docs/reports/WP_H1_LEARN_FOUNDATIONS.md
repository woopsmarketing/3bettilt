# WP-H1 — Learn Lessons 01-05 (Foundations)

## 1. Scope

Authored the five foundation lessons of the Korean Learn curriculum: `holdem-basics`,
`hand-rankings` (slug `poker-hand-rankings`), `starting-hands`, `starting-hand-ranking`,
`hand-matrix`. Flipped all five registry records `PLANNED` → `PUBLISHED`, registered their
compiled MDX, and added this batch's own test file. No file outside the stated boundary was
touched.

## 2. Files changed

| File | What |
| --- | --- |
| `apps/fishtilt/content/learn/holdem-basics.mdx` | new |
| `apps/fishtilt/content/learn/poker-hand-rankings.mdx` | new (id `hand-rankings`, slug `poker-hand-rankings` per ruling 11) |
| `apps/fishtilt/content/learn/starting-hands.mdx` | new |
| `apps/fishtilt/content/learn/starting-hand-ranking.mdx` | new |
| `apps/fishtilt/content/learn/hand-matrix.mdx` | new |
| `apps/fishtilt/src/content/learn/h1.ts` | MDX map: 5 named imports keyed by slug |
| `apps/fishtilt/src/content/registry/learn/h1.ts` | 5 records flipped `PLANNED`→`PUBLISHED`, `readMinutes` set, `indexable: true` |
| `apps/fishtilt/src/content/registry/learn/h1.test.ts` | new — this batch's gate (20 tests), modeled on the already-shipped `h2.test.ts` sibling |
| `docs/reports/WP_H1_LEARN_FOUNDATIONS.md` | this report |

Nothing in `src/components/**`, `src/app/**`, `src/content/{types,graph,content.test,allowList,facts}.ts`,
or any registry/MDX file outside `h1.ts` was touched. Two throwaway verification scripts
(`apps/fishtilt/verify-h1-tmp.mjs`, `apps/fishtilt/verify-22-tmp.mjs`) and one throwaway
measurement script were created, run, and deleted before finishing — none remain on disk.

## 3. Lesson table

| # | slug (id) | Promise | Interactive elements | Facts cited | Outbound links |
| --- | --- | --- | --- | --- | --- |
| 01 | `holdem-basics` | The order of events in one hand, start to end | `PokerCards`, `ToolCTA(toolHandChecker)`, `MiniQuiz` | none (only universal rule counts, not stats) | 4 `relatedConcepts`, 1 tool, 1 next lesson, 1 blog |
| 02 | `poker-hand-rankings` (`hand-rankings`) | The 9 hand categories in order, kicker, split pot | `PokerCards`×13, `Fact`×9 (`CATEGORY_RANK`), `Callout`, `ToolCTA`, `MiniQuiz` | `CATEGORY_RANK` (all 9 categories) | 6 `relatedConcepts`, 2 tools, 1 next lesson, 5 blogs |
| 03 | `starting-hands` | Suited/offsuit/pocket-pair/gap, AKs/AKo notation | `PokerCards`×6, `Fact`×6, `ToolCTA`, `MiniQuiz` | `RFI_POSITIONS_WITH`, `HAND_COMBOS`, `HAND_SHARE`, `COMBOS_OF_KIND` | 3 `relatedConcepts`, 1 tool, 1 next lesson, 3 blogs |
| 04 | `starting-hand-ranking` | The 169-class strength order and what it measures (not strategy) | `PokerCards`×4, `Fact`×11, `Callout`, `RangeMatrixMini`, `ToolCTA`, `MiniQuiz` | `HAND_AT_RANK`, `HAND_EQUITY_VS_RANDOM`, `HAND_RANK`, `HAND_TOP_SHARE`, `COMBOS_OF_KIND`, `COMBO_COUNT` | 3 `relatedConcepts`, 2 tools, 1 next lesson, 3 blogs |
| 05 | `hand-matrix` | Diagonal/upper/lower triangle, why a cell ≠ one hand | `PokerCards`×3, `Fact`×9, `Callout`, `RangeMatrixMini`×2, `ToolCTA`, `MiniQuiz` | `CLASSES_OF_KIND`, `COMBOS_OF_KIND`, `HAND_CLASS_COUNT`, `HAND_COMBOS`, `COMBO_COUNT` | 5 `relatedConcepts`, 2 tools, 1 next lesson, 2 blogs |

All five carry a mid-prose `<ToolCTA>` (not only in `relatedTools`), a `<MiniQuiz>` of 3
questions, a "사람들이 자주 헷갈리는 부분" section, and clear `prerequisites`/`nextLessons`
chaining 01→02→03→04→05→06 (`poker-range`, already published — linked, never touched).

Tool CTAs used the live routes directly (`toolHandChecker`, `toolStartingHand`, `range`) —
per `docs/FISHTILT_STATE.md`, all six tools have shipped since the content plan was written,
so no fallback-to-`range` workaround was needed.

## 4. Evaluator output proving lesson 02's hand-ranking claims

Ran a throwaway script (`npx tsx`, from inside `apps/fishtilt` so workspace packages
resolve; deleted after) calling `evaluateHand`/`bestFiveOf`/`compareHands` from
`@gto-self/strategy-core` directly — nothing in lesson 02 was reasoned by hand.

```
HAND_CATEGORIES (weakest -> strongest):
[ 'HIGH_CARD','PAIR','TWO_PAIR','TRIPS','STRAIGHT','FLUSH','FULL_HOUSE','QUADS','STRAIGHT_FLUSH' ]

HIGH_CARD      [2h 5s 9c Jd Ah] -> category=HIGH_CARD
PAIR           [3h 3s 7c Jd Ah] -> category=PAIR
TWO_PAIR       [3h 3s 7c 7d Ah] -> category=TWO_PAIR
TRIPS          [3h 3s 3c Jd Ah] -> category=TRIPS
STRAIGHT       [5h 6s 7c 8d 9h] -> category=STRAIGHT
FLUSH          [2h 5h 9h Jh Ah] -> category=FLUSH
FULL_HOUSE     [3h 3s 3c Jd Jh] -> category=FULL_HOUSE
QUADS          [3h 3s 3c 3d Ah] -> category=QUADS
STRAIGHT_FLUSH [5h 6h 7h 8h 9h] -> category=STRAIGHT_FLUSH

Pairwise compareHands across all 9, in order: -1,-1,-1,-1,-1,-1,-1,-1 (each stronger than the last)

WHEEL   [2h 3s 4c 5d Ah] -> category=STRAIGHT, ranks=[3] (5-high straight)
Q-K-A-2-3 [2h 3s Qc Kd Ah] -> category=HIGH_CARD (NOT a straight — confirms no wrap-around)
BROADWAY [Th Js Qc Kd Ah] -> category=STRAIGHT, ranks=[12] (ace-high, the top straight)
ROYAL   [Th Jh Qh Kh Ah] -> category=STRAIGHT_FLUSH, ranks=[12]

Kicker: board Ah Ad 7c 4d 2h; hero Ks Qs -> PAIR ranks=[12,11,10,5] (K kicker);
        villain Js Ts -> PAIR ranks=[12,9,8,5] (J kicker); compareHands = 1 (hero wins on kicker)

Split pot: board 5h 6s 7c 8d 9h (straight); hero 2c 2d, villain 3c 3d ->
           both bestFiveOf = board's straight, strength 4653056 = 4653056; compareHands = 0 (split)

Board plays: board Th Jh Qh Kh Ah (royal flush); hero 2c 3d, villain 7s 8s ->
             both bestFiveOf = the royal flush; compareHands = 0 (split)
```

Every claim in the lesson (category order, the wheel, kicker breaking a same-pair tie, a
board-only straight producing a split pot) is backed by this output, not reasoned.

## 5. Lesson 04's strength-vs-strategy wording

Reused, verbatim, the exact sentence `docs/reports/WP_E2_STARTING_HAND_EXPLORER.md` §5
already shipped at `/tools/starting-hand` (`STRATEGY_DISTINCTION_SENTENCE`):

> 이 순위는 포지션별 전략이 아니라 시작 패 자체의 기본 강도를 비교한 것입니다.

Immediately followed by a paraphrase of the shipped `PLAYABILITY_CAVEAT_SENTENCE` (same idea,
reworded to fit the lesson's voice rather than quoted twice verbatim in one paragraph):

> 그래서 이 순위표에서는 실제로 다루기 어려운 오프수트 에이스가, 사람들이 좋아하는 수티드
> 커넥터나 낮은 포켓페어보다 위에 있는 경우도 있습니다. 무작위 상대에게는 잘 이기지만,
> 그것이 실전에서 다루기 쉬운 패라는 뜻은 아닙니다.

A `Callout` right after contrasts the strength ranking with the (separately shown)
`RangeMatrixMini`, and a dedicated myth-busting section uses `HAND_AT_RANK`/`HAND_RANK` to
show `72o` is rank 165, not 169 (verified live via the dataset before writing the sentence —
see §8) — a concrete, computed demonstration that raw strength ≠ folk intuition ≠ strategy.

## 6. Facts needed and not available

None. All facts this batch needed (`HAND_RANK`, `HAND_AT_RANK`, `HAND_EQUITY_VS_RANDOM`,
`HAND_TOP_SHARE`, `CATEGORY_RANK`, plus the pre-existing `COMBO_COUNT`, `HAND_CLASS_COUNT`,
`CLASSES_OF_KIND`, `COMBOS_OF_KIND`, `HAND_COMBOS`, `HAND_SHARE`, `RFI_POSITIONS_WITH`) already
existed in `src/content/facts.ts` (shipped by WP-G3b before this batch started).

## 7. Tests run (real counts)

| Command | Result |
| --- | --- |
| `pnpm vitest run --project fishtilt src/content/registry/learn/h1.test.ts` | **20/20 passed** (this batch's own gate) |
| `pnpm vitest run --project fishtilt src/content/content.test.ts` | **37/37 passed** |
| `pnpm vitest run --project fishtilt` (whole app, run 3× to check stability) | **807/808 passed**, stable across three consecutive runs — 1 failure, not owned (see §8) |
| `pnpm typecheck` (all 13 workspace packages) | **PASS**, 0 errors |
| `npx eslint apps/fishtilt --max-warnings=0` | **PASS**, no output |

## 8. Known limitations / not-mine failures

- **`src/app/tools/hand-checker/page.test.tsx` fails, and is not this batch's file.** The
  test `링크스 to the hand-rankings lesson honestly — inert, since it is not written yet`
  hard-codes lesson `hand-rankings` as its "known still-`PLANNED`" fixture. Publishing lesson
  02 (this batch's job) makes that premise false — this is exactly the pattern
  `docs/FISHTILT_STATE.md` rulings 21/26 already documented and named as inevitable ("a test
  asserting how the product behaves in a state must construct that state, not wait for the
  product to happen to be in it"). Confirmed stable (fails identically on 3 separate runs).
  Out of this batch's file boundary (`src/app/**`); reported rather than fixed.
- **A second, real bug surfaced transiently during testing but is not mine either.**
  `src/app/learn/page.test.tsx` failed once (out of ~6 runs) with a link lookup returning
  `null` for lesson `position` (H2's lesson 07, title `자리(포지션)가 왜 그렇게 중요할까요?`).
  Root cause: that test builds `new RegExp(lesson.title, 'u')` from the live title, and the
  literal parentheses in `position`'s title are regex metacharacters, so the constructed
  regex does not match the literal `(포지션)` substring — confirmed directly in plain Node
  (`/자리(포지션)가.../u.test(...)` → `false`). Despite this, the real test file passed
  reliably on every direct re-run after the first. This sits in `registry/learn/h2.ts` (H2's
  record) and `src/app/learn/page.test.tsx` (outside my boundary either way) — flagged here
  per the "diagnose, don't repair another agent's in-flight file" rule (ruling 23); not
  touched.
- Lesson 05 (`hand-matrix`) and the already-published lesson 06 (`poker-range`) cover
  overlapping ground (diagonal/triangle reading, combo counts) because `poker-range.mdx` was
  authored before the 15-lesson curriculum split existed. Concept ownership now assigns the
  matrix-reading explanation to lesson 05, but lesson 06's prose was out of this batch's file
  boundary and was not rewritten. Both pass their own tests independently; the duplication is
  a content debt, not a bug.

## 9. Anything needing a source change

Nothing. No new domain code, no new `Fact` name, no registry field beyond this batch's own
five records' `status`/`indexable`/`readMinutes` was needed.
