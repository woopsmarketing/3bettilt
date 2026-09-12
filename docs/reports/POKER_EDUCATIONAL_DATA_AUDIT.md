# FishTilt — poker educational data audit

Required by the build spec §71, and written **before** any range or strength data is
implemented. Its job is to classify every number FishTilt intends to put in front of a
beginner, so that no later work package can quietly invent one because a component needed
something to render.

The rule it enforces is CLAUDE.md rule 2 and the build spec §46: *a number that does not
yet exist is not created because the UI wants one.* An unsupported condition says so.

Audit date: **2026-09-04**. Author: orchestrator. Read with
`docs/reports/FISHTILT_00_AUDIT_AND_PLAN.md` and `docs/reports/STRATEGY_ANCHORS.md`.

---

## 1. The three kinds of number, and the test that separates them

Every figure FishTilt displays falls into exactly one of these. The classification is not a
matter of taste: each has a test that decides it.

### A — MATHEMATICAL FACT

*Test: two competent people who agree on the rules of hold'em and start from an empty page
must arrive at the same value. There is nothing to cite because there is nothing to
disagree with.*

Computed here, never sourced. Examples: the 1326 two-card combinations; 6 combos per pair,
4 per suited hand, 12 per offsuit; the probability of being dealt a specific pair; a hand's
equity against another specific hand; the chance a flush draw completes; the win rate a
pot price demands.

These may be stated flatly, with no hedging and no provenance label. What they DO require
is that the method is stated when the method could be misunderstood — see §3 on exact
versus estimated equity, which is the one place this category has a sharp edge.

### B — SOURCED STRATEGY

*Test: it is a recommendation about how to play, it cannot be derived, and a specific,
freely accessible published page says it.*

Example: which hands to open from the button at 100BB in a 6-max cash game. There is no
theorem behind it; there is a chart somebody published. It is legitimate to teach, and it
is illegitimate to present without saying where it came from.

The repository already holds this category, already verified, in
`packages/strategy-core/src/preflop/tables.ts`, traced to `docs/reports/STRATEGY_ANCHORS.md`
(2026-09-01, 14 named free public education sources). That document states explicitly that
no GTO Wizard content, no paywalled content and no bulk range-library scraping was used.
FishTilt consumes that work; it does not re-source it, and it does not extend it.

### C — AUTHORED HEURISTIC

*Test: it is a recommendation, no public source states it, and this project made it up on
purpose to fill a gap.*

`strategy-core` carries several of these and labels them `HEURISTIC` with a mandatory
written rationale — its continue tiers against an open, for instance, exist because *no
public source publishes a defend-percentage table*.

A heuristic is a legitimate thing for a private training engine to hold. **FishTilt does
not display this category at all in MVP.** A beginner cannot evaluate the difference
between "a published chart says this" and "this project decided this", and the site's whole
claim is that a learner can trust what it shows. Where FishTilt has only category C, it
shows nothing and says the condition is not ready.

---

## 2. Inventory — every number FishTilt plans to display

| What the user sees | Kind | Where it comes from | Shipped in MVP |
| --- | --- | --- | --- |
| 1326 combos; 169 classes; 6/4/12 per class | A | `strategy-core` `range/handClass.ts`, `range/combo.ts` — tested identity | yes |
| A range's combo count and % of all hands | A | `notation.ts` `comboCountOf` / `percentageOf` | yes |
| "AA는 얼마나 자주 받을까" (6/1326) | A | computed | yes |
| Hand ranking order (족보) | A | rules of the game; `analysis/evaluate.ts` category order | yes |
| Best five cards out of seven, ties, wheel A2345 | A | `analysis/evaluate.ts`, already tested | yes |
| Hand-vs-hand equity | A | exact enumeration in `learn-core` (WP-B) | yes |
| Outs → turn / river / by-river probability | A | exact hypergeometric, `learn-core` | yes |
| The "×2 / ×4" shortcut | A, *labelled as an approximation* | `learn-core`, always shown beside the exact value | yes |
| Pot odds, required win rate | A | `learn-core/potOdds.ts` | yes |
| 6-max 100BB first-in ranges, UTG/HJ/CO/BTN/SB | **B** | `strategy-core` `RFI_RANGES` ← `STRATEGY_ANCHORS.md` | yes |
| "BB has no first-in range" | A | a rule of the game — if it folds to the BB the hand is over | yes |
| Starting-hand strength ranking / "top X%" | A, **exact** — see §4 | generated in WP-R by full enumeration | yes |
| Ranges vs an open / vs a 3-bet | **C** | `strategy-core` `DEFEND_*`, `THREE_BET_*` — all `HEURISTIC` | **no** |
| Ranges at 40 / 60 / 150BB | — | does not exist at any classification | **no** |
| 9-max, tournament, heads-up ranges | **C** or nonexistent | HU is a `HEURISTIC` union of two lists | **no** |
| Postflop strategy | — | out of scope | **no** |
| Anything labelled "GTO" | — | no solver output exists in this repository | **never** |

---

## 3. The one sharp edge: exact versus estimated equity

`strategy-core`'s equity engine reports its own method per call, and it is honest about it:
`EXACT` when both the opponent assignments and the runouts were enumerated exhaustively,
`SUBSAMPLED` otherwise.

> **Correction, 2026-09-05.** This section originally said preflop is "always `SUBSAMPLED`,
> whatever the budget", because that is what `equity.ts`'s own file-header comment says. The
> comment is stale: `equity.ts` line 385 returns `EXACT` whenever
> `table.exhaustive && runoutsExhaustive`, preflop included. Measured directly — one hand
> class against all 1225 opponent hands over the full 2,118,760-board space returns
> `method: 'EXACT'` in 74.7 s on one thread. At the DEFAULT budget preflop is indeed always
> subsampled, which is what the comment was describing and what an interactive request will
> always get; it is not a property of the engine. `strategy-core` is read-only for this
> build, so the comment was not edited — the discrepancy is recorded here and in
> `docs/FISHTILT_STATE.md` for that package's owner.

That is the right answer for that engine and the wrong answer for FishTilt's equity
calculator, which asks a narrower question: one specific hand against one specific hand.
With four known cards there are only C(48,5) = 1,712,304 runouts, which is exactly
enumerable in well under a second. WP-B implements that enumeration in `learn-core`,
reusing `strategy-core`'s evaluator, and reports `EXACT`.

The resulting rule for the UI, which is not negotiable:

- A number produced by full enumeration is shown plainly.
- A number produced by sampling is shown as **추정** with its sample count visible.
- The two are never rendered by the same component without the label, and a range-based
  equity inherits `strategy-core`'s own method marker verbatim rather than being
  re-described by FishTilt.

Presenting an estimate as exact is the specific failure this section exists to prevent.

---

## 4. The starting-hand strength ranking

The "top X%" slider needs a ranking of the 169 classes, and none exists in this repository.
Three methodologies were considered (build spec §73):

**Chosen — A: heads-up preflop all-in equity against a uniformly random legal hand.** It is
a property of the cards, reproducible by anyone, and requires no source to trust. It is
also honest about what it is not: it measures showdown value all-in preflop, which is *not*
the same as how playable a hand is, and the methodology page must say so — this is why
suited connectors rank lower here than their real-world value suggests.

Rejected — B (adopt a published ranking): it would import someone else's judgement,
require citation and licence work, and still not be reproducible. Rejected — C (composite
heuristic): it is category C, which FishTilt does not display.

**It is computed exactly.**

> **Correction, 2026-09-05.** This section originally shipped an ESTIMATE, on the stated
> grounds that "fully exact evaluation is out of reach — roughly 3.5 × 10¹¹ evaluations
> across all classes". The arithmetic was right and the conclusion was wrong: 3.5 × 10¹¹
> evaluations is about 3.5 hours of CPU here, and roughly 15 minutes of wall clock across
> this machine's cores. The measurement that falsified it — 74.7 s for one class, exhaustive,
> against a textbook-matching AA equity of 0.8520371330210104 — is exactly the falsifying
> evidence CLAUDE.md rule 9 requires before a settled decision may be reopened, so the
> decision was reopened and the dataset regenerated by full enumeration.
>
> A sampled dataset was actually built and reviewed first. It was sound — deterministic,
> with a measured rather than modelled standard error and honest confidence-derived tie
> bands — and every one of those mechanisms exists only to manage sampling error. Exact
> enumeration removes the error and therefore removes the machinery: no tie bands, no
> two-budget stability gate, no "the band may be 10-15% narrow" caveat, no dependence on a
> quasi-random sampler whose accuracy is not monotone in sample size. Fifteen minutes of
> offline compute bought all of that, and a number a learner can be told is simply true.

So:

1. One representative combo per class suffices, because the opponent distribution is
   suit-symmetric and all 6 / 4 / 12 combos of a class are equivalent under suit
   relabelling. 169 measurements, not 1326.
2. An **offline generator** enumerates, for each class, every one of the 1225 opponent
   hands over every one of the 2,118,760 five-card boards. No sampling anywhere.
3. The result is **frozen** into a checked-in dataset carrying `rankBasis`, `methodology`,
   `generatorVersion`, `generatedAt` and `method: 'EXACT'`.
4. **Acceptance gate:** the suit-symmetry argument the methodology rests on is tested
   directly — measure a class from a *different* representative combo and assert the exact
   equity agrees. A two-budget stability gate is not meaningful for an exact computation and
   was removed with the sampling.
5. The slider cuts by cumulative share of the 1326 combos, so "상위 15%" means 15% of hands
   actually dealt — not 15% of the 169 labels, which would be a different and misleading
   number.

**What does not change:** all-in preflop equity is not playability. This ranking measures
showdown value with the money already in, which is why suited connectors sit lower here than
their real-world value suggests. Being exact makes the number certain; it does not make it
mean something else, and the methodology page says so.

---

## 5. Sources and licensing

FishTilt adds **no new external data source**. Everything in category B is already in the
repository and was verified on 2026-09-01 against 14 free, publicly accessible poker
education pages, recorded with URLs and quotes in `docs/reports/STRATEGY_ANCHORS.md`.

Standing prohibitions that apply to this build (ADR-0015, `docs/OPEN_SOURCE_EVALUATION.md`):

- No GTO Wizard content, no paywalled content, no bulk range-library scraping.
- The named blocklist — `postflop-solver`, `TexasSolver` (both AGPL-3.0), `shark-2.0`
  (unlicensed) — is never copied or vendored, and `pnpm lint:licences` is a standing check.
- Three specific datasets are recorded as **provenance hazards regardless of licence** and
  must never become baseline data: `rs-poker`'s `preflop_6max_rfi.json` (labelled
  "6Max-RFI-GTO" but uncited), `poker_solver`'s blueprint shards (null exploitability,
  unmarked uniform-fallback rows), and `poker-engine-ts`'s invented persona numbers.
- Any new third-party dependency needs its licence read from the actual LICENSE file and
  recorded in `docs/DECISIONS.md` before it is added.

---

## 6. What FishTilt tells the user

Internal provenance (`SOURCE` / `DERIVED` / `HEURISTIC`) is preserved in the data and is
**not** shouted at a beginner, who cannot act on it. The user-facing contract is smaller
and more useful:

- Ranges are labelled **학습용 기본 레인지**, with the conditions always visible —
  6인 · 100BB · 아무도 참여하지 않았을 때 — and a `[이 기준은 무엇인가요?]` affordance that
  opens the methodology, including the sentence "상황과 상대에 따라 실제 선택은 달라질 수
  있습니다."
- The strength ranking states its basis next to the slider and links to §4's methodology.
- Estimated numbers say 추정 and show their sample count.
- An unsupported condition gets an honest empty state and a route back to a supported one —
  never a fallback range, never an interpolated stack depth.
- The word **GTO** is not used anywhere in FishTilt's UI.

---

## 7. Rule for anyone adding a number later

Before a new figure reaches the screen, it must be classified here first.

1. **Can it be computed from the rules of the game?** Then it is category A. Compute it,
   test it, and state the method if the method could be misread.
2. **Does a specific, freely accessible published page state it?** Then it is category B.
   Record the URL and a quote in `STRATEGY_ANCHORS.md` before writing the value down.
3. **Neither?** Then it is category C, and FishTilt does not display it. Add the condition
   to the unsupported list and give the user the honest empty state.

There is no fourth branch. "The component needed a value" is not a provenance.
