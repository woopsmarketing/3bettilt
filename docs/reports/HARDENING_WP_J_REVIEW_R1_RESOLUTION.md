# WP-J — Review R1 resolution

2026-09-02. What changed in response to `HARDENING_WP_J_REVIEW_R1.md`, and what deliberately
did not. Every fix below is paired with a test that FAILS against the reintroduced defect —
the fix was reverted, the test observed failing, then restored. That check is noted per item.

**Final state:** `pnpm verify` exit 0 — 136 test files passed / 1 skipped, 2307 tests passed /
3 skipped (the skips are the opt-in benchmarks); typecheck, lint, licence hygiene and
`next build` clean. `pnpm e2e` exit 0 — 30 passed.

| # | severity | verdict | where |
|---|---|---|---|
| 1 | MAJOR | **fixed** | `adaptive-core/src/multiway.ts` |
| 2 | MAJOR | **fixed** | `adaptive-core/src/policy/cap.test.ts` (new) |
| 3 | MAJOR | **fixed** | `apps/web/src/server/adaptive-service.ts` |
| 4 | MAJOR | **fixed** | `apps/web/src/components/table/PlayerProfilePanel.tsx` |
| 5 | MINOR | **not changed, documented** | `adaptive-core/src/multiway.ts:143-151` |
| 6 | MINOR | **fixed** | `packages/db/src/rows.ts`, `adaptive-trace-service.ts` |
| 7 | MINOR | **fixed** | `adaptive-core/src/policy/cap.test.ts` |
| 8 | MINOR | **fixed** | `strategy-core/tests/layering.test.ts` |
| 9 | MINOR | **not changed, documented** | `scripts/backfill-adaptive-traces.ts` |
| 10 | MINOR | **guarded + labelled** | `adaptive-core/src/policy/frequency.ts` |
| 11 | NIT | **fixed** | `StrategyPanel.tsx` |
| 12, 13 | NIT | **fixed** | `adaptive-core/tests/layering.test.ts` |
| 14, 15 | NIT | **not changed, documented** | see below |

Two further defects were found while fixing the above and are recorded as **R1-extra 1** and
**R1-extra 2**. Neither was in the review.

---

## MAJOR 1 — the §9 guard never fired heads-up

`classifyOpponents` gained `isLive` and `actsAfterHero`, and the guard loop's predicate moved
from `role.role !== 'BEHIND'` to `!role.isLive || !role.actsAfterHero`. ADR-0065(e)'s wording
("a live opponent still to act") was always the broader one; the code had narrowed it.

The review's counter-example is the whole point: heads-up, one opponent reading FOLD_TO_CBET
75% / CHECK_RAISE 30% at n=100 each, `CHECK_RAISE_HIGH` contributes −672 against +1132 gross,
so the net was a bluff INCREASE against a known check-raiser. There is no third party
heads-up, so the guard was structurally unreachable in the most common spot at this table.

Facing a bet, the primary has already acted, `actsAfterHero` is false, and they are correctly
excluded — that case is now pinned by its own test rather than left implied.

`compose.test.ts`'s J10.11 block was rewritten (its control case used a check-raising primary,
which under the fix arms the guard, so it was no longer a control) and two describes were
added. **Disable-proof: 2 failures, restored → green.**

## MAJOR 2 — `trimToCap` had no coverage

`trimToCap` is the only thing holding `totalShiftBps` inside its cap after quantization, and
it could be replaced with `return false` with the whole suite green. `cap.test.ts` is new: two
brute-force-found baselines that land on 1500 bps against the 1000-bps multiway cap when the
trim is removed, plus grid/total/kind preservation and the heads-up cap.
**Disable-proof: 1 failure, restored → green.**

## MAJOR 3 — a HUD *hand* count used as an *opportunity* count

A snapshot-wide hand count was assigned as `sampleN` to every HUD reading, so "500 hands"
became 92.6% confidence in a FOLD_TO_3BET number drawn from perhaps 25 actual opportunities.
Now: `manualHudSampleCap(key) = floor(kFor(key)/2)`, a uniform `MANUAL_HUD_MAX_CONFIDENCE_BPS`
of 3333, and an UNCONDITIONAL note carrying the entered figure verbatim
(`… 500핸드 → 유효 표본 20`). The note is unconditional because a conditional one is absent
exactly when the reading is most in need of a caveat.

**This visibly changed the product, and §"Consequences" below says how.**

## MAJOR 4 — editing one HUD field dropped the other seven

`hudText` started empty, so submitting one field wrote a snapshot containing only that field.
The rows survive in the insert-only table but the *effective* profile silently lost seven
readings. The form now seeds from the stored snapshot (`hudFormText`), and an unknown hand
count stays BLANK rather than being seeded as `0` — `0` would invent a sample size.
**Disable-proof: 3 failures, restored → 9 pass.**

## MINOR 5 — `THREE_BET` read as a postflop guard signal — NOT CHANGED

`guardStatsFor` returns `THREE_BET` on every street. The rationale is already written at
`multiway.ts:143-151`: it is the only re-raise-willingness stat that is not street-scoped, and
the guard only ever REFUSES escalation, so a false positive costs conservatism and never
aggression. Changing it would narrow a safety rail on a judgement call. Documented, not
changed. The stale "in the `BEHIND` role" phrasing in the same doc block was corrected to
match the MAJOR 1 fix.

## MINOR 6 — a stored trace could not say why a rule moved nothing — FIXED

This is the one that matters most for an insert-only table: nothing written later can add the
missing explanation. `AdaptiveTraceAdjustment` gained:

- `deviationBps` — the SIGNED read itself. Without it, `contributionBps: 0` cannot be told
  apart from "this opponent was unremarkable here".
- `cappedBy` — which ceiling clipped or zeroed the rule, `null` when none did.
  `AGGRESSIVE_PLAYER_BEHIND` here is the guard rail explaining itself.
- `sources` widened from `readonly string[]` to `AdaptiveTraceSourceRef[]`
  (`{source, valueBps, sampleN, note}`), so a 12-hand manual reading and a 900-observation
  model no longer read back as the same evidence.

The decoder refuses a MISSING property as `CORRUPT_ROW` rather than letting `undefined` read
back as "nothing capped this" or "no caveat" — those are different claims about the hand.
`adjustments_json` is a TEXT column, so **no migration was needed**; migration 0007 is
untouched.

Four tests: a db round-trip proving a refused rule stays distinguishable from an absent one, a
db corruption case, a web service test proving the fields come from the composition
(`deviationBps === estimateBps - priorBps`, and `sampleN` equals the sources' own sum), and a
web test proving `cappedBy` is a signal rather than a constant.
**Disable-proof: 3 web failures + 1 db failure across the two mutations, restored → green.**

## MINOR 7 — the cap scaler's sign-safety was untested — FIXED

Property tests in `cap.test.ts`: `|contribution| <= |raw|` and the sign never flips.
`Math.trunc` → `Math.floor` previously left all tests green.

## MINOR 8 — `strategy-core`'s layering guard did not name the new package — FIXED

`FORBIDDEN` widened to `['@gto-self/player-core', '@gto-self/analysis-core',
'@gto-self/adaptive-core', '@gto-self/db']`.

## MINOR 9 — backfilled traces use today's evidence — NOT CHANGED, DOCUMENTED

Correct as designed and not fixable in principle: a hand played before the model existed has
no contemporaneous model to compose against. The script header now states it plainly — a
`BACKFILL` row answers "what would we advise here, knowing what we know today", a `LIVE` row
answers "what did we advise at the table" — and notes that `source`, `player_model_version`
and the two snapshot maps let any row be dated.

## MINOR 10 — `trimToCap`'s termination argument — GUARDED AND LABELLED

Each move is now taken only if it STRICTLY reduces the measured shift; a move that does not is
undone and the loop stops. **The branch is unreachable and is labelled as unreachable, not as
tested.** A move can only worsen the shift when the chosen row's own |delta| is under 250 on
both sides, and since each side's deltas sum to more than the cap (or the loop would not run),
that needs about `cap / 250` rows per side — nine or more heads-up. A baseline has at most six
(FOLD/CHECK/CALL/BET/RAISE/ALL_IN).

I wrote an off-grid test claiming to cover this, then disabled the guard and watched it stay
green: it was vacuous. It has been renamed and rewritten to assert only what it proves — an
off-grid baseline still yields a legal grid mix with a self-consistent `totalShiftBps` — and
its comment says outright that the no-progress branch is NOT covered and why.

## NIT 11 — a de-escalation rendered in the "good" colour — FIXED

`text-good-500` → `text-ink-100` for any non-zero delta. Brightness says "this moved"; nothing
says "this is good". Adapting toward folding more is exactly as correct an answer as adapting
toward betting more, and green asserted a valence the number does not have.

## NIT 12 / 13 — the layering guard's own blind spots — FIXED

The scan now covers every `.ts` the package compiles (`src/**`, `tests/**`, root-level), not
just `src/`. `react-dom`, `@gto-self/coinpoker-parser` and `solver-lab` were added to
`FORBIDDEN` — `references()` matches a package and its subpaths only, deliberately (it is what
keeps `next-safe-action` from tripping the `next` ban), so a real sibling must be listed.

`layering.test.ts` itself is the single excluded file, by exact path: the forbidden specifiers
in it are quoted sample text for the scanner's own self-test. **Proof it is not a loophole: a
planted `@gto-self/db` import in a new `tests/` file failed the guard.**

## NIT 14 / 15 — NOT CHANGED

14 (`opponent_count` uses `countRange`) would require editing migration 0007, which has
already been applied to working databases. The decoder validates the value; the CHECK is a
belt on a brace. 15 is `heroStreetContributionMbb`'s zero default on a branch
`buildStrategyQuery` refuses to produce, which `clampPostflopSizing` would clamp anyway.

---

## R1-extra 1 — the "no adjustment" line explained the mix with a SIZING remark

Found by the E2E after the MAJOR 3 fix. `StrategyPanel` rendered `조정 없음 — {notes[0]}`, and
`notes[0]` in a preflop spot is `PREFLOP_SIZING_OUT_OF_SCOPE`. The user was told the MIX held
because *preflop sizing is out of scope* — a true sentence answering a different question, and
a reader has no way to tell.

`adaptive-core` now owns `ADAPTIVE_NOTE_SCOPE`, an exhaustive `AdaptiveNoteCode → 'FREQUENCY' |
'SIZING'` map, so a new code is a compile error rather than a note that silently lands in the
wrong explanation. The panel selects the first FREQUENCY-scoped note and falls back to the
plain truth (`조정 결과가 기본전략과 같음`) when there is none. Three tests pin the
classification; the E2E pins the rendering.

## R1-extra 2 — the panel showed the capped sample without the entered one

A direct consequence of MAJOR 3, and a `CLAUDE.md` rule 3 violation ("both are shown"): the
reason row read `n=20` while the user's own HUD panel read `500핸드`, with nothing connecting
them. Each source's note is now rendered verbatim beneath its reason row
(`adaptive-source-note-MANUAL_HUD`), so the entered figure and the effective one appear
together. Asserted in the E2E.

---

## Consequences of MAJOR 3 that the user should know

**A manual HUD reading alone can no longer move a preflop mix.** Worked through for the exact
J6 acceptance spot — `FOLD_TO_THREE_BET` typed at 90% over 500 hands, anchor 55%, `K = 40`:

```
effective n = min(500, floor(40/2)) = 20
confidence  = round(10000 * 20 / 60)          = 3333 bps
estimate    = 5500 + (9000-5500) * 0.3333     = 6666   (deviation 1166)
raw         = floor(1166 * 4000 / 10000)      =  466   (FOLD_TO_3BET_HIGH gain)
scaled      = floor(466 * 3333 / 10000)       =  155 bps
```

155 bps is under half a 500-bps grid step, so the quantized mix is unchanged. Confidence
enters twice by design — once shrinking the estimate toward the anchor, once scaling the
contribution — so the manual-HUD ceiling is effectively squared. In this preflop spot
`FOLD_TO_3BET_HIGH` is the *only* applicable rule, so no amount of HUD typing moves this
particular mix; the learned model is what moves a recommendation.

The `adaptive-strategy.spec.ts` J6 test was rewritten around this rather than being weakened:
it now pins the `ADAPTED` + `changed=false` state, which is a real and useful answer — the
panel names the opponent, cites the rule and the evidence, shows both the entered and the
effective sample, reports `전체 이동 0bps / 상한 2,000bps`, and does **not** invent a movement
a single capped reading does not justify.

**Whether the double application of confidence is right is a policy question, not a bug.** It
was reviewed and passed as designed, and re-opening it would change every number in the WP-J
report. Flagging it as the one calibration decision most worth revisiting if HUD readings feel
inert in use. Changing it means bumping `ADAPTIVE_POLICY_VERSION`.

---

## Test-count movement

| suite | before R1 | after |
|---|---|---|
| `adaptive-core` | 88 | **106** |
| workspace (`pnpm test`) | 2285 | **2307** |
| `web` | 462 | **467** |
| `db` | 149 | **151** |
| E2E | 30 | **30** (1 rewritten) |
