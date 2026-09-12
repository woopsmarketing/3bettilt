# State

Single source of truth for where the project is. The orchestrator updates this after
every phase; phase agents report, they do not edit it.

**Last updated:** 2026-09-03, after the **Hands-on Table UX V2** milestone (WP-1..WP-11 of
`prompt`) on top of the WP-K follow-up. WP-K, Strategy C2 (WP-J), C0+C1, A+B and Phases 1-7
stay accepted.

## Completed

- **Phase 0 — Repository bootstrap.**
  - pnpm workspace: `apps/web`, six `packages/*`, `solver-lab`.
  - TypeScript 5.9.3 strict (+ `noUncheckedIndexedAccess`), shared `tsconfig.base.json`
    with `@gto-self/*` path aliases.
  - Vitest 4 single-root config with one project per package plus a happy-dom `web`
    project. ESLint 10 flat config including the layering restrictions. Prettier.
  - Next.js 16 + React 19 + Tailwind 4 app shell, Playwright config and a smoke spec.
  - `@gto-self/shared` implemented and tested: `MilliBB` fixed-point money with
    explicit rounding, `Card` primitives, branded ids with injectable `IdFactory`,
    `Result`.
  - Docs: `CLAUDE.md`, `ARCHITECTURE.md`, `DECISIONS.md` (ADR-0001..0010), `ROADMAP.md`,
    `UX.md`, `GTO_BASELINE.md`, this file.

- **Open-source integration spike** — `docs/OPEN_SOURCE_EVALUATION.md`.
  Five projects cloned and evaluated at source level against 17 criteria, then put
  through an independent adversarial fact-check pass (licences read from the actual
  LICENSE file in each clone, never from a badge or from recollection).
  - Verdicts: `poker-engine-ts` REFERENCE, `rs-poker` REFERENCE, `poker_solver`
    REFERENCE, `open_spiel` ADOPT-candidate (`solver-lab` only), `pokerkit` REFERENCE
    (partial evaluation).
  - Orchestrator decisions recorded as **ADR-0011..0017**: continue our own
    `poker-core`; differential-oracle outputs are never committed as fixtures; open_spiel
    accepted as the gated Phase 13 validation tool; Phase 13 delivers a validated method
    and a cost curve, not a baseline; licence-hygiene posture with a named AGPL blocklist
    and a standing `pnpm lint:licences` check; seven Phase 9 schema inputs adopted; a
    rake-rounding normalisation policy for `pokerkit` comparisons.

- **Phase 1 — Poker core domain.** `packages/poker-core`, 21 modules, **420 tests
  passing workspace-wide** (386 in poker-core). Spec: `docs/POKER_CORE_API.md`,
  written by a judge agent that synthesized three independent design proposals.
  - Implemented: fixed-point money wiring, seats (ACTIVE/SITTING_OUT/EMPTY), button/SB/BB,
    positions for 2-6 dealt in, ante and blind posting, pot (side-pot-ready layered
    model), call amount, min legal raise under raise-TO semantics, all-in, effective stack,
    SPR, legal actor ordering, fold/check/call/bet/raise/all-in, uncalled-bet return,
    automatic street transitions, rake, single-pot settlement, and an immutable
    reducer with replay and undo.
  - Two replay modes: `replayHand` (strict, re-validates every action — the Phase 11
    round-trip guarantee) and `loadHand` (structural, asserts arithmetic and conservation
    — the DB path). `POT_AWARDED` stores the rake _actually applied_ (ADR-0009), so a
    corrected rake rule can never make stored hands unloadable.
  - Review found 8 actionable defects across 3 lenses; an independent test author added
    110 spec-derived tests and surfaced 1 crash the implementer's own 250 tests missed.
    All fixed or explicitly rejected with reasons. New ADRs: 0024, 0025, 0026.

- **Phase 2 — Poker core edge cases.** `packages/poker-core` + `packages/shared`,
  **47 test files / 546 tests passing workspace-wide** (up from 41 / 420). Four work packages:
  - **Settlement policy surface (ADR-0027/0033).** `Money.quantize` and
    `Money.mulRatioQuantized` — the latter applies the rate and quantizes in ONE rounding
    step, because rounding to milliBB and quantizing afterwards rounds twice and can land a
    whole quantum from the exact value. `RakeConfig.noFlopNoDrop` became a named
    `triggerPolicy` union; `RakeConfig` gained an explicit settlement `quantum` (NL50: 20
    milliBB = one cent) that is **never** derived from `DisplayConfig`. `validateTableConfig`
    rejects a `cap` that is not an exact multiple of the `quantum`. Both real observed
    CoinPoker data points are pinned as regression tests in two packages: a 10 740 milliBB
    pot rakes to 540 (record: 0.27) and a 13 740 pot to 680 (record: 0.34).
  - **Fee accounting (ADR-0018/0032).** New `FeeConfig` and `fee.ts`, separate from rake all
    the way down. `FeeTriggerPolicy` is `'NEVER' | 'MANUAL'` — there is deliberately no
    automatic trigger, and a manually supplied amount is range-checked and then stored exactly
    as entered. `POT_AWARDED.fee`, `HAND_FINISHED.totalFees`, `SeatHandState.feePaid`,
    `HandState.totalFees`. All three money identities now include fees.
  - **Neutral blind primitives (ADR-0031).** `POST_DEAD_BLIND` (accounting identical to an
    ante) and a `BlindSeatOverride` persisted on `HAND_STARTED` so a hand can never replay to
    different blinds. When an override yields a lineup the six-member `Position` union cannot
    label, `assignPositions` returns `POSITION_LINEUP_UNSUPPORTED` and the hand refuses to
    start — no label is ever invented. Automatic missed-blind and dead-button rules remain
    unimplemented on purpose.
  - **Independent review.** A fresh-context adversarial review of the blind primitives found
    no blockers and two should-fix items, both now closed: posts (`POST_ANTE` and
    `POST_DEAD_BLIND` alike) were accepted by `loadHand` outside command group 0, where
    re-seeding the preflop round would silently reset the street and reopen action while
    leaving every money identity satisfied — now guarded and pinned by tests that fail
    without the guard; and the "a hand can never replay to different blinds" property was
    held by reasoning alone and is now pinned by a tamper test.
  - **Auto top-up + settlement breadth.** `AutoTopUpPolicy` / `topUpPlan` / `applyAutoTopUp`
    in `table.ts`, with all twelve boundaries tested. New multiway-award, rake-allocation-branch
    and simultaneous-odd-chip suites, including ADR-0025's documented `MAIN_POT_FIRST`
    zero-payout consequence asserted as intended behaviour.

- **Phase 3 — Database and player domain.** `packages/player-core` + `packages/db`,
  **59 test files / 725 tests passing workspace-wide** (up from 47 / 546). Two work packages
  and an independent review:
  - **`player-core` (3a).** Player identity by manually entered nickname with a separately
    stored normalized form (ADR-0034); manual HUD snapshots as integer `CentiPercent` plus the
    verbatim entered text; our own observations as counts with rates derived, never stored
    (ADR-0035); append-only notes; context-scoped confidence with an explicit `INSUFFICIENT`
    member (ADR-0036). No `zod` — validation follows `poker-core`'s hand-written `Result`
    idiom. Imports `@gto-self/shared` and nothing else.
  - **`db` (3b).** Drizzle + SQLite. Eleven tables, real foreign keys with
    `PRAGMA foreign_keys = ON` set per connection, `CHECK` constraints, partial unique
    indexes. `TableConfig` persists as one validated JSON document and a session keeps its own
    copy (ADR-0038); the event log is authoritative and `hands.hand_number` is a re-derived
    projection (ADR-0039); the load path is `loadHand`, never `replayHand`. Integration tests
    run against a real in-memory SQLite, not mocks.
  - **Independent review.** No blockers. Two MAJOR findings, both fixed: the "insert-only"
    guarantee for manually entered records was a repository _convention_ that the exported
    Drizzle tables let any caller bypass — now enforced by database triggers (ADR-0037); and
    the ESLint layering rules matched only bare specifiers, so every subpath import bypassed
    them, with four boundaries unguarded entirely (ADR-0042). Five MINOR findings also fixed:
    integrality `CHECK`s (ADR-0041), a silently trimmed nickname on read, a `hand_number`
    projection the comment claimed was checked and was not, a `closeSession` that could move
    `updated_at` backwards, and a `formatPercent` that truncated instead of rounding.

## Current

- **Strategy A+B milestone (REFERENCE engine) in flight, started 2026-09-01.** Goal: a
  deterministic local reference-strategy engine (user-facing 기본전략 · REFERENCE — never
  labelled GTO) recommending actions/frequencies/sizings preflop through river, plus the
  between-hands sit-out transition. Orchestrated as work packages; decisions so far:
  **ADR-0055** (`packages/strategy-core`, separate from `gto-core`, single adapter seam;
  the rule registries in `src/{preflop,postflop}/rules.ts` are the authoritative rule
  counts — earlier per-WP counts in this file went stale as fix rounds added rules),
  **ADR-0056** (SOURCE/DERIVED/HEURISTIC provenance, integer BPS, 5% quantization),
  **ADR-0057** (between-hands direct `TableState` write).
  - **A1 done** — ACTIVE↔SITTING_OUT toggle from the running table (SeatOccupancyToggle +
    `S` hotkey via the existing listener), occupancy-only persistence
    (`updateSessionSeatOccupancy`, no migration needed), 6→5→4→5 transitions tested, 2 new
    E2E specs. 867/867 unit, 17/17 E2E at its gate. Report: `docs/reports/STRATEGY_WP_A1.md`.
  - **A2 done** — `packages/strategy-core` foundation: neutral `StrategyQuery`, adapter
    seam (`buildStrategyQuery`, 10 typed refusal codes), preflop spot canonicalization
    (10 families + typed UNSUPPORTED), stack buckets, 1326-combo range model with
    integer-exact normalization/propagation, 169-class aggregation. 138 tests.
    Report: `docs/reports/STRATEGY_WP_A2.md`.
  - **Public anchors verified** against free education pages with citations:
    `docs/reports/STRATEGY_ANCHORS.md` (RFI bands/sizings SOURCE-grade; IP-3bet and
    squeeze sizing DERIVED — sources disagree, choice documented; BB defense charts and
    short-handed ladder HEURISTIC/DERIVED).
  - **A3 done** — preflop REFERENCE policy: provenance-tagged rules with anchor
    citations, 13x13 notation parser, clamp-and-degrade sizing legality, per-seat
    end-of-preflop range propagation with an `offPolicy` flag, no `EXACT` environment
    claim representable. Report: `docs/reports/STRATEGY_WP_A3.md`.
  - **B1 done** — hand evaluator (bitmask, ~12M 7-card evals/sec, validated by the exact
    C(52,5)=2,598,960 frequency-table sweep) + board analyzer (STATIC/DYNAMIC carried as
    `Provenanced` HEURISTIC with exported criteria) + hero-hand analyzer (draws, nut
    status, blockers). Report: `docs/reports/STRATEGY_WP_B1.md`.
  - **B2 done** — deterministic equity engine: HU postflop EXACT on every street (flop
    84.7ms full range), golden-ratio Weyl deterministic subsampling for
    multiway/preflop/range-vs-range with measured error bounds, no RNG anywhere.
    Report: `docs/reports/STRATEGY_WP_B2.md`.
  - **B3 done** — postflop REFERENCE policy: whole scoring model exported as documented
    data in `scoreModel.ts` (zero constants in logic code), score→5%-frequency and
    feature→sizing-bucket tables, multiway scale-down, villain ranges deliberately NOT
    narrowed postflop (`villainRangeNarrowingApplied: false`, honesty flag), SPR-gated
    ALL_IN substitution, BTN-vs-BB worked-example fixture. (Its "worst case ~87ms HU flop"
    claim was later falsified — the true worst shape is a 6-way limped flop, ~106ms here;
    see the R1B fix round and the report's correction appendix.)
    Report: `docs/reports/STRATEGY_WP_B3.md`. Package total: 28 files / 690 tests.
  - **B4 done** — Strategy Panel live in the right aside (기본전략 · REFERENCE): frequencies,
    추천 primary, sizing, equity, pot odds, SPR, 품질/confidence, ACTUAL-vs-MODEL, honest
    refusal states, 12 exhaustive Korean copy maps; compute scheduled off the action hot
    path with measured evidence. Report: `docs/reports/STRATEGY_WP_B4.md` (+ §5.4
    correction).
  - **TWO independent adversarial reviews ran** (a fork of this session produced a second
    reviewer — coordination recorded in the reports): `STRATEGY_REVIEW_R1.md`
    (2 BLOCKER / 8 MAJOR / 13 MINOR) and `STRATEGY_REVIEW_R1B.md` (0/5/11, two unique
    MAJORs). All 2 BLOCKERs and all 13 distinct MAJORs across both reviews are FIXED, each
    with a test proven to fail on revert, across four fix packages:
    `STRATEGY_FIX_{BUTTON,PREFLOP,POSTFLOP,R1B}.md`. Highlights: VS_ALLIN/FACING_ALL_IN
    reserved for genuinely collapsed trees (AA no longer flats a short shove; quads can
    isolate); button survives sit-out (ADR-0058); SB trim is per-class (QJo in, K4o out —
    SB open now 46.91%); multiway equity normalized to fair share; price-implied floor
    stops the multiway penalty from folding 100%-equity hands; faced-bet fraction measured
    from the aggressor's own wager; all-in rendered as ALL IN; benchmark covers 4/5/6-way
    (true worst shape: 6-way limped flop ~106ms) and stale latency claims corrected.
  - **Integration gate green after fixes**: workspace vitest 105 files / 1811 tests,
    strategy-core 766, typecheck/lint/build clean, strategy-panel + seat-occupancy E2E 8/8.
  - **Independent re-verification (peer session, read-only) came back CLEAN ON BEHAVIOR**:
    every BLOCKER and 12/13 distinct MAJORs verified genuinely fixed with pins held; R1's
    M6 (heads-up button) correctly remains partial (documented FLOOR heuristic — see Known
    issues). Its five doc-hygiene items were all fixed, plus the last live MINOR
    (`rangeRank` basis inconsistency — now pairwise-consistent with an exact probe on the
    off-policy path, `docs/reports/STRATEGY_FIX_RANGERANK.md`) and the asymmetric pending
    label.
  - **`docs/STRATEGY_MVP_REPORT.md` written** (2,166 lines): all 18 required sections, two
    full worked examples with real-engine numbers, 39-item weak-areas list, and a 13-item
    report-vs-code discrepancy audit (all dispositioned).
  - **MILESTONE ACCEPTED — final frozen-source gate green, 2026-09-01** (table below).
- **Strategy C0+C1 milestone (history capture + post-session player learning) COMPLETE,
  2026-09-01.** Decisions: **ADR-0059** (reuse the Phase-3 hand tables; persist once at
  `phase === 'COMPLETE'`, off the action path, exactly-once via the `hands.id` PK with a
  typed `ALREADY_PERSISTED` outcome), **ADR-0060** (completed raw hands immutable at DB
  level — migration `0004` triggers: `hand_events`/`hand_players` insert-only, `hands`
  no-delete and no-update-once-finished), **ADR-0061** (new `packages/analysis-core`, the
  only package allowed to import both `poker-core` and `player-core`; nothing but
  `apps/web` may import it; deterministic — no clock/RNG/ids), **ADR-0062** (snapshots are
  versioned all-history recomputations gated by `(algorithmVersion, inputHash)` →
  `NO_CHANGES`; snapshot confidence `n/(n+K)`, K=30 PRODUCT HEURISTIC, display states
  UNKNOWN/LEARNING/KNOWN — separate from ADR-0036's levels; `player_observations` is
  never written by analysis).
  - **C0**: `insertCompletedHand` + client hook `useCompletedHandSaves` fire an unawaited
    persist when a hand completes; failure shows a non-reverting 재시도 banner; header
    shows `저장된 핸드 N`. `hands` gained `source`/`schema_version` (migration `0004`).
  - **C1**: migration `0005` added 7 insert-only tables (`analysis_runs`,
    `analysis_run_players`, `player_model_snapshots`, `player_model_stats`,
    `player_spot_stats`, `player_model_bet_sizes`, `player_model_show_evidence`; 26
    triggers total pinned by the tripwire test). `analysis-core` extracts
    opportunity-based observations from the real action flow (an opportunity exists iff
    the engine put that seat on the clock); `runSessionAnalysis` recomputes each affected
    player from their FULL cross-session history in one all-or-nothing transaction;
    "세션 분석 및 반영" button (safe-boundary gated) + result summary + Player Model panel
    (counts always shown beside rates; position-null and positional rows never merged).
    Perf measured: ~88ms/100 hands, ~608ms/1000, NO_CHANGES re-run ~2-4ms.
  - **Strategy A+B is bit-identical by pin and by tripwire**: the §39 behavioral
    regression test plus `strategy-core/tests/layering.test.ts` (static import scan of
    strategy-core/gto-core for `player-core`/`analysis-core`/`@gto-self/db`, proven to
    fail on a planted import).
  - **Independent adversarial review (R1)**: 1 BLOCKER / 2 MAJOR / 8 MINOR. Fixed: the
    BLOCKER (session `hand_number` high-water mark never advanced — a reloaded session
    restarted numbering and every later hand hit `UNIQUE(session_id, hand_number)`,
    permanently unstorable; now advanced in the hand's own transaction, seeded on load,
    with an honest CONFLICT banner and a reload-then-play E2E proven to fail pre-fix),
    the vacuous-§39-test MAJOR, and MINORs 4/5/6 (fixture location, `inArray` chunking,
    `localeCompare` tiebreak). Reports: `docs/reports/C0C1_*.md`; user-facing report:
    `docs/PLAYER_HISTORY_LEARNING_MVP_REPORT.md`.
  - **Strategy C2 (adaptive recommendations) deliberately NOT started.**
- Phases 1, 2, 3, 4, 5, 6 and 7 are **accepted** — none is reopened.
- **Poker Table Alpha reached, 2026-08-29.** A person can open the app in a browser, configure
  a session, and manually enter a complete practice hand: hole cards, F/C/R/A/Z from the
  keyboard or mouse, flop/turn/river through the card palette, settlement, and next hand.
  Phase 8 is deliberately NOT started; this is a hands-on testing checkpoint.
- **MVP priority update (ADR-0033), 2026-08-29.** The real CoinPoker hand-history export will
  not be provided, and this is **not** a blocker. Phase 11 (parser) is deferred past the first
  usable MVP; delivery order is **2 -> 10, then 12**.
- An independent adversarial review of Phases 4-7 found **2 BLOCKERs, 1 MAJOR and 3 MINORs**;
  all six are resolved. The blockers were an award-panel selection that leaked across hands and
  paid the wrong player, and a keyboard-ownership state in which neither the action dock nor the
  card palette owned the keyboard. Both were reproduced in a real browser before and after the
  fix. Decisions recorded as **ADR-0043..0048**.

- **First Alpha feedback round, 2026-08-31.** The user ran the Alpha by hand and reported six
  things. All six are done, and none of them was found by the existing suite:
  - **Hotkeys did not work.** Not a logic bug: a Korean input method rewrites `event.key`, so
    every key was dead for the primary user and alive for every test, which drives a US
    keyboard. Keys now resolve from the physical key (ADR-0049), proved in a real browser with
    raw Hangul key events, not only in unit tests.
  - **Accidental split winner.** The engine's split arithmetic was reviewed and is correct; the
    award panel toggled, so correcting a misclick ticked two winners and really did split the
    pot. Selection now replaces, and a split must be armed (ADR-0051).
  - **No opponent SHOW / MUCK.** SHOW records `SET_HOLE_CARDS { revealed: true }`; MUCK is
    unknown information and gets no engine event (ADR-0052).
  - **Bottom-of-screen layout.** The dock is pinned in every phase and the award panel's submit
    button can no longer land under it (ADR-0054), with both halves pinned by E2E assertions
    that were confirmed to fail against the old layout.
  - **Per-seat auto top-up** replaces the one session-wide switch (ADR-0050), stored on
    `session_seats` by additive migration `0003`.
  - **Korean-first UI** (ADR-0053).
- **Verified against a copy of the user's REAL database**, not a fixture: it sat at migration
  0002 with 2 sessions, 12 seat rows and 9 players. After `0003` every seat row survived with
  exact stacks, the session-level columns were untouched, and both existing sessions still
  render. In the browser a seat at 85.68 BB with the switch on returned to 100 BB, a winner
  holding 119.08 BB with the switch off was not trimmed, and only the toggled seat's row was
  written.
- **A second independent adversarial review** (fresh context, read-only, no desired conclusion)
  found **1 MAJOR and 4 MINORs**; all five are fixed, each with a test that was confirmed to
  fail without its fix. The MAJOR: a per-seat top-up target of `0` or a negative number was
  refused by the server but accepted by the client, and the store took it — so the engine
  correctly refused `STACK_NOT_POSITIVE` at the next deal and **no hand could be started at
  all** until the user found the poisoned seat. The client now refuses it exactly as the
  server does. The others: a tautological layout assertion that re-read its own source
  string, a server action that would write a policy onto an EMPTY seat or a closed session,
  unsequenced per-seat saves that could raise a false "not saved" banner, and a cross-hand
  guard that was live but untested.

- **Strategy C2 milestone (WP-J — player-specific ADAPTIVE strategy) DONE, 2026-09-02.**
  A second, clearly separated recommendation built from REFERENCE plus what is known about the
  opponents, which never alters REFERENCE. Decisions: **ADR-0063** (`packages/adaptive-core` as
  a composition layer above `strategy-core` and `player-core`; `strategy-core` still must not
  import `player-core`), **ADR-0064** (the prior is a ZERO-ADJUSTMENT ANCHOR, not a claimed
  population value, so zero confidence gives zero adjustment by construction and no number is
  ever a GTO claim), **ADR-0065** (bounded adaptation on REFERENCE's own quantizer — caps of
  2000 bps heads-up / 1000 multiway, clause (e) is the §9 guard rail), **ADR-0066** (ADAPTIVE
  traces are a SEPARATE derived table; a live HUD edit recomputes ADAPTIVE only and never
  rewrites hand events or a stored trace).
  - 17 neutral stats with per-stat `K`, shrinkage `estimate = prior + (observed - prior) * c`,
    12 frequency rules and 4 sizing rules, all `HEURISTIC` with mandatory authored notes.
    Manual HUD and learned model stay SEPARATE in the database and are pooled only in a
    provenance-carrying view at composition time.
  - The two sources' evidence, the deviation, the confidence, the contributing rules and the
    ceiling that clipped each one are persisted per decision point in the insert-only
    `adaptive_strategy_traces` (migration `0007`), so a hand can be re-argued months later
    from the evidence that was actually available at the time.
  - **Independent review** (fresh context, no desired conclusion): no BLOCKER, 4 MAJOR /
    6 MINOR / 5 NIT. All four MAJORs fixed, each proven by a test confirmed to fail against
    the reintroduced defect. The §9 guard rail never fired heads-up — the single most common
    spot at this table; `trimToCap`, the only thing holding the shift cap after quantization,
    could be replaced by `return false` with the whole suite green; a HUD *hand* count was
    used as an *opportunity* count, turning "500 hands" into 92.6% confidence; and editing one
    HUD field silently dropped the other seven from the effective profile.
  - Two further defects were found while fixing those and are also fixed: the "no adjustment"
    line explained a held MIX with a remark about SIZING, and the panel showed the capped
    sample without the entered one (a `CLAUDE.md` rule 3 violation).
  - Reports: `docs/reports/HARDENING_WP_J_ADAPTIVE_PLAYER_STRATEGY.md` (consolidated),
    `HARDENING_WP_J_DESIGN.md` (the design contract), `HARDENING_WP_J_REVIEW_R1.md` (review),
    `HARDENING_WP_J_REVIEW_R1_RESOLUTION.md` (dispositions), and the per-WP A/B/C/D1/D2/E1/E2/F
    reports.

- **WP-K — external HUD player profiles + 1% ADAPTIVE calibration, DONE, 2026-09-03.**
  Bulk-imports 13 real players' lifetime stats from an external HUD (screenshots) and has
  ADAPTIVE use them with real, fixed confidence; sharpens ADAPTIVE's display grid from
  REFERENCE's 5% to 1%; adds a fifth sizing rule reading `WSD`; adds a visible Korean
  narrative reason line and a glossary. **ADR-0067** (new `EXTERNAL_HUD` source, fixed
  9000-bps confidence, per-stat precedence over `MANUAL_HUD`/`LEARNED_MODEL`, and the
  generic street-blind `CBET`/`FOLD_TO_CBET`/`CHECK_RAISE` readings additionally feeding
  the per-street policy keys so they actually reach a rule), **ADR-0068** (1% grid via a
  parameterized `quantizeFrequenciesToGrid`, REFERENCE's own 500-bps call sites byte-
  identical; log-odds/softmax explicitly considered and NOT adopted), **ADR-0069**
  (external profile stays a separate DB table and UI section from the manual HUD, never
  merged).
  - New tables `player_external_hud_snapshots` / `_stats` (migration `0008`, insert-only,
    4 more triggers), `sampleN` always `null` (never invented — the source reports a
    lifetime total, not a hand count), an absent stat is an ABSENT ROW, never a stored
    zero. Bulk import: `pnpm players:import-external <path-to-json>`
    (`apps/web/scripts/import-external-hud.ts` +
    `apps/web/src/server/external-hud-import-service.ts`), exact-nickname reuse, never a
    duplicate player, insert-only with `ALREADY_PERSISTED`/`NEW_SNAPSHOT` reporting.
  - 3 new `AdaptiveStatKey`s (`CBET_ANY_STREET`, `FOLD_TO_CBET_ANY_STREET`,
    `CHECK_RAISE_ANY_STREET`), 1 new sizing rule (`SIZE_WINNER_VALUE_UP`, stat `WSD`), 1
    new reason key (`OPPONENT_WINS_SHOWDOWNS`) — 17 stats -> 20, 3 sources, 12 frequency /
    5 sizing rules. (`SIZE_WINNER_VALUE_UP` was subsequently REMOVED by the WP-K follow-up
    below — ADR-0071. The rule counts below that entry are the current ones.)
  - Golden regression fixtures for two real, extreme-vs-typical players (Shadow7,
    acn1977) across the 8 named spot families, plus a permanent test that the two profiles
    actually produce different ADAPTIVE output — the audit `prompt` itself asked for.
    Finding: `STEAL` (this player's own steal-open rate) never drives a rule, because the
    rule that reads blind defense wants `FOLD_BB_TO_STEAL` (a different seat's stat) which
    this source does not report — recorded, not silently patched over.
  - Reports: `docs/reports/EXTERNAL_ADAPTIVE_00_AUDIT.md` (written first),
    `EXTERNAL_ADAPTIVE_PROFILE_IMPORT.md` (K1), `EXTERNAL_ADAPTIVE_MATH_CALIBRATION.md`
    (K3), `EXTERNAL_ADAPTIVE_KOREAN_REASON_UI.md` (K5), `EXTERNAL_ADAPTIVE_FINAL.md`
    (consolidated).

- **WP-K follow-up — ADAPTIVE sanity calibration, DONE, 2026-09-03.** A three-item audit of
  WP-K with minimal corrections; no structural change, REFERENCE untouched, the 1% grid and
  every existing safety cap kept.
  - **§1 — an aggression-DOWN rule must not read a VALUE hand (ADR-0070).** WP-K's golden
    fixtures bet a STRONG hand LESS often than REFERENCE (Shadow7 `BET 54`, acn1977
    `BET 49`, against `BET 60`) at opponents who fold to a c-bet only 26% / 24% of the time.
    Two causes: `FOLD_TO_CBET_LOW` was `bands: null` and `CHECK_RAISE_HIGH` read all three
    bands, so both DECREASING rules hit VALUE; and the §9 guard rail zeroed the one
    INCREASING rule in the same spots, making the table a one-way ratchet. Fix: both
    de-escalating rules scoped to `['MARGINAL','WEAK']`, and a new
    `FOLD_TO_CBET_LOW_VALUE_UP` (`['VALUE']`, gain 3000, cap 800) carrying the value half of
    the read. The check-raise half removed an outright contradiction with the sizing pass,
    whose `SIZE_CHECK_RAISE_DOWN` note has said since WP-J that a VALUE hand wants the
    opposite treatment. The guard rail itself was NOT touched.
  - **§2 — `WSD` demoted from a primary sizing signal to a secondary one (ADR-0071).**
    `SIZE_WINNER_VALUE_UP` REMOVED: a high `WSD` says an opponent wins the showdowns they
    reach, not that they call more, and the rule contradicted `WSD`'s own anchor note
    ("no directional opinion at all about this one"). Replaced by an optional
    `suppressedWhen` on `AdaptiveSizingRule`, used once — `SIZE_STATION_VALUE_UP` withholds
    its rung when `WSD` is above the anchor, because a high `WTSD` describes both the
    station and the strong player and `WSD` is the stat that separates them. A suppressor
    can only ever remove a rung, is held to the same confidence gate as the primary signal,
    and an absent secondary reading suppresses nothing.
  - **§3 — a street-blind reading yields to real per-street evidence (ADR-0072).**
    ADR-0067(c)'s per-stat `EXTERNAL_HUD` precedence plus ADR-0067(e)'s fan-out let one
    lifetime `Check/Raise 17%` override a `CHECK_RAISE_RIVER` measured over real river
    opportunities. The fan-out now skips per-street keys already covered by a
    `MANUAL_HUD`/`LEARNED_MODEL` reading with `sampleN > 0`, and the losing reading is never
    written rather than written and outranked. The provenance note was reworded to
    `prompt`'s own phrasing, "외부 HUD 전체 통계 · 스트리트 구분 없음 (모든 스트리트에 동일
    적용)", which the reason row already renders verbatim.
  - Current counts: 20 stats, 3 sources, **13 frequency rules / 4 sizing rules**, 12 reason
    keys, 11 note codes. New golden spot 9 (STRONG hand, villain already acted) is where the
    corrected value direction is visible: Shadow7 `RAISE 50% -> 52%`.
  - Report: `docs/reports/EXTERNAL_ADAPTIVE_SANITY_FOLLOWUP.md`.

- **Hands-on Table UX V2 (WP-1..WP-11) DONE, 2026-09-03.** The manual table became usable at
  speed: immediate seat leave, in-place player replacement, quick HUD entry, quick next hand,
  inline stack resync, button resync, both strategy readings side by side, and a card picker
  sized for real use. Decisions: **ADR-0073** (a lineup correction rebases the current hand at
  the same hand number — it is not a skip; supersedes ADR-0057 for occupancy/player/button),
  **ADR-0074** (a folded seat's stack is exactly `startingStack − totalContribution`, every
  other dealt-in seat is dirty; `skipped_hands.reason`), **ADR-0075** (seat state is persisted
  at every between-hands boundary), **ADR-0076** (typed HUD numbers use `EXTERNAL_HUD`
  semantics; one player holds at most one seat per session), **ADR-0077** (hero's decision
  leads the right column; a seat selection opens a drawer and never replaces the strategy),
  **ADR-0078** (a stack correction is a lineup correction, so mid-hand it rebases; an
  unverified stack stays unverified across a reload; a deal-time button advance is announced),
  **ADR-0079** ("new player" means new — an existing nickname is refused, not silently reused
  with a partial profile).
  - **The whole milestone turns on one distinction**: CORRECTION (rebase — same hand number, no
    rotation, no audit row) versus QUICK NEXT HAND (exactly one rotation, +1, an audit row with
    a derived reason). Every row of that table is pinned by unit tests and by E2E.
  - Migrations `0009` (`skipped_hands.reason`, additive) and `0010`
    (`session_seats.stack_unverified`, additive). Both hand-written: drizzle-kit generated a
    12-step table recreate that would have **dropped the insert-only triggers**. Both upgrade
    tests freeze the pre-migration state for real and prove the column is absent first, so
    neither is vacuous.
  - **`updateSessionTable`'s seam is finally wired** (through narrow `updateSessionSeats` /
    `updateSessionButtonSeat`), closing the long-standing "stacks are not persisted across
    hands" gap as a side effect of WP-5.
  - `poker-core` gained exactly one primitive: `replaceSeatPlayer` (swaps the seat's player,
    never touching occupancy, stack, button or hero).
  - **Two independent fresh-context reviews** (data integrity/money/DB paths; requirements and
    honesty), neither told the desired conclusion: **0 BLOCKER**, 4 MAJOR, and a set of MINORs.
    All four MAJORs were reproduced against a real database and are fixed, each pinned by a test
    confirmed to fail against the reintroduced defect:
    a mid-hand stack correction was **destroyed by the derived settlement value** (rule 3);
    a mid-hand rebase advanced the button permanently with nothing on screen saying so;
    `새 플레이어 추가` with an existing nickname **collapsed a ten-stat opponent profile** to the
    two or three stats just typed; and an unverified stack was persisted while its 확인 필요
    mark was memory-only, so a reload presented unconfirmed money as confirmed.
    Both reviews independently confirmed **no assertion was deleted or weakened** (559 added /
    41 removed, all removals being contracts ADR-0073/0077 retired).
  - Follow-up work found and closed two settlement dead-ends the reviews had not named: a stack
    correction and a player replacement while a COMPLETE hand awaited settlement, the latter of
    which produced a hand that could never settle and had no exit.
  - E2E grew to 32 specs including the full 17-step WP-10 scenario and a reload-persistence spec.
    E2E caught the one product regression the unit suite could not: the enlarged palette
    overflowed the entry tray and **clipped the last suit row off-screen**.
  - **An independent RE-VERIFICATION then re-ran every original repro** rather than trusting the
    fix reports: 11 CLOSED, 3 PARTIAL (all three intentional, e.g. the button round trip), and
    **3 new defects, two of them regressions this milestone introduced** — the enlarged tray
    floor occluded the bottom seat row below ~637px of viewport height, and the enlarged card
    grid put the four deuces past the right edge with no scrollbar below ~1110px of width.
    **E2E could not have caught the second**: Playwright's `.click()` calls
    `scrollIntoViewIfNeeded`, which a real pointer has no equivalent of, so layout is now judged
    by `document.elementFromPoint` measurement instead. All three are fixed and measured across
    seven viewports in both palette states: zero occluded seats, zero unreachable cards, zero
    document scroll, dock always inside the viewport.
  - Final frozen-source gate: `pnpm verify` green (145 files / 2598 tests), `pnpm e2e` 32/32.
  - Reports: `docs/reports/HANDS_ON_TABLE_UX_V2.md` (consolidated),
    `HANDS_ON_TABLE_UX_V2_DESIGN.md` (the design contract, written first),
    `HANDSON_V2_WP_E_STRATEGY_PANEL.md`, `WP10_E2E_REPORT.md`, `HANDSON_V2_R1_FIX_UI.md`,
    `R2_LAYOUT_AND_DEADEND_FIXES.md`.

## Next

- **Hands-on testing by the user.** Launch with `pnpm dev` and open
  `http://localhost:3210`. This is the point of the Alpha: find what is wrong by using it.
- **Phase 8 is now substantially delivered** by Hands-on Table UX V2: hero fold -> quick next
  hand, dirty marking, inline resync with next-dirty focus, next-hand rotation and the manual
  button override all exist. What Phase 8 still owns and V2 did NOT do: the manual **blind**
  override surface (ADR-0031's primitives exist in `poker-core` with no UI), the editable auto
  top-up threshold whose column ADR-0045 deferred, and **live-hand recovery** — an in-progress
  hand is still memory-only (ADR-0059) and persisted undo stays deferred with it.
- **Then Phases 9 -> 10, then 12.** Phase 11 is deferred past the MVP (ADR-0033).

## Known issues / explicit TODOs

- **Hands-on Table UX V2 — deliberate limitations, none silent** (full list in
  `docs/reports/HANDS_ON_TABLE_UX_V2.md` §11):
  - **A rebase loses the in-progress hand.** Correcting a seat after entering several actions
    means re-entering them. The alternative — splicing a seat out of an event log that already
    happened — produces a hand whose arithmetic balances and whose history is fiction
    (ADR-0073's explicit trade-off).
  - **A button round trip does not restore the button.** Sitting the button seat out mid-hand
    advances the button by ADR-0058(c)'s deal-time rule and sitting them back in does not move
    it back. The deal rule was NOT forked; instead the rebase notice now names the seat the
    button moved to, and `[버튼으로 지정]` is the way back (ADR-0078(c)).
  - **A quick skip reduces the table's total chips.** Folded seats' contributions are removed
    while the pot they went into is discarded. That is the honest reading of "the rest was not
    observed"; it lives only in the in-memory table and resolves when the dirty seats are
    resynced. No `hands` row, player observation or trace is ever produced by one.
  - **`0009` and `0010` cannot be reversed by `DROP COLUMN`** — SQLite refuses to drop a column
    a CHECK references. There are no down-migrations in this repo, so this is informational;
    both migration headers say so.
  - **`SeatCard`'s root is `<div role="button">`**, because a `<button>` may not contain the
    inline stack input. Click and Enter/Space selection are pinned by regression tests, but a
    `role="button"` element holding a real `<button>` child has presentational-children
    semantics, so assistive technology may not expose the inner control. Recorded in the file
    header.
  - **Viewports under ~620px tall leave a very thin felt.** Unchanged by this milestone and not
    made worse; the action dock is inside the viewport at every size measured
    (1440x800 / 1280x720 / 1024x640, all 52/52 cards visible with no clipping).
  - **`PLAYER_EXISTS` guidance pre-fills a search rather than reading a structured field.** The
    refusal names the match in its message; a `matchedPlayerId` on the result would let the UI
    jump straight to that player.
  - **E2E does not cover** the full seat-an-empty-seat flow or the seat-state save-failure
    banner; both are covered by unit/component tests. The exact-stack assertions
    (99.84 / 99.34 BB) are coupled to the ante policy and will break deliberately if it changes.
  - **Viewports 560-600px tall need a vertical scroll inside the palette.** Seats, header, dock
    and a full palette want 644px and the screen has less. The palette yields; the seat rows and
    the action dock never do. Lowering the felt's 304px requirement (the controls under each seat
    card) is the way out and was not attempted.
  - **`scrollbar-gutter: stable` was measured in Chromium only.** Firefox and Safari unmeasured.
  - **The dead-end guidance recognises its state by observation** — the engine's error code plus
    a COMPLETE hand awaiting settlement — rather than re-implementing engine logic in the UI. It
    can appear when `[핸드 시작]` would in fact succeed; the sentence is conditional, so it does
    not become false.
  - **The partial-profile collapse mechanism is still live at the service layer.** A
    `requireNew: false` replacement carrying a partial `externalHud` for the seat's current
    occupant, or a partial `saveExternalHudSnapshot`, still shrinks the latest profile. It is
    unreachable from the UI (the swap panel sends `externalHud` only in NEW mode; the profile
    panel pre-fills from the latest snapshot so a one-field correction cannot drop the other
    nine), but a server action is a public endpoint and this gate is UI-side only. Left as is for
    a local single-user app; a server-side guard would need its own decision.
- **`packages/strategy-core/src/postflop/benchmark.test.ts` is load-sensitive.** It passes 4/4 in
  isolation and was observed failing once in seven full-suite runs: it compares measured latencies,
  and parallel load skews the measurement. Predates this milestone.

- **Strategy C2 (WP-J) — deliberate limitations, none silent** (full list in
  `docs/reports/HARDENING_WP_J_ADAPTIVE_PLAYER_STRATEGY.md` §13):
  - **A manual HUD reading alone cannot move a preflop mix.** Capping the effective sample at
    `floor(K/2)` holds manual confidence at 3333 bps, and confidence is applied twice — once
    shrinking the estimate, once scaling the contribution — so the single applicable preflop
    rule tops out near 155 bps, under half a 500-bps grid step. The panel is honest about it
    (`ADAPTED`, `changed=false`, both the entered and the effective sample shown) rather than
    inventing a movement. **This is the calibration decision most worth revisiting if HUD
    entry feels inert in use**; changing it bumps `ADAPTIVE_POLICY_VERSION`.
  - **ADAPTIVE cannot exploit an action REFERENCE assigns no row** (ADR-0065); it re-weights
    the kinds REFERENCE emitted.
  - **The manual HUD reaches 8 of the (now 20) stats.** Widening `HudStatKey` needs a CHECK
    rebuild of an insert-only table, which ADR-0046 rules out without its own ADR.
  - **The 12 frequency and 5 sizing rules are authored, unbacktested heuristics**, tagged
    `HEURISTIC` with mandatory notes and never labelled GTO.
  - **`actsAfterHero` uses first-orbit action order**, so after a re-raise it under-reports
    who is still to act — the multiway guard fires LESS often than it should, which is wrong
    in the permissive direction and worth knowing.
  - **`trimToCap`'s no-progress branch is unreachable and untested, and says so in its own
    comment**; it needs about `cap / 250` action rows per side and a baseline has at most six.
  - **`reference_trace_id` can be `null` and both trace tables are insert-only**, so a missing
    link can never be repaired: run `pnpm strategy:backfill` before `pnpm adaptive:backfill`.
  - **A `BACKFILL` trace is composed against TODAY's evidence**, not the evidence that existed
    when the hand was played. `source`, `player_model_version` and the snapshot maps date it.
  - **The manual-HUD sample cap lives at the server mapping boundary**; any future builder of
    an `AdaptiveOpponentInput` must apply `manualHudSampleCap` too.
- **WP-K (external HUD + 1% calibration) — deliberate limitations, none silent** (full list
  in `docs/reports/EXTERNAL_ADAPTIVE_FINAL.md`):
  - **`STEAL` never drives a rule.** The external HUD reports how often THIS player opens
    from a steal position; the rule that reads blind defense (`FOLD_BB_TO_STEAL_HIGH`)
    needs how often the BIG BLIND folds to one — a different seat's stat this source does
    not measure. `VPIP`/`PFR` are imported, stored, and displayed but likewise drive no
    frequency or sizing rule today — a pre-existing WP-J property, not new to WP-K.
  - **`adaptive_strategy_traces` does not yet persist which `EXTERNAL_HUD` snapshot informed
    a decision** — only manual-HUD and learned-model snapshot ids are columns on that table.
    A deliberate scope decision to stay inside WP-K's approved plan, not an oversight.
  - **The generic-to-per-street fan-out (ADR-0067(e)) applies one number to all three
    streets uniformly.** Partly addressed by the WP-K follow-up (ADR-0072): the stand-in now
    yields to any per-street reading with a real denominator, and says "스트리트 구분 없음"
    verbatim on screen. What remains is that where no real reading exists, one number still
    stands in for three streets whose anchors differ (e.g. a 7% check-raise reads BELOW the
    800 bps flop anchor and ABOVE the 600 bps turn one), so the same profile can behave
    differently by street for a reason the user did not supply.
- **WP-K follow-up — the one open question it deliberately did not answer.** The §9 guard
  rail (ADR-0065(e)) zeroes EVERY positive `AGGRESSION` contribution while a live opponent
  with an above-anchor `THREE_BET` or street `CHECK_RAISE` is still to act, making no
  distinction between escalating a bluff and escalating a value bet. It is why golden spots
  4 and 7 now return ADAPTIVE ≡ REFERENCE rather than a value increase. `prompt` said to
  keep the existing safety caps, so the guard was not touched; a case can be made that a
  VALUE hand WANTS the check-raise and should be exempt. Recorded as falsifying evidence on
  ADR-0070 and as limitation 1 in
  `docs/reports/EXTERNAL_ADAPTIVE_SANITY_FOLLOWUP.md`. Related and also unchanged:
  `THREE_BET` is used as a POSTFLOP guard stat, so any opponent above a 7% 3-bet rate trips
  the guard on every postflop street.

- **Strategy A+B — deferred review findings (CLAUDE.md rule 5 requires these listed).** All
  behavioral findings from the two independent reviews are fixed; these documented
  deferrals remain (locations per `docs/reports/STRATEGY_REVIEW_R1.md` / `_R1B.md` and the
  fix reports):
  - **Heads-up preflop coverage is a FLOOR, not a HU strategy** (R1 M6, partial): the HU
    button opens the BTN∪SB union (49.62%, HEURISTIC, note says FLOOR in as many words) —
    still too tight (A2o/A3o fold); HU BB defense and 3-handed ladder reuse are likewise
    HEURISTIC/DERIVED without HU-specific anchors.
  - **Isolation-raise share vs a short shove reads the shove as an overbet** in
    `FACED_BET_SIZE`, keeping the raise mix low (~15%); shape correct, tuning deliberately
    not done (see `STRATEGY_FIX_R1B.md` residual).
  - **`heroVsAggressor` vs `heroInPosition` sizing fidelity** (R1 MINOR-6): wants an
    anchor-doc decision before changing emitted sizes.
  - Smaller deferrals, all cosmetic/latent and none reachable as wrong output today:
    rankBasis fallback (`postflop/context.ts`), `DEFAULT_RANGE_EQUITY_MAX_OPS` placement,
    the latent invariant throw on an all-in-only action set (unreachable from poker-core;
    marginally widened by the M7 guard — documented so it isn't rediscovered),
    `equityVsRanges` silently shrinking a >MAX_VILLAIN_RANGES lineup, the dead `NO_HAND`
    member in `apps/web/src/lib/table/strategy.ts`, an asymmetric pending label in
    `copy.ts`, the structurally unreachable `OPEN_PLUS_CALLER`-with-hero-as-opener branch,
    and R1B MINOR-8's remaining dedup items; the equity cache's 64-bit range digest (a
    collision would return a wrong number undetectably — measured 0 collisions in 160k
    probes, trade-off documented in `equity/cache.ts`); and `squeezeSizing`'s
    matching-denominator assumption (correct today, silently wrong if a non-integral
    squeeze multiplier is ever introduced); `STRONG_SHARE_PERCENTILE`'s three outputs
    currently have no reader anywhere (dead data — remove or consume in a later phase).
  - **`LINEUP_SHORT_HANDED` is DERIVED preflop and HEURISTIC postflop — intentional, not
    drift**: preflop short-handed play maps deterministically from anchor-backed tables
    (DERIVED per ADR-0056), while the postflop model is authored end-to-end, so nothing
    postflop can rise above HEURISTIC (`docs/STRATEGY_MVP_REPORT.md` §16/§20).
  - **Postflop villain ranges are not narrowed by postflop actions**
    (`villainRangeNarrowingApplied: false` — an honesty flag, deliberate; revisit with a
    latency budget if it ever matters more than the ~65ms/action it costs).
  - **Panel compute split follow-up**: a resumable two-phase equity context could cut the
    worst blocking window ~130→~64ms; needs a small `strategy-core` export, recorded in
    `STRATEGY_FIX_POSTFLOP.md`, not done.

- **Only COMPLETED hands are persisted (C0, ADR-0059).** A hand that reaches
  `phase === 'COMPLETE'` is stored durably exactly once; an IN-PROGRESS hand still lives in
  memory only and a reload discards it — full live-hand recovery remains Phase 8 work, and
  **persisted undo stays deferred until then**. A completed-but-unsaved hand (persist
  failed) survives for retry only until the page closes; closing the tab loses it
  (documented, accepted this milestone). Two tabs playing the same session collide on hand
  numbering — the second tab gets an honest CONFLICT banner whose retry cannot succeed;
  server-side renumbering would need a new ADR.
- ~~**Stacks are still not persisted across hands.**~~ — **closed by ADR-0075** (Hands-on
  Table UX V2). Seat occupancy, player and stack, plus the button seat, are written back at
  every between-hands boundary through `updateSessionSeats` / `updateSessionButtonSeat`, and a
  reload restores them (pinned by `seat-state-persistence.spec.ts`). Two residuals:
  `updateSessionTable` itself is still uncalled and does not write `stack_unverified` (it takes
  a whole `TableState`, which has no notion of human confirmation, so it would have to invent
  one — documented in its doc comment); and a quick-skipped hand number is not persisted, so a
  reload right after a quick skip may reuse it. Nothing ever claimed that number, so nothing
  collides.
- **C0+C1 deferred review findings (R1 MINORs, documented not fixed):** the analysis VPIP
  denominator (true opportunity count) is not directly comparable to the manually entered
  HUD VPIP shown elsewhere; a delayed cbet widens the `CBET_TURN`/`CBET_RIVER` denominators
  (algorithm v1 definition — a versioned algorithm change can rebuild all snapshots from
  raw history); hero's own hole cards are `revealed:false` and therefore never become SHOW
  evidence; UNFINISHED `hands` header rows remain mutable (immutability begins at
  `finished_at` — by design, ADR-0060, but noted as future risk); run-level
  `observationCount` is zero on an all-NO_CHANGES run and deliberately not surfaced in the
  summary UI.
- **A MUCK mark is not persisted and does not restrict an award.** Opponent SHOW / MUCK now
  exists (ADR-0052). SHOW writes a real hole-card event; MUCK is per-hand UI state, because a
  muck is unknown information and inventing an event for it would be a claim the engine could
  be asked to replay. Whether a mucked seat may still win a pot is deliberately undecided —
  that is a poker rule with no fixture behind it (`CLAUDE.md` rule 7). There is still no hand
  evaluator: the user picks the winner and the engine settles it.
- **The observed splash fee has no input.** `AWARD_POTS` always sends `fee: null` (ADR-0032 —
  no automatic trigger is invented). An observed fee cannot yet be recorded from the UI.
- ~~`S` (sit-out toggle) is not bound~~ — **done in the Strategy A+B milestone** (WP A1):
  `S` toggles the selected seat's occupancy via the existing single keydown listener, and
  `SeatOccupancyToggle` does the same by mouse.
- **The felt has visible dead space at 1440x800.** The seat rows are compact and the pot/board
  sit in a large empty middle. Functional, and deliberately not chased further — the prompt
  rules out pixel work — but it is the obvious next density win if the user wants one.
- **A save of a per-seat auto top-up preference is not retried.** If the write fails the
  preference still applies in this browser for this session and a banner says so; a reload
  loses it. Same write boundary as the item at the top of this list.
- **Per-seat auto top-up cannot be cleared back to "no preference" from the UI** — the switch
  writes enabled/disabled, and only the repository can write `null`. Harmless: a disabled
  policy and no policy behave identically.
- **`apps/web` typechecks as `moduleResolution: nodenext`** (required by Turbopack). Relative
  imports must carry `.js`, `next/link` is unusable as a default import, and
  `@testing-library/user-event` must be imported as a named import. Future web phases inherit
  this constraint.
- `packages/{gto-core,coinpoker-parser}/src/index.ts` are still Phase 0 placeholders with a
  wiring test each. Each implementing phase must delete its `placeholder.test.ts`.
  (`poker-core`'s went in Phase 1; `player-core`'s and `db`'s in Phase 3.)
- **`0001_insert_only_guards.sql` is hand-maintained.** `drizzle-kit` does not generate
  triggers, so adding another insert-only table will NOT update it automatically. The
  trigger-list assertion in `packages/db/tests/insert-only.test.ts` is the only tripwire
  (ADR-0037).
- **A trigger abort is classified `STORAGE_FAILURE`, not `CONSTRAINT_VIOLATION`.** SQLite
  surfaces `RAISE(ABORT, ...)` as a plain error whose message contains "is insert-only", and
  `attempt()` in `packages/db/src/errors.ts` has no marker for it. Harmless today because no
  repository path can reach a trigger; if a later phase needs a typed code, `CONSTRAINT_MARKERS`
  needs the entry.
- **Integrality `CHECK`s cover the enumerated categories only** (money, counts, centipercent,
  epoch-ms). `seat`, `seq`, `command_seq`, `ordinal`, `hand_number` and `archived` still rely on
  their range/enum checks plus the decoders: a fractional value there is caught on read, not
  rejected on write (ADR-0041).
- **`hand_players` is an index, not a checked projection.** Unlike `hands.hand_number`, the seat
  rows are taken from the caller-supplied state and are never re-derived from the log.
  `loadStoredHand` never reads them, so they cannot corrupt a rehydrated hand — but they can go
  stale relative to the log (ADR-0039).
- **`packages/db` declares `@gto-self/gto-core` and `zod` as dependencies but imports neither**;
  `packages/player-core` declares `zod` and does not import it. Left in place because Phase 9
  will need `gto-core` in `db`; the manifests currently overstate what the packages need.
- **Persisted undo does not exist.** `poker-core`'s undo drops the last command group, but
  `packages/db` has no `truncateHandEventsAfter`. Phase 5/6 will need it; deliberately not
  built in Phase 3.
- `MAIN_POT_FIRST` rake allocation can pay a winner a net of zero. Documented policy, not
  a bug (ADR-0025); `PROPORTIONAL` is the shipped default.
- `docs/POKER_CORE_API.md` §8 splits its numbered entries into **poker-rule assumptions**
  (§8.1) and **architecture/model decisions** (§8.2, rows 17-18). Accepted ADRs cite entries by
  index, so **1-18 keep their meaning permanently**; Phase 2 appended rows **19-28** rather than
  inserting. Rows 2, 5 and 15 were rewritten in place: assumption 5 (rake floors) is now marked
  KNOWN WRONG for CoinPoker and superseded by ADR-0027, retained only to hold its number.
- **`fixtures/coinpoker/` has no real hand history, and none is expected now** (ADR-0033).
  Do **not** request or wait for it. Consequences: Phase 11 is deferred, and the exact
  CoinPoker settlement rule stays a pre-Phase-13 validation item rather than a Phase-2 task.
  If an export is ever supplied it goes in `fixtures/coinpoker/private/` (git-ignored, safe
  for real nicknames). Nothing may be fabricated in its place — see
  `fixtures/coinpoker/README.md`.
- **CoinPoker rake rounding: ADR-0009's milliBB floor is FALSIFIED, and no replacement rule
  is confirmed yet** (ADR-0027). Real NL50 lines show a ₮5.37 pot raked to a recorded ₮0.27,
  where a milliBB floor yields ₮0.2685 — the site settles in whole currency cents
  (20 mBB at NL50), not milliBB. The two known data points also rule out floor-at-cent and
  ceil-at-cent, and are consistent with nearest-cent; **neither is a half-cent tie, so the
  tie-breaking rule is undetermined and must not be guessed.** Phase 2 ships the quantum and
  rounding mode as explicit configuration with the half-way behaviour flagged as an assumption;
  confirming the real rule is a pre-Phase-13 validation item (ADR-0033).
- **Open question — the 8 BB rake cap may be valid only for the dealt-in count currently
  targeted.** Rooms commonly run a short-handed cap schedule. Do not invent one, and do not
  claim exact CoinPoker short-handed settlement until a fixture verifies it.
- Splash-fee **trigger** semantics (when it applies, how it interacts with the cap) remain
  unknown. The amount is modelled; the trigger is not invented (ADR-0018). Shipped as
  `fee.triggerPolicy: 'NEVER'`, so the fee surface exists but is inert by default.
- **An all-folded hand cannot record a fee.** The engine auto-awards inside the command
  cascade, so there is no user command to carry an observed amount; `autoAwardUncontested`
  accepts one but the cascade passes `null`. Vacuous under the shipped `'NEVER'` default.
  Phase 8 is the natural place to fix it — it already needs an explicit abandon path for the
  same structural reason.
- **The rake `quantum` applies to the hand's TOTAL rake, not to each pot's share.**
  `allocateRake` then splits that quantized total at plain milliBB granularity so the parts sum
  exactly, which means an individual side pot's rake need not be a whole cent. Coherent — only
  the amount leaving the table is quantized — and documented in `docs/POKER_CORE_API.md` §7.13.
- **`POSITION_LINEUP_UNSUPPORTED` is unreachable today.** An independent review established
  that for every input `assignBlinds` accepts, the refusal cannot fire: with three or more
  dealt in the override guarantees BTN/SB/BB are three distinct seats, and heads-up the two
  labels are always distinct. It is sound defence in depth for a future lineup rule (a null
  small blind, a dead button, a seventh seat) — **not** evidence that a present-day input is
  gated. Code and assumption 28 now say so explicitly.
- **Two pre-existing `docs/POKER_CORE_API.md` gaps found during the Phase 2 doc pass, not
  fixed** (they predate Phase 2): §3.1's `EngineErrorContext` omits `commandIndex?: number`,
  which exists in `errors.ts` and is live; and §3.9 plus §1 label a formula `mayAggress` where
  `betting.ts` computes it as `mayReopen` (`mayAggress` is strictly narrower). The source is
  right and the doc is wrong in both cases.
- **`player_aggregates` and the `gto_*` tables do not exist yet.** `docs/ARCHITECTURE.md`
  lists them; Phase 3 built only the ten tables its scope named (plus
  `player_hud_snapshot_stats`, needed to keep an entered value and its verbatim text in
  separate columns). The `gto_*` set belongs to Phase 9; `player_aggregates` has no domain type
  because aggregating positional observation buckets double-counts and needs a design pass.
- No GTO data of any kind exists. The only permitted provider until Phase 14 is a
  mock that labels itself.
- `open_spiel` and `pokerkit` received only a _partial_ evaluation in the spike — no
  independent fact-check pass. ADR-0013 makes the full pass a precondition of actually
  taking the open_spiel dependency at Phase 13.
- Whether an external engine's numeric output could legally be committed as a fixture
  was left unresolved by the spike. ADR-0012 sidesteps it rather than settling it: we
  commit only hand-derived expected values, noting where an oracle agreed.

## Test status

WP-K follow-up (ADAPTIVE sanity calibration) final frozen-source gate, 2026-09-03.

| Suite                       | Result                            |
| --------------------------- | --------------------------------- |
| `pnpm verify` (typecheck + test + lint + lint:licences + build) | pass — exit 0 |
| `pnpm test`                 | pass — **140 files passed / 1 skipped**, 2383 passed / 3 skipped |
| — `adaptive-core` project   | pass — 143 tests                  |
| — `db` project              | pass — 157 tests                  |
| — `analysis-core` project   | pass — 66 tests                   |
| — `player-core` project     | pass — 191 tests                  |
| — `strategy-core` project   | pass — 783 tests (REFERENCE untouched by the follow-up) |
| — `web` project             | pass — 483 passed / 3 skipped     |
| `pnpm e2e`                  | pass — **30 Playwright tests**    |

(WP-K (external HUD + 1% ADAPTIVE calibration) gate, 2026-09-03: 139 files / 2363 tests,
30 Playwright tests.)

(Strategy C2 (WP-J adaptive) gate, 2026-09-02: 136 files / 2307 tests, 30 Playwright tests.)

(Strategy C0+C1 gate, 2026-09-01: 2091 tests, 26 Playwright tests.)

(Strategy A+B gate, 2026-09-01: 106 files / 1826 tests, 23 Playwright tests.)

(Alpha feedback round gate, 2026-08-31: 72 files / 979 tests, 15 Playwright tests.)

(Poker Table Alpha gate, 2026-08-29: 66 files / 856 tests, 11 Playwright tests.)

Evidence beyond the suite passing:

- **The performance contract is asserted, not assumed.** An end-to-end test drives a full
  betting sequence against a production build and asserts the captured network request list is
  empty, so ADR-0043 cannot silently regress into a server round trip on the action path.
- **The DB boundary was proved non-vacuous by probe**: a client-side import of `@gto-self/db`
  and of `@gto-self/db/client.js` both error, the same file under `apps/web/src/server/` does
  not, and `next build` output contains neither `better-sqlite3` nor `drizzle-orm` in the
  client bundle.
- **Migration `0002` was verified against a POPULATED database**, not an empty one: applied
  inside a single transaction to a database holding a session and its seats, every row survived
  with exact values, and `integrity_check` / `foreign_key_check` came back clean. An
  empty-database test cannot observe data loss (ADR-0046).
- **Test quality was probed by mutation.** Six deliberate breaks were introduced; five were
  caught (raise-to inflation, stale `view` after undo, ignored `hotkeysSuppressed`, ignored
  `deadCards`, award ignoring the user's pick). The sixth — raise-**to** silently treated as
  raise-**by** — passed against all 116 tests, because every raise test acted from a seat with
  zero street contribution. Three tests raising from the SB, the BB and over an existing raise
  now pin it, and were confirmed to fail against that mutation.
- **Migration `0003` was verified against the user's OWN database**, copied out of `.data/`
  rather than constructed: it sat at 0002 with 2 sessions, 12 seat rows and 9 players, and
  after the upgrade every seat row was byte-identical, the session-level policy columns were
  untouched, the declared index was present exactly once, no `__new%` scratch table existed,
  and both sessions still rendered. The same upgrade is now a permanent test.
- **The Korean input path was proved in a real browser, not simulated in a test.** Raw CDP key
  events carrying a Hangul jamo with the physical `code` fold the hand and enter cards. The old
  code passes every unit test and fails this.
- **Two layout invariants are pinned by E2E and were confirmed to fail before the fix**: the
  action dock stays inside the viewport with the palette open, and the award panel's submit
  button stays clear of the dock.
