# C0+C1 — R1 fix work package

Fixes the findings raised in `docs/reports/C0C1_REVIEW_R1.md`. Scope was fixed by the work
package: **B1, M1, m4, m5, m6**, plus verification of the reviewer's restoration of
`packages/player-core/src/index.ts`. Everything else in the review (m1, m2, m3, m7, m8, M2)
was explicitly out of scope and was not touched.

No existing assertion was weakened or deleted. Every fix below has a test that was **proved
to fail without the fix**, by temporarily mutating the source back to its pre-fix shape,
running the test, and restoring. The exact mutation and the observed failure are recorded per
finding.

---

## B1 (BLOCKER) — a reloaded session restarted hand numbering

### Root cause, restated precisely

`TableState.handNumber` is the number the **next** hand will take: `startHand` numbers a hand
`table.handNumber` (`packages/poker-core/src/commands.ts:732`) and `advanceButton` increments
afterwards (`table.ts:268`). `sessions.hand_number` mirrors that counter, but it was written
exactly once — at session creation — and `updateSessionTable` had no production caller. So
every page load handed the store a counter of `0`, the next hands reused numbers already
stored, and `UNIQUE(session_id, hand_number)` refused them permanently.

(The review's walkthrough said hands are stored as 1, 2, 3; the engine actually numbers the
first hand of a fresh table `0`. That changes none of the reasoning — it only sets the `+ 1`
in the fix below.)

### Fix (a) — the counter is now durable, in the hand's own transaction

`packages/db/src/repositories/hands.ts`, inside `insertCompletedHand`'s transaction:

```ts
const next = hand.state.handNumber + 1;
tx.update(sessions)
  .set({ handNumber: next })
  .where(and(eq(sessions.id, input.sessionId), lt(sessions.handNumber, next)))
  .run();
```

- **Same transaction** as the header, lineup and events, so the counter can never be committed
  without the hand it describes, nor the hand without the counter.
- **Monotone** (`WHERE hand_number < next`), so a late-arriving lower number — a queued save
  from an earlier page life — stores without resetting the mark the next hand uses.
- **`updated_at` is deliberately not touched.** It orders sitting activity, `closeSession`
  refuses to move it backwards, and a completed hand may legitimately be persisted after the
  sitting was closed in another tab.
- Layering: this is the db repository writing its own package's `sessions` table. ADR-0039
  calls `hands.hand_number` a projection of the log; the session column is between-hands table
  state, which is what is being advanced. No migration — the column already exists.

### Fix (b) — session load resumes from the durable high-water mark

New read `maxStoredHandNumber(db, sessionId)` in the same repository (`max(hands.hand_number)`
for a session, `null` when none; unfinished headers count, because they hold their number in
the unique index just as finished ones do).

`apps/web/src/server/sessions.ts` / `loadSessionView` now returns a record whose
`table.handNumber` is `max(sessions.hand_number, max(hands.hand_number) + 1)`. The page already
passes `view.record.table` to the store (`app/table/[sessionId]/page.tsx:44`), so this is the
whole wiring — no store change was needed.

Both terms are kept on purpose: fix (a) makes `sessions.hand_number` correct for everything
written from now on, but a session written **before** this fix still carries `0` with real
hands behind it, and reading the hands is the only way to recover its true mark. A failed read
adds a visible warning and keeps the stored counter — it never silently lowers the mark.

### Fix (c) — the second-tab / stale-counter collision is named, not raw

The pre-existing duplicate probe is keyed on `hands.id`, so it **cannot** see a *different*
hand reusing a number: the id is new, only the number collides. Verified by reading it — the
probe returns `ALREADY_PERSISTED` only when the id, the session, the hand number **and** the
event count all match, so it can never misclassify this case; it simply never fires, and the
INSERT used to surface a raw `UNIQUE constraint failed: hands.session_id, hands.hand_number`
driver string in the user's banner.

`insertCompletedHand` now probes `(session_id, hand_number)` before inserting and returns a
named `CONFLICT` identifying the hand that already holds the number. It is a **save failure**,
shown honestly in the existing `hand-save-error` banner — not swallowed, not retried into
success.

### Two-tabs limitation (documented, not fixed — for the orchestrator's deferral list)

Two tabs open on the same session still each hold their own in-memory counter, seeded from the
same high-water mark at their own load time. The second tab to finish a hand therefore gets a
`CONFLICT` and an honest save-failure banner, and its retry will fail identically, because the
retry re-sends a byte-identical log (which is required for exactly-once and must not change).
Nothing is silently lost or mis-stored, and the first tab is unaffected — but a hand played in
a stale second tab is not recoverable through the UI. Fixing it properly means the client
learning the number from the server at persist time (the server renumbering the hand), which
changes the hand's own `HAND_STARTED` event and so is an engine/ADR question, not a bug fix.
This interacts with m8 (a queued failed save dies with the mount); after B1, that is once again
the rare tail case ADR-0059 accepted, rather than the ordinary outcome.

### Tests

`packages/db/tests/completed-hands.test.ts` (4 new):

| Test | Asserts |
| --- | --- |
| `advances the session hand counter in the SAME transaction as the hand` | counter goes 0 → 1 → 2; only this session's row moves; `maxStoredHandNumber` agrees |
| `never moves the session hand counter backwards` | a later hand numbered 3 after one numbered 7 leaves the counter at 8 |
| `refuses a DIFFERENT hand under a number this session already stored` | `CONFLICT`, `field: 'hand_number'`, `actual` names the incumbent hand id; nothing written; counter unchanged |
| `resuming from the stored high-water mark makes the next hand storable` | the whole scenario at repository level: 3 hands, read the mark, the next hand `PERSISTED`, 4 headers stored |

`apps/web/tests/e2e/hand-history.spec.ts` — new test **`a hand played AFTER a reload still
stores`**: play a hand, reload, **play a second complete hand**, assert no `hand-save-error`
and `저장된 핸드 2`, then reload again so the count is re-read by the server out of `hands`.
The hand-playing sequence was extracted into `playAndStoreOneHand` and the original test
rewritten to use it — its assertions are unchanged.

### Proof of failure without the fix

1. **db tests.** Removed the `tx.update(sessions)` block from `insertCompletedHand` →
   all four new tests fail (`expected +0 to be 1 / 8 / 2 / 4`). Restored.
2. **the named CONFLICT, in isolation.** Removed only the `numberHolder` pre-check →
   `refuses a DIFFERENT hand…` fails with `expected 'CONSTRAINT_VIOLATION' to be 'CONFLICT'`
   (i.e. the raw driver path the review described). Restored.
3. **E2E.** Removed *both* halves (the `tx.update` and the high-water computation in
   `loadSessionView`) and ran `npx playwright test tests/e2e/hand-history.spec.ts`:
   the **pre-existing** test still passed and the **new** test failed —
   `getByTestId('hand-save-error')` expected 0, received 1 — which is exactly the gap the
   review identified. Restored; both pass.

---

## M1 (MAJOR) — the §39 "strategy is unaffected" test was near-vacuous

The behavioural pin (`apps/web/src/server/analysis-strategy-unaffected.test.ts`) is **kept
unchanged**. Two real tripwires were added around it.

**New static guard: `packages/strategy-core/tests/layering.test.ts`.** It walks
`packages/strategy-core/src/**` and `packages/gto-core/src/**` as **text**, extracts every
module specifier (`from '…'` for imports *and* re-exports, bare side-effect `import '…'`,
dynamic `import('…')`, `require('…')`) and asserts none references `@gto-self/player-core`,
`@gto-self/analysis-core` or `@gto-self/db`, as themselves or as a subpath. It then asserts the
same over each package's `dependencies` / `devDependencies` / `peerDependencies`.

Design notes:

- It reads text rather than loading modules, because a type-only import is exactly how a
  player-model parameter would arrive first and an import-graph check would not see it.
- It asserts the file list is non-empty, so it cannot pass vacuously if the walk breaks.
- Two self-tests pin the scanner itself (it finds all six forbidden forms and leaves a local
  import alone; `@gto-self/dbx` is not mistaken for `@gto-self/db`), so the suite cannot pass
  because the regex stopped matching.
- It is deliberately a *second*, independent guard alongside ADR-0061's ESLint rules, which the
  reviewer confirmed fire in all 12 directions. This one runs in `pnpm test`.

**Comment added at `apps/web/src/lib/table/strategy.ts`'s `computeStrategy`** stating that the
parameter list is load-bearing for §39, that an optional `playerModel` option counts, and that
changing it needs an ADR and would have to defeat the layering test.

### Proof of failure without the fix

Appended `import type { ModelStatKey } from '@gto-self/player-core';` to
`packages/strategy-core/src/index.ts` **and** added `"@gto-self/analysis-core": "workspace:*"`
to `packages/gto-core/package.json`, then ran the test:

```
× names no forbidden package in any source specifier
    + "strategy-core/src/index.ts: @gto-self/player-core"
× declares no forbidden package as a dependency
    + "@gto-self/analysis-core"
Tests  2 failed | 4 passed (6)
```

Both mutations reverted (`git diff --stat` on those two files: empty).

---

## m4 — test scaffolding in `src/`

`apps/web/src/server/analysis-fixture.ts` → **`apps/web/tests/support/analysis-fixture.ts`**,
matching the boundary every workspace package draws with its own `tests/fixture.ts`. It is now
outside the Next.js `src/` tree entirely, so no route can reach it structurally — not merely by
tree-shaking. Its own docblock records the move and why.

Imports updated in the three consumers (`analysis-service.test.ts`,
`analysis-performance.test.ts`, `analysis-strategy-unaffected.test.ts`) and inside the fixture
itself (`../../src/…`). `apps/web/tsconfig.json` already includes `**/*.ts`, and Playwright's
`testDir` is `./tests/e2e`, so the new directory is typechecked but not collected as an E2E
spec.

**One ESLint config change was required** (`eslint.config.js`): the block that exempts
`apps/web/src/server/**` from the `@gto-self/db` import restriction now also lists
`apps/web/tests/**`. That rule exists to keep a native module out of a client bundle; a fixture
no route can reach cannot put one there. This is the same allowance the file already had in its
old location, moved with it — no rule was relaxed for any app path.

**Verification**: `pnpm typecheck` and `pnpm lint` both pass, and the three consuming test files
pass. (A first attempt at the docblock contained `packages/*/tests/fixture.ts`, whose `*/`
closed the block comment early — caught by `pnpm typecheck`, reworded.)

---

## m5 — `loadCompletedHands` bound-parameter ceiling

`inArray(hands.id, [...handIds])` binds one parameter per id, so a history longer than
SQLite's `SQLITE_MAX_VARIABLE_NUMBER` (32766) made the presence probe **throw**, not merely run
slowly. ADR-0062b recomputes over all of a player's history, which grows without bound.

The probe is now chunked at 500 ids per statement, merging into one presence map; the
order-preserving load loop below it is untouched, so results still come back in the order
requested. Same shape and same reasoning as `insertAnalysisResults`'s chunked writes.

### Tests (both in `packages/db/tests/completed-hands.test.ts`)

- `batch-loads a list far larger than SQLite bound-parameter ceiling` — 33 001 ids. The
  **unknown id is first**, so the loop refuses at index 0 before decoding a single log: the test
  is about the ceiling, not about 33 000 folds. Runs in ~40 ms, so no integration-cost
  justification is needed.
- `reassembles chunked results in the ORDER REQUESTED, across chunk boundaries` — 1100 ids
  spanning three chunks, alternating between two stored hands, asserting the returned
  `state.handId` sequence equals the requested one. A regression guard on order and on the
  merged presence map (a per-chunk overwrite would show up as a wrong id, not a wrong length).

### Proof of failure without the fix

Restored the single unchunked `inArray` → `batch-loads a list far larger…` fails with
`expected 'STORAGE_FAILURE' to be 'NOT_FOUND'` (the driver's "too many SQL variables"). The
order test passes either way, as intended — it is a guard, not the ceiling proof. Restored.

---

## m6 — `localeCompare` tiebreak in `topSpots`

`apps/web/src/lib/table/analysis-view.ts` now breaks ties with `<`/`>` on the `spotKey`, the
same code-point comparator `packages/analysis-core/src/aggregate.ts:186` uses for the **stored**
ordering, so display order and stored order cannot disagree and neither depends on the
runtime's ICU data or ambient locale. The docblock says why.

**Test** (`analysis-view.test.ts`, new): eight keys chosen so `localeCompare` genuinely reorders
them — case folding (`a` vs `B`), `_` treated as ignorable punctuation (`B_a` vs `Ba`), and the
Swedish `Z`/`Ä` inversion. It asserts the literal expected order (so the pin does not rest on
the comparator under test) and additionally asserts that `en`, `sv` and `de` collations each
produce a *different* order.

### Proof of failure without the fix

Restored `a.spotKey.localeCompare(b.spotKey)` → the new test fails
(`expected [ 'a', 'Ä', 'B', 'B_a', 'Ba', …] to deeply equal [ 'B', 'B_a', 'Ba', 'RFI_BTN', …]`).
Restored.

---

## Verification of the reviewer's restoration of `packages/player-core/src/index.ts`

**Exports — correct and complete.** The barrel exports all ten non-test modules in `src/`
(`errors`, `time`, `percent`, `player`, `hud`, `observation`, `notes`, `confidence`, `model`,
`modelConfig`); nothing is missing. `analysis-core` imports from `@gto-self/player-core` at five
sites, and `packages/analysis-core` typechecks and its full suite passes, so the two re-added
`export *` lines cover exactly what it needs. Nothing else in the workspace imports a
`player-core` submodule directly.

**Docblock prose — consistent, left as written.** The restored paragraph ("`model.ts` and
`modelConfig.ts` (C1) add the DERIVED player model vocabulary… They are types and pure integer
arithmetic only — still no `poker-core`, no `gto-core`, no `strategy-core`.") matches the file's
existing conventions: it names the modules, states what they add, and restates the layering
constraint the way the paragraphs above it do. Its claims are true — `model.ts` and
`modelConfig.ts` import nothing from those packages, and the reviewer separately confirmed
ESLint refuses all three directions. Its "still no `strategy-core`" extends the ADR-0021 list
in the paragraph above, which is accurate rather than a clash. **No wording change made.**

---

## Gate

| Gate | Result |
| --- | --- |
| `pnpm vitest run --project db` | 9 files / **135 tests PASS** (129 before this WP; +6) |
| `pnpm vitest run --project strategy-core` | 33 files / **783 tests PASS** (777 before this WP; +6) |
| `pnpm vitest run --project web` / `analysis-core` / `player-core` | PASS (web +1 test, m6) |
| `pnpm test` (full workspace) | 122 files + 1 skipped / **2091 PASS**, 3 skipped, 0 fail |
| `pnpm typecheck` | PASS (10 projects) |
| `pnpm lint` | PASS, clean |
| `pnpm e2e` (full Playwright suite, includes `next build`) | **26 PASS**, 0 fail (was 25; +1) |

## Files changed

| File | Change |
| --- | --- |
| `packages/db/src/repositories/hands.ts` | B1 (a) counter advance in-transaction, B1 (c) named `hand_number` CONFLICT, new `maxStoredHandNumber`, m5 chunked presence probe |
| `packages/db/tests/completed-hands.test.ts` | +6 tests (4 × B1, 2 × m5) |
| `apps/web/src/server/sessions.ts` | B1 (b) high-water-mark seeding of `record.table.handNumber` |
| `apps/web/tests/e2e/hand-history.spec.ts` | B1 (c) new post-reload test; helper extraction |
| `packages/strategy-core/tests/layering.test.ts` | **new** — M1 static import/dependency tripwire (6 tests) |
| `apps/web/src/lib/table/strategy.ts` | M1 comment: the parameter list is load-bearing for §39 |
| `apps/web/src/lib/table/analysis-view.ts` | m6 code-point tiebreak |
| `apps/web/src/lib/table/analysis-view.test.ts` | m6 determinism test |
| `apps/web/tests/support/analysis-fixture.ts` | m4 relocation (from `src/server/`) + import rewrites |
| `apps/web/src/server/analysis-{service,performance,strategy-unaffected}.test.ts` | m4 import path |
| `eslint.config.js` | m4 — `apps/web/tests/**` joins `apps/web/src/server/**` in the DB-import exemption |

No migration was added; no schema change was made; no ADR was reopened.

## Residual risk

- **Two tabs on one session** — described above. Honest failure, not silent loss; needs a
  product decision, not a patch.
- **m8 (a queued failed save dies with the mount)** — unchanged and still ADR-0059's accepted
  behaviour; B1's fix returns it to the rare case the ADR assumed.
- Findings **m1, m2, m3, m7** and **M2** were out of scope and remain open for the
  orchestrator's deferral list.
