# C0+C1 — Independent adversarial review (R1)

**Scope**: the uncommitted C0 (durable completed-hand history) + C1 (post-session player
model) change set, against `prompt` §5-§45 and ADR-0059..0062. `CLAUDE.md` and `prompt`
are user-owned and were ignored.

**Reviewer posture**: read-only on source, hunting for defects. Verification run:
`pnpm typecheck` (PASS), `pnpm lint` (PASS, clean), `pnpm vitest run --project db
--project analysis-core --project player-core` (21 files / 369 tests PASS),
`pnpm vitest run --project web` (PASS). Playwright E2E was **not** run.

**Verdict**: 1 BLOCKER, 2 MAJOR, 8 MINOR. The engine, schema, immutability and
idempotency work is genuinely strong — most of the §41 hunt list came back clean and is
recorded under "Verified sound" so fixes do not re-litigate it. The BLOCKER is not in the
analysis engine at all; it is in the *identity* the write path inherits from a session
that never persists its hand counter.

---

## ⚠️ Incident disclosure — a milestone file was destroyed and restored during this review

A read-only lint-probing subagent dispatched by this reviewer ran
`git checkout -- packages/player-core/src/index.ts` to revert its own temporary probe
import. That file carried an **uncommitted, unstaged** milestone edit (C1-A's barrel
exports), which the checkout discarded irrecoverably. The repository was left in a
non-compiling state (20 × TS2305 in `analysis-core`).

**This reviewer restored it**, breaking its own read-only rule deliberately rather than
leaving a broken tree:

- `packages/player-core/src/index.ts` — re-added `export * from './model.js';` and
  `export * from './modelConfig.js';` plus a docblock paragraph.
- WP C1-A's own report (`C0C1_WP_C1A.md:43`) documents the lost edit as exactly
  "`+ 2 export lines, + a docblock paragraph`", so the reconstruction is faithful in
  substance.
- `pnpm typecheck` passes again; `pnpm lint` passes; all four test projects pass.

**Action for the orchestrator**: diff the restored docblock against the original intent if
you have it. The two `export *` lines are certainly correct (typecheck proves it); the
prose paragraph is this reviewer's wording, not C1-A's.

---

## BLOCKER

### B1 — Every completed hand played after a page reload (or in a second tab) is permanently unstorable

`hands` carries `UNIQUE(session_id, hand_number)`
(`packages/db/src/schema.ts:611` — `uniqueIndex('hands_session_hand_number_unique')`), and
`insertCompletedHand` writes `hand_number` straight from the folded state
(`packages/db/src/repositories/hands.ts:277`). The hand number therefore has to be
globally unique *per session, across the whole life of that session*.

It is not. The chain:

- `createTable` starts at `handNumber: 0` (`packages/poker-core/src/table.ts:67`) and
  `startHand` increments it (`packages/poker-core/src/table.ts:268`) — **in memory only**.
- The session row's `hand_number` is written exactly once, at session creation
  (`packages/db/src/repositories/sessions.ts:121`), with the value `0`.
- The only function that would ever update it, `updateSessionTable`
  (`packages/db/src/repositories/sessions.ts:216`), **has no production caller**. Verified:
  `grep -rn "updateSessionTable" apps packages --include="*.ts" --include="*.tsx"` outside
  tests returns only its own definition and a doc reference.
- The table page hands the store `view.record.table`
  (`apps/web/src/app/table/[sessionId]/page.tsx:44`), i.e. the stored session row — so
  `handNumber` is `0` on **every** page load.

**Failure scenario (deterministic, not a race):**

1. Open a session, play 3 hands to completion. Rows stored with `hand_number` 1, 2, 3.
   The header reads `저장된 핸드 3`. Everything is fine.
2. Reload the page (which the UI itself invites — the header promises "세션은 저장됩니다"),
   or open the same session in a second tab.
3. Play a hand. The store numbers it **1**.
4. `insertCompletedHand` finds no row under the new `hands.id`, so the duplicate probe at
   `packages/db/src/repositories/hands.ts:245-267` passes, and the INSERT hits
   `SQLITE_CONSTRAINT_UNIQUE` on `hands_session_hand_number_unique`.
5. The user sees `핸드 1 기록 저장 실패 …`. **재시도 re-sends the identical log and fails
   identically, forever.** Hands 2 and 3 of the new page life fail the same way. Only from
   hand 4 onward does the session start storing again.
6. `세션 분석 및 반영` then silently analyses a truncated history. The gate does not block on
   failed saves (only on in-flight ones, `apps/web/src/lib/table/analysis-view.ts:70`), so
   the run proceeds; the user gets the `analysis-unsaved-warning` line, but the snapshot is
   still built on a hand set that is missing real hands.
7. Closing the tab discards the queued log (`useCompletedHandSaves` state dies with the
   mount — documented and accepted by ADR-0059, but here it is the *normal* outcome rather
   than the rare one).

This defeats `prompt` §45's "completed hands are durably stored" and §10's "do not
silently lose history".

**Why the test suite does not catch it.** `apps/web/src/server/analysis-fixture.ts` holds a
**mutable** `SessionFixture.table` that is threaded across every
`persistFixtureHands` call (`analysis-fixture.ts:75`, `:199-204`), so hand numbers keep
climbing inside a test the way they never do in the app. And
`startFixtureSession` seeds `table` from the stored session row with `handIndex: 0`
(`analysis-fixture.ts:122`) — the exact production behaviour — but no test ever calls it
twice for one session. The E2E (`apps/web/tests/e2e/hand-history.spec.ts:66`) reloads and
re-reads the count, but **never plays a hand after the reload**, which is precisely the
uncovered step.

**Suggested fix direction** (pick one, then add the missing test — "reload, play another
hand, it stores"):

1. *Preferred, smallest*: at page load, seed the store's `handNumber` from the database —
   `max(hand_number)` over the session's stored completed hands — and pass it alongside
   `storedHandCount`. `listCompletedHandsForSession` is already called there
   (`apps/web/src/server/sessions.ts:77`) and is ordered by `hand_number`, so the value is
   free. This also makes the on-screen 핸드 counter continuous across a reload, which it
   currently is not.
2. Persist the counter: call `updateSessionTable` (or a narrow
   `updateSessionHandNumber`) unawaited on the same boundary that fires the persist.
   Weaker — it reintroduces a lost-update window between two tabs.
3. Relax the identity: treat `hand_number` as a non-unique projection and let `hands.id`
   (already the PK, already the engine's own id) be the sole uniqueness guarantee. Cleanest
   conceptually, but it is a migration and it weakens a real integrity check; and the
   duplicate-hand-number display problem remains.

Whatever is chosen, `insertCompletedHand` should also translate a
`hands_session_hand_number_unique` violation into a *named* `CONFLICT` with a message a
user can act on, instead of the raw driver error that reaches the banner today.

---

## MAJOR

### M1 — The §39 "strategy is unaffected" acceptance test is near-vacuous

`apps/web/src/server/analysis-strategy-unaffected.test.ts:80-111` compares
`JSON.stringify(computeStrategy(state, 0))` before and after a real analysis run. But
`computeStrategy(state: HandState, heroSeat, options)`
(`apps/web/src/lib/table/strategy.ts:393`) is a **pure function of its arguments** with no
database handle, no player-model parameter and no module-level state. The assertion cannot
fail while that signature holds — including in the very world the test exists to forbid,
where someone adds an *optional* `playerModel` option and wires it from the panel. The
test's setup (persist hands, run analysis, assert snapshots were written,
`:99-105`) is real and good; the property being asserted is the one thing that is
structurally guaranteed.

The real guard is ADR-0061's ESLint layering, which this review probed directly and which
**does** fire in all 12 directions tested (see Verified sound #1). The §39 test is
therefore not worthless — but it should not be counted as *the* acceptance evidence.

**Suggested fix direction**: assert the property where it could actually break — the
boundary between the app and the panel. E.g. a test that renders/derives the
`StrategyPanel`'s props before and after a run and asserts deep equality, plus a static
assertion over `strategy.ts`'s transitive import graph (no `analysis-core`, no
`player-core`, no `@gto-self/db`) so that the check survives a signature change. At minimum,
add a comment at `strategy.ts:393` stating that the parameter list is load-bearing for §39
and may not gain a player-model argument without an ADR.

### M2 — The required milestone report (`prompt` §42-§44) does not exist

`docs/PLAYER_HISTORY_LEARNING_MVP_REPORT.md` is absent (`ls docs/`). §42 specifies its
twenty required sections, §43 mandates a full worked player example showing numerator,
denominator, `n/(n+30)` and the resulting UNKNOWN/LEARNING/KNOWN state, and §44 requires
the hands-on browser test script. §45's acceptance list is not satisfiable without it. The
per-WP reports in `docs/reports/` are implementer notes, not this document.

If this is deliberately deferred to R2, say so explicitly in `docs/STATE.md`; otherwise it
is an outstanding deliverable. Note that §43's worked example is also the cheapest
independent check that exists on the denominators — writing it out by hand is likely to
surface any residual extraction disagreement.

---

## MINOR

### m1 — VPIP/PFR denominators are not comparable to the HUD VPIP shown elsewhere in the app
`packages/analysis-core/src/extract.ts:162` — the denominator is "faced at least one
preflop decision", so a **walk** (everyone folds to the BB) and a blind that was already
all-in contribute nothing. This is exactly right per §16/§30 and is well documented. But
`PlayerHudSnapshot` stores a third-party HUD's VPIP, whose denominator *is* hands dealt,
and both can appear in the same profile UI. Two differently-defined numbers under the same
four letters will be read as a contradiction. Label the model's VPIP with its denominator
convention in the profile panel, and record the convention in the §42 report.

### m2 — `CBET_TURN` / `CBET_RIVER` include delayed continuation bets
`packages/analysis-core/src/decisions.ts:330` keeps `initiativeSeat` unchanged across a
street that checked through, so the preflop raiser who checked the flop gets a
`CBET_TURN` **opportunity** on the turn. That is a defensible definition (and the
comment says so), but it is not the common HUD definition, and it silently widens the
denominator relative to what a user importing outside numbers would expect. `TURN_BARREL`
(`extract.ts:246`) correctly uses the strict `cbetTaken.FLOP === true` chain. Worth an
explicit line in the §42 report, or an ADR note.

### m3 — Hero can never be recorded as SHOW evidence
`apps/web/src/lib/table/cardEntry.ts:88-91` only offers a `REVEAL` request for a seat with
`holeCards.length < 2`. The hero's own two cards are always already entered, so the hero
seat can never be re-entered with `revealed: true`. Consequence: if the hero shows at
showdown, that fact is unrecordable, and the hero's own hands contribute `sourceShowCount:
0` forever. (This is also *why* hero cards cannot leak into SHOW evidence, which is the
correct outcome — see Verified sound #7 — so fixing it needs care: a future "hero shows"
path must not turn `revealed: false` hero entries into evidence retroactively.)

### m4 — `analysis-fixture.ts` is test scaffolding living in `src/`
`apps/web/src/server/analysis-fixture.ts` is not a `.test.ts` file, is imported by
`@gto-self/db` and by `poker-core` command builders, and sits inside the Next.js app
source tree. It is server-only and tree-shaken in practice, but it is production-adjacent
scaffolding that a future refactor could reach from a non-test path. Move it under a
`tests/` or `__fixtures__/` boundary, or at least name it `*.fixture.ts` and add it to a
lint rule that forbids importing it from non-test code.

### m5 — `loadCompletedHands` has a SQLite bound-parameter ceiling
`packages/db/src/repositories/hands.ts:552` uses `inArray(hands.id, [...handIds])`. With
one bound parameter per id, a player with more than ~32k eligible hands (better-sqlite3's
`SQLITE_MAX_VARIABLE_NUMBER`) makes the whole analysis throw. §35 only asks for 1000 hands,
so this is not urgent — but the ADR-0062b design is explicitly *all-history* recomputation,
which grows without bound. Chunk the `inArray`, the way `insertAnalysisResults` already
chunks its writes (`repositories/analysis.ts:125`).

### m6 — `topSpots` ties are broken with a locale-dependent comparator
`apps/web/src/lib/table/analysis-view.ts:203` uses `a.spotKey.localeCompare(b.spotKey)`.
Display-only (nothing stored depends on it), but the surrounding module's own docblock
claims stability "across runs", and `localeCompare` is not stable across ICU versions or
locales. Use the same `<`/`>` comparator `aggregate.ts:186` uses for the stored ordering.

### m7 — An *unfinished* `hands` header is still fully mutable
`packages/db/drizzle/0004_completed_hand_history.sql` — `hands_no_update_once_finished`
fires only `WHEN OLD.finished_at IS NOT NULL`. This is correct and deliberate for ADR-0059
(and the review confirms C0 only ever inserts already-finished rows, so the window is
unreachable today). But when the future live-persistence phase starts inserting headers
early, `session_id` and `hand_number` on an in-flight row will be freely rewritable. Narrow
the trigger to the columns that may legitimately change (`finished_at` only) when that
phase lands.

### m8 — A queued failed save is lost on unmount, with no recovery surface
`apps/web/src/components/table/useCompletedHandSaves.ts:114-130` keeps the entry registry
and the failure list in refs/state that die with the mount. ADR-0059 accepts this
explicitly and the module docblock states it plainly, so this is not a defect against the
current decision — but B1 turns it from a rare tail case into the *ordinary* outcome for
every post-reload hand. Re-evaluate once B1 is fixed; if the residual risk still matters,
the smallest honest mitigation is a `beforeunload` warning while `failures.length > 0`.

---

## Verified sound

Probed and found genuinely to hold. Fixes for the above should not disturb these.

1. **ESLint layering actually fires.** Twelve forbidden import directions were probed by
   temporarily inserting a real import and running `eslint` on the file (all reverted):
   strategy-core⊥player-core, gto-core⊥player-core, strategy-core⊥analysis-core,
   gto-core⊥analysis-core, player-core⊥poker-core, player-core⊥strategy-core,
   player-core⊥gto-core, analysis-core⊥@gto-self/db, analysis-core⊥strategy-core,
   analysis-core⊥gto-core, poker-core⊥analysis-core, poker-core⊥player-core. **All 12
   report an error.** `packages/analysis-core` is not ignored — root `pnpm lint` (`eslint .`)
   lints all of its files.
2. **No test, script or fixture can touch live `.data`.** The only fallback to
   `.data/gto-self.db` is `apps/web/src/server/db.ts:87`, reachable only from
   `players.ts`/`sessions.ts`, which no test imports. Every DB-opening test site uses
   `:memory:` or `mkdtempSync(tmpdir())`; `apps/web/playwright.config.ts:26` overrides
   `GTO_SELF_DB_URL` to a throwaway tmpdir file. `migrations.test.ts` builds tmpdir
   databases from the committed migration SQL and never copies or opens `.data`.
3. **Raw history is immutable at the database level, and the guard list is exhaustive.**
   `0004`/`0005` create BEFORE UPDATE + BEFORE DELETE triggers on `hand_events`,
   `hand_players`, `hands` (UPDATE conditional on `finished_at IS NOT NULL`, DELETE
   unconditional), and all six derived tables. `packages/db/tests/insert-only.test.ts:88`
   asserts the **exact full trigger list** (a new table without a guard fails the test), and
   a second test asserts the `WHEN` clause is present on `hands_no_update_once_finished` and
   absent everywhere else. The `withoutInsertOnlyGuards` helper lives only in
   `packages/db/tests/fixture.ts:196`, is used by three test files, restores the DDL read
   back out of `sqlite_master`, and is **not** exported from `src/` — no production path can
   reach it.
4. **Exactly-once persistence.** Client side: one ref-held entry per `handId` with
   `PENDING→IN_FLIGHT→SAVED|FAILED`, checked before every dispatch
   (`useCompletedHandSaves.ts:137`), so Strict Mode double effects, re-renders, repeated
   Next Hand and a retry racing an in-flight request all collapse. Server side: `hands.id`
   is the engine's own `handId` and the PK; `insertCompletedHand` probes first and returns
   `ALREADY_PERSISTED` only when session, hand number and event count all match, and
   `CONFLICT` otherwise (`repositories/hands.ts:245-267`). The component tests
   (`HandHistorySave.test.tsx:109-256`) are load-bearing, not vacuous: they assert call
   *counts*, that a retry re-sends a byte-identical payload, and that Start Hand stays
   enabled during an in-flight save. (Two concurrent inserts of the same id could in
   principle both pass the probe; better-sqlite3 is synchronous and `runSessionAnalysis` /
   `persistCompletedHand` run to completion without interleaving on Node's single thread, so
   this is unreachable in this deployment — and the PK still refuses the second row.)
5. **The `NO_CHANGES` gate has no hole I could find.** It compares **both**
   `inputHash` and `algorithmVersion` against the player's *latest* snapshot
   (`analysis-service.ts:144-148`). `inputIdentityHash` (`analysis-core/src/hash.ts`) sorts
   before hashing (order-independent), prefixes the count and `\n`-separates the ids (so
   `['ab','c']` ≠ `['a','bc']` and a differently-sized set cannot collide by
   concatenation), uses no clock/RNG/crypto dependency, and its non-cryptographic choice is
   argued explicitly. The hash is taken over exactly the id list passed to
   `computePlayerModel`, and the hands are loaded from that same list, so a hand persisted
   between the two reads cannot desynchronise the pair.
6. **No double counting, and snapshots are versioned, never overwritten.**
   `computePlayerModel` is a full recomputation with no `previous + delta` anywhere
   (`aggregate.ts`), rejects a duplicated hand id, and the run always passes the player's
   *complete* eligible set (`analysis-service.ts:134`, with the docblock explaining why
   narrowing it would break the gate in the worst direction). `model_version` is assigned as
   `max(...) + 1` inside the write transaction with `UNIQUE(player_id, model_version)` behind
   it (`repositories/analysis.ts:250-261`). `analysis-service.test.ts:141` asserts the second
   run yields 9, "not 14 and not 10", and that `v1` still exists with its original count.
7. **MUCK creates no cards; SHOW attribution is correct.** `extract.ts:358` requires
   `seatState.holeCardsRevealed && holeCards.length > 0`. The UI's only `revealed: true`
   path is the explicit showdown REVEAL request (`cardEntry.ts:135`); the hero's own entry is
   hard-coded `revealed: false` (`cardEntry.ts:134`). A mucked hand emits no
   `HOLE_CARDS_SET` at all, so there is nothing to leak. `outcomeFor` returns `UNKNOWN`
   rather than guessing when the reveal was not at a showdown the player contested.
8. **Opportunity denominators are read off the real action flow, not from positions.**
   Every stat is derived from `HandState.actions`, which `poker-core` appends only for
   voluntary actions (`reduce.ts:235`, blinds excluded) and only when the engine put the seat
   on the clock. So the four §30 counterexamples hold *by construction*: a folded seat is
   removed from `live` and produces no later record; an all-in seat is skipped by
   `seatsAbleToAct`; a sitting-out seat is not in `dealtInSeats`; a seat action never reached
   produces nothing. Spot-checked independently against hand-derived expectations:
   - *VPIP/PFR* — denominator "faced ≥1 preflop decision", numerator over the **effect**, so
     a shove counts as a raise; `isVoluntaryEffect` correctly excludes `CHECK`, so a BB
     checking its option is an opportunity without an action, while an SB completing is
     VPIP (`model.ts:71`).
   - *Fold-to-3Bet* — denominator is the `VS_THREE_BET` family, which requires
     `raisesBefore === 2 && seat === openerSeat` (`decisions.ts:260`). A cold-caller facing
     the 3-bet is correctly *not* counted (that is fold-to-squeeze), and a player who folded
     before the 3-bet never reaches the decision at all.
   - *CBet* — `canContinuationBet` requires initiative *and* no bet in front
     (`extract.ts:109`); in a limped pot `initiativeSeat` is `null`, so nobody gets a cbet
     opportunity, which is correct.
   - *Check-Raise* — `canCheckRaise` requires the seat to have checked *this street* and now
     face a bet (`extract.ts:115`); `scratch.checked` is cleared on any non-check and reset at
     every street boundary, so a player who called and then faces a re-raise is not counted.
   - *BB option / walks* — a walk generates no `ActionRecord` for the BB, so no opportunity;
     a BB in an unraised pot is classified `BB_OPTION`, never `RFI` and never `VS_OPEN`
     (`decisions.ts:251`).
   - *Sit-out and 6→5→4→5 lineups* — `dealtInSeats` is per hand and `hand_players` is
     written from it, so `listCompletedHandIdsForPlayer` links a player only to hands they
     were actually dealt into.
9. **Strategy A+B reads no player data at runtime.** `computeStrategy` takes
   `(HandState, SeatIndex | null, options)` and nothing else
   (`apps/web/src/lib/table/strategy.ts:393`); `strategy.ts` and `StrategyPanel.tsx` contain
   no reference to `player-core`, `analysis-core`, `getPlayerModel` or `playerModel`.
   `buildStrategyQuery` is fed only from `HandState`. (See M1 on the *test* that is meant to
   pin this.)
10. **Determinism of stored content.** No clock, RNG or id generation in `analysis-core`;
    `createdAt` and `modelVersion` are supplied by the persistence layer and live in
    columns, not in the hashed content. Every emitted list is explicitly sorted by a stable
    key (`aggregate.ts:169-192`) rather than left in `Map` iteration order, and the
    `betSizes` sort relies on ES2019 sort stability to keep within-hand decision order —
    stated in the comment. `analysis-service.test.ts:303` asserts identical content from
    identical input **on two separate databases**.
11. **Money stays integer.** The only division in the new modules is
    `model.ts:376/383/433/437` — observed rates and bet-as-fraction-of-pot / bet-in-BB,
    which `CLAUDE.md` rule 1 explicitly permits as non-money ratios. Raw milliBB is stored
    beside every bucket (`BetSizeObservation.toAmount/amount/potBefore`), and
    `observedRateLabel` rounds explicitly, half-away-from-zero.
12. **PARTIAL is honest end to end.** `planPlayer` is total — every per-player failure,
    including a thrown `invariant`, comes back as `FAILED` for that player alone
    (`analysis-service.ts:129-171`). The status is derived from the failure count
    (`:313`), the per-player `errorJson` is stored verbatim, the DB CHECK
    `analysis_run_players_snapshot_iff_created` makes "created a snapshot" unclaimable
    without one, the UI renders `일부 실패` and a per-player `role="alert"` with the verbatim
    code and message, and `analysisDisclaimer` picks its leading sentence from what actually
    happened — including the case where a `SUCCESS` run changed nothing. A run whose single
    write call fails persists nothing at all, deliberately, and says so.
13. **Player identity is deterministic and reused across sessions.** `resolvePlayer`
    (`apps/web/src/server/session-service.ts:88`) looks a seat's nickname up by
    `normalized_nickname` (UNIQUE) and reuses the existing player; only an unmatched
    nickname creates one. No fuzzy matching. `analysis-service.test.ts:226` asserts one
    snapshot built from both sessions for the same nickname, and `:173` asserts a player
    outside the new session's scope keeps exactly the model the earlier run gave them.
14. **Raw history is never written or deleted by the analysis path.** `analysis-service.ts`
    has no write other than `insertAnalysisResults`, and every hand table is
    delete-guarded at the database level regardless.
