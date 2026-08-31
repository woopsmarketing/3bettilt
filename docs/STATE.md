# State

Single source of truth for where the project is. The orchestrator updates this after
every phase; phase agents report, they do not edit it.

**Last updated:** 2026-08-31, after the first Alpha feedback round. Phases 4-7 stay accepted;
this round is corrections to them, not a reopening.

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

## Next

- **Hands-on testing by the user.** Launch with `pnpm dev` and open
  `http://localhost:3210`. This is the point of the Alpha: find what is wrong by using it.
- **Phase 8 — Observe / dirty stack flow** (`web`, `poker-core`), fresh agent. Hero fold ->
  Observe mode, Skip Rest, dirty marking, inline resync with next-dirty focus, next-hand
  rotation, manual button/blind override (ADR-0031), and the editable auto top-up threshold
  whose column ADR-0045 deliberately deferred. **Hand persistence belongs here too** — see
  known issues.
- **Then Phases 9 -> 10, then 12.** Phase 11 is deferred past the MVP (ADR-0033).

## Known issues / explicit TODOs

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

- **Nothing entered at the table is persisted.** Phases 4-7 write the SESSION only. The live
  table, the hand event log, cards and awards live in memory; a page reload discards them
  (ADR-0043). The table says so plainly in the UI, because losing entered work silently would
  violate rule 3. The write boundary and its reconciliation rules are Phase 8 work, and
  **persisted undo stays deferred until then** — there is nothing written yet to reconcile.
- **`updateSessionTable` is never called.** Stack changes across hands (wins, losses, auto
  top-up) advance in memory only, so a reloaded session returns to its configured stacks.
  Same fix as the item above.
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

Strategy A+B (REFERENCE engine) final frozen-source gate, 2026-09-01.

| Suite                       | Result                            |
| --------------------------- | --------------------------------- |
| `pnpm verify` (typecheck + test + lint + lint:licences + build) | pass — exit 0 |
| `pnpm test`                 | pass — **106 files, 1826 tests**  |
| — `strategy-core` project   | pass — 777 tests                  |
| `pnpm e2e`                  | pass — **23 Playwright tests**    |

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
