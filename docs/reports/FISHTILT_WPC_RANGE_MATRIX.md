# FISHTILT WP-C — 13×13 matrix and the range facade

Delivered by a fresh-context agent; **independently re-verified by the orchestrator**,
including recomputing every contrast claim from the token file.

## What shipped (`apps/fishtilt/src/`)

**Facade — `features/range/`**
- `types.ts` — `RangeQuery` over hero position × spot × stack depth × table size.
- `resolve.ts` — `resolveRange(query)` returning a discriminated union: a supported range
  with its notation, combo count and percentage, or `UNSUPPORTED` carrying **every** failing
  axis plus a `nearestSupportedQuery`.
- `notation.ts` — `formatHandClassSet`, a serializer for the chart grammar. `strategy-core`
  had a parser but no formatter; the new one is tested by round-tripping through that parser.
- `copy.ts` — the Korean surface, as exhaustive typed maps so a new domain value is a
  compile error rather than a silently untranslated string (the `apps/web/src/lib/table/copy.ts`
  pattern).

**Components** — `RangeMatrix`, `SelectedHandPanel`, `RangeSummary`, each with tests.

## Orientation, pinned by construction

`RangeMatrix` renders `HAND_CLASSES` — already in `row*13+col` order — straight into a
13-column grid, so DOM order *is* matrix order and there is no second row/column
calculation that could drift from `strategy-core`'s. A test sweeps all 169 cells against
`handClassAt`, and pins `(0,0)→AA`, `(0,1)→AKs`, `(1,0)→AKo`.

## A contrast trap the design system had not caught

WP-A audited the token pairs it used. WP-C introduced new ones — text on the *strategy
action fills* — and found a real failure. All figures below were **recomputed independently
by the orchestrator from `globals.css` and reproduced exactly**:

| Pairing | Ratio | Outcome |
| --- | --- | --- |
| `text-100` on `act-raise-500` fill | **3.40:1** | fails body text — rejected |
| `ground-900` on `act-raise-500` fill | 5.37:1 | adopted for in-range cells |
| `text-100` on `act-fold-500` fill | 9.50:1 | adopted for out-of-range cells |
| `brand-500` ring on `act-raise-500` | **1.02:1** | effectively invisible — rejected |
| `brand-500` ring on `act-fold-500` | 2.85:1 | fails — rejected |
| `text-100` on `brand-600` fill | 4.70:1 | adopted for the selected cell |

The consequence is a better design, not just a compliant one: because no ring colour works
on both fills, **selection changes the cell itself to the brand fill** rather than drawing a
washed-out outline. A selected cell is categorically brand-coloured and unmistakable.

`act-fold-500` is used only as a fill, never as a border — as a border on `ground-900` it
measures 1.93:1, which WP-A had already flagged.

## Honesty properties, enforced by test

- `resolveRange` was enumerated over the **entire** query space (216 combinations) and every
  one resolves to real data or to `UNSUPPORTED`. There is no third branch and no fallback.
- The BB is not an error. It renders the explanation — the big blind is not a first-in seat —
  and deliberately offers **no** "try this instead" link, because there is nothing it should
  be trying instead.
- The label is fixed: `학습용 기본 레인지`, with conditions rendered as
  `6인 · 100BB · 아무도 참여하지 않았을 때 (First In)`, asserted verbatim in a test.

## An ADR conflict the agent raised rather than resolved silently

The brief told the agent to add Korean rank names. ADR-0053 says poker notation stays Latin.
Rather than pick one, the agent implemented the conservative reading and flagged it.

**That was the right behaviour, and the brief was wrong.** Build spec §10 and §21 both show
a hand class with its spoken reading beneath the key — `AKs · 에이스 킹 수티드` — and that does
not contradict ADR-0053: the notation `AKs` is displayed unchanged, and what is added beside
it is a pronunciation gloss. That is exactly the build spec §3 pattern of teaching a term
instead of hiding or replacing it. A beginner who cannot say a hand cannot ask about it.

The orchestrator therefore added `handClassReading` (`AKs → 에이스 킹 수티드`, `AA → 포켓
에이스`, `AKo → 에이스 킹 오프수트`) and rendered it under the key in `SelectedHandPanel`,
with four tests including a sweep proving all 169 classes read without a gap. The plain
explanation WP-C wrote (`같은 무늬의 A와 Q`) is kept — the panel now shows the key, how to
say it, and what it means.

One orchestrator defect during that change: the new test called `handClassByKey`, which is
typed `HandClass | undefined`, without narrowing — caught by `tsc`, fixed with a failing
helper rather than a cast.

## Verification

| Gate | Result |
| --- | --- |
| `pnpm vitest run --project fishtilt` | **136 passed**, 18 files (58 WP-A + 74 WP-C + 4 orchestrator) |
| `pnpm --filter @gto-self/fishtilt typecheck` | pass |
| `npx eslint apps/fishtilt --max-warnings=0` | pass, 0 warnings |
| `pnpm build:fishtilt` | pass — `/` still prerenders static |
| `pnpm e2e:fishtilt` | 10 passed, unchanged |
| Orchestrator contrast re-measurement | all 6 pairings reproduced exactly |

## Not verified

- No visual QA: WP-C built reusable pieces with no page to mount them on. **WP-D owns
  photographing the matrix in situ**, and its brief requires it.
- No screen-reader pass; DOM roles and ARIA only.
- Real-device touch targets asserted by CSS class, not measured.
