# FISHTILT WP-B — learn-core domain mathematics

Delivered by a fresh-context agent; **independently re-verified by the orchestrator**
before acceptance. Both halves are recorded here, because a subagent's own PASS is not the
acceptance.

## What shipped (`packages/learn-core/src/`)

| Module | What it answers |
| --- | --- |
| `outs.ts` | Exact hypergeometric outs probabilities, plus the ×2/×4 shortcut as a separate, clearly-labelled field |
| `equity/exact.ts` | Exact heads-up hand-vs-hand equity by full enumeration, `method: 'EXACT'` |
| `handClass/facts.ts` | Structured facts for all 169 classes — kind, combo count, universe share, a deterministic example combo |

Presentation was kept out: `facts.ts` returns structure, never Korean strings. Copy belongs
to the app layer (ADR-0053).

## Why an exact equity path exists at all

At any budget an interactive request can afford, `strategy-core`'s engine labels a preflop
*range* equity `SUBSAMPLED`, and it is right to: a villain range preflop is on the order of
2.6 billion trials. (It will report `EXACT` if the full runout space is actually enumerated —
see the correction in `POKER_EDUCATIONAL_DATA_AUDIT.md` §3 — but that takes ~75 s per query,
which is an offline cost, not an interactive one.) But FishTilt's calculator
asks a narrower question — one hand against one hand — where four known cards leave only
C(48,5) = 1,712,304 runouts. That is exactly enumerable, so FishTilt enumerates it and can
honestly print `EXACT` instead of an estimate.

Measured: **202–217 ms** for the full preflop enumeration, single thread (3.4M evaluator
calls, allocation-free inner loop). Flop: 0.22 ms.

## The differential test — the strongest evidence in this WP

The villain is expressed as a single-combo range and fed to `strategy-core`'s
`equityVsRange`, which is a genuinely independent implementation: runout-outer over a
weighted 1326-combo range, colex unranking, basis-point weighted sums, and the *opposite*
card-removal strategy (it keeps villain's cards in the deck and discards colliding runouts;
`exact.ts` removes them up front).

- **Flop and turn**, 6 matchups each: agreement to 12 decimals. **Measured difference:
  exactly 0.0 on every comparison.**
- **River**: deterministic, asserted as literal 1/0/tie counts.
- **Preflop**, 8 matchups: within 0.005 equity share, justified from the oracle's ~80,800
  live runouts (binomial SE ≤ 0.00176, so the bound is ~2.8σ). Largest disagreement
  actually observed: **0.00127**. Both sides are deterministic, so this is a fixed bound,
  not a flakiness allowance.
- `outs.byRiverProb` cross-checked against `1 - C(u-o,k)/C(u,k)` for **all 94 legal out
  counts**; all **1326 combos** round-tripped through `handClassFactsOfCards`.

## Orchestrator's independent verification

- `packages/strategy-core` confirmed **untouched** — `git status` shows only the four files
  that were already modified by the in-flight session before this build began.
- Re-ran `pnpm vitest run --project learn-core`: **49 passed**, 5 files.
- Read `exact.ts`'s enumeration directly. The combinatorial odometer is correct; the river
  case (`needed === 0`) correctly scores exactly one runout; the 7-card hand is assembled
  as board + runout + hole cards with no duplicates possible, which is `evaluateStrength`'s
  precondition; `equity = win + tie/2` is the right heads-up split. The function does not
  *assume* exhaustiveness — it throws if `runouts !== C(deckSize, needed)`.
- Read `outs.ts`. `nextCardProb = outs/unseen`, flop `byRiver = 1 − miss(miss−1)/(47·46)`,
  `missThenHit = (miss/47)(outs/46)` — all correct, and the ×2/×4 shortcut is returned in a
  separate object with its own error terms rather than blended into the answer.

## Two deviations from the brief, both accepted

1. **Symmetry assertion.** The brief asked for equity shares summing to exactly 1 on a
   hero/villain swap. That is not universally true — `wins/n + (ties/n)/2` is a sum of
   separately rounded doubles, and a 400-spot sweep found 6 pairs off by one ulp. The test
   instead asserts the genuinely exact statement (`b.wins === a.losses`, and so on for
   every count) plus `|a.equity + b.equity − 1| ≤ Number.EPSILON`, which is *tighter* than
   the `toBeCloseTo(1, 12)` it replaced. Accepted: the assertion got stronger, not weaker.
2. **Turn `byRiverProb`.** On the turn, "by the river" and "the next card" are the same
   event, but the complement form and the direct form differ in the last bit — which would
   render as two different percentages for one fact. The same float is now returned for
   both. Accepted; the complement form remains primary on the flop and is still
   cross-checked against `binomial`.

## Noted, not acted on

`exact.ts` and `facts.ts` import the `@gto-self/strategy-core` barrel, matching how
`adaptive-core` and `apps/web` consume it. The barrel transitively pulls `poker-core` at
runtime. This is invisible to layering — ESLint and the layering test both pass, since
`learn-core` never *names* `poker-core` — but if FishTilt's client bundle size becomes a
concern, the fix is a subpath import. Subpaths are currently unused anywhere in the repo
and would need a Vitest alias check first. Revisit at WP-L2 (performance).

## Verification

| Gate | Result |
| --- | --- |
| `pnpm vitest run --project learn-core` | 49 passed, 5 files |
| `pnpm --filter @gto-self/learn-core typecheck` | pass |
| `npx eslint packages/learn-core` | pass |
| Orchestrator re-run of the above | pass |
