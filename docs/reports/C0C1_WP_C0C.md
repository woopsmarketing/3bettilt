# WP C0-C — `apps/web`: wiring completed-hand persistence

Scope: `apps/web/**` only. No file outside the app was modified (`packages/*`, root configs,
`CLAUDE.md`, `prompt`, `docs/STATE.md` untouched). Consumes WP C0-B's repository surface as
built; `packages/db` was not edited.

Implements ADR-0059 (b, c, d, e) in the app: a completed hand is written once, off the action
path, with a visible non-reverting failure banner and a retry.

---

## 1. Files

| File | Change |
|---|---|
| `apps/web/src/lib/table/history-contract.ts` | NEW. Client-safe wire types + `persistCompletedHandSchema` (zod, shape only). |
| `apps/web/src/server/hand-history-service.ts` | NEW. `persistCompletedHand(db, input, { now })` — validate, decode, re-fold, clamp, insert. |
| `apps/web/src/server/actions/hand-history.ts` | NEW. `'use server'` wrapper: real db handle + real clock, nothing else. |
| `apps/web/src/server/sessions.ts` | `SessionView` gains `storedHandCount: number \| null` from `listCompletedHandsForSession`. |
| `apps/web/src/components/table/useCompletedHandSaves.ts` | NEW. The COMPLETE-transition trigger, the exactly-once registry and the retry queue. |
| `apps/web/src/components/table/TableRoot.tsx` | Two new optional props, the hook call, the `hand-save-error` banner with 재시도, the `stored-hand-count` indicator. |
| `apps/web/src/app/table/[sessionId]/page.tsx` | Passes `persistCompletedHandAction` and `view.storedHandCount` down as props. |
| `apps/web/src/components/table/HandHistorySave.test.tsx` | NEW — 8 component tests. |
| `apps/web/src/server/hand-history-service.test.ts` | NEW — 11 integration tests against a real in-memory database. |
| `apps/web/tests/e2e/hand-history.spec.ts` | NEW — 1 E2E: persist fires, succeeds, survives a reload. |
| `apps/web/tests/e2e/card-palette.spec.ts`, `tests/e2e/seat-occupancy.spec.ts` | Their network-empty assertions RETARGETED, not weakened — see §6. |

---

## 2. The trigger point, exactly

`useCompletedHandSaves` is a `useEffect` in `TableScreen` watching the store's `hand`:

- the first time a hand id is seen, `Date.now()` is recorded as that hand's `startedAt`;
- when `hand.state.phase === 'COMPLETE'` (award submitted, `HAND_FINISHED` folded in — the
  same boundary `canStartHand` already uses), the hand's entry is created with
  `encodeHandEvents(hand.events)` and `finishedAt = Date.now()`, and the action is fired
  **unawaited**.

It is an effect, so `applyCommand` has already returned and React has already rendered before
anything is dispatched. No store method was changed: `tableStore.ts` is untouched, and the
synchronous-transition rule of ADR-0043 holds by construction — the store still cannot see the
network. Start Hand is never gated on a save (proved by a test with a promise that never
settles).

Nothing derived travels. The wire carries the encoded log, the session id and two client
clock readings; the server recomputes the state.

## 3. Action signature

```ts
// apps/web/src/lib/table/history-contract.ts
interface PersistCompletedHandValue {
  sessionId: string;
  events: readonly unknown[];   // encodeHandEvents(hand.events)
  startedAt: number;            // client clock, epoch ms
  finishedAt: number;
}
type PersistCompletedHandResult =
  | { ok: true; handId: string; outcome: 'PERSISTED' | 'ALREADY_PERSISTED' }
  | { ok: false; code: string; message: string };
type PersistCompletedHandAction =
  (input: PersistCompletedHandValue) => Promise<PersistCompletedHandResult>;

// apps/web/src/server/actions/hand-history.ts
export async function persistCompletedHandAction(input: unknown): Promise<PersistCompletedHandResult>;

// apps/web/src/server/hand-history-service.ts
export function persistCompletedHand(
  db: GtoDatabase, input: unknown, deps: { now: Timestamp },
): PersistCompletedHandResult;
```

Server-side sequence: zod shape → `decodeHandEvents` (engine codec, authoritative) →
`loadHand` (structural fold, authoritative) → refuse non-`COMPLETE` with `HAND_NOT_COMPLETE`
→ `getSession` (must exist) → clamp timestamps → `insertCompletedHand(..., source:
'MANUAL_PRACTICE')`. The server supplies **no id and no randomness**: the hand id is the
engine's own `handId` out of `HAND_STARTED` (ADR-0040). `code` is whatever domain layer
refused — `EngineErrorCode` or `DbErrorCode`, verbatim.

## 4. Exactly-once mechanics

The DB is the authority (`hands.id` PK + `UNIQUE(session_id, hand_number)`), and
`ALREADY_PERSISTED` is treated as **success** everywhere. On the client side a duplicate is
still refused before it is sent:

- one `SaveEntry` per `handId` in a ref-held `Map`, created only on the COMPLETE transition;
- status `PENDING → IN_FLIGHT → SAVED | FAILED`, checked in `fire()` before every dispatch;
  `IN_FLIGHT` and `SAVED` are both no-ops.

That single guard covers all five hazards the prompt (§9) names: a re-render (effect re-runs,
entry exists, `IN_FLIGHT`/`SAVED`), a Strict Mode double effect (same), repeated Next Hand (a
new hand gets its own entry; the old one is `SAVED`), a retry racing an in-flight request
(refused while `IN_FLIGHT`), and a retry after a genuine failure (allowed, and the DB answers
`ALREADY_PERSISTED` if the earlier attempt in fact landed).

Failure surface: a `role="alert"` banner listing every unsaved completed hand —
`핸드 N 기록 저장 실패 (<code>: <message>). 이 핸드는 아직 저장되지 않았습니다.` — with a
재시도 button that re-fires **the same stored log**, byte-identical (asserted). The in-memory
hand is untouched, the next hand may be dealt immediately, and the banner clears only on a
successful save.

Success surface (deliberately minimal, and it doubles as the E2E durability probe):
`stored-hand-count` in the header — the server's load-time count plus what this mount saved,
rendered `저장된 핸드 N`, or `저장된 핸드 ?` when the count itself could not be read.

## 5. Decisions taken

**Closed session: ACCEPT.** Unlike `updateSeatAutoTopUp` / `updateSeatOccupancy`, which refuse
a closed session, a completed hand is accepted. Those write session *preferences*, which a
finished sitting must not change; this writes *history that already happened*. Refusing would
destroy a hand the user really played because the sitting was ended in another tab first —
`CLAUDE.md` rule 3. The hand tables are append-only (ADR-0060), so accepting rewrites nothing
about the closed session. A session that does not exist is still `NOT_FOUND` (the FK would
refuse it anyway).

**Timestamps: clamp, never refuse.** `startedAt`/`finishedAt` are the client's clock — the
only place that knows when the hand was actually entered. Server-side each is clamped into
`[2020-01-01, now]`: a non-integer, a pre-2020 value or any future value becomes the server's
`now`. If the pair is still reversed, `startedAt` is moved to `finishedAt` (the column CHECK
requires `finished_at >= started_at`). A wrong wall clock must not cost a played hand; the
value only ever says *when*, never what happened or how much money moved.

**Hand belongs to the session:** taken from the page's own session id; the log carries no
session id to cross-check. The repository's integrity probe (session_id / hand_number / event
count) is what catches a genuinely mismatched id, and reports `CONFLICT`.

**No mid-hand appends** (ADR-0059b), and no store change: the trigger lives in the React
layer, so `tableStore.ts` stays free of any awareness of persistence.

## 6. Tests

`pnpm vitest run --project web` — **18 files, 306 tests, 306 PASS, 0 FAIL** (baseline before
this WP: 16 files / 287 tests). `pnpm exec tsc -p apps/web/tsconfig.json --noEmit` PASS.
`pnpm exec eslint apps/web --max-warnings=0` PASS. `pnpm exec playwright test` (whole suite) —
**24 PASS, 0 FAIL**.

### `src/components/table/HandHistorySave.test.tsx` (8, happy-dom, real `TableRoot`)

1. fires exactly one persist at COMPLETE, and NOTHING while the hand is still live; the
   submitted log decodes and ends in `HAND_FINISHED`; `startedAt <= finishedAt`.
2. still exactly one under React Strict Mode double effects.
3. a second hand gets its own persist, under a different `handId`.
4. a failed save shows the banner (code + message verbatim), does not revert the hand, leaves
   Start Hand enabled, and 재시도 re-fires the *identical* input; success clears the banner.
5. `ALREADY_PERSISTED` is success: no banner, count advances.
6. re-renders that do not change the hand (seat select/deselect) never re-fire.
7. a persist that never settles does not block the next deal — the next hand is dealt while it
   is still in flight, and no second call is made.
8. an unreadable stored count renders `?`, never `0`.

### `src/server/hand-history-service.test.ts` (11, node env, `openTestDatabase`)

1. round trip: `loadStoredHand` returns `events` and `state` **equal** to the hand
   `poker-core` played (hero cards, one SHOWN hand, board, award, rake); header carries
   `source = MANUAL_PRACTICE` and both timestamps.
2. exactly-once: three duplicate calls all report `ALREADY_PERSISTED`, the event rows are
   unchanged, the session lists one hand.
3. refuses a hand that is not COMPLETE (`HAND_NOT_COMPLETE`), writes nothing.
4. refuses a log the engine cannot decode, writes nothing.
5. refuses malformed shapes (`null`, a string, `{}`, an empty event array) — `INVALID_INPUT`.
6. refuses an unknown session — `NOT_FOUND`.
7. **accepts** a completed hand for a CLOSED session.
8. clamps a future client clock to the server clock and still stores.
9. clamps a 1970 / non-integer client clock and still stores.
10. orders a reversed client pair rather than refusing the write.
11. two hands of one session are stored under their own ids, in hand order.

### E2E

`tests/e2e/hand-history.spec.ts` — real browser: session with two players → count reads
`저장된 핸드 0` → a hand played to the award → the persist POST's **response** asserted `ok()`
→ count reads `저장된 핸드 1`, no failure banner → **page reload** → count still
`저장된 핸드 1` (that number is read on the SERVER from `listCompletedHandsForSession`, so it
is a database row that survived) and the live hand is gone, exactly as ADR-0059 says.

Chosen over opening the E2E sqlite file from the spec: `playwright.config.ts` derives the
throwaway DB path from `process.pid`, which differs between the config's main-process load and
each worker's, so a worker cannot reliably locate that file; and `@gto-self/db` is
ESLint-banned outside `src/server/**`. Reading the count back through the app's own server
render proves the same durability with no new surface and no config change.

**The pinned no-network assertion (`action-dock.spec.ts:79`) is unmodified and passes** — its
capture window ends at the flop, before any hand completes.

Two other specs did capture requests across a hand's completion, so their
`expect(requests).toEqual([])` became factually wrong the moment ADR-0059 shipped. Neither was
weakened; both were split so *more* is asserted than before:

- `card-palette.spec.ts` — `expect(requests).toEqual([])` now sits immediately **before** the
  award submit, pinning the entire entry path (hole cards, three streets, every action, the
  winner selection) as network-free; after completion the spec asserts the request list is
  **exactly one** POST to `/table/<id>`, i.e. the persist and nothing else.
- `seat-occupancy.spec.ts` — same split: `[]` through the toggle and the live hand, then
  exactly one POST across fold-out + next deal.

---

## 7. Residual risks / notes for downstream (C1)

1. **A never-saved hand dies with the page.** The retry queue is in-memory (a ref on the
   mounted table). If the user closes the tab while a save is failing, that hand is lost. This
   is what ADR-0059 accepts for this milestone; a durable outbox is a later phase's work.
2. **`storedHandCount` is a page-load read plus this mount's successes.** It is not live
   across tabs, and it deliberately shows `?` rather than `0` when the read failed.
3. **The banner is per hand, not per session.** Several failed hands stack as several rows,
   each with its own 재시도. Nothing auto-retries: a background retry loop against a failing
   database is noise, and the user is the one who knows whether the machine is healthy.
4. **`persistCompletedHand` and `storedHandCount` are optional props.** A `TableRoot` rendered
   without them plays exactly as Phases 4-7 did (no persistence). Component tests rely on
   that; the real route always passes both.
5. **C1 orchestration should read, not re-derive.** The analysis surface it adds belongs on
   the same page-load read path (`loadSessionView`), and its "hands to analyse" list is
   `listCompletedHandsForSession` / `listCompletedHandIdsForPlayer` — the values this WP
   already proved are populated end to end.
6. **The persist POST is now part of the table's network profile.** Any future spec asserting
   "no requests" must scope its capture to a window that does not contain a hand completion,
   or assert the persist explicitly, as the two adapted specs now do.
7. **`prompt` §36 item 17** ("persistence failure is visible, not silently swallowed") is
   covered by component test 4; items 13/14/15 remain C1's, as WP C0-B noted.
