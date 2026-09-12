# WP-G3 (domain half) — Category Frequency + Class-vs-Class Equity

## 1. Scope

Two new domain facts for `@gto-self/learn-core`, both required by
`docs/FISHTILT_CONTENT_PLAN.md` and ruled on in `docs/FISHTILT_STATE.md` rulings 14-15:

- **`CATEGORY_FREQUENCY`** — how often each of the nine 5-card hand categories occurs, over
  all `C(52,5) = 2,598,960` hands. Blocks blog #9/#10 and lesson 02.
- **`classVsClassEquity`** — exact, combo-weighted heads-up equity between two of the 169
  starting-hand classes. Blocks blog #5 (`QQ와 AK 중 뭐가 강할까?`).

No `apps/fishtilt` files touched. No `packages/strategy-core` files touched (read-only).

## 2. Files changed

| File | What |
| --- | --- |
| `packages/learn-core/src/handClass/categoryFrequency.ts` | NEW — live enumeration + frozen-at-load result |
| `packages/learn-core/src/handClass/categoryFrequency.test.ts` | NEW |
| `packages/learn-core/src/equity/classVsClass.ts` | NEW — the combo-pairing engine |
| `packages/learn-core/src/equity/classVsClass.test.ts` | NEW |
| `packages/learn-core/src/equity/classVsClassDataset.model.ts` | NEW — frozen-dataset vocabulary |
| `packages/learn-core/src/equity/classVsClassDataset.generated.ts` | NEW, GENERATED — do not hand-edit |
| `packages/learn-core/src/equity/classVsClassDataset.ts` | NEW — public lookup (incl. mirrored order) |
| `packages/learn-core/src/equity/classVsClassDataset.test.ts` | NEW — structure + generator-consistency |
| `packages/learn-core/scripts/generate-class-vs-class-equity.ts` | NEW — offline generator |
| `packages/learn-core/package.json` | +1 script line: `generate:classVsClass` (mirrors existing `generate:strength`) |
| `packages/learn-core/src/index.ts` | +4 export lines (appended only) |
| `docs/reports/WP_G3_DOMAIN_FACTS.md` | this report |

## 3. Decisions

| Deliverable | Live compute vs frozen | Why |
| --- | --- | --- |
| `categoryFrequency` | **Live**, computed once at module load | Measured 97-143ms for the full `C(52,5)` enumeration (§7) — 2-3 orders of magnitude under "hurts a page render." A generator+consistency-test pair would add process for a sub-150ms computation. |
| `classVsClassEquity` | **Frozen** via offline generator, engine itself stays a callable library function | Measured ~86ms/pairing preflop; QQ vs AK is 96 pairings (24 + 72) = ~8.3s total (§7) — far too slow for a page render. Only the two matchups content cites are frozen (§6). |

## 4. Public API — what `apps/fishtilt`'s `facts.ts` should call

```ts
// Category frequency (packages/learn-core/src/handClass/categoryFrequency.ts)
export const FIVE_CARD_HAND_COUNT: number; // C(52,5) = 2,598,960
export interface CategoryFrequency {
  category: HandCategory; // 'HIGH_CARD' .. 'STRAIGHT_FLUSH'
  count: number;
  probability: number; // 0..1
  rank: number; // 1 = STRAIGHT_FLUSH (strongest) .. 9 = HIGH_CARD (weakest/most common)
}
export const CATEGORY_FREQUENCIES: readonly CategoryFrequency[]; // rank order, 1 first
export function categoryFrequencyOf(category: HandCategory): CategoryFrequency; // total

// Class-vs-class equity (packages/learn-core/src/equity/classVsClassDataset.ts)
export const CLASS_VS_CLASS_MATCHUPS: readonly ClassVsClassEquity[]; // frozen, generation order
export const CLASS_VS_CLASS_DATASET_META: ClassVsClassDatasetMeta; // methodology + report link
export function classVsClassMatchupFor(
  classAKey: string, classBKey: string,
): Result<ClassVsClassEquity, 'UNKNOWN_MATCHUP'>; // either order; mirrors are answered too

// The engine underneath (packages/learn-core/src/equity/classVsClass.ts) — NOT for a page;
// only the generator and tests call this directly.
export function classVsClassEquity(
  classA: HandClass, classB: HandClass, board?: readonly Card[], // default []
): Result<ClassVsClassEquity, 'INVALID_BOARD_LENGTH' | 'NO_LEGAL_PAIRINGS'>;
```

`ClassVsClassEquity` fields: `classAKey`, `classBKey`, `board`, `pairingCount`,
`totalPairingsConsidered`, `skippedPairings`, `runoutsPerPairing`, `runouts`, `wins`, `ties`,
`losses`, `winProb`, `tieProb`, `loseProb`, `equity`, `classAWinBps`, `tieBps`, `classBWinBps`,
`method: 'EXACT'`.

## 5. Category frequency table (computed) vs `strategy-core` (cited)

Source cited: `packages/strategy-core/src/analysis/evaluateExhaustive.test.ts:17-27`
(`EXPECTED_FIVE_CARD_FREQUENCIES`).

| Rank | Category | This package's count | strategy-core's count | Agree? |
| --- | --- | --- | --- | --- |
| 1 | STRAIGHT_FLUSH | 40 | 40 | yes |
| 2 | QUADS | 624 | 624 | yes |
| 3 | FULL_HOUSE | 3,744 | 3,744 | yes |
| 4 | FLUSH | 5,108 | 5,108 | yes |
| 5 | STRAIGHT | 10,200 | 10,200 | yes |
| 6 | TRIPS | 54,912 | 54,912 | yes |
| 7 | TWO_PAIR | 123,552 | 123,552 | yes |
| 8 | PAIR | 1,098,240 | 1,098,240 | yes |
| 9 | HIGH_CARD | 1,302,540 | 1,302,540 | yes |
| — | **Total** | **2,598,960** | 2,598,960 | yes |

Two independent derivations — this package's own odometer enumeration and `strategy-core`'s
test, run by different code, on different evaluator call sites — agree on all nine numbers and
the total. That agreement, not either run alone, is what licenses shipping the numbers.

## 6. Frozen class-vs-class matchups

| Matchup | Why frozen | Cited by |
| --- | --- | --- |
| `QQ vs AKs` | Content plan's ONLY class-vs-class need, suited half | `FISHTILT_CONTENT_PLAN.md` §2.2 row 5 (`blog-qq-vs-ak`), §4 "Article #5 special rule": "Show both a suited and an offsuit AK case; they differ." |
| `QQ vs AKo` | Same article, offsuit half | same |

No other matchup is cited anywhere in the content plan. Generating the full 169x169 grid was
explicitly rejected as scope expansion in the generator's own header and in ruling 14 — at the
measured per-pairing cost it would take days.

## 7. Measured cost

All measurements on this machine (single core, no worker pool — see §3 for why none was
needed).

| Enumeration | Runs | Elapsed | Per-unit |
| --- | --- | --- | --- |
| `C(52,5)` category enumeration (categoryFrequency) | 3 consecutive | 97ms / 143ms / 135ms | n/a (one space, one pass) |
| `QQ vs AKs` (24 pairings, preflop, `C(48,5)=1,712,304` runouts/pairing) | 1 (generator) | 2,060ms | 85.8ms/pairing |
| `QQ vs AKo` (72 pairings, preflop) | 1 (generator) | 6,197ms | 86.1ms/pairing |
| Both matchups combined (96 pairings total) | 1 (generator) | 8,257ms | ~86ms/pairing average |

96 pairings matches ruling 14's estimate exactly (QQ's 6 combos x AK's 4+12); the measured
~86ms/pairing is close to ruling 14's ~85ms figure and well under the WP brief's ~200ms
figure — either way, tens of seconds is not render-safe, which is the only conclusion either
number supports.

## 8. Cross-check (independent path, in scratchpad)

Independent script: re-derives combo buckets via `ALL_COMBOS` + `handClassOfCombo` directly
(no `COMBOS_BY_CLASS`, no `combosOf`, no `classVsClassEquity`), calls `exactHeadsUpEquity`
directly, and sums manually. Does not import `classVsClass.ts` or `classVsClassDataset.ts`.

| Matchup | Field | Frozen (production generator) | Independent script | Match |
| --- | --- | --- | --- | --- |
| QQ vs AKs | pairingCount | 24 | 24 | yes |
| QQ vs AKs | wins / ties / losses | 22,082,460 / 178,116 / 18,834,720 | 22,082,460 / 178,116 / 18,834,720 | yes |
| QQ vs AKs | runouts | 41,095,296 | 41,095,296 | yes |
| QQ vs AKs | equity | 0.5395147415412217 | 0.5395147415412217 | yes (bit-identical) |
| QQ vs AKo | pairingCount | 72 | 72 | yes |
| QQ vs AKo | wins / ties / losses | 69,714,036 / 520,308 / 53,051,544 | 69,714,036 / 520,308 / 53,051,544 | yes |
| QQ vs AKo | runouts | 123,285,888 | 123,285,888 | yes |
| QQ vs AKo | equity | 0.5675766394285127 | 0.5675766394285127 | yes (bit-identical) |

Sanity remark, clearly labelled and NOT the source of the shipped numbers: commonly quoted
heads-up preflop equities put QQ over AKs at roughly 54/46 and over AKo at roughly 57/43. Our
enumeration (53.95% / 56.76%) lands in that neighborhood, which is a plausibility check, not
evidence — the shipped numbers come only from the exhaustive enumeration above.

## 9. Tests run

| Suite | Before | After | Result |
| --- | --- | --- | --- |
| `pnpm vitest run --project learn-core` | 94 tests / 8 files | **114 tests / 11 files** | PASS |
| `pnpm --filter @gto-self/learn-core typecheck` | — | — | PASS, no errors |
| `pnpm typecheck` (all 13 workspace packages) | — | — | PASS, no errors |
| `npx eslint packages/learn-core --max-warnings=0` | — | — | PASS, no output |

New test files: `categoryFrequency.test.ts` (7 tests), `classVsClass.test.ts` (5 tests),
`classVsClassDataset.test.ts` (8 tests) = 20 new tests, all passing.

`classVsClassDataset.test.ts`'s generator-consistency test re-derives `QQ vs AKs` LIVE (24 full
preflop pairings, ~2s) via the production `classVsClassEquity` function and asserts the result
`toEqual` the frozen entry — i.e. bit-identical, not approximate.

## 10. Known limitations

- `classVsClassEquity`'s `board` parameter exists for testability (cheap river-board unit
  tests exercise the real blocker/pairing logic in milliseconds); no shipped content uses a
  non-empty board today. If a future article needs a class-vs-class equity ON A SPECIFIC FLOP,
  the engine already supports it — only the generator's `FROZEN_MATCHUPS` list needs a new
  entry, following the same freeze-then-consistency-test pattern.
- The frozen dataset holds only the 2 matchups the content plan cites. `classVsClassMatchupFor`
  answers the mirrored key order (`AKs vs QQ`) by arithmetic complement, not by storing a
  second generated row, so no new fact is invented there — but a genuinely different, uncited
  pair (e.g. `AA vs KK`) returns `UNKNOWN_MATCHUP` rather than computing live; the WP boundary
  is the content plan's citations, not "any pair anyone might ask for."
  Regenerating with a new pair requires editing `FROZEN_MATCHUPS` in
  `scripts/generate-class-vs-class-equity.ts` and re-running `pnpm --filter
  @gto-self/learn-core generate:classVsClass`.
- `categoryFrequency.ts`'s enumeration is a plain four-nested-loop odometer, identical in
  shape to `evaluateExhaustive.test.ts`'s; it was not further optimized because 100-150ms
  already leaves ~3 orders of magnitude of headroom before "live compute" would need to be
  reconsidered.
