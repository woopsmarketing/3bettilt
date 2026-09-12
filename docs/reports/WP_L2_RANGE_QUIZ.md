# WP-L2 — The Range Quiz

## 1. Scope

Built `/practice/range-quiz`: a ten-question quiz asking whether a hand class is in this
site's `학습용 기본 레인지` for a chosen position, at the one point in the range dataset that
actually ships data (RFI / 100BB / 6-max). Every answer is read straight off `resolveRange` +
`hasHandClass` — no hand-typed hand list, no authored answer key. Built the question
generator (`features/quiz/rangeQuestions.ts`), the setup+play UI (`components/RangeQuiz.tsx`,
composing the existing `RangeFilters` and `Quiz`), the route (`app/practice/range-quiz/`), one
hub copy fix, one `routes.ts` entry, and an e2e spec (written, not run).

Did not touch `features/quiz/{types,engine,rng,index}.ts`, `components/Quiz*.tsx`, any
existing test file, or `src/content/**`.

## 2. Files changed

| File                                              | What                                                                                                                                                                                          |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/quiz/rangeQuestions.ts` (new)       | The generator: `buildRangeQuestions`, `generateRangeMembershipQuestion`, `RANGE_QUIZ_SUPPORTED_POSITIONS` (computed, not hard-typed), `isSupportedRangeQuizQuery`, seed/limit/query constants |
| `src/features/quiz/rangeQuestions.test.ts` (new)  | 17 tests — see §3/§4/§5                                                                                                                                                                       |
| `src/components/RangeQuiz.tsx` (new)              | The interactive island: position/spot/stack setup (reuses `RangeFilters` as-is) → `Quiz` handoff                                                                                              |
| `src/components/RangeQuiz.test.tsx` (new)         | 8 tests                                                                                                                                                                                       |
| `src/app/practice/range-quiz/page.tsx` (new)      | Server-component shell (written before the `routes.ts` flip, per instructions)                                                                                                                |
| `src/app/practice/range-quiz/page.test.tsx` (new) | 4 tests                                                                                                                                                                                       |
| `tests/e2e/range-quiz.spec.ts` (new)              | Written, **not run** (orchestrator's gate)                                                                                                                                                    |
| `src/features/quiz/hub.ts`                        | **One line**: `practiceRange`'s description string (§7)                                                                                                                                       |
| `src/lib/routes.ts`                               | **One entry**: `practiceRange` → `/practice/range-quiz`, `available: true` (done last)                                                                                                        |
| `docs/reports/WP_L2_RANGE_QUIZ.md`                | This report                                                                                                                                                                                   |

## 3. How questions are generated, and why every answer is traceable to `resolveRange`

`buildRangeQuestions(query)` calls `resolveRange(query)` **once**, then maps all 169
`HAND_CLASSES` through `generateRangeMembershipQuestion(resolution, handClass)`:

```ts
if (resolution.kind === 'UNSUPPORTED') return null;
const included = hasHandClass(resolution.range, handClass.index);
const correctAnswerId = included ? 'INCLUDE' : 'EXCLUDE';
```

There is no second code path that could answer differently: `included` is the same boolean
`SelectedHandPanel` (the Range Explorer's own hand-detail panel) computes from the same
`resolveRange` result. `rangeQuestions.test.ts`'s `buildRangeQuestions` suite re-derives
`resolveRange`/`hasHandClass` independently for all 169 classes across all 5 supported
positions (845 checks total) and asserts each generated question's `correctness` matches —
never comparing the generator's output against itself.

`RANGE_QUIZ_SUPPORTED_POSITIONS` is `STRATEGY_POSITIONS.filter(p => resolveRange(...).kind ===
'RANGE')` — computed, not a restated `['UTG','HJ','CO','BTN','SB']` literal — so it can never
silently disagree with `resolve.ts`'s own answer.

## 4. Mixed frequencies and `UNSUPPORTED`

**`UNSUPPORTED` → no question.** `buildRangeQuestions` runs its 169 candidates through the
shared `compactQuestions` (WP-L1). For this generator the UNSUPPORTED case is all-or-nothing
(one `resolveRange` call gates every hand class), proven by:
`generateRangeMembershipQuestion — UNSUPPORTED yields no question` (`rangeQuestions.test.ts`),
using `heroPosition: 'BB'` at this quiz's fixed `spot: 'RFI'` — **not** an unbuilt spot like
`FACING_OPEN`. Ruling 26: an unbuilt spot may ship within this same project and start passing
for the wrong reason; `BB` at `RFI` is structurally permanent (`resolve.ts`: the hand is over
before BB acts), so it is a fixture this test controls forever, not one borrowed from
"whatever happens to be unbuilt today."

**Mixed frequency: this dataset has none, and the test proves absence, not presence.**
`RFI_RANGES`' values are `HandClassSet` — `packages/strategy-core/src/preflop/notation.ts`'s
`Uint8Array` of 169 entries, each exactly `0` or `1`. `hasHandClass` can only return `true`/
`false`; there is no per-class frequency this dataset can express, so this generator can only
ever build `{ kind: 'SINGLE' }` — never a fabricated binary standing in for a real mixed
outcome, because no mixed outcome exists to fabricate over. Proven in `rangeQuestions.test.ts`
(`mixed frequency — this dataset has none...`): every generated question across all five
supported positions has `correctness.kind === 'SINGLE'`, and `excludeMixedQuestions` is still
run in the production pipeline (a proven no-op today) so nothing regresses silently if a
future weighted dataset ever changes this. The engine's actual `'MIXED'`-scoring machinery is
WP-L1's `engine.test.ts`'s job (a real board making two hands chop) — this quiz's job is to
prove its own data can never need it, not to re-test the engine.

## 5. Seeding scheme

`RANGE_QUIZ_SEED = 574_301` — a fixed literal, never `Date.now()`/`Math.random()`.
`RANGE_QUIZ_QUESTION_LIMIT = 10`. `<Quiz questions={buildRangeQuestions(query)}
seed={RANGE_QUIZ_SEED} limit={10} />` — `Quiz`/`createQuizSession` do the seeded shuffle
themselves (WP-L1's `rng.ts`). Proven in `rangeQuestions.test.ts`: the same `(query, seed)`
reproduces the same 10 question ids in the same order, for two independent positions, across
two independent calls each.

## 6. What the explanation says, and the claim it deliberately does not make

```
{key} ({spoken reading}, {plain-Korean description})는 {POSITION} · {table}·{stack}·{spot}
기준 학습용 기본 레인지에서 {지금 보고 있는 레인지에 포함되어 있어요 | 포함되어 있지 않아요}.
13×13 표에서 전체 범위를 직접 확인해보세요.
```

Every phrase is reused from `features/range/copy.ts` (`IN_RANGE_LABEL`/`OUT_OF_RANGE_LABEL`,
`RANGE_LABEL`, `POSITION_LABEL`, `describeRangeConditions`, `handClassReading`,
`describeHandClassKorean`) — no new claim is composed. It states **membership in this
dataset**, never that the hand _should_ be opened, that including it is _correct_, or _how
often_ — the words "해야"/"정답입니다"/"올바른 선택" never appear, asserted directly in
`rangeQuestions.test.ts`. `relatedTool: 'range'` (→ `/tools/range`, the 13×13 chart) and
`relatedConcept: 'term-range'` (a `PUBLISHED` glossary entry) are the two cross-links every
question and every missed-question card carries (via the existing `QuizRelatedLinks`),
satisfying "a link to see the missed hands on the 13×13 chart" without any change to that
shared component.

## 7. Hub copy fix

|        | Text                                                                              |
| ------ | --------------------------------------------------------------------------------- |
| Before | `포지션별로 어떤 시작 패를 열어야 하는지 직접 골라보고 바로 확인합니다.`          |
| After  | `포지션별 학습용 기본 레인지에 이 패가 포함되는지 직접 맞혀보고 바로 확인합니다.` |

"열어야 하는지" ("which hands you _should_ open") is a prescription; the quiz only asks
whether a hand is _in this learning range_. `hub.test.ts`'s copy assertions (length, Korean
content, no digits, no "GTO") still pass against the new string — verified.

## 8. Tests run, with real counts

This app has multiple work packages editing it concurrently this session (a search feature
under `src/features/search/`, a hand-ranking quiz under `src/features/quiz/handRankingQuestions.ts`,
content batches under `src/content/registry/learn/`) — the whole-project total below is a
snapshot, not a stable number; a repeat run minutes apart shows a different total and
different unrelated failures as those WPs land. The stable, load-bearing number is the one
scoped to files this WP owns, re-verified in isolation after every edit including the final
`prettier --write` pass.

| Check                                                                                                         | Result                                                                                           |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Files this WP owns (`rangeQuestions.test.ts` 17, `RangeQuiz.test.tsx` 8, `page.test.tsx` 4), run in isolation | **29 passed, 0 failed**                                                                          |
| `pnpm vitest run --project fishtilt` (whole project, one snapshot)                                            | **1032 passed, 9 failed**, 1041 total, 92 files                                                  |
| `pnpm typecheck` (13 workspace projects)                                                                      | 0 errors in any file this WP touched                                                             |
| `npx eslint` scoped to every file this WP touched, `--max-warnings=0`                                         | 0 errors, 0 warnings (exit 0)                                                                    |
| `npx eslint apps/fishtilt --max-warnings=0` (whole app)                                                       | 1 error, in `src/features/quiz/handRankingQuestions.ts` (WP-L3, not mine — unused `isWheelHand`) |
| `tests/e2e/range-quiz.spec.ts`                                                                                | Written only, **not run** (per instructions)                                                     |

**None of the whole-project failures are broken logic in this WP's own files.** One is a
direct, anticipated _consequence_ of the one `routes.ts` edit this WP was instructed to make;
the rest belong to other WPs' in-flight work, confirmed by reading each failure:

1. `src/features/quiz/hub.test.ts` — **`resolves route to null for an id ROUTES has no entry
for at all`** now fails: it expects `practiceHubCards().find(c => c.id ===
'practiceRange').route` to be `null`, but flipping `routes.ts`'s `practiceRange` entry to
   `available: true` (this WP's one required, targeted edit) makes it resolve to a real
   route. Reading the test: its `vi.mock('../../lib/routes.js', ...)` spreads
   `...actual.ROUTES` and adds synthetic entries for `practiceHandRanking`/
   `practiceStartingHand` only — `practiceRange`'s "no entry" fact was left resting on the
   **live** registry rather than a constructed fixture, exactly ruling 26's pattern. This is
   in my file boundary's explicit "existing test file you did not create" — not fixed here.
   Flagged prominently for the orchestrator in §9.

2. `src/content/content.test.ts` (`<Term id="term-offsuit">`/`<Term id="term-suited">` not
   declared in `relatedConcepts`) and `src/content/registry/learn/h2.test.ts` (same shape,
   `term-utg`) — untouched, untracked/in-progress content files under active authoring by
   concurrent content agents; unrelated to this WP.

3. `src/features/search/buildIndex.test.ts` (6 failures, "Tool route \"toolFixture\" has no
   description in TOOL_DESCRIPTION") — a concurrent search-feature WP's own in-progress file;
   `src/lib/routes.ts` itself was not touched by it (confirmed: no `toolFixture` entry exists
   in the registry I read and edited), so this is that WP's own fixture/wiring gap, not a
   `routes.ts` conflict with my edit.

4. `src/lib/routes.test.ts` — **`availability matches the disk in BOTH directions`** fails on
   `/search available=false`: a concurrent WP has already created
   `src/app/search/page.tsx` on disk without yet flipping `search`'s `available` flag. My
   `practiceRange` entry passes this same test cleanly (`routes.test.ts` run in isolation:
   8/9 pass, the one failure is `/search`, never `/practice/range-quiz`).

## 9. Known limitations

- `docs/reports/WP_QA_RULING26_SWEEP.md` §4 judged `src/features/quiz/hub.test.ts` "NOT an
  instance" of ruling 26 on the grounds that it "searches a locally mocked
  `practiceHubCards()` array... not the live registry." That holds for two of its three ids
  but not the third: the "resolves route to null" case's fixture for `practiceRange`
  specifically was never constructed — it inherits from `actual.ROUTES`. This WP's required
  `routes.ts` flip is exactly what falsifies it, empirically confirmed above. The fix
  (mirroring how the same file already handles `practiceHandRanking`/`practiceStartingHand`)
  is to give `practiceRange` its own synthetic "no entry" fixture — e.g. filter it out of
  `actual.ROUTES` before spreading, or build all three ids from scratch — but `hub.test.ts` is
  outside this WP's file boundary.
- The quiz asks about all 169 hand classes per position (obvious folds included), then samples
  10 via the seeded shuffle — no difficulty curation (e.g. weighting toward borderline
  classes). Not required by the brief; noted as a possible future refinement.
- `RangeQuiz`'s setup screen exposes `Spot`/`Stack` via the real `RangeFilters` controls
  (rather than hiding them, since only one value each is enabled) so the UI needs no rebuild
  the day a second spot or stack depth ships real data — but today, selecting anything other
  than the default `heroPosition` is the only click that ever changes what "퀴즈 시작" is
  gated on.
