# GTO baseline

## The rule

**Do not invent poker strategy numbers.** Not in code, not in fixtures, not in
comments, not in UI copy. There is currently no real solution data in this repository
and none may be fabricated.

Also forbidden: scraping GTO Wizard or any solver product, and copying proprietary
solution datasets.

## Mock data (allowed, until Phase 14)

A mock provider is permitted for UI development on these conditions:

1. Its output type carries a provenance tag, e.g. `provenance: 'MOCK'`, that the type
   system will not let a consumer drop.
2. The UI renders any mock-sourced strategy with a visible `MOCK DATA` badge in the
   dedicated mock colour (`--color-mock-500`).
3. Mock numbers are obviously synthetic, never presented as a plausible equilibrium.
4. Removing the mock provider must not require changing the poker engine or the UI —
   only the provider registration.

## Baseline identity and versioning

```
CP_NL50_6MAX_ANTE_100BB_PREFLOP_V1
CP_NL50_HU_ANTE_100BB_POSTFLOP_SRP_V1
 ^   ^    ^     ^     ^      ^         ^
 |   |    |     |     |      coverage  version
 |   |    |     |     stack depth
 |   |    |     ante mode
 |   |    lineup
 |   stake preset
 site style
```

Format: `<site>_<stake>_<lineup>_<ante>_<stack>_<coverage>_V<n>`.

**The identifier must name its lineup** (ADR-0028). Without it a six-handed preflop dataset
and a four-handed preflop dataset collide on one name — reintroducing exactly the failure
ADR-0019 exists to prevent. Lineup gets its own segment rather than being folded into
coverage, so it is always present instead of present only when someone remembered it.

**The identifier must state its coverage** (ADR-0019). A name like
`..._BASELINE_V1` implies a dataset covering the whole game; per ADR-0014 no such dataset
is reachable, so the name would be a claim we cannot meet. Coverage names the **street scope
and pot type** actually solved; the lineup segment carries the lineup. Together they are what
lets the matcher detect a miss and the UI say "no exact solution for this lineup" instead of
silently presenting a six-handed answer for a four-handed spot.

Every solution dataset is versioned and immutable. **Never regenerate under an
existing version.** A changed action tree, a changed rake model, a changed sizing set
or a re-solve all produce a new version.

## Preset (MVP)

| Field              | Value                                             |
| ------------------ | ------------------------------------------------- |
| Site style         | CoinPoker                                         |
| Game               | NLHE cash                                         |
| Seats              | 6 max                                             |
| Stake              | NL50                                              |
| SB / BB            | 0.5 / 1 BB                                        |
| Reference stack    | 100 BB                                            |
| Ante               | 0.16 BB per dealt-in player, when ante mode is on |
| Rake               | 5% (exact rational 5/100, never a float)          |
| Rake cap           | 8 BB — see the open question below                |
| Settlement quantum | ₮0.01 = 20 milliBB at NL50 (ADR-0027)             |

Rake is configuration, not code. NL100 should be reachable by changing the cap, the
settlement quantum and the monetary display config — three separate fields. The settlement
quantum is **not** derived from the display config (ADR-0027): display is presentation, and
recorded money must not move when a formatting choice does.

**Open question — the cap may be lineup-dependent.** The 8 BB cap is confirmed only for the
dealt-in count currently targeted. Many rooms run a short-handed cap schedule. Do not invent
one, and do not claim exact CoinPoker short-handed settlement until a fixture verifies it.

## Long-term pipeline (Phases 13-14, gated)

```
research game tree
  -> CFR / equilibrium solver
  -> research results
  -> simplified representative action tree
  -> re-solve
  -> versioned baseline dataset
```

Research sizing candidates — these are **candidates to evaluate, not poker laws**:

- open: 2.0 / 2.25 / 2.5 / 3.0 BB
- 3bet, 4bet: several representative sizes plus all-in where legal
- postflop: 20% / 33% / 50% / 75% / 100% / 125% / 150% / all-in

Rules for the spike:

- Do not attempt a production six-player NLHE solver in one phase. `docs/OPEN_SOURCE_EVALUATION.md`
  section 6 supplies the measured numbers behind this sentence, and ADR-0014 fixes the
  deliverable as a validated method plus a cost curve, not a baseline.
- Validate any CFR implementation on Kuhn and Leduc poker first, with published
  equilibrium values as the check. **Two landmines, found during the open-source
  evaluation:** (1) Kuhn poker has a _continuum_ of equilibria parameterised by
  alpha in (0, 1/3], so asserting a point strategy value is wrong — assert the algebraic
  invariant between infosets instead. (2) At least one published open-source DCFR
  implementation has docstrings that write the strategy-sum update with the opponent's
  reach while its code correctly uses the acting player's own reach. Transcribing the
  comment yields a silently wrong average strategy that still looks plausible. Read the
  code, not the comment.
- Before integrating any external solver: check the licence, document the licence in
  `docs/DECISIONS.md`, and confirm compatibility with future distribution. Never
  silently adopt AGPL, commercial or proprietary code. ADR-0015 carries a named
  blocklist of AGPL/unlicensed poker solvers, because those are exactly what a search
  for "open source poker solver" surfaces first. `pnpm lint:licences` is the standing
  tripwire.
- Never import an unprovenanced strategy chart as baseline data, whatever its licence.
  A permissive licence makes copying _legal_, not the numbers _true_.
- Never claim NLHE solving works unless it has actually been validated.

## Strategy policy layer

Lives in **`packages/strategy-policy`** from Phase 10, not in `gto-core` (ADR-0023). `gto-core`
may hold the pure `GTO` and `SAFE_GTO` primitives — they need no player data — but the
cross-domain composition and `ADAPTIVE` sit in the layer above, which is the only package
allowed to depend on both `gto-core` and `player-core`.

Three modes. Default `SAFE_GTO`.

- **GTO** — the stored baseline, unmodified. Always available and always separately
  visible in the other modes.
- **SAFE_GTO** — a policy layer on top of GTO. It is **not** GTO and must never be
  labelled as equilibrium.
  - When action EV data exists: find the best EV, take a configurable small EV
    tolerance, and among actions inside that tolerance prefer the lower-risk option.
    Risk proxies: smaller fraction of effective stack committed, smaller bet sizing,
    check/call over a large bet when EV is effectively tied.
  - When EV data does **not** exist: show the true GTO frequencies and fabricate
    nothing. Any conservative preference shown must be explicitly marked heuristic.
  - `SAFE_GTO` is not "fold more".
- **ADAPTIVE** — interface and scaffolding only during MVP. No fake exploit logic.
  Player statistics must never mutate baseline solution data.

Phase 9's binding design constraints — stack profiles, sizing formulas, match-result typing,
unreached-strategy typing, quality metrics, the adapter seam and baseline identity — are in
`docs/GTO_DESIGN_NOTES.md`.
