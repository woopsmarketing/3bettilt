# WP A2 — `packages/strategy-core` foundation

**Status:** complete · **Date:** 2026-09-01 · **Scope:** machinery only, zero strategy numbers

Builds the package, the neutral `StrategyQuery` model, the single documented adapter seam
onto `poker-core`, preflop spot canonicalization, stack buckets, and the full 1326-combo
range model. **No range, frequency, sizing or any other strategy number is encoded
anywhere in this WP** — that is the later policy work package's job.

---

## 1. Files created

### Package scaffold

| File                                   | Purpose                                                               |
| -------------------------------------- | --------------------------------------------------------------------- |
| `packages/strategy-core/package.json`  | `@gto-self/strategy-core`, private, ESM, deps `shared` + `poker-core` |
| `packages/strategy-core/tsconfig.json` | copied from `player-core`                                             |
| `packages/strategy-core/README.md`     | layering contract in prose                                            |

No `zod`: validation follows the hand-written `Result` idiom (`player-core/errors.ts`).

### Source

| File                           | Lines | Contents                                                                 |
| ------------------------------ | ----: | ------------------------------------------------------------------------ |
| `src/errors.ts`                |    77 | `StrategyErrorCode` / `StrategyError` / `StrategyResult` / `strategyErr` |
| `src/provenance.ts`            |    54 | `SOURCE \| DERIVED \| HEURISTIC` axis, `Provenanced<T>`                  |
| `src/bps.ts`                   |   161 | `Bps` brand, `apportion`, `divideByBpsTotal` (largest remainder)         |
| `src/stackBucket.ts`           |   142 | five buckets + typed `OUT_OF_RANGE`                                      |
| `src/types.ts`                 |   225 | the neutral `StrategyQuery` and every mirror type                        |
| `src/range/combo.ts`           |   120 | 1326 combos, canonical index, parse/print                                |
| `src/range/handClass.ts`       |   139 | 169 classes, 13x13 matrix mapping                                        |
| `src/range/weights.ts`         |   389 | `RangeWeights`, all operations, 169-aggregation                          |
| `src/preflop/spot.ts`          |   279 | `classifyPreflopSpot` — 10 families + typed UNSUPPORTED                  |
| `src/adapter/fromHandState.ts` |   393 | **THE SEAM** — `buildStrategyQuery`                                      |
| `src/adapter/testHands.ts`     |    76 | TEST-ONLY real-hand fixtures (not exported from the barrel)              |
| `src/index.ts`                 |    30 | public surface                                                           |

### Tests (8 files, 138 tests)

`src/bps.test.ts`, `src/stackBucket.test.ts`, `src/range/combo.test.ts`,
`src/range/handClass.test.ts`, `src/range/weights.test.ts`, `src/preflop/spot.test.ts`,
`src/adapter/fromHandState.test.ts`, `src/adapter/preflopSpot.test.ts`.

### Root configs edited (mine for this WP)

- `tsconfig.base.json` — `@gto-self/strategy-core` + `/*` path entries.
- `vitest.config.ts` — `'strategy-core'` in `WORKSPACE_PACKAGES` + `nodeProject('strategy-core')`.
- `eslint.config.js` — one new layering block, one nested adapter carve-out, plus
  `@gto-self/strategy-core` (+ subpath) bans added to the `poker-core`, `gto-core`,
  `player-core`, `coinpoker-parser` and `solver-lab` blocks. (`shared` already bans
  `@gto-self/*` wholesale.)
- `pnpm-lock.yaml` — 9 lines, the new workspace importer only.

**Untouched, as required:** `packages/poker-core`, `packages/gto-core`,
`packages/player-core`, `packages/db`, `apps/web`, `docs/STATE.md`, `docs/DECISIONS.md`.

---

## 2. Public API summary

```
errors      StrategyErrorCode, StrategyError, StrategyResult<T>, strategyError, strategyErr
provenance  Provenance, PROVENANCES, isProvenance, Provenanced<T>, sourced, derived, heuristic
bps         Bps, BPS_TOTAL/ZERO/FULL, isBps, asBps, parseBps, clampBps, bpsToFraction,
            apportion(values, total) -> Result, divideByBpsTotal(products)
buckets     StackBucketId, StackBucketDefinition, StackBucketClassification, STACK_BUCKETS,
            MIN_BUCKETED_STACK_MBB, PRIMARY_STACK_BUCKET, classifyStackBucket, stackBucketById
types       StrategyStreet/Position/ActionKind/SeatStatus/BlindRole, StrategyActionRecord,
            StrategyLegalActions (+ Call/Wager/AllIn options), StrategySeatProfile,
            StrategyEnvironment, StrategyAggression, StrategyQuery
combo       ComboIndex, COMBO_COUNT (1326), ALL_COMBOS, comboIndexOf, comboCards,
            comboToString, parseCombo, comboContainsCard, combosContainingCard, isComboIndex
handClass   HandClassIndex, HandClass, HAND_CLASSES (169), handClassAt/ByKey/OfCombo,
            handClassIndexOfCombo, RANK_GRID_SIZE, HAND_CLASS_COUNT
range       RangeWeights, ComboFrequencies, emptyRange, uniformRange, rangeFrom,
            rangeFromEntries, comboFrequenciesFrom, uniformFrequencies, copyWeights,
            weightAt, withWeight, totalWeightBps, activeComboCount, rangePercentage,
            toEntries, enumerateCombos, rangesEqual, removeConflicts, universeAfterRemoval,
            applyActionStrategy, normalizeRange, normalizeToFullWeight,
            aggregateToHandClasses, combosOfHandClass, HandClassAggregate, HandClassMatrix
preflop     PreflopSpotFamily, PreflopSpotUnsupportedReason, PreflopSpot,
            UnsupportedPreflopSpot, PreflopSpotClassification, classifyPreflopSpot
adapter     BuildStrategyQueryOptions, buildStrategyQuery(state, options?) -> StrategyResult
```

---

## 3. Key decisions

### 3.1 Combo indexing scheme

Colexicographic over the unordered pair, with `low < high` card indices (0..51 from
`shared/cards.ts`):

```
index = high * (high - 1) / 2 + low          0..1325
```

Chosen over rank-major alternatives because it is a closed-form bijection needing no
lookup table to be _defined_, and it is stable under any future change to how cards are
printed. Lookup tables (`Uint8Array` forward, `Int16Array` reverse) are derived from the
formula at module load for O(1) access; the formula remains the definition.

### 3.2 Basis points and the two apportionment schemes

Weights and frequencies are integer basis points 0..10000 (ADR-0016 item 4's convention,
applied to in-memory arithmetic as well as storage). Two rounding schemes, both
largest-remainder (Hamilton) with a fully specified tie-break — **larger remainder first,
then LOWER index**:

1. `apportion(values, total)` — proportional split hitting `total` **exactly**
   (`sum(result) === total` always). Used by `normalizeRange`. Refuses
   (`NORMALIZATION_UNDEFINED`) when every value is zero and `total > 0`; refuses
   (`INVALID_TOTAL`) a negative/fractional total.
2. `divideByBpsTotal(products)` — the `weight * P(action)` division. Products are in
   "bps squared"; each is floored by 10000 and the sub-basis-point residue is
   redistributed so that `sum(result) === floor(sum(products) / 10000)` **exactly**.
   FLOOR, never round: a conditioned range can be understated by under one basis point
   in total, never overstated.

`normalizeRange` additionally refuses (`INVALID_TOTAL`) a target that would need more
than 10000 bps on any single combo.

### 3.3 Range representation

`RangeWeights = { kind: 'RangeWeights'; bps: Uint16Array /* 1326 */ }` — 2.6 KB per range.
`ComboFrequencies` has identical backing but a different `kind` discriminant, so a range
can never be passed where per-combo action frequencies are expected. Immutability is by
API: every operation returns a new value, the backing array is only handed out through
`copyWeights()`, and that constraint is documented at the top of the module (TypeScript
cannot make typed-array elements readonly).

`rangePercentage(range, universeCombos?)` takes an explicit denominator so that after
card removal the honest denominator (1176 for a 3-card board, from
`universeAfterRemoval`) can be used instead of a vacuum 1326.

### 3.4 169-class matrix convention

Rows/cols are ranks **descending** (0 = A ... 12 = 2); `row === col` pair, `row < col`
suited, `row > col` offsuit; `index = row * 13 + col`. `aggregateToHandClasses` reports
`totalCombos`, `activeCombos`, `weightSumBps` and `fraction` per cell — combo count and
weight sum are kept separate because "one combo at 20%" and "four combos at 5%" are
different facts a fraction-only chart would hide.

### 3.5 Stack buckets

`[40,60) [60,80) [80,120) [120,160) [160,∞)` in BB, compared in **integer milliBB**
(half-open), so 59.999 BB is `BB_40_59` and exactly 60 BB is `BB_60_79`. `BB_80_119` is
the primary bucket. Below 40 BB there is **no** bucket: a typed
`{ kind: 'OUT_OF_RANGE', reason: 'BELOW_MINIMUM' }` member, never a borrowed policy. The
ACTUAL effective stack is carried in both branches (CLAUDE.md rule 3, ADR-0016 item 5).

### 3.6 Spot canonicalization rules

Applied in order, first match wins. "Aggression" = BET, RAISE, or an ALL_IN whose
`toAmount` exceeds the current bet it faced (derived once at the seam, mirroring the
engine's own `classifyWager` test).

| #   | Condition                                              | Result                                                                 |
| --- | ------------------------------------------------------ | ---------------------------------------------------------------------- |
| 0   | not preflop / no live opponent                         | UNSUPPORTED                                                            |
| 1   | hero is the last aggressor, 1 raise + caller behind    | `OPEN_PLUS_CALLER`                                                     |
| 1   | hero is the last aggressor, otherwise                  | UNSUPPORTED `HERO_IS_CURRENT_AGGRESSOR`                                |
| 2   | last aggression all-in and hero owes chips             | `VS_ALLIN`                                                             |
| 3   | 0 raises, 0 limpers / ≥1 limper                        | `RFI` / `VS_LIMP`                                                      |
| 4   | 1 raise, hero+aggressor are the last two, both blinds  | `BLIND_VS_BLIND`                                                       |
| 4   | 1 raise + cold caller, hero not yet in / already in    | `SQUEEZE` / `OPEN_PLUS_CALLER`                                         |
| 4   | 1 raise otherwise                                      | `VS_OPEN`                                                              |
| 5   | 2 raises, hero opened / hero never acted / hero called | `OPENER_VS_3BET` / `COLD_4BET` / UNSUPPORTED `CALLER_FACING_THREE_BET` |
| 6   | 3 raises, hero 3-bet / otherwise                       | `VS_4BET` / UNSUPPORTED `COLD_FIVE_BET`                                |
| 7   | ≥4 raises                                              | UNSUPPORTED `BEYOND_FOUR_BET`                                          |

`blindVsBlind` is also a **flag** on every family, so an SB-limp-into-BB spot stays
`VS_LIMP` with the flag set rather than being force-fitted. The spot also reports
`limperCount`, `coldCallerCount` (after the first aggression), `callerCount` (after the
last), `openerPosition`, `aggressorPosition`, `openSizeMbb`/`openSizeBB`,
`lastAggressionToMbb`/`ToBB`, `heroVsAggressor` (IP/OOP by postflop order), `heroHasActed`,
`playersRemaining`, `lineupSize`, `facingAllIn`. Covers 2- through 6-handed lineups.

### 3.7 Adapter refusal cases

`buildStrategyQuery(state, { heroSeat? })` refuses with a typed error rather than
guessing:

| Code                      | When                                                              |
| ------------------------- | ----------------------------------------------------------------- |
| `NOT_A_DECISION_POINT`    | `phase !== 'BETTING'` — nobody is on the clock                    |
| `HERO_UNKNOWN`            | no `state.heroSeat` and no `options.heroSeat`                     |
| `HERO_NOT_DEALT_IN`       | the hero seat is not in `dealtInSeats`                            |
| `HERO_NOT_ACTOR`          | hero is in the hand but `actorSeat !== hero`                      |
| `NO_LEGAL_ACTIONS`        | the engine offers hero no action                                  |
| `UNSUPPORTED_LINEUP`      | dealt-in count outside 2..6, or a dealt-in seat is `NOT_DEALT_IN` |
| `POSITION_UNAVAILABLE`    | a dealt-in seat or a past action carries no position label        |
| `UNSUPPORTED_ACTION_KIND` | an action record is not one of the six voluntary kinds            |
| `INVALID_HERO_CARDS`      | hero's holding is entered but is not exactly two cards            |
| `INVALID_BOARD`           | board length is not 0/3/4/5                                       |

A stack below 40 BB is deliberately **not** a refusal — it is carried as an
`OUT_OF_RANGE` bucket, because the query still describes the spot truthfully.

Everything derived is **read from the engine, never recomputed**: positions, legality,
call amounts, pot, SPR, pot odds, effective stack. The only derivations the adapter makes
itself are `isAggressive` (documented above), `heroInPosition` (hero's `postflopOrder`
strictly greater than every active opponent's — computed from postflop order even preflop,
because "in position" is a claim about the streets to come), and `deadMoneyMbb` (sum of
dead contributions).

### 3.8 Layering / the seam

`src/adapter/` is the one directory that may import `@gto-self/poker-core`
(`docs/GTO_DESIGN_NOTES.md` note F). Everything else in the package is shared-only and
consumes the neutral DTO. The neutral string unions (`StrategyStreet`, `StrategyPosition`,
...) are **declared independently**, not re-exported from poker-core: a re-export would
make every downstream consumer a consumer of the engine's type graph and quietly reverse
the seam. The adapter maps both ways with exhaustive switches (`assertNever`), so a change
on either side fails to compile at the seam rather than drifting.

ESLint enforcement uses the flat-config last-match-wins discipline the file's header
comment describes: the `packages/strategy-core/**/*.ts` block bans UI, DB, solver-lab,
`player-core`, `gto-core` **and `poker-core`**; the nested
`packages/strategy-core/src/adapter/**/*.ts` block repeats the full list **minus the
poker-core entry** — that omission is the entire carve-out.

**Carve-out proven.** A temporary probe importing `@gto-self/poker-core` and
`@gto-self/player-core/errors` from `src/preflop/spot.ts`, and `@gto-self/player-core`
from `src/adapter/fromHandState.ts`, produced exactly:

```
src/adapter/fromHandState.ts  48:1  error  '@gto-self/player-core' import is restricted ...
src/preflop/spot.ts           42:1  error  '@gto-self/poker-core' import is restricted ...
src/preflop/spot.ts           43:1  error  '@gto-self/player-core/errors' import is restricted ...
✖ 3 problems
```

i.e. poker-core is banned outside the adapter, allowed inside it, and the subpath variant
is caught. The probe was removed; `pnpm lint` is clean.

---

## 4. Verification

| Gate                                      | Result                                     |
| ----------------------------------------- | ------------------------------------------ |
| `pnpm vitest run --project strategy-core` | **PASS** — 8 files, **138 tests**          |
| `pnpm typecheck` (all 9 projects)         | **PASS**                                   |
| `pnpm lint` (whole repo)                  | **PASS** — 0 errors, 0 warnings            |
| ESLint carve-out probe                    | **PASS** — 3 expected errors, then removed |
| `prettier --write` on files I created     | applied (repo-wide format NOT run)         |

Test coverage by area:

- **bps** (17): guards, apportionment exactness, tie-break order, all-zero and
  negative-total refusals, residue redistribution, determinism.
- **stack buckets** (18): every exact BB edge (39.999/40, 59.999/60, 79.999/80,
  119.999/120, 159.999/160), OUT_OF_RANGE typing, tiling with no gap/overlap, actual
  stack retained, single primary bucket.
- **combo universe** (10): count 1326, bijection over all 1326 card pairs, index↔cards
  round-trip for all of them, order independence, duplicate-card rejection, parse/print,
  51 combos per card, 52·51/2 total.
- **169 classes** (7): 13/78/78 split, declared combos = 1326, key uniqueness, matrix
  placement, concrete-combo classification, real-universe counts match declarations.
- **range ops** (31): construction refusals, non-mutation, ascending enumeration; card
  removal (**AA 6 → 3 with one ace on the board**, 4 aces → 0, 3-card board 1326 → 1176);
  propagation incl. zero-weight combo, zero-frequency action, all-zero prior, residue
  distribution (`[1667,1666,1666]`, total 4999), determinism; normalization exactness,
  zero-total no-op, empty-range and ceiling refusals; 169-aggregation counts
  (13·6 + 78·4 + 78·12 = 1326), combo-count vs weight-sum separation.
- **adapter** (19, all on REAL poker-core hands): 6-max BTN RFI (positions, environment,
  legal actions incl. raise-TO bounds, history, stacks/bucket/opponents), facing an open,
  an all-in in front, five-handed ladder (`HJ CO BTN SB BB`), postflop after a flop is
  dealt (street/board/hero cards/preflop aggressor/OOP), all refusal codes, explicit
  `heroSeat` override, determinism, and SPR/pot-odds/call-amount identity against
  `spr()`/`potOdds()`/`callAmount()` from the engine.
- **spot classification** (36): 11-case family matrix on synthetic neutral queries plus
  10 real-hand family tests (RFI, VS_LIMP, VS_OPEN, SQUEEZE, OPEN_PLUS_CALLER,
  BLIND_VS_BLIND, OPENER_VS_3BET, COLD_4BET, VS_4BET, VS_ALLIN), every UNSUPPORTED reason,
  counter separation, IP/OOP, and determinism.

---

## 5. Risks / notes for the orchestrator

1. **`CALLER_FACING_THREE_BET` is UNSUPPORTED by design.** A player who limped or
   cold-called and then faces a 3-bet is a real and not-rare spot, but it is not in the
   family list this WP was given. It returns a typed UNSUPPORTED with that reason rather
   than being force-fitted into `COLD_4BET`. If the policy WP needs it, the family list
   must be extended deliberately.
2. **`OPEN_PLUS_CALLER` when hero is the opener** is reachable only in unusual
   configurations (the engine normally closes the round). It is defined and tested, but
   the common reading of that family is "hero already entered and now faces a raise plus
   callers", which is what the real-hand test exercises.
3. **`heroInPosition` with zero active opponents** is `true` (vacuously last to act). The
   adapter refuses before that matters in practice, but consumers should not read it as a
   strategy signal in that state.
4. **`applyActionStrategy` does not renormalize.** Conditioning shrinks a range's mass;
   callers who want relative frequencies must call `normalizeRange` /
   `normalizeToFullWeight` explicitly. This is deliberate and documented, but it is the
   most likely place for a downstream misuse.
5. **`RangeWeights.bps` is mutable at the type level.** TypeScript cannot express a
   readonly typed array element. The API never hands the internal array out, but a
   determined caller could write into it.
6. **`src/adapter/testHands.ts` is a non-test source file** carrying test fixtures (it is
   not exported from the barrel, mirroring `poker-core/src/testing.ts`). It is included in
   typecheck and lint.

---

## 6. ADR-worthy items

1. **`strategy-core` as a package separate from `gto-core`, with a single adapter seam.**
   Needs an ADR recording: (a) the local REFERENCE engine and the future solved-GTO
   provider are separate, mutually unaware packages; (b) `poker-core` is importable only
   from `packages/strategy-core/src/adapter/`, which is the note-F seam; (c) the neutral
   DTO's string unions are declared, not re-exported; (d) `player-core` is banned from
   `strategy-core` so player data can never influence the baseline. This extends
   ADR-0021/ADR-0023's import graph and is now enforced in `eslint.config.js`.
2. **The `SOURCE | DERIVED | HEURISTIC` provenance axis.** A NEW axis, orthogonal to the
   `MOCK` tag in `docs/GTO_BASELINE.md`: `MOCK` answers "is this real data?", provenance
   answers "how was this value produced?". The ADR should state that `HEURISTIC` requires
   a mandatory explanatory note (enforced at the type level by `Provenanced<T>`) and that
   a `HEURISTIC` value may never be presented as solved output (CLAUDE.md rule 2).
3. _(Secondary, orchestrator's call)_ **The two largest-remainder rounding schemes and the
   floor-not-round rule for range conditioning** — an integer-money-adjacent convention
   that the policy WP and any future storage layer must not re-invent differently.
4. _(Secondary)_ **Stack-bucket edges and the `OUT_OF_RANGE` member** — half-open integer
   milliBB comparison, 80-119 primary, nothing below 40 BB modelled.
