# Strategy A+B — REFERENCE engine, final milestone report

**Date:** 2026-09-01 · **Milestone:** Strategy A+B (기본전략 · REFERENCE) · **Scope:**
`packages/strategy-core/**`, `apps/web/src/lib/table/strategy.ts`,
`apps/web/src/components/table/StrategyPanel.tsx`

This document explains, end to end, **why the percentages and the bet size you see in the
Strategy panel are the ones you see**. It is written for a reader who is not a poker
professional: every piece of jargon is defined the first time it appears, and every number in
it was either read out of the source code or produced by running the real engine (see the two
worked examples at the end).

Where a work-package report and the code disagree, **the code wins** and the disagreement is
recorded in section 19.

---

## 0. What this engine is, and what it is not

**It IS** a deterministic, local, *reference* strategy engine. Give it the same hand twice and
it returns a bit-identical answer, on any machine, forever. It looks at the situation you have
entered, classifies it, looks up a documented table or runs a documented scoring model, and
returns a set of action frequencies (e.g. "check 20%, bet 80%") plus, when the answer includes
a bet or a raise, one legal amount in integer milliBB.

**It IS NOT:**

- **Not GTO.** "GTO" (game-theory optimal) means output from a solver that has actually
  computed an equilibrium. Nothing here does that. The user-facing badge is the constant string
  `REFERENCE` (Korean: 기본전략 · REFERENCE), it is a literal type-level constant in both
  recommendation shapes, and a test serialises a whole recommendation and greps it to prove the
  three letters G-T-O appear nowhere in it. CLAUDE.md rule 2 and ADR-0056 both forbid the label.
- **Not a solver.** There is no CFR, no tree traversal, no iteration to convergence. Preflop is
  a table lookup; postflop is a weighted-average score over fifteen measurements.
- **Not connected to any poker client.** No screen reading, no OCR, no scraping, no automation,
  no live-table assistance. The user types the hand in by hand. This is a hard product boundary
  (CLAUDE.md), not a preference.
- **Not a source of precision it does not have.** Every emitted frequency is a multiple of 500
  basis points — five percentage points. `63.72%` is *unrepresentable by construction*. Every
  bet size is one of eight fixed pot fractions or an all-in; `47.83% pot` is likewise
  unrepresentable.
- **Not a claim about your opponents.** No player statistics, tendencies or history feed it
  (`player-core` is banned from the package by lint).

### 0.1 Milestone acceptance checklist status

Taken from `docs/STATE.md` "Current" as of this report:

| item | status |
| --- | --- |
| A1 — sit-out toggle (ACTIVE ↔ SITTING_OUT) from the running table | **done** |
| A2 — `strategy-core` foundation: neutral query, adapter seam, spot classification, stack buckets, 1326-combo range model | **done** |
| Public anchor verification (`STRATEGY_ANCHORS.md`) | **done** |
| A3 — preflop REFERENCE policy, provenance-tagged rules, range propagation | **done** |
| B1 — hand evaluator + board analyzer + hero-hand analyzer | **done** |
| B2 — deterministic equity engine, no RNG anywhere | **done** |
| B3 — postflop REFERENCE policy, whole scoring model exported as data | **done** |
| B4 — Strategy Panel in the right aside, compute scheduled off the action hot path | **done** |
| Two independent adversarial reviews | **done** — R1 (2 BLOCKER / 8 MAJOR / 13 MINOR), R1B (0 / 5 / 11) |
| All BLOCKERs and all 13 distinct MAJORs fixed, each with a test proven to fail on revert | **done** — four fix packages |
| Integration gate after fixes | **green** — workspace vitest 105 files / 1811 tests; `strategy-core` 766; typecheck, lint, build clean; strategy-panel + seat-occupancy E2E 8/8 |
| Independent re-verification against the fixed tree | **in flight** (peer session, read-only) |
| Single frozen-source final gate (`pnpm verify` + full E2E) | **not yet run** — deliberately deferred to source freeze |

### 0.2 Where the independent scrutiny is written down

Two adversarial reviews, run independently:

- `docs/reports/STRATEGY_REVIEW_R1.md` — 2 BLOCKER, 8 MAJOR, 13 MINOR.
- `docs/reports/STRATEGY_REVIEW_R1B.md` — 0 BLOCKER, 5 MAJOR, 11 MINOR, two of the MAJORs
  unique to it.

Four fix packages answer them:

- `docs/reports/STRATEGY_FIX_BUTTON.md` — the button/sit-out interaction (produced ADR-0058).
- `docs/reports/STRATEGY_FIX_PREFLOP.md` — the SB per-class trim, the all-in-in-tree family
  fix, the "a shove the engine calls a CALL is not aggression" fix, the propagation legality fix.
- `docs/reports/STRATEGY_FIX_POSTFLOP.md` — the multiway equity normalization, the ALL_IN gate,
  the heads-up-button and faced-bet-size defects on the postflop side.
- `docs/reports/STRATEGY_FIX_R1B.md` — the price-implied continue floor, the isolation raise
  facing an all-in, the faced-bet-fraction quantity, and the corrected benchmark.

The work-package reports (`STRATEGY_WP_{A1,A2,A3,B1,B2,B3,B4}.md`) describe the state at the
time each package landed; several are superseded by the fix reports and say so in appended
correction notes.

**Two caveats about that paper trail, stated up front.** The BLOCKER and MAJOR findings were all
fixed with reverting tests; the **MINOR and NOTE findings were never routed as a set**, and nine
of R1's thirteen MINORs have no recorded disposition anywhere — section 19.4 enumerates them.
And the two review files share an identical H1, with the on-disk R1 report not matching the
finding labels its own fix agents worked from (section 20, items 12–13). Every statement in this
report was therefore verified against the source code or a live engine run, not against a report.

---

## 1. Architecture

```
  ┌──────────────────────────────────────────────────────────────────────────────┐
  │ apps/web  (React / Next)                          may import EVERYTHING      │
  │                                                                              │
  │   StrategyPanel.tsx                                                          │
  │     useEffect(() => { const t = setTimeout(run, 0); return () => clear(t) },  │
  │                       [hand])           ← the analysis is a MACROTASK, so a   │
  │        │                                  keystroke never waits on it         │
  │        ▼                                                                     │
  │   lib/table/strategy.ts :: computeStrategy(HandState, heroSeat)               │
  │        │   pure, synchronous, no fetch, no server action, no DB               │
  └────────┼─────────────────────────────────────────────────────────────────────┘
           │  StrategyPanelModel  (a read model: it reads fields, authors nothing)
  ═════════╪═══════════ package boundary — ADR-0055 ══════════════════════════════
           ▼
  ┌──────────────────────────────────────────────────────────────────────────────┐
  │ @gto-self/strategy-core                                                      │
  │                                                                              │
  │  src/adapter/fromHandState.ts        ◀── THE ONLY directory in this package   │
  │    buildStrategyQuery(HandState)         allowed to import @gto-self/poker-   │
  │      → Ok(StrategyQuery) | Err(10 typed refusal codes)                       │
  │                            │             core.  ESLint enforces it.           │
  │                            ▼                                                 │
  │                     ┌─────────────┐                                          │
  │                     │StrategyQuery│  neutral DTO. Its `Street` / `Position`   │
  │                     └──────┬──────┘  unions are declared INDEPENDENTLY, never  │
  │                            │         re-exported, so the seam cannot reverse. │
  │           ┌────────────────┴────────────────┐                                │
  │           ▼                                 ▼                                │
  │  preflop/spot.ts                    postflop/spot.ts                          │
  │  classifyPreflopSpot                classifyPostflopSpot                      │
  │  10 families + typed UNSUPPORTED    6 families + typed UNSUPPORTED            │
  │           │                                 │                                │
  │           ▼                                 ▼                                │
  │  range/  (1326 combos, integer bps)  postflop/ranges.ts  ← reuses preflop     │
  │  preflop/propagate.ts                       │              propagation         │
  │           │                                 ▼                                │
  │           │                          postflop/context.ts  (MEASUREMENT layer) │
  │           │                            ├── equity/equity.ts    hero equity     │
  │           │                            ├── equity/rangeEquity  range advantage │
  │           │                            ├── equity/strength.ts  nut advantage   │
  │           │                            ├── analysis/board.ts   board features  │
  │           │                            └── analysis/heroHand.ts hand features  │
  │           ▼                                 ▼                                │
  │  preflop/policy.ts                   postflop/score.ts + scoreModel.ts        │
  │   tables.ts (constants)               scoreModel.ts holds EVERY constant;     │
  │   sizing.ts (ratios → milliBB)        score.ts holds control flow and NO      │
  │   rules.ts  (35 rules)                constant.  sizing.ts, rules.ts (43)     │
  │           │                                 │                                │
  │           └────────────┬────────────────────┘                                │
  │                        ▼                                                     │
  │        StrategyRecommendation  /  PostflopRecommendation                      │
  │        label: 'REFERENCE'  ·  actions[] (bps, sum = 10000)  ·  metrics        │
  │        provenance{quality, ruleIds, notes, environmentCompatibility}          │
  │        explanation{typed features — ids and numbers, never prose}             │
  └──────────────────────────────────────────────────────────────────────────────┘

  Banned inside strategy-core by ESLint: React/Next, @gto-self/db, @gto-self/player-core,
  @gto-self/gto-core, solver-lab.  Banned from importing strategy-core: poker-core,
  gto-core, player-core, coinpoker-parser, solver-lab.
```

**Why the seam matters.** Everything past `buildStrategyQuery` sees only the neutral
`StrategyQuery`. That means the strategy code physically cannot re-derive a poker rule: whose
turn it is, what a legal raise size is, what the pot is, what "in position" means — all of it is
*read* from the engine's own answer, never recomputed. If poker-core changes its `Street` union,
the adapter's exhaustive `switch` fails to compile rather than drifting silently.

**Why the panel schedules rather than computes.** ADR-0043 says the path from a keystroke to a
visible change never waits on anything. A postflop recommendation is real work (section 18), so
`StrategyPanel`'s effect only *schedules* a `setTimeout`; the analysis runs in a later task, after
the user's own action has already committed to screen. `clearTimeout` supersedes a computation
that has been **scheduled and not started** — a burst of six transitions in one task analyses the
sixth state and never begins the first five. It does **not** interrupt a computation already
running: `computeStrategy` is one synchronous call with no yield point. That sentence is in the
component's own header, because an earlier version of the comment overclaimed and review R1
caught it.

---

## 2. Where the preflop numbers come from

Preflop, the engine does not compute anything about hand strength — it looks up tables. Those
tables were calibrated against **free, public poker-education pages**, verified one by one in
`docs/reports/STRATEGY_ANCHORS.md` (all sources accessed 2026-09-01).

Explicitly **not** used: GTO Wizard content, any paywalled content, any bulk scraping of a range
library. Two aggregator blogs (Preflop Wizard, FreeBetRange) were read as single public articles
for percentage cross-checking only, and are deliberately demoted from "primary coaching source".

### 2.1 The fourteen sources

| id | publisher | what it supplied |
| --- | --- | --- |
| S1 | PokerCoaching.com — preflop charts | the only public 13×13 hand-class detail for 6-max cash 100 BB; RFI / 3-bet / 4-bet sizing |
| S2 | nlh.poker | qualitative "ranges widen toward the button"; 2.5 BB sizing note |
| S3 | Preflop Wizard (blog) | RFI percentage per position; 2.5 BB / 3 BB SB sizing |
| S4 | FreeBetRange (blog) | RFI percentage per position; sizing rationale |
| S5 | Upswing — 3-bet strategy | 3-bet sizing IP vs OOP; linear-vs-polarized range shape |
| S6 | Upswing — 4-bet size | 4-bet sizing for cash at 100 BB |
| S7 | SplitSuit — squeezes | squeeze sizing, flat 3x + 1x per caller |
| S8 | BlackRain79 — preflop bet sizing | open sizing by position, 3-bet 3x IP / 4x OOP, squeeze 4x IP / 5x OOP, +1 BB per limper |
| S9 | PokerCoaching — big blind strategy | qualitative BB defence only (no percentage) |
| S10 | Upswing — small blind strategy | SB is raise-or-fold in cash; SB opens 40–50%; blind-vs-blind ~3x |
| S11 | Upswing — 6-handed strategy | the mechanism by which a shorter field widens ranges |
| S12 | PokerCoaching — antes | antes widen ranges (tournament numbers only) |
| S13 | Upswing — BB vs SB limp | BB raises an SB limp ~40–45%, sized 3.5–4 BB |
| S14 | CardPlayer — big blind glossary | worked pot-odds/equity-needed numbers |

*Jargon:* **RFI** = "raise first in", i.e. everyone before you folded and you open the pot.
**IP / OOP** = in position / out of position — whether you act last or first on the streets to
come. **3-bet** = the second raise, **4-bet** = the third. **Squeeze** = re-raising an open when
somebody has already called it. **Limp** = entering by calling the big blind rather than raising.

### 2.2 The verdicts, and what each one licensed

| anchor | subject | verdict | consequence in code |
| --- | --- | --- | --- |
| 1 | RFI ranges per position | percentages **VERIFIED** (S1+S3+S4 converge); exact 13×13 hand lists **single-sourced → DERIVED** | `RFI_NOTATION` is S1 verbatim; `tables.test.ts` asserts the percentage each list produces falls inside the published band |
| 2 | RFI sizing | **VERIFIED (SOURCE)** — 2.5 BB, 3 BB from SB | `SIZING.RFI_STANDARD_BB = 5/2`, `RFI_SB_BB = 3/1` |
| 3 | 3-bet sizing | OOP ~4x **VERIFIED**; IP **sources disagree** (S5/S8 say 3x, S1 says 3.5x) | OOP is `SOURCE`; IP is `DERIVED` at 3.0x, with 3.5x kept in code as `THREE_BET_IP_ALTERNATIVE` so the disagreement stays visible |
| 4 | 4-bet sizing | **VERIFIED (SOURCE)** — 2.3x IP, 2.5x OOP | `FOUR_BET_IP = 23/10`, `FOUR_BET_OOP = 5/2` |
| 5 | squeeze sizing | **sources disagree** (S7 flat 3x+1x vs S8 4x IP / 5x OOP +1x) | S8 chosen (`DERIVED`), S7 recorded as `SQUEEZE_FLAT_ALTERNATIVE`. The anchor doc explicitly forbids averaging the two |
| 6 | SB strategy and BB defence | SB raise-or-fold and the 40–47% band **VERIFIED**; a "defend X% vs each position" table **UNVERIFIED** | the SB trim is `DERIVED`; **every** defence tier is `HEURISTIC`. Only S14's pot-odds *relationship* is SOURCE |
| 7 | blind-vs-blind and vs-limp | qualitative shape verified, numerics **single-sourced** | `BB_VS_SB_LIMP_BB = 7/2` is `DERIVED` |
| 8 | short-handed (5/4-handed) | mechanism **VERIFIED**, the mechanical reuse rule **UNVERIFIED** | preflop registry tags it `DERIVED` on its brief; the postflop registry tags it `HEURISTIC` following the anchor doc — a known, documented divergence |
| 9 | ante adjustment | direction only; **no cash-applicable numeric factor exists publicly** | **no numeric ante adjustment is applied anywhere.** An ante table reports `ANTE: DIVERGENT` |

The single most important line in that table is anchor 6. **There is no public source that
states what percentage of hands to defend against an open.** Everything the engine says about
defending is this project's own authored rule of thumb, and it is labelled `HEURISTIC`
everywhere it surfaces.

---

## 3. SOURCE, DERIVED, HEURISTIC — and the full rule inventory

### 3.1 The three tags (ADR-0056, quoted from `provenance.ts`)

- **`SOURCE`** — directly represented by an accepted public reference rule or table, verified
  against the cited page in `STRATEGY_ANCHORS.md`. Note what this does *not* say: it is not
  "read out of a stored dataset". A table this package types out from a cited public chart is
  `SOURCE`; a number with no anchor is not, however mechanically it was produced.
- **`DERIVED`** — deterministically mapped from a nearby reference environment or spot, with the
  mapping rule documented (a bucket interpolation, a combo-to-class aggregation, a mechanical
  trim of a sourced list). **A deterministic function of `HEURISTIC` inputs is `HEURISTIC`, not
  `DERIVED`: the tag describes the weakest input, not the arithmetic.**
- **`HEURISTIC`** — this project's own explicit deterministic fallback. Never solved output,
  never presented as one, and it carries a **mandatory** explanatory note — enforced at the type
  level, because `Provenanced<T>`'s `HEURISTIC` variant makes `note` non-optional.

A recommendation's overall `provenance.quality` is the **worst** tag among every rule that
contributed. That is why almost every postflop answer reads `HEURISTIC` even though the equity
arithmetic inside it is exact.

### 3.2 Preflop rule registry — 35 rules

`packages/strategy-core/src/preflop/rules.ts`. Distribution: **4 SOURCE, 14 DERIVED,
17 HEURISTIC.**

| group | rule ids | provenance |
| --- | --- | --- |
| Range selection (15) | `RFI_TABLE`, `RFI_SB_RAISE_ONLY_TRIM`, `VS_LIMP_BB_VS_SB` | DERIVED |
| | `RFI_HEADS_UP_BUTTON`, `VS_LIMP_ISO`, `VS_OPEN_MIX`, `BLIND_VS_BLIND_MIX`, `SQUEEZE_MIX`, `OPEN_PLUS_CALLER_CONTINUE`, `OPENER_VS_3BET_MIX`, `COLD_4BET_MIX`, `VS_4BET_MIX`, `VS_ALLIN_POT_ODDS`, `FACING_ALLIN_IN_TREE`, `UNSUPPORTED_SPOT_FALLBACK` | HEURISTIC |
| Sizing (10) | `SIZE_RFI`, `SIZE_THREE_BET_OOP`, `SIZE_FOUR_BET_IP`, `SIZE_FOUR_BET_OOP` | **SOURCE** |
| | `SIZE_ISO_VS_LIMP`, `SIZE_BB_VS_SB_LIMP`, `SIZE_THREE_BET_IP`, `SIZE_SQUEEZE` | DERIVED |
| | `SIZE_FIVE_BET_SHOVE`, `SIZE_FACING_ALLIN_JAM` | HEURISTIC |
| Policy mechanics (4) | `LEGALITY_CLAMP`, `LEGALITY_SUBSTITUTION`, `FREQUENCY_QUANTIZATION`, `PRIMARY_ACTION_TIE_BREAK` | DERIVED |
| Degradation (5) | `STACK_BUCKET_NEARBY`, `LINEUP_SHORT_HANDED` | DERIVED |
| | `STACK_BUCKET_DISTANT`, `STACK_BUCKET_OUT_OF_RANGE`, `LINEUP_VERY_SHORT_HANDED` | HEURISTIC |
| Environment (1) | `ENVIRONMENT_COMPATIBILITY` | DERIVED |

**The four SOURCE rules in the entire preflop engine are all bet SIZES.** Not one range is
SOURCE. That is the honest summary of what public material actually supports.

### 3.3 Postflop rule registry — 43 rules

`packages/strategy-core/src/postflop/rules.ts`. Distribution: **0 SOURCE, 9 DERIVED,
34 HEURISTIC.** A test asserts the no-SOURCE property over the whole registry.

The nine `DERIVED` rules are: `POSTFLOP_SPOT_CLASSIFICATION` (mechanical read of the action
list), `POSTFLOP_REQUIRED_EQUITY` (the one restatement of S14's sourced pot-odds relationship),
`SIZING_POT_FRACTION_TO_AMOUNT` (integer milliBB arithmetic), the four mechanics rules mirrored
from preflop, `STACK_BUCKET_NEARBY`, and `ENVIRONMENT_COMPATIBILITY`.

Everything else — every weight, every threshold, every score-to-frequency band, every sizing
modifier, the range model, the nut-share definition, the multiway adjustments — is `HEURISTIC`.
The reason is stated in the registry header: `STRATEGY_ANCHORS.md` verified **preflop material
only**, and contains exactly one postflop-applicable relationship (S14's pot odds).

The 43 rules by group: spot/range model (5), measurement (7), scoring model (5), multiway (3),
all-in (3), sizing (10), policy mechanics (4), degradation and environment (6).

---

## 4. Stack buckets

*Jargon:* the **effective stack** is the smaller of your stack and your opponent's — the most
money that can actually change hands. It is expressed in big blinds (BB).

The public charts are authored for 100 BB. The engine therefore normalizes the actual stack into
a **bucket**, and uses the bucket as a lookup key — while always carrying the **actual** number
alongside it (CLAUDE.md rule 3: a normalized value never replaces what the user has).

| bucket id | range (half-open, compared in integer milliBB) | role |
| --- | --- | --- |
| `BB_40_59` | `[40, 60)` BB | distant |
| `BB_60_79` | `[60, 80)` BB | nearby |
| `BB_80_119` | `[80, 120)` BB | **PRIMARY** — the tables are authored here |
| `BB_120_159` | `[120, 160)` BB | nearby |
| `BB_160_PLUS` | `[160, ∞)` BB | distant |
| `OUT_OF_RANGE` | below 40 BB | **not a bucket at all** |

Boundaries are half-open in milliBB, so 59.999 BB is `BB_40_59` and exactly 60.000 BB is
`BB_60_79`. Comparison never happens in floating-point BB.

**`OUT_OF_RANGE` is a typed member, not an error and not a silent fallback.** Below 40 BB,
short-stack play is a different game and this package does not model it. The engine still
answers — refusing would be less useful than answering honestly — but it reuses the reference
tables with **every provenance forced to `HEURISTIC`** and emits an `UNMODELLED_STACK_DEPTH`
explanation feature so the panel can say so.

**Degradation ladder** (identical on both streets, `preflop/policy.ts` and `postflop/policy.ts`):

| situation | effect on provenance | rule id |
| --- | --- | --- |
| `BB_80_119` | none | — |
| `BB_60_79` or `BB_120_159` | one step worse (SOURCE→DERIVED→HEURISTIC) | `STACK_BUCKET_NEARBY` |
| `BB_40_59` or `BB_160_PLUS` | forced to `HEURISTIC` | `STACK_BUCKET_DISTANT` |
| below 40 BB | forced to `HEURISTIC` + `UNMODELLED_STACK_DEPTH` | `STACK_BUCKET_OUT_OF_RANGE` |
| 5 or 4 players dealt in | one step worse | `LINEUP_SHORT_HANDED` |
| 3 players or heads-up | forced to `HEURISTIC` | `LINEUP_VERY_SHORT_HANDED` |
| 2+ live opponents (postflop only) | one step worse | `MULTIWAY_DEGRADE` |

**No table is re-tuned per bucket.** Inventing per-depth thresholds would be inventing data.
What changes is the honesty label.

---

## 5. Preflop range propagation

*Jargon:* a **range** is the set of two-card holdings a player could have, each with a weight.
There are exactly 1326 distinct two-card combinations ("combos") from a 52-card deck, and 169
distinct *classes* once suits are abstracted away (`AKs`, `AKo`, `77`, …).

`preflop/propagate.ts` answers: **what can every seat hold by the time preflop is over?**

Representation: a `Uint16Array` of length 1326, one integer weight in basis points (0..10000)
per combo — 2.6 KB per range, which matters because a hand carries one range per player per
street. Every operation returns a new array; nothing is mutated.

### 5.1 The algorithm

For each preflop action, in engine order:

1. **Rebuild the query as it stood at that decision point.** Take the prefix of the action list,
   recompute seat statuses and street contributions, and set the *acting* seat as hero. Then run
   it through the **same** `classifyPreflopSpot` the recommendation uses. Re-deriving the family
   locally would be a second classifier that could drift.
2. **Ask the same `classPolicy`** for that spot's fold/call/raise mix, for all 169 classes.
   There is exactly one strategy in the package: editing a preflop table moves both the
   recommendation and the propagated ranges at once.
3. **Condition the range on the bucket the action actually falls into.** `applyActionStrategy`
   multiplies each combo's prior weight by `P(action | combo)` and divides by 10000.

`bucketOf` maps actions to buckets: `FOLD → FOLD`, `CALL → CALL`, `BET`/`RAISE` → `RAISE`, an
aggressive `ALL_IN` → `RAISE`, a non-aggressive `ALL_IN` → `CALL`, and **`CHECK → NOT_RAISE`**,
whose frequency is `10000 − raiseBps`. That last one is load-bearing: checking is what the
policy's fold mass *and* its call mass both do when continuing is free, so conditioning a check
on the fold bucket alone would throw the call mass away.

### 5.2 Integer conditioning

The multiply-and-divide uses `divideByBpsTotal`, a largest-remainder scheme with a fixed
tie-break. Per ADR-0056 the residue is **floored and redistributed, never rounded up**: a
conditioned range may be understated by under one basis point in total, and can never be
overstated. Every weight stays an integer; no float ever enters a range.

### 5.3 Not renormalized, deliberately

The weights mean "how much of this combo survives the line", not "the relative frequency of this
combo". Rescaling them to sum to a constant would hide how much of a starting range a line
actually represents. A consumer that wants relative frequencies calls `normalizeRange`
explicitly.

### 5.4 The `offPolicy` flag — the honest answer to an off-model action

A real player may take a line the reference policy assigns **zero** frequency — an SB limp, when
the policy is raise-or-fold. Conditioning on a zero-frequency action produces the *empty* range,
which asserts the player can hold nothing. That is false.

So: when conditioning would empty a non-empty range, **the range is left completely unchanged**
and the seat is flagged `offPolicy: true`. A flagged range is *uninformative*, not narrow, and
downstream code must treat it that way — postflop, it costs a confidence step
(`OFF_POLICY_RANGE`) and adds the `VILLAIN_RANGE_OFF_POLICY` rule id.

### 5.5 Card removal

Hero's known cards are removed from **every other** seat's range (nobody else can hold them) and
never from hero's own. The board is empty preflop by definition. Postflop, `ranges.ts` removes
the board from every range including hero's.

---

## 6. Preflop sizing — the exact rules

All sizings are stored as **exact integer ratios** (numerator / denominator) in `tables.ts`. The
milliBB arithmetic happens once, in `sizing.ts`, through `Money.mulRatio(..., 'round')` — one
explicit rounding, never two, never implicit. No milliBB constant is hard-coded: the big blind
comes from the query's environment, because blind/rake/ante structure is policy, not site
knowledge (CLAUDE.md rule 10).

| rule | formula | ratio | provenance |
| --- | --- | --- | --- |
| `SIZE_RFI` | raise to 2.5 BB; **3 BB from the SB** | `5/2`, `3/1` | SOURCE |
| `SIZE_ISO_VS_LIMP` | RFI size **+ 1 BB per limper** | base + `1/1` × limpers | DERIVED (limper term single-sourced, S8) |
| `SIZE_BB_VS_SB_LIMP` | BB raises an SB limp to 3.5 BB | `7/2` | DERIVED (S13; its 4 BB is the documented alternative) |
| `SIZE_THREE_BET_IP` | **3.0×** the open | `3/1` | DERIVED (S1 says 3.5×; kept as `THREE_BET_IP_ALTERNATIVE`) |
| `SIZE_THREE_BET_OOP` | **4×** the open | `4/1` | SOURCE |
| `SIZE_FOUR_BET_IP` | **2.3×** the 3-bet | `23/10` | SOURCE |
| `SIZE_FOUR_BET_OOP` | **2.5×** the 3-bet | `5/2` | SOURCE |
| `SIZE_SQUEEZE` | **4×** the open IP, **5×** OOP, **+1×** the open per cold caller *beyond the first* | combined into one exact ratio before rounding | DERIVED (S8 chosen over S7) |
| `SIZE_FIVE_BET_SHOVE` | the engine's maximum raise-TO | — | HEURISTIC |
| `SIZE_FACING_ALLIN_JAM` | the family's own size, **unless** the requested raise-TO reaches the midpoint between hero's street contribution and the engine's maximum — then jam | — | HEURISTIC (the midpoint is authored) |

**A subtle arithmetic fix worth naming.** `addRatioTimes` combines the squeeze base and the
per-caller addend into a *single* ratio over the common denominator, so the rounding happens
once at the end. An earlier version read only the addend's numerator — arithmetically correct
while that denominator happened to be 1, and silently wrong the moment it stopped being. It is
now exported so the property is testable rather than latent (R1 MINOR-3).

### 6.1 Clamp-and-degrade (`LEGALITY_CLAMP`)

Poker engines impose a minimum and maximum raise. The rule is identical on both streets:

1. Compute the size the rule asks for.
2. Clamp it into the engine's `[minToAmountMbb, maxToAmountMbb]`.
3. **Keep the original request beside the clamped value** (`requestedToAmountMbb`) — a
   normalized value never replaces what the rule said (CLAUDE.md rule 3).
4. Record the direction: `NONE` / `RAISED_TO_MINIMUM` / `LOWERED_TO_MAXIMUM`.
5. If the clamp moved the number, **degrade the sizing's provenance one step**, because a
   clamped size is no longer the size the source prescribed.

An illegal size is never emitted.

### 6.2 Legality substitution (`LEGALITY_SUBSTITUTION`)

If the policy wants an action the engine does not offer, its frequency is handed to a documented
substitute — first legal candidate wins:

- preflop: `RAISE → ALL_IN → CALL → CHECK → FOLD`; `CALL → CHECK → FOLD`;
  `FOLD → CHECK → FOLD → CALL`
- postflop, not facing a bet: `BET → RAISE → ALL_IN → CHECK → CALL → FOLD`;
  `CHECK → CALL → FOLD`; `FOLD → CHECK → FOLD → CALL`
- postflop, facing a bet: `RAISE → BET → ALL_IN → CALL → CHECK → FOLD`;
  `CALL → CHECK → FOLD`; `FOLD → CHECK → FOLD → CALL`

The fold bucket reaches for `CHECK` *before* `FOLD`, because a free continue strictly dominates
folding: "not in the continue range" must render as a check in an unraised pot.

One guard is worth spelling out. `ALL_IN` is accepted only when the engine's own
`allIn.effect` is not `'CALL'`. When hero cannot cover the outstanding bet, the shove *is* a
call — the same money to the milliBB — and emitting it as an aggressive row understated the call
frequency and read as aggression the model never chose. Both policies now refuse it and the mass
falls through to `CALL`, whose own `isAllIn` flag says the call commits the stack (R1 M7).

Frequencies are merged by kind afterwards, so the total is preserved exactly.

---

## 7. Board analysis (`analysis/board.ts`)

This module classifies a community-card board and stops. No strategy, no frequencies.

**Rank bands.** `LOW` = 2–6, `MID` = 7–9, `HIGH` = T–A. `composition` counts *cards*, so a
paired board contributes twice.

**Pairing.** `UNPAIRED` / `PAIRED` / `TWO_PAIR` / `TRIPS` / `FULL_HOUSE` / `QUADS`.

**Suits.** `flopPattern` (`MONOTONE` / `TWO_TONE` / `RAINBOW`) is *always* computed from the
first three cards on every street, because the flop's shape stays a fact about the hand after the
turn arrives. Later-street facts are counts: `flushPossible` (≥3 of a suit), `fourFlush`
(exactly 4), `flushOnBoard` (≥5).

**Straightness — mechanical, never eyeballed.** There are exactly ten five-rank windows that can
make a straight, from the wheel `A2345` to `TJQKA`. `windowCoverage[i]` is how many of window
`i`'s five ranks the board shows. Coverage 3 means a two-card holding completes it, 4 means one
card does, 5 means the straight is on the board. Connectivity is derived *only* from
`straightWindowCount` (windows at coverage ≥3):

| `straightWindowCount` | connectivity |
| --- | --- |
| 0 | `DISCONNECTED` |
| 1 | `LOW_CONNECTED` |
| 2 | `CONNECTED` |
| ≥3 | `HIGHLY_CONNECTED` |

**The one judgement call — STATIC / SEMI_DYNAMIC / DYNAMIC.** *Jargon:* a **static** board is one
where the best hand now is very likely still the best hand at showdown; a **dynamic** board is one
where a later card frequently changes who is winning.

It is carried as `Provenanced<BoardTendency>` with provenance `HEURISTIC` and a mandatory note,
because it is an authored rule of thumb. The rule is a point sum:

| component | points |
| --- | --- |
| three or more cards of one suit (a flush is possible) | **+2** |
| exactly two cards of one suit | **+1** |
| connectivity `DISCONNECTED` / `LOW_CONNECTED` / `CONNECTED` / `HIGHLY_CONNECTED` | **0 / 1 / 2 / 3** |
| the board carries any pair or better | **−1** |

| total score | tendency |
| --- | --- |
| ≤ 1 | `STATIC` |
| 2 – 3 | `SEMI_DYNAMIC` |
| ≥ 4 | `DYNAMIC` |

`SEMI_DYNAMIC` exists so a genuinely borderline board (a monotone broadway flop, say) is not
forced into one of the two extremes.

`analyzeBoardTransition` describes what one new card changed (overcard, board paired, flush draw
completed, straights now possible, connectivity increased, tendency changed) by **diffing the two
boards' features**, so a transition can never disagree with the features it comes from.

---

## 8. Hero-hand classification (`analysis/heroHand.ts`)

The made-hand *category* always comes from the evaluator — this module never re-derives "what
hand is this". What it adds is everything the evaluator cannot know because the evaluator does
not know which two cards are hero's.

**Sixteen made-hand classes:** `STRAIGHT_FLUSH`, `QUADS`, `FULL_HOUSE`, `FLUSH`, `STRAIGHT`,
`SET`, `TRIPS`, `TWO_PAIR`, `OVERPAIR`, `TOP_PAIR`, `MIDDLE_PAIR`, `BOTTOM_PAIR`, `UNDERPAIR`,
`BOARD_PAIR`, `ACE_HIGH`, `NO_MADE_HAND`.

Thirteen documented edge choices govern them. The ones that most affect a displayed answer:

1. **`UNDERPAIR`** is a pocket pair below the *highest* board card, not the lowest. `77` on
   `9 5 2` is an underpair — but `boardRanksBeaten` (2 here) is reported so a consumer can tell
   it apart from `77` on `A K Q` (0).
2. **A pocket pair is never top/middle/bottom pair.** Those three describe pairing a board card
   with one hole card, positioned by index into the board's *distinct* ranks descending: index 0
   is `TOP_PAIR`, the last index is `BOTTOM_PAIR`, anything between is `MIDDLE_PAIR`.
3. **`BOARD_PAIR`** is when the only pair sits entirely on the board. `A Q` on `K K 5` is a
   `BOARD_PAIR`, not a pair.
4. **`SET` vs `TRIPS`.** `SET` = hero's pocket pair matched a board rank (two hole cards in the
   three of a kind). `TRIPS` = the board was paired and hero holds the third card. `SET` is the
   stronger, more disguised hand and the scoring model ranks it accordingly.
5. **Kicker significance is a count, not an opinion.** `betterKickerCount` = the number of ranks
   strictly above hero's kicker that are neither the paired rank nor already on the board — i.e.
   how many better kickers an opponent could hold. `0 → TOP`, `1 → SECOND`, `2 → THIRD`,
   `≥3 → WEAK`. The kicker is reported even when it does not play, because hero's actual card is
   never discarded.
6. **`DOUBLE_GUTSHOT` is its own member.** *Jargon:* an **OESD** (open-ended straight draw) needs
   a run of four consecutive ranks whose two flanking ranks are both live outs; two completing
   ranks *without* such a run is a double gutshot. `A K Q J` therefore comes out as a `GUTSHOT`
   (only one usable flank), which is correct.
7. **A straight out only counts if it beats the board.** A card that would put a straight on the
   board for everybody is not hero's out.
8. **Draws are reported only below the category they draw to.** A hero holding a flush has no
   flush draw. Top pair with an open-ender reports both.
9. **Backdoor draws are flop-only** — after the turn there is one card left, so a three-card suit
   is no longer a draw.
10. **The nuts ignore card removal.** `nutStrengthOnBoard` is the best hand *any* two cards could
    make on this board (~1100 evaluations), so it is a property of the board and is computed once
    per board and threaded everywhere. Note `isNuts` and `flush.isNut` answer different questions:
    `Ah 5h` on `Kh 7h 2h` holds the **nut flush** but is not **the nuts**, because `Ah Qh` beats it.

**Blockers** — cards hero holds that an opponent therefore cannot. Eight mechanical members:
`NUT_FLUSH_BLOCKER`, `SECOND_NUT_FLUSH_BLOCKER`, `NUT_FLUSH_DRAW_BLOCKER`, `FLUSH_DRAW_BLOCKER`,
`NUT_STRAIGHT_BLOCKER`, `STRAIGHT_BLOCKER`, `TOP_PAIR_BLOCKER`, `BOARD_PAIR_BLOCKER`. Each is a
statement about cards, never a strategy claim.

---

## 9. The equity engine (`equity/`)

*Jargon:* **equity** is your expected share of the pot if the hand went to showdown right now
with no further betting — a number between 0 and 1. Probabilities and equities are plain
floating-point numbers here, which CLAUDE.md rule 1 permits explicitly: an equity share is a
ratio, not money. Nothing in this directory ever divides a real pot; `poker-core`'s settlement
does that and is untouched.

### 9.1 The enumeration

```
for each RUNOUT r            (the cards still to come)
    heroStrength = eval(board + r + hero)                    ← 1 evaluation
    for each villain COMBO c in the union of the villain ranges
        strength[c] = eval(board + r + c)                    ← shared by all villains
    for each ASSIGNMENT (c_1 … c_V), one combo per villain
        score hero against strength[c_1] … strength[c_V]     ← comparisons only
```

Runout-outer is the load-bearing choice: a villain combo's strength on a given runout does not
depend on who holds it, so it is computed once per runout and reused by every assignment.

**Card removal** is applied in three places, all before any arithmetic: every villain range is
filtered against hero's cards and the board; an assignment where two villains hold the same card
is discarded; a runout colliding with an assignment is skipped. The denominator is the weight of
what was actually scored, so removal shows up as a changed weighting rather than a fudge factor.
A range with nothing left is a typed `ZERO_MASS_RANGE` error — never a NaN, never a silent 0.5.

**Ties.** Hero's share is `0` if any villain is strictly better, else `1 / (1 + tiedVillains)`.

### 9.2 Exactness

| board | runouts | heads-up trials | method with the default budget |
| --- | --- | --- | --- |
| river | 1 | ~1.1k | **EXACT** |
| turn | 46 | ~50k | **EXACT** |
| flop | 1081 | ~1.17M | **EXACT** |
| preflop | 2,118,760 | ~2.6G | **SUBSAMPLED** (always) |

`method` is `EXACT` **only** when *both* the assignment cross-product and the runout space were
enumerated exhaustively. Preflop is always labelled `SUBSAMPLED`, whatever the budget.

### 9.3 Why there is no random number generator

An estimate that moves when you reload the page is not a measurement, it is noise. Every function
in `sampling.ts` is a pure function of its integer arguments. To pick `k` of `n`:

```
s = round(n × 0.6180339887498949)      ← the golden ratio's fractional part
    nudged upward until gcd(s, n) = 1
i-th index = (i × s) mod n             ← accumulated incrementally, never as a product
```

Because `gcd(s, n) = 1` the walk visits `n` distinct residues before repeating, so the indices
are **distinct**. Because `s/n` is near the golden ratio the walk is a Weyl sequence with low
discrepancy: every interval of the index space gets its fair share, with no clustering. Indices
are returned sorted ascending, so a sampled run visits the space in the same direction an
exhaustive one would.

A plain stride (`floor(i × n / k)`) was rejected deliberately: card indices are `rank × 4 + suit`,
so two-card runout enumeration has a strong period-4 structure in the suits, and a stride sharing
a factor with that period would systematically bias every flush-draw equity.

### 9.4 The work budget

All four fields bound an **enumeration size**, never wall-clock time — so a slow machine returns
the *same* answer as a fast one, just later.

| field | default | bounds |
| --- | ---: | --- |
| `maxTrials` | 2,000,000 | `assignments × runouts` |
| `maxAssignments` | 20,000 | villain cross-product entries carried |
| `minRunoutSamples` | 192 | a **floor** on runouts |
| `maxRunoutSamples` | 100,000 | a ceiling on runouts regardless of `maxTrials` |

`minRunoutSamples` is a floor rather than a ceiling because runout subsampling is the dominant
error term while assignment subsampling is an order of magnitude smaller — when the budget must
be split, runouts are worth more. `maxRunoutSamples` exists because a *one-combo* villain range
makes `assignments × runouts` tiny while the preflop runout space is still 2.1 million; without
it, "AA against exactly KK preflop" was the slowest call in the package at 4.5 s.

At most **5** villain ranges (six-max means five opponents).

### 9.5 Measured accuracy

Swept over 96 (board, hero) pairs across four flops, uniform villain range, each compared against
the exact 1081-runout answer:

| runouts sampled (of 1081) | max abs error | RMS error | mean error |
| ---: | ---: | ---: | ---: |
| 64 | 0.06080 | 0.02480 | −0.00003 |
| 128 | 0.06197 | 0.01519 | −0.00220 |
| 256 | 0.02284 | 0.00821 | −0.00178 |
| 512 | 0.01947 | 0.00481 | 0.00023 |

Turn (of 46 runouts, 40 pairs): 8 samples → max 0.101 / RMS 0.035; 16 → 0.072 / 0.027; 24 →
0.052 / 0.016. Preflop AA vs exactly KK against the exact 2,118,760-runout answer: 1,000 samples
→ 0.00405; 10,000 → 0.00048; **100,000 (the default) → 0.00055**. Assignment subsampling on a
river: 200 of 1081 combos → max 0.0062; 1000 of 1081 → 0.00000.

Two properties stated honestly: the error is **unbiased** (mean ≈ 0) but **not small for an
individual high-variance holding** — a gutshot on a dry flop can be five points off at 64
runouts. And errors at 64/128/256 are strongly correlated, because a Weyl sample of `k` is a
prefix of the sample of `2k`.

### 9.6 The cache

`createEquityCache(capacity = 256)` is an explicit, caller-owned, bounded LRU. **There is no
default instance and no module-level cache** — a global memo is exactly what makes a
"deterministic" engine stop being one, because two runs of the same test would share it. Omit the
option and no caching happens at all.

A hit returns the *exact* frozen result object a miss produced. A cache can change how long an
answer takes and never what it is. The key is
`"eq" | heroCards | board | rangeDigest(s) | budget`; cards are sorted (order cannot affect
equity), villain digests are **not** sorted (mixed-radix decoding makes a sample depend on villain
order, so order is part of the answer). A range digest is two independent 32-bit FNV-1a lanes
plus the range's total weight and active-combo count — ~64 hash bits plus two exact structural
counters against a few hundred entries. It is still a hash, so it is documented rather than
hidden.

---

## 10. Range advantage

*Jargon:* **range advantage** on a board means "my whole range does better than yours here",
independent of the two cards I happen to hold.

Definition, exactly (`RANGE_ADVANTAGE_MEASUREMENT`, HEURISTIC):

```
rangeAdvantage = rangeVsRangeEquity(heroRange, primaryVillainRange, board).equity − 0.5
```

`rangeVsRangeEquity` is **one pass** that shares all the work it can. Calling the heads-up engine
1326 times would re-evaluate the villain range on every runout 1326 times — on a flop, about 1.5
billion evaluations. Instead, per runout: evaluate every villain combo (~1081), sort those
(strength, weight) pairs and prefix-sum the weights; then for each hero combo, one evaluation and
two binary searches give (weight below, weight equal, weight above) over the *whole* villain
range in `O(log n)` — and then **subtract the at most `51 + 51 − 1 = 101` villain combos that
share a card with this hero combo**. That correction is what makes the prefix sum legal, and a
test asserts the result is identical to the naive per-combo enumeration on a river (the measured
difference was 0).

The aggregate is a **weighted mean of per-combo shares**, not a pooled ratio of totals. The two
differ whenever hero's combos block unequal amounts of villain weight. The mean is the right
definition because "my range's equity" is what each of my hands is worth, weighted by how often I
hold it. (Consequence worth knowing: a *lopsided* range against itself measured 0.564 on one
fixture, though its pooled ratio is exactly 0.5.)

### 10.1 Pairwise, not pooled — and why

Range advantage runs against **one** villain, the `primaryVillain`, chosen deterministically:

1. the current street's aggressor, if that seat is a live opponent;
2. else the previous street's aggressor, if live;
3. else the live opponent with the lowest postflop order.

The reason is cost: range-vs-range equity is the single most expensive call in the policy
(~65 ms on a flop), and running it against five opponents would multiply the dominant cost by
five and blow the latency budget. The ordering picks the opponent whose betting the action most
constrains. This is a documented compromise (`PRIMARY_VILLAIN_SELECTION`, HEURISTIC), and it is
also why range advantage and nut advantage are **not** fair-share-normalized: they are already
pairwise and already centred on 0.5.

---

## 11. Nut advantage — the top-5% cutoff

*Jargon:* the **nuts** is the best possible hand on a board. **Nut advantage** asks which of two
ranges holds more of the very top of the board.

The naive version does not work: if each range used its *own* top 5%, every range would have a
nut share of 5% by construction and the difference would always be zero. So the cutoff is
**absolute and board-referenced**:

1. Build the made-hand strength distribution of the **uniform 1326-combo range** on this board
   (`buildStrengthDistribution`, ~1.3 ms). This depends on nothing but the board.
2. Walk it from the top and take the strength of the first entry at which the cumulative weight
   reaches `NUT_SHARE_PERCENTILE = 0.05`. That single packed strength value is the board's
   **nut cutoff**.
3. `nutShare(R)` = the weight of `R` at or above that cutoff, divided by `R`'s total weight.
4. `nutAdvantage = nutShare(hero) − nutShare(primaryVillain)`.

Everything of *equal* strength is counted, so a board whose top 5% falls inside a large tie group
yields a share above 5% for the reference range itself. That is correct and deliberate: the
cutoff is a **strength**, and two ranges must be measured against the same strength to be
comparable at all.

Made-hand strength is used rather than equity because it costs ~1.3 ms per range against ~65 ms
for an equity distribution — and on a river, where nut advantage matters most, the two are the
same thing.

A second, looser cutoff (`STRONG_SHARE_PERCENTILE = 0.20`) is computed —
`strongCutoffStrength`, `heroStrongShare`, `villainStrongShare` — and, verified by grep while
writing this report, **has no reader anywhere in the repository**. It is not scored, not
explained, and not rendered; it costs two extra `shareAtOrAbove` passes on every postflop
recommendation. It is public API on `NutShares`, so removing it is a breaking change, and the
worst measured shape is inside budget without doing so — recorded as open (R1B NOTE-9), not done.

---

## 12. The postflop scoring model

`postflop/scoreModel.ts` holds **every** weight, threshold, point value and mapping, exported as
data. `score.ts`, `sizing.ts` and `policy.ts` hold control flow and arithmetic and **no
constants**. A reviewer can read one file and know exactly what the engine believes; a
disagreement about the model is a data edit, not a code change.

### 12.1 How a score is built

1. Each **component** measures one fact and maps it, through a documented band table, to
   `points` in roughly −100..+100.
2. `score = round( Σ(weight_i × points_i) / Σ(weight_i) )` — a **weighted mean**, so the score
   stays on the same −100..+100 scale as its components and adding a component does not silently
   rescale the bands.
3. The score is looked up in a band table to get a frequency in basis points.

**No single-feature advice, structurally.** The heaviest aggression component carries 3 of 26
total weight (11.5%), so no single measurement can move the score by more than ~23 points out of
a ~200-point span — never enough to cross from `GIVE_UP` to `DOMINANT` on its own. A module-load
self-check enforces `MAX_SINGLE_COMPONENT_WEIGHT_SHARE = 0.30`, and a test asserts it. "Top pair
therefore bet" is unrepresentable by construction.

### 12.2 Aggression model — 15 components, total weight 26

| component | weight | what it measures |
| --- | ---: | --- |
| `HAND_STRENGTH` | 3 | hero's made-hand class (below) |
| `HERO_EQUITY` | 3 | hero's showdown equity vs every live villain range, **fair-share normalized** |
| `RANGE_ADVANTAGE` | 2 | hero's whole range vs the primary villain's, minus 0.5 |
| `NUT_ADVANTAGE` | 2 | `nutShare(hero) − nutShare(villain)` |
| `RANGE_RANK` | 2 | where hero's hand sits inside hero's *own* range |
| `DRAW_QUALITY` | 2 | additive semi-bluff equity, capped |
| `BLOCKER_QUALITY` | 1 | cards hero holds that villain cannot |
| `POSITION` | 2 | acting last on every remaining street |
| `INITIATIVE` | 2 | who bet last street, and who has bet this one |
| `BOARD_TEXTURE` | 1 | the tendency, read as *protection* value |
| `SPR_PRESSURE` | 1 | how committed the remaining stack is |
| `MULTIWAY` | 2 | live opponent count |
| `FACED_BET_SIZE` | 1 | the last aggressive wager as a fraction of the pot before it |
| `POT_TYPE` | 1 | limped / single-raised / 3-bet / 4-bet+ pot |
| `STREET_ACTION` | 1 | how many opponents checked to hero |

### 12.3 Continue model — 8 components, total weight 14

| component | weight | note |
| --- | ---: | --- |
| `POT_ODDS_MARGIN` | **4** | `heroEquity − requiredEquity`. The single largest share anywhere in the model, because it is the **only** input in the whole package traceable to a public source (anchor 6 / S14). A call that is not priced is not a call. |
| `HAND_STRENGTH` | 2 | separate from equity: "beats a range" and "beats a value bet" are different questions on the river |
| `DRAW_QUALITY` | 2 | a stand-in for implied odds |
| `BLOCKER_QUALITY` | 1 | the bluff-catcher's argument; tilts a close call, never decides one |
| `RANGE_RANK` | 1 | folds the bottom of a range before the middle |
| `POSITION` | 1 | lower than in the aggression model: the price, not the seat, dominates a call |
| `MULTIWAY` | 2 | reinforced by `MULTIWAY_CONTINUE_PENALTY_BPS` on top |
| `FACED_BET_SIZE` | 1 | only the leftover after the price: a large bet is more polarized |

### 12.4 The component band tables

**Made-hand points** (then clamped to −100..100):

| class | pts | class | pts | class | pts | class | pts |
| --- | ---: | --- | ---: | --- | ---: | --- | ---: |
| `STRAIGHT_FLUSH` | 100 | `FLUSH` | 82 | `OVERPAIR` | 55 | `ACE_HIGH` | −30 |
| `QUADS` | 100 | `STRAIGHT` | 76 | `TOP_PAIR` | 40 | `BOARD_PAIR` | −35 |
| `FULL_HOUSE` | 92 | `TRIPS` | 70 | `MIDDLE_PAIR` | 5 | `NO_MADE_HAND` | −45 |
| `SET` | 88 | `TWO_PAIR` | 60 | `UNDERPAIR` | −5 | | |
| | | | | `BOTTOM_PAIR` | −10 | | |

`SET` outranks `STRAIGHT` here even though a straight beats a set at showdown. That is the one
deliberate departure from showdown order: a set on an unpaired board is far more disguised and
has redraws, and the plain strength ordering is already carried exactly by `HERO_EQUITY`.

Adjustments: `NUTS_BONUS +12`; `WEAK_KICKER_PENALTY −10` (a one-pair hand with three or more
better kickers still available); `PLAYS_THE_BOARD_PENALTY −25` (hero's hand needs neither hole
card, so it cannot be ahead of anything).

**Hero equity** — fed the **normalized** value (see 12.5), never raw pooled equity:

| at least | points | label |
| ---: | ---: | --- |
| 0.80 | 80 | `CRUSHING` |
| 0.65 | 55 | `STRONG` |
| 0.55 | 30 | `AHEAD` |
| 0.45 | 5 | `EVEN` |
| 0.35 | −20 | `BEHIND` |
| 0.25 | −45 | `WELL_BEHIND` |
| −∞ | −70 | `CRUSHED` |

**Range advantage** (0.10/0.06/0.02/−0.02/−0.06/−0.10 → 45/30/15/0/−15/−30/−45,
`LARGE_EDGE … LARGE_DEFICIT`).
**Nut advantage** (0.08/0.04/0.01/−0.01/−0.04/−0.08 → the same 45…−45 ladder).
**Range rank** (0.95/0.85/0.70/0.50/0.30/0.15 → 50/35/18/0/−18/−32/−45,
`TOP_5 … BOTTOM_15`).

**Draw quality** is **additive** across four sources then capped, because a hand can genuinely
hold two draws at once and a max-of would throw the second away. Every value is non-negative — a
draw is never a reason to be *less* aggressive.

| source | points |
| --- | ---: |
| flush draw, by nut class `NUT` / `SECOND_NUT` / `THIRD_NUT` / `WEAK` | 45 / 36 / 30 / 24 |
| straight draw `OESD` / `DOUBLE_GUTSHOT` / `GUTSHOT` | 32 / 26 / 12 |
| backdoor flush draw | 8 |
| backdoor straight draw | 5 |
| each overcard — **only** when hero has nothing better than ace-high, else it double-counts | 3 |
| **cap on the sum** | **70** |

**Blockers**, summed then capped at **30**: `NUT_FLUSH_BLOCKER` 18, `NUT_STRAIGHT_BLOCKER` 12,
`SECOND_NUT_FLUSH_BLOCKER` 10, `NUT_FLUSH_DRAW_BLOCKER` 8, `TOP_PAIR_BLOCKER` 8,
`BOARD_PAIR_BLOCKER` 6, `STRAIGHT_BLOCKER` 5, `FLUSH_DRAW_BLOCKER` 4.

**Position:** aggression IP +20 / OOP −12; continue IP +15 / OOP −5.

**Initiative** is the *sum* of a previous-street and a current-street term (clamped), because "I
bet the flop" and "my flop bet just got raised" are different facts that can both be true:
`HERO_HAD_INITIATIVE +25`, `OPPONENT_HAD_INITIATIVE −12`, `NOBODY_HAD_INITIATIVE 0`,
`HERO_AGGRESSION_RAISED −10`, `OPPONENT_AGGRESSED_THIS_STREET −8`.

**Board texture** is read as *protection* value, not raw texture — a dynamic board is a reason to
bet a made hand and a reason **not** to bet air, so each tendency has two entries:
`STATIC_WITH_RANGE_EDGE +10` / `STATIC_WITHOUT_RANGE_EDGE −5` (threshold: range advantage ≥ 0.02);
`SEMI_DYNAMIC 0`; `DYNAMIC_WITH_EQUITY +15` / `DYNAMIC_WITHOUT_EQUITY −12` (qualifying equity =
a made hand at or above `TOP_PAIR`'s points, or draw points ≥ 26).

**SPR pressure.** *Jargon:* **SPR** = stack-to-pot ratio, remaining effective stack divided by the
pot. Lower means more committed.

| SPR at least | points | label |
| ---: | ---: | --- |
| 12 | −15 | `VERY_DEEP` |
| 7 | −8 | `DEEP` |
| 4 | 0 | `MEDIUM` |
| 2 | 5 | `SHALLOW` |
| 1 | 15 | `NEAR_COMMITTED` |
| −∞ | 25 | `COMMITTED` |

`UNKNOWN_SPR` is **read off this table** as the `MEDIUM` band's own lower edge (4), not written
as a literal — so "no SPR" scores in the neutral band by construction, and moving that edge moves
the default with it (R1B MINOR-8).

**Multiway points**, indexed by live opponent count:
aggression `[0, 0, −25, −45, −55, −65]`; continue `[0, 0, −20, −35, −45, −50]`.

**Faced bet size** — `lastAggression.amountMbb / lastAggression.potBeforeMbb`, i.e. **the size
villain chose**, read off villain's own action record:

| at least | points | label |
| ---: | ---: | --- |
| 1.10 | −40 | `OVERBET` |
| 0.85 | −25 | `LARGE` |
| 0.60 | −12 | `MEDIUM` |
| 0.35 | 0 | `SMALL` |
| −∞ | 10 | `TINY` |

> **This was a real defect (R1B MAJOR-4b).** The quantity used to be derived from hero's *call
> amount* and the pot after the fact. Those are different numbers whenever hero already has chips
> in on the street, or somebody called between the aggressor and hero. Measured counterexample:
> hero bets 3000 into 5500 and BB raises to 9000 — the old computation gave
> `6000 / (17500 − 6000) = 0.5217` → `SMALL` (0 points); the truth is `9000` into `8500` =
> `1.0588` → `OVERBET` (−40 points). A 40-point swing on a weight-1 component.

**Pot type:** `LIMPED −8`, `SINGLE_RAISED 0`, `THREE_BET +12`, `FOUR_BET_PLUS +20`.

**Street action** (opponents who checked to hero, only when not facing a bet): `NO_CHECKS 0`,
`ONE_CHECK +12`, `TWO_OR_MORE_CHECKS +20`. Its rationale states plainly that this is an authored
aggression nudge and **not** range narrowing — no range weight is changed anywhere by a postflop
action.

**Pot-odds margin** (`heroEquity − requiredEquity`):

| at least | points | label |
| ---: | ---: | --- |
| 0.20 | 90 | `HUGE_OVERLAY` |
| 0.10 | 65 | `CLEAR_OVERLAY` |
| 0.04 | 38 | `OVERLAY` |
| 0.00 | 12 | `BREAK_EVEN` |
| −0.04 | −25 | `SHORT` |
| −0.10 | −60 | `CLEARLY_SHORT` |
| −∞ | −100 | `HOPELESS` |

### 12.5 The multiway equity normalization

`HERO_EQUITY_BANDS` is a **0.5-centred** table: 0.5 means "break even against the field". Heads-up
that is raw equity. **It is not raw equity multiway** — five ways, an even split is 0.20, so
feeding pooled equity straight in scored every multiway hand as if it were drawing dead. That was
review finding M8 and it was real.

The fix is `normalizeHeroEquity`, a piecewise-linear rescaling around hero's fair share
`s = 1 / (1 + opponents)`:

```
equity ≤ s :  0.5 × equity / s                      (0 → 0.0,  s → 0.5)
equity > s :  0.5 + 0.5 × (equity − s) / (1 − s)    (s → 0.5,  1 → 1.0)
```

Three properties, and they are why this shape was chosen over a bare `equity / s` ratio:

1. **Heads-up is bit-identical to the old behaviour.** With `s = 0.5` both branches are the
   identity, and every operation is a multiply or divide by a power of two — exact in IEEE-754,
   not merely close. No heads-up recommendation moved.
2. **It stays inside the table's domain**, always in `[0, 1]`, so the band edges keep meaning what
   they say. A bare ratio would put a five-way nut hand at 4.4 and saturate the top band for
   anything above fair share.
3. **Both directions are graded** — multiway, "slightly behind fair share" and "drawing nearly
   dead" land in different bands.

**It is applied to `HERO_EQUITY` only.** `RANGE_ADVANTAGE` and `NUT_ADVANTAGE` are measured
against the primary villain alone and are already pairwise and already centred.
`POT_ODDS_MARGIN` and `ALL_IN_CALL_BANDS` are fed the **raw pooled** equity by definition: hero
must beat the whole field to win the pot, and the price does not care how many opponents set it.

The raw equity is still what the recommendation reports (`metrics.heroEquity`, the `HERO_EQUITY`
explanation feature, the component's `rawValue`); the normalized value is reported beside it as
`HERO_EQUITY_NORMALIZED`. Nothing is replaced.

### 12.6 The price-implied continue floor

`priceImpliedContinueBps(margin)` reads `ALL_IN_CALL_BANDS` for a second purpose, with no second
table: that table already states, for a given equity margin, how often a decision that is purely
about price continues. Facing an all-in it *is* the answer; facing an ordinary bet it is the
**floor** under the multiway continue penalty (section 15).

```
ALL_IN_CALL_MARGIN = 0.02          ← the tolerance that absorbs range-model and subsampling error

margin ≥  4 × 0.02  →  10000  CLEAR_CALL
margin ≥  1 × 0.02  →   8500  CALL
margin ≥ −1 × 0.02  →   5000  BREAK_EVEN
margin ≥ −3 × 0.02  →   1500  THIN
otherwise           →      0  FOLD
```

The bands are graded rather than a single threshold on purpose: a binary "call iff equity >
price" would claim the range model is accurate to the basis point, and it is not — the ranges
themselves are authored and multiway flop equity is roughly ±2 points. The middle band is the
width of that uncertainty. `ALL_IN_CALL_MARGIN` is declared **once**, before the table, and every
edge is written as a whole multiple of it (R1B MINOR-11 removed a duplicated copy).

---

## 13. Score → frequency

**Aggression bands.** First row whose `atLeast` is reached wins.

| score ≥ | bet/raise frequency | id | why |
| ---: | ---: | --- | --- |
| 28 | **9500** | `DOMINANT` | ahead on essentially every axis. The residual 500 is the honest admission that a reference model is not a solve |
| 16 | **8000** | `STRONG` | a clear edge on most axes |
| 5 | **6500** | `MODERATE` | thin value, or a good semi-bluff |
| −6 | **5000** | `NEUTRAL` | the axes cancel; an even mix is the honest answer |
| −20 | **3000** | `WEAK` | behind, but with something (a draw, a blocker, position) |
| −38 | **1500** | `POOR` | behind nearly everywhere; a small residual keeps the betting range from being purely strong |
| −∞ | **0** | `GIVE_UP` | the model declines to invent a bluff |

The top is **never 10000** and the bottom **is** 0, and both are enforced by a module-load
self-check. A policy with no solver behind it does not get to claim a pure strategy; and a zero
is a statement that this hand has no documented reason to bet, not a claim that betting is
provably wrong.

**Continue bands** (used only when hero faces a bet). Here 10000 **is** reachable: a hand that
beats the price by a wide margin should never be shown a fold frequency at all.

| score ≥ | continue frequency | id |
| ---: | ---: | --- |
| 30 | **10000** | `ALWAYS` |
| 16 | **9000** | `STRONG` (the 1000 fold is the model's own error bar) |
| 4 | **7500** | `GOOD` |
| −10 | **5500** | `MARGINAL` |
| −25 | **3500** | `THIN` |
| −45 | **1500** | `POOR` |
| −∞ | **0** | `GIVE_UP` |

**Raise share** — once the continue mass is fixed, the **aggression** score decides how much of
it raises rather than calls. Splitting the decision in two is deliberate: a hand can be clearly
priced in (high continue score) and still be a poor raising candidate (low aggression score), and
a one-step model would force it to choose between folding and raising.

| aggression score ≥ | share of the continue mass that raises | id |
| ---: | ---: | --- |
| 45 | 8000 | `MOSTLY_RAISE` |
| 25 | 5000 | `MIXED` |
| 10 | 2500 | `SOME_RAISE` |
| −5 | 1000 | `RARE_RAISE` |
| −20 | 500 | `MINIMAL_RAISE` (the minimum representable non-zero frequency) |
| −∞ | 0 | `NEVER_RAISE` |

**Quantization and the tie-break.** Every emitted frequency is a multiple of 500 bps and the set
sums to exactly 10000, apportioned by largest remainder over 20 five-point units with a fixed
tie-break (larger remainder first, then **lower** index). Because the emitted action list is
ordered least-committing first, the index tie-break is also the conservative one.

The **primary action** (the one the panel marks 추천) is the highest frequency; a tie goes to the
**least committing** action, in the order `FOLD < CHECK < CALL < BET < RAISE < ALL_IN`. A genuine
50/50 is never displayed as if the aggressive line were the recommendation. Worked example A is
exactly such a 50/50, and it shows `CALL` first.

**Three shapes, and the branch between them is structural, not a judgement:**

- **Facing an all-in.** The continue mass comes from `ALL_IN_CALL_BANDS` on the pot-odds margin,
  not from the continue score: against a committed stack there are no later streets to win.
  Whether any of that mass can *raise* depends on `allInCollapsedTree` — see section 15.
- **Facing a bet.** Continue score fixes the continuing mass; aggression score splits it between
  calling and raising.
- **Not facing a bet.** Aggression score alone splits check and bet. `foldBps` is **0 by
  construction** — folding is not an action a rational player takes when checking is free.

---

## 14. Sizing selection

*Jargon:* a **pot fraction** size means betting some proportion of the current pot.

The only sizes this policy can recommend are eight fixed rungs, plus `ALL_IN` as a separate top
rung:

```
index    0     1     2     3     4     5     6     7
pot %   25    33    50    67    75   100   125   150
ratio  1/4   1/3   1/2   2/3   3/4   1/1   5/4   3/2
```

A recommendation is always one of these. `47.83% pot` is unrepresentable — the sizing analogue of
the 5-point frequency grid.

### 14.1 The base rung — deliberately NOT monotone

| aggression band | base index | size |
| --- | ---: | --- |
| `DOMINANT` | 5 | 100% |
| `STRONG` | 4 | 75% |
| `MODERATE` | 3 | 67% |
| `NEUTRAL` | 3 | 67% |
| **`WEAK`** | **4** | **75%** |
| **`POOR`** | **4** | **75%** |
| `GIVE_UP` | 4 | 75% (unreachable: this band bets at 0 frequency) |

**This non-monotonicity is the whole point.** A betting range is *polarized*: the hands that bet
are the strong ones and the ones with nothing, and they must bet the **same size** or the size
itself tells the opponent which is which. So the two bluffing bands (`WEAK`, `POOR`) borrow the
`STRONG` band's rung rather than sizing down, while the middling bands (`MODERATE`, `NEUTRAL`) —
thin value that wants to be called — size *down*. A monotone table would make every size a
readable strength announcement.

### 14.2 The modifiers — summed, then clamped into the ladder

| modifier | condition | rungs |
| --- | --- | ---: |
| `SIZING_TEXTURE_MODIFIER` | board `STATIC` / `SEMI_DYNAMIC` / `DYNAMIC` | −1 / 0 / +1 |
| `SIZING_NUT_ADVANTAGE_MODIFIER` | nut advantage ≥ +0.05 / ≤ −0.05 | +1 / −1 |
| `SIZING_RANGE_ADVANTAGE_MODIFIER` | range advantage ≥ 0.06 **and** the board is `STATIC` | −1 |
| `SIZING_SPR_MODIFIER` | SPR < 2 / SPR > 6 | +1 / −1 |
| `SIZING_MULTIWAY_MODIFIER` | 3 or more live opponents | −1 |
| `SIZING_STREET_MODIFIER` | the river | +1 |
| `SIZING_RAISE_MODIFIER` | hero is raising rather than betting | +1 |

The range-advantage modifier is *conditioned on texture* on purpose — the "small and frequent"
shape is a static-board shape, and the same edge on a dynamic board does not want the small size.
That is why it is a separate entry from the texture modifier rather than one combined number.

The sum is clamped into `[0, 7]`, so no combination can leave the ladder.

### 14.3 The ALL_IN rung

`ALL_IN` is selectable only when **both** hold:

- `SPR ≤ 1.5` (`ALL_IN_GATE.MAX_SPR`), and
- the aggression band is `STRONG` or better (`ALL_IN_GATE.MIN_BAND`).

Above the gate a shove is a size no pot fraction would ever produce, so offering it would be
inventing a line rather than choosing one. A third guard, in the substitution chain, refuses a
shove the *engine* classifies as a `CALL`. When either guard blocks it, the aggressive frequency
falls through to the passive action and merges — and the `ALL_IN_GATE` explanation feature
reports `SELECTED` / `BLOCKED_BY_SPR` / `BLOCKED_BY_BAND` / `NOT_CONSIDERED` so the panel can say
which.

A clamp of an ordinary bucket to the engine maximum can still land on the whole stack; that path
is recorded as a **clamp**, never as a chosen shove.

### 14.4 Fraction → legal milliBB

```
BET   (nothing to call):  toAmount = heroStreetContribution + round(potBeforeDecision × f)
RAISE (facing a bet):     toAmount = callToAmount + round((potBeforeDecision + callAmount) × f)
```

The raise formula applies the fraction to the pot **as it would be after hero calls**, which is
the standard reading of "raise to X% of the pot" and the only reading under which a 100%-pot
raise leaves villain facing a pot-sized bet. Exactly one rounding, inside `Money.mulRatio`.

Then `clampPostflopSizing` applies the same clamp-and-degrade rule as preflop (section 6.1) — with
one refinement: the base provenance is the **worst** of every rule that contributed (the ladder,
the base rung, each modifier that fired, and the arithmetic). Reporting only the arithmetic rule's
`DERIVED` would be a claim about the *choice* that the choice does not support: the milliBB
conversion is mechanical, but which rung to convert is entirely authored.

---

## 15. Multiway adjustment

Two separate mechanisms, plus a labelling change.

### 15.1 Aggression: a multiplicative SCALE

```
final = floorToGrid( bandFrequency × scale / 10000 )

opponents  0      1      2     3     4     5
scale   10000  10000   7500  5500  4500  3500
```

It is a **scale**, not a ceiling, for a specific reason: a ceiling only bites when a spot happens
to sit above it, so "we bet less multiway" would be an accident of where a score landed inside
its band. A scale makes the reduction **unconditional** — every non-zero aggression frequency is
strictly lower three-handed than heads-up, and a test asserts exactly that on the same spot.

The grid rounding is **downward**, because reducing aggression is the entire purpose of the
adjustment and rounding back up would sometimes undo it. The one fixed point: a 500 bps frequency
at the smallest scale floors to 0 — the minimum representable frequency has nowhere to go but off.

This scale is applied *in addition to* the `MULTIWAY` score component (weight 2 of 26), because
multiway is "the single most reliable way an authored model goes wrong".

### 15.2 Continue: a flat PENALTY, floored by the price

```
opponents  0     1     2     3     4     5
penalty    0     0  1000  2000  2500  3000

penalizedContinueBps(continueBps, opponents, margin):
    priceBps = priceImpliedContinueBps(margin)          ← section 12.6
    floor    = continueBps ≥ priceBps ? priceBps : 0
    return max(floor, continueBps − penalty)
```

**The floor is the fix for a real defect (R1B MAJOR-3).** Subtracted unconditionally, the penalty
reached `CONTINUE_BANDS.ALWAYS` — whose own contract is *"never folds"* — and produced a fold
frequency for hands that cannot lose. Measured: three-handed quads on a river were shown
`FOLD 1000`; a three-handed flop shove faced with **0.9997 equity** was shown `FOLD 1000`. No
number of extra opponents makes a hand that wins every runout a fold.

So the penalty stops where the price takes over. **Below** the price line — the hand is short of
the price, or the model's non-price axes say fold — it applies in full, which is where it does
most of its work. Heads-up the penalty is 0 and the function is the identity, so no heads-up
answer moved.

Post-fix assertions: `penalizedContinueBps(5500, 1, −0.5) === 5500`; `(5500, 2, −0.5) === 4500`;
`(10000, 2, 0.05) === 9000`; `(3500, 5, 0.5) === 500`. Reverting the floor fails three tests.

### 15.3 The isolation raise facing an all-in

`allInCollapsedTree` is true only when hero has **no** legal aggression, or **no** live opponent
besides the shover remains. That is always the case heads-up and often false multiway — a short
stack shoves, a deep opponent is still to act, and isolating with a strong hand is the standard
line, not an exotic one.

Before the fix (R1B MAJOR-5) the facing-all-in branch returned `aggressionBps: 0`
unconditionally, so an isolation raise was **structurally unreachable**. Measured after the fix,
on a three-way flop `7h 7d 2c` with hero holding quads and a 25 BB shove in front with a 100 BB
opponent still live: `FOLD 0 | CALL 8500 | RAISE 1500`, `ALL_IN_TREE = LIVE`. The same fixture
with `6c 5c` gives `FOLD 10000`.

Preflop, the mirror of this is `FACING_ALLIN_IN_TREE`: the family keeps its own name, the RAISE
frequency is kept exactly as the family assigned it (so a premium never flats a short shove with
players still to act), the CALL frequency survives only if the class also clears the pot-odds tier
the price selects, and whatever leaves CALL goes to FOLD.

### 15.4 Provenance and confidence degradation

Two live opponents or more adds `MULTIWAY_DEGRADE`: the recommendation's provenance drops one
step, and `MULTIWAY` is counted as a confidence reason. The justification is stated: the equity
engine treats multiway villain ranges as **independent priors and models no correlation between
them**, and multiway flop equity is roughly ±2 points.

---

## 16. Provenance and confidence, as the user sees them

### 16.1 `provenance.quality`

The **worst** tag among every contributing rule. Preflop answers are usually `HEURISTIC`
(because the defence tiers are) and occasionally `DERIVED`.

**Postflop, the field is a constant, not a measurement.** `VILLAIN_RANGE_FROM_PREFLOP`
(`HEURISTIC`) is unconditionally in every postflop `ruleIds`, so `worstProvenance` returns
`HEURISTIC` for **every** postflop recommendation without exception — which means the whole
degradation ladder of section 4 cannot move the field it feeds, and `confidence` is the only
gradated postflop output. `postflop/rules.ts` says "essentially always `HEURISTIC`" where the
truth is "always" (R1B NOTE-10a, open).

`provenance.ruleIds` lists every rule that participated, and `provenance.notes` carries one
mandatory explanatory note per rule — so a user can go from a number on screen to the rule that
produced it to the anchor that justifies it, without reading any code.

### 16.2 `environmentCompatibility` — there is deliberately no `EXACT`

```ts
type EnvironmentCompatibilityStatus = 'APPROXIMATE' | 'DIVERGENT';   // no EXACT member
```

**The type has no `EXACT` member on purpose.** The public charts behind `tables.ts` never state
the rake or ante structure they assume, so claiming an exact match would be a claim no source
supports (anchor 9). `APPROXIMATE` is the best this package can *ever* report, and that is
enforced by the type system rather than by discipline.

Five factors are reported, each with its own status and a stable token:

| factor | `APPROXIMATE` when | `DIVERGENT` when |
| --- | --- | --- |
| `GAME_FORMAT` | always (`PUBLIC_6MAX_CASH_100BB_CHARTS`) | never |
| `ANTE` | no ante (`NO_ANTE`) | an ante is present (`ANTE_PRESENT_NO_NUMERIC_ADJUSTMENT`) |
| `RAKE` | always (`RAKE_NOT_STATED_BY_SOURCE` / `NO_RAKE`) | never |
| `STACK_DEPTH` | reference or nearby bucket | distant bucket or below the modelled minimum |
| `LINEUP_SIZE` | 6- or 5/4-handed | 3-handed or heads-up |

The overall status is `DIVERGENT` if any factor is. **No numeric ante adjustment is applied
anywhere** — the ante is reported as a divergence, not corrected for, because no public source
gives a cash-applicable factor.

### 16.3 `confidence` (postflop only)

Postflop provenance is always `HEURISTIC` and therefore cannot carry gradation, so a second field
does. The `ConfidenceLevel` type is **not** from ADR-0056 — it is reused from **ADR-0036**
(`INSUFFICIENT | LOW | MEDIUM | HIGH`, whose thresholds ADR-0036 calls *"display thresholds, not
poker claims"*). Here the semantics differ from that ADR's original sample-size reading in two
ways worth stating plainly: it is a **count of documented degradations**, not a sample size, and
**`INSUFFICIENT` is never emitted** anywhere in the strategy path (grep-verified). Preflop
carries no confidence field at all.

| reason | when |
| --- | --- |
| `MULTIWAY` | two or more live opponents |
| `HERO_EQUITY_SUBSAMPLED` | **hero's own** equity was estimated rather than enumerated |
| `OFF_POLICY_RANGE` | some seat took a preflop line the reference policy never takes |
| `UNNARROWED_AGGRESSION` | a postflop **bet or raise** happened before hero's decision and was not conditioned on |

`0 → HIGH`, `1 → MEDIUM`, `2 or more → LOW`.

Two deliberate asymmetries. **Range** equity being subsampled does *not* count: it is a
range-level aggregate feeding two components with combined weight 4 of 26, and on a flop it is
subsampled essentially always, so counting it would pin every flop answer to `LOW` and make the
field carry no information. (It is still reported, in `metrics.rangeEquityMethod`, in the
`EQUITY_METHOD` feature, and as the `EQUITY_SUBSAMPLED` rule id.) And only *aggression* counts
for `UNNARROWED_AGGRESSION`, not a check: a check is the least informative action in poker and
every range this model builds already contains the hands that would check.

### 16.4 `villainRangeNarrowingApplied: false` — the honesty flag

This field's type is the **literal `false`**. It cannot be anything else.

Postflop actions taken before hero's decision do **not** narrow any range. The package was offered
two options and chose the second, for three stated reasons:

1. **Narrowing is circular.** This policy's inputs are range-level (range advantage, nut
   advantage, hero's rank in hero's own range). To narrow villain's range by villain's policy, the
   policy must first be evaluated *for* villain — which needs villain's range advantage, which
   needs villain's range. That is a fixed point, not a computation, with no convergence guarantee.
   Breaking the cycle by evaluating villain's policy against *unnarrowed* ranges would be the
   no-narrowing option with an extra step and a misleading label.
2. **It is unaffordable.** Even the broken-cycle version costs one full policy evaluation per
   prior postflop action, each dominated by a ~65 ms range-vs-range equity pass. A three-action
   flop would blow the latency budget several times over.
3. **The honest precedent already exists** — the preflop `offPolicy` rule: an action the model
   cannot condition on carries no information; leave the range alone and **flag** it. A range
   narrowed by a model that does not really know how villain plays is *worse* than an unnarrowed
   one, because it looks like a read.

The flag is not decorative. Whenever a postflop action exists it surfaces a
`VILLAIN_RANGE_NARROWING: NOT_APPLIED` explanation feature, adds `VILLAIN_RANGE_NOT_NARROWED` to
the rule ids, and — if any of those actions was aggressive — costs a confidence step.

---

## 17. Explanations carry no prose

`ExplanationFeature` carries an id, a stable token and typed numbers (`bpsValue`, `mbbValue`,
`ratioValue`, `countValue`). It never carries a generated sentence, and **nothing in this package
writes prose or calls a model** — the UI renders and localizes from the ids. That is what makes
CLAUDE.md rule 6 ("no LLM in the decision path") structural rather than aspirational: there is no
place in the pipeline where a sentence could be generated.

Worked example B emits **52** such features. A test asserts none of their tokens contains
whitespace, which is a cheap proof that they are identifiers rather than sentences.

---

## 18. Performance — the corrected numbers

All measurements below are on **Darwin arm64, M-series Mac**, which is the machine class this was
developed on.

> **Caveat, stated because the earlier numbers were wrong and it matters:** a mid-range laptop
> routinely runs **2–4× slower**. At 2–4× the worst measured shape would be **at or past** the
> 200 ms interaction budget. Nothing measured here rules that out.

### 18.1 `recommendPostflop`, per street and lineup

From `packages/strategy-core/src/postflop/benchmark.test.ts` (3 runs after a warm-up):

| shape | measured |
| --- | ---: |
| heads-up flop | 89.6 ms |
| heads-up turn | 11.5 ms |
| heads-up river | 2.5 ms |
| 3-way flop | 42.2 ms |
| 3-way turn | 6.3 ms |
| 3-way river | 1.8 ms |
| 4-way flop (single-raised, facing a bet) | 90.5 ms |
| 5-way flop (limped) | 101.1 ms |
| **6-way flop (limped) — the worst shape** | **106.3 ms** |

Off-table probes: 6-way limped **monotone** flop 112.1 ms; 6-way limped flop facing a bet
107.5 ms; 6-way *single-raised* flop 61.9 ms; 6-way limped turn 34.5 ms.

**The cost is range width × villain count on the flop, so a limped six-way pot is the worst shape
— not a heads-up one.** The benchmark previously covered only 2- and 3-handed lineups and the
"worst case is the heads-up flop at 87 ms" claim was generalised from a two-point sample; that
was review R1B MAJOR-2. The benchmark now measures 2 through 6 players and asserts the ordering.

Headroom against the 200 ms budget on this hardware: **~1.8×**. (Earlier documents claimed
~2.3×, and an intermediate correction estimated ~1.3–1.7×. Only ~1.8× is current. An independent
R1B measurement of the same shape *through the real adapter* landed at 130–153 ms, and B4's own
reproduction at 119–130 ms; both are recorded, and neither is 87 ms.)

Existing benchmark cases assert `< 200 ms`; the three new multiway cases assert a 1000 ms smoke
ceiling rather than a budget.

**Where the time goes** (5 repeats, 6-way limped flop, hero first to act):

| phase | min / max |
| --- | ---: |
| `recommendPostflop` total | 119.0 / 129.6 ms |
| `buildPostflopContext` (equity phase) | 119.6 / 121.6 ms |
| ↳ `equityVsRanges` (hero vs 5 ranges) | 54.9 / 61.5 ms |
| ↳ `equityDistribution` (hero range vs primary villain) | 63.2 / 64.0 ms |
| ↳ `buildPostflopRanges` + 3× `buildStrengthDistribution` | ~2.5 ms combined |
| `scorePostflop` (policy phase) | 0.0 / 0.3 ms — **0.22% of the total** |

The consequence is recorded rather than acted on: splitting between the equity and policy phases
would shorten the worst-case block by **under a millisecond** and was not adopted. The only
meaningful split is *between the two dominant equity calls* (~130 ms → ~64 ms), and that needs a
resumable two-phase context inside `strategy-core`. It is a follow-up, not done.

### 18.2 The equity engine in isolation

| call | time | method | runouts | trials |
| --- | ---: | --- | ---: | ---: |
| heads-up river (exact) | 0.6 ms | EXACT | 1 | 990 |
| heads-up turn (exact) | 7.6 ms | EXACT | 46 | 45,540 |
| **heads-up flop (exact)** | **84.7 ms** | EXACT | 1081 | 1,070,190 |
| heads-up flop (subsampled 128) | 9.8 ms | SUBSAMPLED | 128 | 126,720 |
| heads-up flop (subsampled 256) | 22.4 ms | SUBSAMPLED | 256 | 253,440 |
| heads-up flop (subsampled 512) | 33.8 ms | SUBSAMPLED | 512 | 506,880 |
| 3-way flop (bounded, default) | 43.4 ms | SUBSAMPLED | 192 | 2,957,538 |
| preflop heads-up (bounded, default) | 113.3 ms | SUBSAMPLED | 1632 | 1,615,680 |
| preflop heads-up vs ONE combo, forced EXACT | ~1500 ms | EXACT | 2,118,760 | 1,712,304 |
| range-vs-range river (exact) | 4.3 ms | EXACT | 1 | 1,081 |
| range-vs-range turn (exact) | 41.1 ms | EXACT | 48 | 51,888 |
| **range-vs-range flop (bounded)** | **65.1 ms** | SUBSAMPLED | 153 | 165,393 |
| strength distribution (flop) | 1.3 ms | — | — | 1176 combos |

### 18.3 The panel

Measured through the real UI (production `next build`, Chromium): 6-handed, hero in the BB, BTN
opens 2.5 BB, hero calls, flop `Qh 7s 2d` completed by clicking the third palette card — the click
that schedules the analysis.

| interaction | analysis inside the effect body | **shipped (scheduled in a timer)** |
| --- | --- | --- |
| board-completing click | 105 – 107 ms | **33 – 36 ms** |
| hero's next action while the analysis is in flight | 2 ms | 1 – 2 ms |
| opening the raise editor | 1 ms | 1 ms |
| per keystroke into the raise editor | max 1 ms | max 1 – 2 ms |
| six keystrokes total | 5 – 6 ms | 5 – 8 ms |

The naive variant's click took **~70 ms longer**. Typing latency was not measurably degraded in
either variant, so the `PostflopBudget` lever was not pulled — tuning it would trade `EXACT` for
`SUBSAMPLED`.

**Two corrections were applied to B4's original claims and are worth carrying forward:**

- "Superseded work is *cancelled*" was **overclaimed**. Not-yet-started work is never started; a
  running computation cannot be interrupted. The original proof ("five store commits in one tick
  produce exactly one call to `compute`") was **vacuous** — React auto-batches five commits inside
  one `act()` into a single re-render, so only one timer was ever scheduled and deleting
  `clearTimeout` changed nothing. The test was rewritten with fake timers and each transition in
  its own effect flush: **five timers scheduled, four cleared, one runs**; removing the cleanup now
  fails it 5-vs-1.
- The row "hero's next action … 1–2 ms" was **mislabelled** — that run landed outside the
  computation's window.

---

# Worked example A — preflop

**Every number below was produced by running the real engine.** The hand was built through
`poker-core`'s own constructors (`packages/strategy-core/src/adapter/testHands.ts`), converted by
the real adapter seam (`buildStrategyQuery`), and answered by `recommendPreflop`.

## A.1 The spot

Six-handed 6-max cash, blinds 0.5 / 1 BB, everyone 100 BB. UTG folds, HJ folds, **CO opens to
2.5 BB**, and hero is on the **button** holding **A♥ Q♥**.

## A.2 The `StrategyQuery` the adapter produced

| field | value |
| --- | --- |
| `street` | `PREFLOP` |
| `dealtInCount` | 6 |
| `positionsInHand` | `[UTG, HJ, CO, BTN, SB, BB]` |
| `heroPosition` / `heroSeatIndex` | `BTN` / seat 0 |
| `heroCards` | `[49, 41]` = `A♥ Q♥` (card index = `rank × 4 + suit`) |
| `effectiveStackMbb` | `100000` (100 BB, starting basis) |
| `effectiveStackRemainingMbb` | `99500` |
| `stackBucket` | `BUCKET / BB_80_119` — the **primary** bucket, effective stack `100000` carried alongside |
| `potBeforeDecisionMbb` | `4000` (0.5 SB + 1 BB + 2.5 CO) |
| `currentBetMbb` | `2500` |
| `callAmountMbb` / `callToAmountMbb` | `2500` / `2500` |
| `spr` | `24.875` |
| `potOdds` | `0.38461538…` = `2500 / (4000 + 2500)` |
| `activeOpponentCount` | 3 (CO, SB, BB) |
| `heroInPosition` | `true` (BTN postflop order 5 > CO 4, SB 0, BB 1) |
| `legalActions.call` | to `2500`, amount `2500`, not all-in |
| `legalActions.wager` | `RAISE`, min-TO `4000`, max-TO `100000` |
| `legalActions.allIn` | to `100000`, effect `RAISE` |
| `environment` | SB `500`, BB `1000`, no ante, rake 5/100 capped at `8000`, `NO_FLOP_NO_DROP` |

Action history (three records, all with the engine's own `isAggressive` / `isFullRaise` flags):

| seq | position | kind | to (mBB) | potBefore | isAggressive | isFullRaise |
| ---: | --- | --- | ---: | ---: | --- | --- |
| 9 | UTG | `FOLD` | — | 1500 | false | false |
| 10 | HJ | `FOLD` | — | 1500 | false | false |
| 11 | CO | `RAISE` | 2500 | 1500 | **true** | **true** |

## A.3 Spot classification

`classifyPreflopSpot` walks its ordered rules. There is one full raise standing
(`raiseCount = 1`), hero is not the aggressor, the shove clauses do not apply, it is not
blind-vs-blind, and there are no cold callers — so rule 4's last branch fires:

```
family              VS_OPEN
openerPosition      CO          aggressorPosition   CO
openSizeMbb         2500        lastAggressionToMbb 2500
heroVsAggressor     IP          heroHasActed        false
limperCount         0           coldCallerCount     0
blindVsBlind        false       facingAllIn         false
lineupSize          6           playersRemaining    4
```

## A.4 The rule and the table

`VS_OPEN` routes to `defendMix`, rule **`VS_OPEN_MIX`** — provenance **`HEURISTIC`**, because
anchor 6 found no public defend-percentage table at all.

**Tier selection** (`defendTier`): hero is not the BB, not the SB, and is `IP` against a *late*
opener (CO, BTN or SB count as late) → tier **`DEFEND_WIDE`**.

Measured from the live tables:

| tier | share of the 1326-combo universe |
| --- | ---: |
| `DEFEND_PREMIUM` | 3.77% |
| `DEFEND_TIGHT` | 9.20% |
| `DEFEND_MEDIUM` | 17.19% |
| **`DEFEND_WIDE`** | **26.40%** |
| `DEFEND_VERY_WIDE` | 45.40% |

**Hand-class membership.** `A♥ Q♥` → combo index 1217 → class **`AQs`** (index 2, `SUITED`,
4 combos).

`defendMix` applies its sets in a fixed precedence, so an overlap can never produce two answers:

| step | set | contains `AQs`? |
| --- | --- | --- |
| 1 | `THREE_BET_VALUE` = `QQ+, AKs, AKo` | no |
| 2 | in tier **and** `THREE_BET_MIXED` = `TT, JJ, AQs, AJs, KQs` | **YES → stop** |
| 3 | in tier and `THREE_BET_BLUFF` = `A5s-A2s, KJs, QJs, JTs` | — |
| 4 | in tier only | — |
| 5 | otherwise | — |

## A.5 The frequency mix

Step 2's outcome is `freq(fold 0, call 5000, raise 5000)`, membership `MIXED`. There is nothing
to quantize (both values are already multiples of 500 and sum to 10000), no substitution is
needed (the engine offers both `CALL` and `RAISE`), and:

```
CALL   5000 bps = 50%
RAISE  5000 bps = 50%
```

**Primary action = `CALL`.** This is a genuine tie, and `PRIMARY_ACTION_TIE_BREAK` sends a tie to
the *least committing* action. A 50/50 is never displayed as if the aggressive line were the
recommendation.

## A.6 The sizing arithmetic, step by step, in milliBB

Hero is `IP` against the opener, so `threeBetSizing` selects **`SIZE_THREE_BET_IP`** — provenance
`DERIVED`, because S5 and S8 say 3.0× while S1 says 3.5×, and 3.0× is the figure two of three
independent sources state.

```
1. ratio           SIZING.THREE_BET_IP = 3 / 1                      (exact integers, no float)
2. input           openToMbb = spot.openSizeMbb = 2500 mBB          (read from CO's own record)
3. formula         Money.mulRatio(2500, 3, 1, 'round')
4. raw request     2500 × 3 / 1 = 7500 mBB                          (one explicit rounding)
5. engine bounds   min-TO 4000 mBB … max-TO 100000 mBB
6. clamp           4000 ≤ 7500 ≤ 100000     →  clamp = NONE
7. raise-TO        7500 mBB = 7.5 BB
8. chips added     7500 − 0 (hero has nothing in yet) = 7500 mBB
9. provenance      clamp === NONE  →  base provenance kept = DERIVED
```

## A.7 The `StrategyRecommendation`

```jsonc
{
  "kind": "PreflopRecommendation",
  "label": "REFERENCE",
  "street": "PREFLOP",
  "family": "VS_OPEN",
  "unsupportedReason": null,
  "heroPosition": "BTN",
  "handClass": { "index": 2, "key": "AQs", "kind": "SUITED", "comboCount": 4 },
  "actions": [
    { "kind": "CALL",  "frequencyBps": 5000, "toAmountMbb": 2500, "amountMbb": 2500,
      "isAllIn": false, "sizing": null },
    { "kind": "RAISE", "frequencyBps": 5000, "toAmountMbb": 7500, "amountMbb": 7500,
      "isAllIn": false,
      "sizing": { "ruleId": "SIZE_THREE_BET_IP", "requestedToAmountMbb": 7500,
                  "toAmountMbb": 7500, "clamp": "NONE", "provenance": "DERIVED",
                  "minToAmountMbb": 4000, "maxToAmountMbb": 100000 } }
  ],
  "primaryAction": { "kind": "CALL", "frequencyBps": 5000, ... },
  "metrics": {
    "spr": 24.875, "potOdds": 0.38461538461538464, "requiredEquity": 0.38461538461538464,
    "potBeforeDecisionMbb": 4000, "callAmountMbb": 2500, "effectiveStackMbb": 100000,
    "stackBucket": { "kind": "BUCKET", "bucket": { "id": "BB_80_119", ... } }
  },
  "provenance": {
    "quality": "HEURISTIC",
    "ruleIds": ["VS_OPEN_MIX", "SIZE_THREE_BET_IP", "FREQUENCY_QUANTIZATION",
                "PRIMARY_ACTION_TIE_BREAK", "ENVIRONMENT_COMPATIBILITY"],
    "environmentCompatibility": { "status": "APPROXIMATE", "factors": [
        { "id": "GAME_FORMAT",  "status": "APPROXIMATE", "token": "PUBLIC_6MAX_CASH_100BB_CHARTS" },
        { "id": "ANTE",         "status": "APPROXIMATE", "token": "NO_ANTE" },
        { "id": "RAKE",         "status": "APPROXIMATE", "token": "RAKE_NOT_STATED_BY_SOURCE" },
        { "id": "STACK_DEPTH",  "status": "APPROXIMATE", "token": "REFERENCE_BUCKET" },
        { "id": "LINEUP_SIZE",  "status": "APPROXIMATE", "token": "SIX_HANDED" } ] },
    "notes": [ /* one mandatory note per rule id, verbatim from the registry */ ]
  },
  "explanation": { "features": [
    { "id": "SPOT_FAMILY",       "token": "VS_OPEN" },
    { "id": "HERO_POSITION",     "token": "BTN" },
    { "id": "HAND_CLASS",        "token": "AQs" },
    { "id": "RANGE_MEMBERSHIP",  "token": "MIXED" },
    { "id": "LINEUP_SIZE",       "countValue": 6 },
    { "id": "CONTINUE_TIER",     "token": "DEFEND_WIDE" },
    { "id": "OPENER_POSITION",   "token": "CO" },
    { "id": "RELATIVE_POSITION", "token": "IP" },
    { "id": "STACK_BUCKET",      "token": "BB_80_119", "mbbValue": 100000 },
    { "id": "SPR",               "ratioValue": 24.875 },
    { "id": "POT_ODDS",          "ratioValue": 0.38461538461538464 },
    { "id": "SIZING_RULE",       "token": "SIZE_THREE_BET_IP", "mbbValue": 7500 }
  ] }
}
```

**Reading it in one sentence:** *the panel says "call half the time, 3-bet to 7.5 BB half the
time" because AQs sits in the mixed tier of an authored `DEFEND_WIDE` continue range for a button
facing a cutoff open, and 7.5 BB is exactly 3.0× the 2.5 BB open — a size two of three public
sources agree on, and the only part of this answer that traces to anything public at all.*

## A.8 The reference ranges, measured live

For context, the RFI tables as the engine actually computes them (share of all 1326 combos):

| position | combos | share | published band asserted in `tables.test.ts` |
| --- | ---: | ---: | --- |
| UTG | 226 | **17.04%** | 15.0 – 17.6% |
| HJ | 280 | **21.12%** | 19 – 22% |
| CO | 368 | **27.75%** | 25 – 30% |
| BTN | 568 | **42.84%** | 40 – 48% |
| SB (raise-only, after the per-class trim) | 622 | **46.91%** | 40 – 47% |
| heads-up BTN (the union floor) | — | 49.62% | — (no public source exists) |

The SB figure is the corrected one: the earlier report said 45.10% and 21 offsuit classes; the
per-class trim actually lands on **622 combos / 46.91% / 23 offsuit classes**, still inside the
band.

---

# Worked example B — postflop

The deterministic fixture in `packages/strategy-core/src/postflop/workedExample.test.ts`, whose
assertions are exact so that any change to a weight, threshold, band edge or sizing rung fails the
test rather than quietly going stale. Every number below was re-derived by running the engine
while writing this report.

## B.1 The spot

Six-handed, 100 BB stacks. **BTN opens 2.5 BB**, SB folds, **BB calls**. Flop **A♥ 7♦ 2♣**.
**BB checks.** Hero is the **BTN** holding **A♣ Q♠**.

| field | value |
| --- | --- |
| `potBeforeDecisionMbb` | `5500` |
| `callAmountMbb` | `0` (nothing to call) |
| `legalActions` | `canCheck: true`; `wager` is a **`BET`**, min-TO `1000`, max-TO `97500` |
| family / pot type | **`CBET`** / `SINGLE_RAISED` |
| `spr` | `97500 / 5500 = 17.7272…` |
| `activeOpponentCount` | 1 |

*Jargon:* a **c-bet** (continuation bet) is a bet by the player who raised on the previous street.

## B.2 The ranges

Both ranges come from replaying the preflop action list through the same `classPolicy` the
recommendation uses.

**Before board removal** (propagation output; hero's two cards are already removed from every
non-hero range):

| seat | status | live combos | total weight (bps) | preflop actions | `offPolicy` |
| --- | --- | ---: | ---: | --- | --- |
| UTG | FOLDED | 1041 | 10,410,000 | `["FOLD"]` | false |
| HJ | FOLDED | 991 | 9,910,000 | `["FOLD"]` | false |
| CO | FOLDED | 912 | 9,120,000 | `["FOLD"]` | false |
| **BTN (hero)** | IN_HAND | **568** | **5,680,000** | `["RAISE"]` | false |
| SB | FOLDED | 1141 | 11,338,500 | `["FOLD"]` | false |
| **BB** | IN_HAND | **500** | **4,750,500** | `["CALL"]` | false |

Hero's 568 combos each carry weight exactly `10000`: the RFI table is pure raise-or-fold, so the
button's opening range is 568 combos at full weight — the same 568 combos as the `BTN` RFI row in
A.8. BB's 500 combos carry an **average** weight of 9501, because BB's calling range is a mixture
(some classes call only part of the time).

**Card removal.** Five cards are removed from the non-hero ranges: hero's `A♣ Q♠` plus the board
`A♥ 7♦ 2♣` (`removedCards = [51, 40, 49, 22, 3]`). The board alone is removed from hero's own
range — nobody holds a board card, but hero's own two cards obviously stay.

**After board removal** (the ranges the measurements actually run on):

| | live combos | total weight | distinct classes |
| --- | ---: | ---: | ---: |
| hero (BTN) | **507** | 5,070,000 | 90 |
| BB (the primary and only villain) | **434** | 4,126,500 | 87 |

A few example classes at their weights: hero holds `98o`, `T8o`, `T9o`, `J9o`, `JTo`, `Q9o`,
`QTo`, `QJo`, `K8o`, `K9o`, `KTo`, `KJo` all at the full 120,000 bps (12 combos × 10,000). BB
holds `98o`, `T8o`, `T9o`, `J9o`, `JTo`, `K8o`, `K9o`, `KTo`, `KJo` at 120,000 but `Q9o`, `QTo`,
`QJo` at only **90,000** — those classes call less than 100% of the time in the authored defence
tier, and the conditioning shows it.

`primaryVillain = BB` (the only live opponent). `postflopActionCount = 1` (BB's check),
`postflopAggressionCount = 0`, `narrowingApplied = false`.

## B.3 Board features

```
board            A♥ 7♦ 2♣
pairing          UNPAIRED
composition      HIGH 1, MID 1, LOW 1        broadwayCount 1     highCardClass ACE_HIGH
suits            maxSuitCount 1              flopPattern RAINBOW
straightness     straightWindowCount 0   →   connectivity DISCONNECTED
tendency score   suit 0  +  connectivity 0  +  pairing 0  =  0     →   STATIC   (score ≤ 1)
```

The tendency is carried as `Provenanced<'STATIC'>` with provenance `HEURISTIC` and the note
`"score 0 from authored texture criteria (…)"` — the criteria string is exported, so the panel can
show the rule that produced the label.

## B.4 Hero-hand features

```
made class       TOP_PAIR         (A♣ pairs the board's highest card; the board's distinct
                                   ranks descending are [A, 7, 2], and A is index 0)
kicker           Q, class SECOND, betterKickerCount 1  (only a K is a better live kicker), plays
draws            none — no flush draw, no straight draw, no backdoors
blockers         [TOP_PAIR_BLOCKER]   (hero holds a card of the board's highest rank)
overcardCount    0        holeCardsUsed 2        playsTheBoard false
strength         1,877,248   (category PAIR, ranks [A, Q, 7, 2])
nutStrength      3,952,640   (the best any two cards make here — a set of aces)
isNuts           false
```

## B.5 Equity and range measurements

| measurement | value | method |
| --- | ---: | --- |
| hero's equity vs BB's range | **0.88038136** | **EXACT** — all 1081 runouts × 434 assignments = 429,660 trials |
| ↳ win / tie / lose | 0.87100 / 0.01877 / 0.11023 | |
| hero's **range** vs BB's range | **0.53061106** | `SUBSAMPLED` — 355 of 1176 runouts, 507 hero combos vs 434 villain combos |
| **range advantage** = rangeEquity − 0.5 | **+0.03061106** | |
| **range rank** (share of hero's own range hero's hand is at least as good as) | **0.90532544** | |
| board nut cutoff strength (top 5% of the uniform range) | **1,877,248** | |
| nut share, hero | **0.08086785** | |
| nut share, BB | **0.05379862** | |
| **nut advantage** | **+0.02706923** | |
| strong-share cutoff (top 20%) — reported, not scored | 1,427,456; hero 0.34714 / BB 0.28911 | |
| pot odds / required equity / margin | `null` — hero is not facing a bet | |

A detail worth noticing: the board's nut cutoff (1,877,248) is **exactly** hero's own strength.
Counting the hands at or above A-Q-top-pair on this board — three sets, twenty-seven two-pairs,
twelve `AK` and twelve `AQ` combos = 54 to 60 of the 1176 live combos — lands right at the 5%
line (58.8 combos). Hero's hand sits precisely on the cutoff, which is why hero's nut share
(8.09%) exceeds the reference 5%: every combo of *equal* strength is counted, as section 11
describes.

`anyEquitySubsampled = true` (the range equity was), so `EQUITY_SUBSAMPLED` appears in the rule
ids and the `EQUITY_METHOD` feature reads `EXACT/SUBSAMPLED`. It does **not** cost a confidence
step, because only *hero's own* equity being subsampled does.

## B.6 The aggression score, component by component

| # | component | measured value | points | weight | weighted | band / label |
| ---: | --- | ---: | ---: | ---: | ---: | --- |
| 1 | `HAND_STRENGTH` | `TOP_PAIR` (base 40; no nuts bonus, kicker is SECOND not WEAK, does not play the board) | **40** | 3 | 120 | `TOP_PAIR` |
| 2 | `HERO_EQUITY` | 0.88038136 (normalized: identical, heads-up) | **80** | 3 | 240 | `CRUSHING` (≥ 0.80) |
| 3 | `RANGE_ADVANTAGE` | +0.03061106 | **15** | 2 | 30 | `SLIGHT_EDGE` (≥ 0.02) |
| 4 | `NUT_ADVANTAGE` | +0.02706923 | **15** | 2 | 30 | `SLIGHT_EDGE` (≥ 0.01) |
| 5 | `RANGE_RANK` | 0.90532544 | **35** | 2 | 70 | `TOP_15` (≥ 0.85) |
| 6 | `DRAW_QUALITY` | 0 (no draws) | **0** | 2 | 0 | `NONE` |
| 7 | `BLOCKER_QUALITY` | 8 (`TOP_PAIR_BLOCKER`) | **8** | 1 | 8 | `BLOCKERS_1` |
| 8 | `POSITION` | in position | **20** | 2 | 40 | `IP` |
| 9 | `INITIATIVE` | hero raised preflop (+25), nobody has bet this street (0) | **25** | 2 | 50 | `HERO_PREV/NONE_NOW` |
| 10 | `BOARD_TEXTURE` | `STATIC` and range advantage 0.0306 ≥ 0.02 | **10** | 1 | 10 | `STATIC_WITH_RANGE_EDGE` |
| 11 | `SPR_PRESSURE` | 17.727 | **−15** | 1 | −15 | `VERY_DEEP` (≥ 12) |
| 12 | `MULTIWAY` | 1 live opponent | **0** | 2 | 0 | `OPPONENTS_1` |
| 13 | `FACED_BET_SIZE` | not facing a bet | **0** | 1 | 0 | `NOT_FACING_A_BET` |
| 14 | `POT_TYPE` | single-raised pot | **0** | 1 | 0 | `SINGLE_RAISED` |
| 15 | `STREET_ACTION` | one opponent checked to hero | **12** | 1 | 12 | `CHECKS_TO_HERO_1` |
| | | | | **26** | **595** | |

```
score = round( 595 / 26 ) = round( 22.8846… ) = 23
```

`23 ≥ 16` → aggression band **`STRONG`** → **8000 bps**.

Heads-up, the multiway scale is `10000` (a no-op) and the multiway continue penalty is `0`. Hero
is not facing a bet, so no continue model and no raise-share band run at all
(`continueModel: null`, `continueBand: null`, `raiseShareBand: null`, `allInBandLabel: null`).

Raw mix, straight from the band: `{ foldBps: 0, passiveBps: 2000, aggressiveBps: 8000 }` — folding
is not an option when checking is free.

## B.7 The size

```
base rung        SIZING_BASE_INDEX_BY_BAND.STRONG = 4       →  POT_FRACTION_BUCKETS[4] = 75%
modifiers        SIZING_TEXTURE_MODIFIER  · STATIC   →  −1
                 SIZING_SPR_MODIFIER      · HIGH_SPR (17.727 > 6)  →  −1
                 (nut advantage 0.0271 < 0.05 margin        → no step)
                 (range advantage 0.0306 < 0.06 margin      → no step, even on a STATIC board)
                 (1 opponent < 3, not the river, not a raise → no steps)
sum of offsets   −2
final index      clamp(4 − 2, 0, 7) = 2                     →  POT_FRACTION_BUCKETS[2] = 50%
ALL_IN gate      band STRONG passes MIN_BAND, but SPR 17.727 > MAX_SPR 1.5
                                                            →  BLOCKED_BY_SPR
```

Arithmetic, in integer milliBB. Hero has nothing to call, so the **BET** formula applies:

```
toAmount = heroStreetContribution + round(potBeforeDecision × 1/2)
         = 0 + Money.mulRatio(5500, 1, 2, 'round')
         = 0 + 2750
         = 2750 mBB  =  2.75 BB
engine bounds  min-TO 1000 … max-TO 97500      →   1000 ≤ 2750 ≤ 97500   →   clamp = NONE
provenance     worst of { SIZING_BUCKET_SET, SIZING_BASE_BY_BAND, SIZING_POT_FRACTION_TO_AMOUNT,
                          SIZING_TEXTURE_MODIFIER, SIZING_SPR_MODIFIER }  =  HEURISTIC
```

Note the provenance: the *arithmetic* rule is `DERIVED`, but the rung choice is authored, so the
sizing reports `HEURISTIC`. Reporting `DERIVED` would be a claim about the choice that the choice
does not support.

## B.8 The `PostflopRecommendation`

```jsonc
{
  "kind": "PostflopRecommendation",
  "label": "REFERENCE",
  "street": "FLOP",
  "family": "CBET",
  "potType": "SINGLE_RAISED",
  "heroPosition": "BTN",
  "handClass": { "index": 26, "key": "AQo", "kind": "OFFSUIT", "comboCount": 12 },
  "actions": [
    { "kind": "CHECK", "frequencyBps": 2000, "toAmountMbb": null, "amountMbb": null,
      "isAllIn": false, "sizing": null },
    { "kind": "BET",   "frequencyBps": 8000, "toAmountMbb": 2750, "amountMbb": 2750,
      "isAllIn": false,
      "sizing": { "ruleId": "SIZING_POT_FRACTION_TO_AMOUNT", "requestedToAmountMbb": 2750,
                  "toAmountMbb": 2750, "clamp": "NONE", "provenance": "HEURISTIC",
                  "minToAmountMbb": 1000, "maxToAmountMbb": 97500 } }
  ],
  "primaryAction": { "kind": "BET", "frequencyBps": 8000, "toAmountMbb": 2750, ... },
  "metrics": {
    "spr": 17.727272727272727, "potOdds": null, "requiredEquity": null,
    "heroEquity": 0.8803813611701652,  "heroEquityMethod": "EXACT",
    "rangeEquity": 0.5306110632231295, "rangeEquityMethod": "SUBSAMPLED",
    "rangeAdvantage": 0.030611063223129453,
    "nutAdvantage": 0.027069231414504458,
    "rangeRank": 0.9053254437869822,
    "potBeforeDecisionMbb": 5500, "callAmountMbb": 0,
    "effectiveStackMbb": 100000,
    "stackBucket": { "kind": "BUCKET", "bucket": { "id": "BB_80_119", ... } },
    "activeOpponentCount": 1
  },
  "provenance": {
    "quality": "HEURISTIC",
    "ruleIds": ["POSTFLOP_SPOT_CLASSIFICATION", "VILLAIN_RANGE_FROM_PREFLOP",
                "HERO_EQUITY_MEASUREMENT", "RANGE_ADVANTAGE_MEASUREMENT",
                "NUT_ADVANTAGE_MEASUREMENT", "RANGE_PERCENTILE_MEASUREMENT",
                "AGGRESSION_SCORE_MODEL", "AGGRESSION_FREQUENCY_BANDS",
                "VILLAIN_RANGE_NOT_NARROWED", "EQUITY_SUBSAMPLED",
                "SIZING_BUCKET_SET", "SIZING_BASE_BY_BAND", "SIZING_TEXTURE_MODIFIER",
                "SIZING_SPR_MODIFIER", "SIZING_POT_FRACTION_TO_AMOUNT",
                "FREQUENCY_QUANTIZATION", "PRIMARY_ACTION_TIE_BREAK",
                "ENVIRONMENT_COMPATIBILITY"],
    "environmentCompatibility": { "status": "APPROXIMATE", ... },
    "notes": [ /* 18 notes — one per rule id */ ]
  },
  "confidence": "HIGH",                      // 0 degradation reasons
  "villainRangeNarrowingApplied": false,     // literal type; always false, always shown
  "explanation": { "features": [ /* 52 typed features, no prose */ ] },
  "scoring": { /* every component, band, cap and modifier from B.6 and B.7 */ }
}
```

**Reading it in one sentence:** *the panel says "bet 2.75 BB 80% of the time, check 20%" because
top pair with the second kicker is 88% to win against the range a big blind gets here, hero's
whole range is slightly ahead and holds slightly more of the top of an ace-high rainbow board, and
hero has position and the initiative — which sums to a score of 23 out of a possible ~100, landing
in the `STRONG` band; and 50% of the pot because a `STRONG` hand starts at 75% and both the
completely static board and the very deep stack argue for one rung smaller each.*

## B.9 Reproducibility

The test re-runs the entire pipeline on a freshly built identical query and asserts
`JSON.stringify(again) === JSON.stringify(first)` — bit-for-bit. Nothing in the pipeline reads
`Date`, `Math.random`, or any machine state.

---

## 19. Unsupported, weak, and knowingly open

This section is the point of the report. Everything below is a place where the engine is doing
something it cannot fully justify — all of it labelled in the output, none of it hidden.

### 19.1 Ranges with no public source at all

1. **Every "defend" tier is authored.** `DEFEND_PREMIUM / TIGHT / MEDIUM / WIDE / VERY_WIDE` and
   the value/mixed/bluff split inside them (`THREE_BET_VALUE / MIXED / BLUFF`) come from nowhere
   but this project. Anchor 6's verdict is explicit: *"UNVERIFIED for a specific 'defend X% of
   hands vs each position' number."* Only the **direction** is sourced — the cheapest continue
   (the BB closing the action) defends widest, an out-of-position continue defends tightest. All
   of it is `HEURISTIC` and says so. **This is the single largest unsupported surface in the
   preflop engine.**
2. **The heads-up button range is a FLOOR, not a heads-up range.** No public source publishes a
   heads-up chart at all. The engine takes the **set union** of the 6-max BTN list and the SB
   raise-only list — a widening whose *construction* is stated rather than a percentage that was
   chosen — giving **49.62%**. Published heads-up buttons open **80%+**. The rule note says so,
   the `HEADS_UP_BUTTON_APPROXIMATION` feature says so, and `LINEUP_VERY_SHORT_HANDED` already
   forces every heads-up answer to `HEURISTIC`. If heads-up ever becomes a supported mode it needs
   its own anchor pass, not a wider union.
3. **Iso-raise, squeeze, 4-bet, cold-4-bet and 5-bet ranges are all authored.** No public source
   publishes any of them. The sizings for some of these are sourced; none of the *ranges* is.
4. **The `UNSUPPORTED_SPOT_FALLBACK` is a deliberate refusal to model.** A caller facing a 3-bet,
   a cold 5-bet, anything beyond a 4-bet: the engine answers with a narrow, passive catch-all that
   never authors a raise, because an unmodelled line is the last place to invent aggression.

### 19.2 The postflop model is entirely this project's

5. **Zero postflop rules are `SOURCE`** (34 of 43 are `HEURISTIC`). Every weight, band edge, point
   value, cap, sizing rung and multiway constant was chosen by this project. The anchor doc
   verified preflop material only.
6. **Villain ranges are never narrowed by postflop actions** (section 16.4). This is a *deliberate*
   choice with three stated reasons, but it remains a real limitation: a villain who has bet
   three streets is treated as holding exactly the range they had at the end of preflop.
7. **Range advantage and nut advantage are measured against ONE villain**, not the field. In a
   five-way pot, two of the fifteen aggression components (combined weight 4 of 26) describe a
   pairwise relationship in a multiway pot.
8. **The equity engine models no correlation between villain ranges.** They are independent priors
   made mutually consistent only by card removal. That is card removal, not a correlation model.
9. **The isolation raise's frequency is the aggression model's, unexamined.** On the quads
   fixture it produces 1500 bps, which is low for what is textbook a near-pure isolation — because
   `FACED_BET_SIZE` reads a shove as an overbet to raise *into*. Making the aggression model treat
   a raise over a short all-in differently is a real modelling question and was deliberately not
   attempted. **Open.**

### 19.3 Environment and depth

10. **No numeric ante adjustment exists, anywhere.** Anchor 9 found no cash-applicable factor in
    public sources. An ante table is reported `ANTE: DIVERGENT` and nothing is corrected for.
11. **No rake adjustment either.** The public charts do not state the rake they assume, which is
    why `EnvironmentCompatibilityStatus` has no `EXACT` member at all.
12. **Nothing below 40 BB is modelled.** `OUT_OF_RANGE` reuses the reference tables with everything
    forced to `HEURISTIC`. Short-stack play is a different game.
13. **No table is re-tuned per stack bucket.** The SPR component reacts to depth; the bands
    themselves were authored at 100 BB.
14. **Short-handed reuse is an extrapolation.** Anchor 8 verifies the *mechanism* (a shorter field
    drops the tightest seats first) but no source states a numeric 5- or 4-handed table. The
    preflop registry tags this trigger `DERIVED`; the postflop registry tags it `HEURISTIC`. That
    divergence is documented in both places but is still a divergence.
15. **The `SIZE_FACING_ALLIN_JAM` midpoint is authored.** Half a stack is the conventional
    commitment line, not a sourced figure.

### 19.4 Findings left open by the reviews

All 2 BLOCKERs and all 13 distinct MAJORs across both reviews are fixed, each with a test proven
to fail on revert. **That claim is exactly as narrow as it sounds.** The MINORs and NOTEs were
never routed to a fix agent as a set: of R1's 13 MINORs only four (1, 4, 9, 10) are demonstrably
closed, and **nine have no recorded disposition anywhere**. All eleven of R1B's NOTEs are
deferred. The substantive ones:

**Correctness, still open:**

16. **R1 MINOR-2** — the `rangeRank` fallback ranks a **multiway** equity inside a **heads-up**
    distribution. It fires exactly on off-policy preflop lines — a path CLAUDE.md rule 3
    guarantees is reachable — and biases downward with opponent count. Measured three-handed:
    `2h2s` moved `TOP_5 (+50)` → `TOP_15 (+35)`, enough to cross a band. **The most consequential
    unaddressed finding in the set.**
17. **R1 MINOR-3** — `rangeRank` is coarse under the default budget (153 of 1176 runouts; max
    per-combo error 0.0559, **max `rangeRank` error 0.1267**), and the `SUBSAMPLED` label does not
    travel with `rangeRank`. Compounds with MINOR-2.
18. **R1 MINOR-5** — `recommendPostflop` can **throw** an `invariant` rather than return a typed
    error, from a `StrategyResult`-returning function. Unreachable through poker-core today;
    reachable by any second adapter.
19. **R1 MINOR-7** — `equityVsRanges` silently shrinks the lineup on a sparse `villains` array and
    reports the reduced count as correct. Every other bad input in that file is a typed error;
    this one is a silent wrong answer.
20. **R1 MINOR-8** — a `rangeDigest` collision would return a wrong equity undetectably (0
    collisions in 160k measured trials). Documented trade-off, section 9.6.
21. **R1B NOTE-8** — if no seat carries `isHero`, `buildAction` emits an **overstated chips-in
    figure** while `toAmountMbb` stays legal. Nothing upstream guarantees the lookup succeeds.
22. **R1B NOTE-7** — `ALL_IN_CALL_BANDS` stores points of 10000/8500/… in a `ScoreBand` type whose
    ordinary consumer clamps to ±100. Correct today because that table has its own reader; a live
    footgun for the next one.
23. **R1B MINOR-10** — a min-raise clamp resizes without touching the frequency, contradicting
    B3's own reasoning in the small.

**Honesty-surface defects, still open:**

24. **R1 MINOR-6** — the rationale copied verbatim into `provenance.notes` (the *mandatory honesty
    text*) states "thirteen documented components" where there are fifteen. A wrong statement
    inside the field whose whole purpose is to be right.
25. **R1B NOTE-10a** — postflop `provenance.quality` is a constant, so the degradation machinery
    cannot move it (section 16.1).
26. **R1B NOTE-10b** — `STACK_BUCKET_NEARBY` and `ENVIRONMENT_COMPATIBILITY` are tagged `DERIVED`
    citing **ADR-0056 itself** as their anchor. An internal ADR id is not a public source.
27. **R1B NOTE-4** — every recommendation carries three or more boilerplate `DERIVED` notes, so
    the `quality !== 'HEURISTIC' || notes.length > 0` invariant is satisfied by boilerplate rather
    than by the heuristic that actually drove the answer.
28. **R1B NOTE-11** — the sentence justifying the raise-sizing formula in `postflop/sizing.ts` is
    arithmetically wrong (it yields a half-pot price for villain). The arithmetic is right; the
    sentence describing it is not.

**Deferred as strategy decisions rather than defects:**

29. **R1B MINOR-6** — `heroVsAggressor` drives multiway squeeze sizing where `heroInPosition` is
    arguably better. Deferred **twice** because it changes emitted sizes on an argument for which
    neither review records a counterexample.
30. **R1B MINOR-8 (remainder)** — `policy.ts`'s `lineupSize >= 6 / >= 4` and
    `activeOpponentCount <= 1 / >= 2` triggers and `sizing.ts`'s `degradeProvenance(base, 1)` are
    still undocumented literals outside `scoreModel.ts`.
31. **R1 MINOR-11 / MINOR-13** — a dead `{ kind: 'NO_HAND' }` union member with an unreachable
    render branch, and an unreachable `OPEN_PLUS_CALLER` branch that would squeeze-size off hero's
    *own* open (0 reachable instances in a depth-6 sweep).
32. **R1 MINOR-12** — asymmetric pending label: re-activating a seat shows `'끔'` immediately while
    sitting out correctly shows `다음 핸드부터`, though both take effect next hand.
33. **R1B NOTE-1 / NOTE-5** — `NOT_A_DECISION_POINT` renders as "지원하지 않는 상황입니다" even
    between betting phases, which is a normal state; and `StrategyPanel` re-runs a full postflop
    analysis on every remount (selecting a seat and pressing `Esc` is enough).

34. **`STRATEGY_WP_A3.md`, `STRATEGY_WP_B2.md`, `STRATEGY_WP_B3.md` and `STRATEGY_REVIEW_R1.md` on
    disk still contain superseded text.** Corrections were appended rather than made in place, by
    design — but R1's own MINOR-1 now defends behaviour that no longer exists (see section 20).

### 19.5 Verification not yet done

35. **The 200 ms interaction budget is not proven on mid-range hardware.** Measured headroom is
    ~1.8× on an M-series Mac; a machine 2–4× slower would be at or past the budget on a six-way
    limped flop. This is stated rather than asserted away. The one measurable improvement — a
    yield between the two dominant equity calls, worst case ~130 ms → ~64 ms — was costed and
    **deliberately not done**: it needs a resumable two-phase `buildPostflopContext` on the
    package's public surface.
36. **The frozen-source final gate has not run.** `pnpm verify` plus full regression and
    cross-surface E2E are deliberately deferred to source freeze; the last integration gate
    (105 files / 1811 tests, typecheck / lint / build clean, 8/8 targeted E2E) was green. Every
    individual fix package ran only a partial gate, under concurrent edits by other agents.
37. **R1B's own MAJOR-1 was never re-verified by its reviewer** — "treat the finding as open until
    the orchestrator's own gate closes it." ADR-0058 and `STRATEGY_FIX_BUTTON.md` are the closure,
    but the closing evidence is the fixing agent's, not an independent one's. An independent
    re-verification pass is in flight.
38. **No authorization or multi-user security assessment is possible.** R1 states it plainly: the
    app has no auth layer at all, and "session ownership" has no meaning in a single-user local
    SQLite tool. Nothing here would survive a future multi-user deployment unexamined.
39. **Phase 8 (persistence) is not started.** Nothing produced by this engine is persisted:
    recommendations are recomputed from the hand state on every render pass and there is no
    strategy-related table, migration or repository. A saved hand replays into the same answer
    because the engine is deterministic, not because the answer was stored.

---

## 20. Discrepancies found between the reports and the code while writing this

Recorded per the brief; the code is authoritative in each case.

1. **`docs/STATE.md` says A3 delivered "30 provenance-tagged rules".** The registry now holds
   **35** (4 SOURCE / 14 DERIVED / 17 HEURISTIC). The count grew during the fix packages
   (`RFI_HEADS_UP_BUTTON`, `FACING_ALLIN_IN_TREE`, `SIZE_FACING_ALLIN_JAM`, …).
2. **`postflop/rules.ts`'s `AGGRESSION_SCORE_MODEL` rationale says "thirteen documented
   components".** There are **fifteen** (`AGGRESSION_WEIGHTS.length === 15`, total weight 26), and
   `workedExample.test.ts` asserts "scores all fifteen components". The rationale string is stale.
3. **`docs/STATE.md` says "Worst-case latency 87ms" for B3.** Corrected: the worst shape is a
   six-way limped flop at **106.3 ms** (112.1 ms monotone), and the heads-up flop is 89.6 ms.
   Four different figures for this one quantity exist across the tree (87 / 106.3 / 119–130 /
   130–153 ms); the benchmark file's 106.3 ms is the current in-repo measurement, and the two
   higher figures are adapter-level measurements of the same shape. All are far from 87 ms.
4. **Headroom against the 200 ms budget appears as ~2.3× (B3, wrong), ~1.3–1.7× (B4 §5.4) and
   ~1.8× (R1B, current).** Only ~1.8× is current.
5. **`STRATEGY_WP_A3.md`'s SB range figure (45.10%, 21 offsuit classes) is superseded** by
   **46.91% / 622 combos / 23 offsuit classes**, which is what the code computes today. The report
   carries an appended correction rather than an in-place edit.
6. **The short-handed trigger is tagged differently on the two streets** — `LINEUP_SHORT_HANDED`
   is `DERIVED` in `preflop/rules.ts` and `HEURISTIC` in `postflop/rules.ts`. Both registries
   document the divergence (preflop followed its brief, postflop followed the anchor doc's
   `UNVERIFIED` verdict). It is a real inconsistency in the output, not just in the prose: the
   same lineup degrades preflop by one step and postflop to `HEURISTIC` outright.
7. **`STRATEGY_WP_B2.md`'s 84.7 ms is the raw `equityVsRange` heads-up flop enumeration**, not a
   `recommendPostflop` figure. It sits one line away from the 87 / 89.6 ms full-policy numbers in
   other reports and is easy to conflate; they measure different things.
8. **Confidence is attributed to the wrong ADR by the brief for this report.** ADR-0056 does not
   define confidence at all; `ConfidenceLevel` comes from **ADR-0036** and is reused postflop-only,
   with different semantics (a degradation count, not a sample size) and with `INSUFFICIENT` — the
   member ADR-0036's own title is about — never emitted. Section 16.3 states this.
9. **`postflop/rules.ts:21` says postflop provenance is "essentially always `HEURISTIC`".** It is
   **always** `HEURISTIC`, unconditionally, because `VILLAIN_RANGE_FROM_PREFLOP` is always in
   `ruleIds`. The qualifier suggests a gradation that cannot occur.
10. **`STRONG_SHARE_PERCENTILE`'s three outputs have no reader anywhere** (grep-verified across
    `packages/` and `apps/`), contradicting the natural reading of B3's description that they are
    reported. They are computed on every postflop recommendation and discarded.
11. **`docs/STATE.md` is internally stale in three places.** Its `## Test status` section is still
    the 2026-08-31 Alpha gate (72 files / 979 tests / 15 Playwright) rather than the Strategy A+B
    gate recorded 250 lines above it; its known-issues list still says "`S` (sit-out toggle) is
    not bound", which A1 contradicts in the same file; and ADR-0058 is missing from the
    milestone's cited-decisions line although it is accepted and load-bearing.
12. **Both review files carry the same H1** (`# STRATEGY_REVIEW_R1 …`), and two fix agents recorded
    that the R1 findings they were assigned **were not in the R1 file on disk** under any
    numbering — `STRATEGY_FIX_POSTFLOP.md` §0 says M4, M7 and M8 are absent from it, and
    `STRATEGY_FIX_PREFLOP.md` §0 says the on-disk file opens with R1B's "Verdict: no BLOCKER" and
    that its MINOR-1 asks to *preserve* the very `VS_ALLIN` precedence B1 asks to remove. Both
    agents proceeded only after independently reproducing every finding against the real code,
    which is the right call — but the on-disk R1 report cannot currently be used to audit what was
    fixed. **This is a document-integrity problem, not an engine problem**, and it is the reason
    section 19.4 enumerates the open MINORs from the review text rather than by citing R1's
    numbering alone.
13. **`STRATEGY_REVIEW_R1.md`'s file mtime is later than two of the fix packages it nominally
    drove.** Recorded as an observation about the paper trail, with no bearing on the code.

---

## Appendix — jargon, in one place

| term | meaning |
| --- | --- |
| **milliBB** | the money unit. 1 BB = 1000 milliBB, always an integer. Never a float. |
| **bps** (basis points) | 1/100 of a percent. All frequencies and range weights are integers 0..10000. |
| **combo** | one specific two-card holding, e.g. A♥Q♥. There are 1326. |
| **hand class** | a combo with suits abstracted: `AQs` (suited), `AQo` (offsuit), `QQ` (pair). There are 169. |
| **range** | a weight per combo — what a player could hold. |
| **RFI** | raise first in: everyone folded to you and you open. |
| **3-bet / 4-bet / 5-bet** | the second / third / fourth raise preflop. |
| **squeeze** | re-raising an open that somebody has already called. |
| **limp** | entering the pot by calling the big blind instead of raising. |
| **IP / OOP** | in position / out of position — acting last or first on the remaining streets. |
| **c-bet** | continuation bet: a bet by the previous street's raiser. |
| **equity** | your expected share of the pot at showdown, 0..1. |
| **pot odds / required equity** | `call / (pot + call)` — the equity a call needs to break even. |
| **SPR** | stack-to-pot ratio: remaining effective stack ÷ pot. Low means committed. |
| **effective stack** | the smaller of the two stacks — the most that can actually change hands. |
| **the nuts** | the best possible hand on a board. |
| **OESD** | open-ended straight draw: four in a row, two ways to complete. |
| **gutshot** | a straight draw with one completing rank. |
| **blocker** | a card you hold that your opponent therefore cannot. |
| **STATIC / DYNAMIC board** | whether the winner is likely to change as more cards come. |
| **polarized range** | a betting range made of very strong hands and bluffs, with little in between — which is why they must share a bet size. |
