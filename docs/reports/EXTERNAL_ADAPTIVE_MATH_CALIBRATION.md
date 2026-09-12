# WP-K3 — 1% ADAPTIVE grid + WSD sizing rule

Continues `EXTERNAL_ADAPTIVE_00_AUDIT.md` §4 (K3's scope call) and
`EXTERNAL_ADAPTIVE_PROFILE_IMPORT.md` (K1). This report covers K3 only: sharpening
ADAPTIVE's display grid from REFERENCE's 5% to 1%, and adding the one sizing rule
`prompt` §7 names as unused (`WSD`).

## 1. What changed, and what deliberately did not

**Did not change:** the frequency pipeline's arithmetic (gain → confidence-scaling →
per-rule cap → limiters → pro-rata transfer → normalize), the 12 frequency rules, the
existing 4 sizing rules, the shrinkage formula, or any safety cap. As recorded in the
audit report §4, `prompt` §6's "consider log-odds/softmax" is a "검토한다" ask, not a
mandate, and this pipeline is independently-reviewed (review R1) hardened arithmetic; it
already produces continuous bps deviations and only rounds once, at the very last step.
Rewriting it was rejected as disproportionate to what §6 actually requires, which is a
finer *display* grid — the literal ask of §5.

**Did change:** the one rounding step, and its accompanying post-quantization trim.

### 1.1 `packages/strategy-core/src/preflop/recommendation.ts`

`quantizeFrequencies(values)` (REFERENCE's own apportionment onto its 500-bps grid) is
now a thin wrapper:

```ts
export function quantizeFrequenciesToGrid(values: readonly number[], stepBps: number): readonly Bps[] {
  invariant(
    Number.isInteger(stepBps) && stepBps > 0 && BPS_TOTAL % stepBps === 0,
    `stepBps ${stepBps} must be a positive divisor of ${BPS_TOTAL}`,
  );
  const units = apportion(values, BPS_TOTAL / stepBps);
  invariant(units.ok, 'cannot quantize an all-zero frequency set');
  return units.value.map((unit) => asBps(unit * stepBps));
}

export function quantizeFrequencies(values: readonly number[]): readonly Bps[] {
  return quantizeFrequenciesToGrid(values, FREQUENCY_STEP_BPS); // 500, unchanged
}
```

Every REFERENCE call site still calls `quantizeFrequencies` and is byte-identical — the
full `strategy-core` suite (783 tests, including the REFERENCE exhaustive spot matrix)
passed unchanged. `adaptive-core` is the only caller of the new
`quantizeFrequenciesToGrid` with a non-500 step.

### 1.2 `packages/adaptive-core/src/policy/frequency.ts`

- `GRID_STEP_BPS` changed from `500` to `100` (ADAPTIVE's own constant, not shared with
  REFERENCE's `FREQUENCY_STEP_BPS`).
- The quantize call site now reads
  `quantizeFrequenciesToGrid(projected, GRID_STEP_BPS)`.
- `trimToCap` (the post-quantization safety net that hands grid units back if rounding
  pushed a mix just outside `MAX_TOTAL_SHIFT_BPS_*`) already took its step size from
  `GRID_STEP_BPS`, not a hard-coded literal — parameterizing the grid also parameterized
  the trim with no code change beyond the constant. The proof of termination is unchanged
  in shape: each move reduces the measured shift by exactly one grid unit (100, not 500)
  and is undone if it does not strictly help, bounded by `GRID_UNIT_COUNT =
  10000/100 = 100` iterations.
- The "no-progress branch is unreachable" argument in the doc comment was re-derived for
  the smaller step (a row's own `|delta|` would need to be under 50 on both sides, not
  250, for a move to fail to help — the conclusion, "cannot occur with at most six
  baseline rows", is unchanged) and reworded to stop citing the old 250/500 numbers.
- Header comment's pipeline description (steps 5 and 6) updated to say "1%/100-bps
  grid" instead of quoting REFERENCE's 500-bps grid as if ADAPTIVE shared it.

### 1.3 Sizing: `SIZE_WINNER_VALUE_UP` (`packages/adaptive-core/src/policy/sizingModel.ts`)

`prompt` §7 asks that sizing read from `FOLD_TO_CBET`, `CHECK_RAISE`, `WTSD` and `WSD`.
Reading the existing 4 rules confirmed `FOLD_TO_CBET`/`CHECK_RAISE`/`WTSD` were already
each used by an existing rule; `WSD` (won $ at showdown — what happens *once* a showdown
is reached, as opposed to `WTSD`, which measures reaching one at all) was not. Added:

```ts
{
  id: 'SIZE_WINNER_VALUE_UP',
  stat: { kind: 'FIXED', stat: 'WSD' },
  streets: POSTFLOP,
  appliesWhen: 'HERO_MAY_AGGRESS',
  bands: VALUE_ONLY,
  direction: 'ABOVE_PRIOR',
  steps: 1,
  provenance: 'HEURISTIC',
  reasonKey: 'OPPONENT_WINS_SHOWDOWNS',
  note: '...', // see sizingModel.ts — the WTSD-vs-WSD distinction, VALUE-only scope, and
               // why it collapses with the two SIZE_STATION_* rules under
               // MAX_SIZING_BUCKET_DELTA if more than one fires
},
```

Same shape, same confidence gate (`SIZING_MIN_CONFIDENCE_BPS_HEADS_UP` / `_MULTIWAY`,
unchanged) and same `+1`/VALUE-only discipline as the existing station-value rules — a
sizing rule never sizes up outside a VALUE band, the property that keeps this pass from
turning a bigger bluff loose against a station.

A new closed-union reason key, `OPPONENT_WINS_SHOWDOWNS` ("기준보다 쇼다운 승률이
높음"), was added to `AdaptiveReasonKey` (`policy/reasons.ts`) since the WSD read is a
genuinely different observation from `OPPONENT_GOES_TO_SHOWDOWN` (WTSD) — conflating them
would say "reaches showdown" when the fact is "wins once there". Korean copy for both the
reason and the new rule id was added to the exhaustive `Record`s in
`apps/web/src/lib/table/copy.ts` (`ADAPTIVE_REASON_LABEL`, `ADAPTIVE_RULE_LABEL`) —
TypeScript's exhaustiveness check caught both sites as compile errors until filled in,
exactly the safety net `AdaptiveReasonKey`/`AdaptiveSizingRuleId` are documented to be.

## 2. Invariants re-verified at the finer grid

All four hold, and are exercised by the existing (updated, not weakened) test suite:

- **Sum = 10000.** `apportion`'s own guarantee, independent of step size — confirmed by
  `cap.test.ts`, `invariants.test.ts`'s full spot-matrix sweep, and every `compose.test.ts`
  fixture.
- **No new action kind.** Structural — the working vector is indexed by the baseline's
  own rows and no row is ever appended; unaffected by grid size. Unchanged code.
- **No action REFERENCE assigned 0% ever becomes positive.** `prompt` §5 asks this be
  "재검토하되 임의로 풀지 말고 보고서에 명시" (reconsidered, not silently loosened, and
  recorded here): it is unchanged — the pass still moves mass pro rata across only the
  actions the baseline already offers a row for, and `TARGET_ABSENT` still refuses a
  transfer with nowhere legal to land. This is an MVP limitation carried over from WP-J
  verbatim, not reopened by K3.
- **Determinism.** Pure integer arithmetic throughout; unchanged.
- **Global shift cap survives quantization.** `cap.test.ts`'s pinned overshooting
  baselines still trip `trimToCap`, now trimming in 100-bps units; both the "on-grid" and
  the documented-unreachable "off-grid input" cases were re-verified against the new
  modulus (`% 100 === 0` in place of `% 500 === 0`).

## 3. Test changes (no assertion weakened or deleted)

Every changed assertion is a **grid-size migration** of a previously-pinned literal, not
a loosened invariant — each new literal was computed by actually running
`composeAdaptive` against the fixture (not hand-derived), confirmed with a scratch probe
script before being written into the test, then deleted:

- `packages/adaptive-core/src/compose.test.ts` — 4 pinned frequency literals moved from
  their 500-bps values to their exact 100-bps equivalents (`J10.3`, `J10.4`, `J10.5`, and
  the sample-size comparison in row 2); one fixture in the `changedFromBaseline` describe
  block (`WTSD` sizing-without-frequency-movement case) was re-tuned (`n=200,v=4000` →
  `n=60,v=3200`) because at the finer grid the original fixture's 208-bps frequency
  contribution now clears half a 100-bps rung and moves the mix — the *property* being
  tested ("size can move alone") still needed a fixture where it holds, so a new one was
  found by sweeping `n`/observed-value pairs for one where the frequency contribution
  stays under 50 bps while sizing's confidence gate (which uses a different threshold,
  `SIZING_MIN_CONFIDENCE_BPS_HEADS_UP = 5000`) still clears.
- `packages/adaptive-core/src/policy/cap.test.ts` — grid-modulus checks (`% 500` →
  `% 100`) and the one-rounding-tolerance bound (`MAX_TOTAL_SHIFT_BPS_MULTIWAY + 500` →
  `+ 100`).
- `packages/adaptive-core/src/policy/invariants.test.ts` — the full-matrix sweep's
  grid-modulus check (`% 500` → `% 100`), and the pinned sizing-rule-id list extended
  with `SIZE_WINNER_VALUE_UP`.
- `apps/web/src/lib/table/adaptive.test.ts` and
  `apps/web/src/server/adaptive-trace-service.test.ts` — same grid-modulus migration for
  the two web-level tests that independently assert ADAPTIVE output lands on a grid.

## 4. Verification

- `pnpm vitest run --project adaptive-core` — 110/110 passed.
- `pnpm vitest run --project strategy-core` — 783/783 passed, unchanged (confirms
  REFERENCE stayed byte-identical).
- `pnpm vitest run --project web` — 474/477 passed, 3 skipped (unrelated pre-existing
  skips), 0 failed.
- `pnpm typecheck` (all 11 packages) — clean.
- `pnpm lint` — clean (layering rules included).

## 5. Known limitation carried forward

Unchanged from WP-J and re-confirmed, not re-litigated: ADAPTIVE cannot turn a
0%-frequency action into a real one if REFERENCE's baseline omitted the row entirely —
the finer grid changes how close to true zero a real percentage can land, not whether an
absent row can be manufactured. Recorded in `docs/STATE.md`'s known-issues list alongside
the original WP-J entry.
