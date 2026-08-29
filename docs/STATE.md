# State

Single source of truth for where the project is. The orchestrator updates this after
every phase; phase agents report, they do not edit it.

**Last updated:** 2026-08-29, after Phase 3 (database and player domain).

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
    guarantee for manually entered records was a repository *convention* that the exported
    Drizzle tables let any caller bypass — now enforced by database triggers (ADR-0037); and
    the ESLint layering rules matched only bare specifiers, so every subpath import bypassed
    them, with four boundaries unguarded entirely (ADR-0042). Five MINOR findings also fixed:
    integrality `CHECK`s (ADR-0041), a silently trimmed nickname on read, a `hand_number`
    projection the comment claimed was checked and was not, a `closeSession` that could move
    `updated_at` backwards, and a `formatPercent` that truncated instead of rounding.

## Current

- Nothing in flight. Phases 1, 2 and 3 are **accepted** — none is reopened or reimplemented.
- **MVP priority update (ADR-0033), 2026-08-29.** The real CoinPoker hand-history export will
  not be provided, and this is **not** a blocker. Phase 11 (parser) is deferred past the first
  usable MVP; delivery order is **2 -> 10, then 12**. Phase 2 does no further rake forensics —
  it builds the *configuration surface* so that a later correction is config-only.
- A bounded documentation + Phase-2 input reconciliation pass ran on 2026-08-29. No source
  code changed. It removed the duplicated status column from `docs/ROADMAP.md`, reconciled
  `ARCHITECTURE.md` with ADR-0023, corrected product-boundary wording, and recorded
  **ADR-0027..0032** plus `docs/GTO_DESIGN_NOTES.md`.

## Next

- **Phase 4 — Session setup UX** (`apps/web`), fresh agent. Six seats, nickname
  search/autocomplete over `searchPlayersByNicknamePrefix`, existing-player reuse, new-player
  HUD entry, stack input, Hero selection, active/sitting-out/empty. The persistence seam it
  builds on is `packages/db`'s repositories, which return domain types, not rows.
- **Then Phases 5 -> 10 in order, then 12.** The milestone is the loop in `docs/UX.md`:
  session setup -> seats/stacks -> start hand -> hero cards -> rapid F/C/R/A -> automatic
  pot/stack/action order -> board entry -> undo -> hero fold / observe -> Skip Rest / dirty
  resync -> next hand -> MOCK-labelled strategy. Phase 11 is deferred past it (ADR-0033).

## Known issues / explicit TODOs

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

Phase 3 gate, 2026-08-29, run after the review fixes landed.

| Suite                | Result                                                          |
| -------------------- | --------------------------------------------------------------- |
| `pnpm typecheck`     | pass                                                            |
| `pnpm lint`          | pass                                                            |
| `pnpm lint:licences` | pass                                                            |
| `pnpm test`          | pass — **59 files, 725 tests**                                  |
| `pnpm build`         | pass                                                            |
| `pnpm e2e`           | not run — needs `pnpm --filter @gto-self/web e2e:install` first |

Every layering rule in `eslint.config.js` was proved non-vacuous by a probe asserting that a
forbidden import errors and a permitted one does not (15 cases). The insert-only triggers were
verified independently of the test suite by applying the committed migrations to a scratch
database and attempting a raw `UPDATE` and `DELETE`: both were rejected and the original row
survived.
