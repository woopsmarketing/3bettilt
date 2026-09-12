/**
 * Generating `strategy_decision_traces`: what the REFERENCE engine would have recommended
 * at every Hero decision point of an already-persisted, COMPLETED hand.
 *
 * ## What this is not
 *
 * This module invents no poker fact and no strategy number. It replays the hand's own
 * `hand_events` log through `poker-core`'s own `handAtCommand` to reconstruct the exact
 * `HandState` immediately before each Hero decision, then calls `computeStrategy` — the
 * SAME function the live Strategy Panel calls, with the SAME two-argument signature
 * (`apps/web/src/lib/table/strategy.ts` — its parameter list is documented load-bearing).
 * Nothing here re-derives a frequency, a sizing, an equity number or a provenance grade;
 * every field on a stored trace is a read off `StrategyPanelReady` (CLAUDE.md rule 2).
 *
 * ## Refusals are not errors
 *
 * A decision point `computeStrategy` refuses (`REFUSED`, e.g. `HERO_UNKNOWN`,
 * `UNSUPPORTED_LINEUP`) or cannot even build a query for (`NO_HAND`) is skipped — nothing is
 * recorded for it, and the run continues to the hand's other decision points (CLAUDE.md
 * rule 7: an honest refusal is never replaced by an invented number). This function never
 * throws for a poker-shaped reason; it can only fail on a genuine storage/lookup error
 * (`DbResult`'s `err` branch).
 *
 * ## Exactly once
 *
 * `insertStrategyTraces` treats a duplicate `id` (`${handId}:${commandSeq}`) as
 * `ALREADY_PERSISTED`, a no-op for that row rather than an error, so calling this function
 * twice for the same hand writes nothing extra — recomputing is safe, just wasted work. The
 * backfill script additionally skips a hand outright when `listTracesForHand` already
 * reports rows for it, so it never needs to recompute at all.
 *
 * ## Read-only over `hands` / `hand_events` / `hand_players` / `sessions`
 *
 * The only write this module performs is `insertStrategyTraces`, into the insert-only
 * `strategy_decision_traces` table. Nothing here touches the hand history tables.
 *
 * ## Not a hot path
 *
 * This runs after a hand has already reached `COMPLETE` and has already been durably
 * persisted (`hand-history-service.ts`) — never during an interactive betting decision.
 */
import { asId, ok, type HandId } from '@gto-self/shared';
import type { Timestamp } from '@gto-self/player-core';
import { handAtCommand, isActionEvent, type HandEvent, type SeatIndex } from '@gto-self/poker-core';
import {
  dbErr,
  getHand,
  getSession,
  hands,
  insertStrategyTraces,
  listTracesForHand,
  loadStoredHand,
  type DbResult,
  type GtoDatabase,
  type StrategyDecisionTraceInsert,
  type StrategyDecisionTraceInsertResult,
  type StrategyTraceAction,
  type StrategyTraceSource,
} from '@gto-self/db';
import { computeStrategy, type StrategyActionRow } from '../lib/table/strategy.js';

/**
 * A manually-bumped tag for the REFERENCE engine's output shape/content, stored verbatim on
 * every trace this build produces. Not a poker fact — it identifies WHICH run of the engine
 * produced a row, the same way a software version does, so a later materially-changed
 * reference table shows up as a new `strategy_version` on new rows rather than silently
 * mixing with old ones. Bump it whenever `strategy-core`'s reference tables or recommendation
 * shape change in a way that would make an old trace non-comparable to a new one.
 */
const STRATEGY_VERSION = 'reference-2026-09-strategy-a-b';

/**
 * `computeStrategy`'s primary-action row translated to the schema's "recommended sizing"
 * column: the raise/bet-to amount, and ONLY for an aggressive primary (BET/RAISE/ALL_IN) —
 * `null` for FOLD/CHECK/CALL, exactly as `strategy_decision_traces.recommended_to_amount_mbb`
 * documents, even though a CALL row itself carries a (call-to) `toAmountMbb`.
 */
function recommendedToAmountOf(primary: StrategyActionRow): StrategyDecisionTraceInsert['recommendedToAmountMbb'] {
  if (primary.kind === 'BET' || primary.kind === 'RAISE' || primary.kind === 'ALL_IN') {
    return primary.toAmountMbb;
  }
  return null;
}

/** A `0..1` probability read off the panel model into the schema's integer bps column. */
function toBps(value: number | null): number | null {
  if (value === null) return null;
  return Math.min(10_000, Math.max(0, Math.round(value * 10_000)));
}

/**
 * The Hero action ACTUALLY taken at this event, or `null` when the event is not one of
 * Hero's own voluntary actions. `isActionEvent` is not a type predicate (it is shared with
 * non-narrowing callers in `poker-core`), so the cast on the way out is justified by the
 * membership check it performs: `HandEventPayload`'s `ACTION_EVENT_KINDS` members are
 * exactly `StrategyTraceAction`'s members.
 */
function heroActionTakenAt(event: HandEvent, heroSeat: SeatIndex): StrategyTraceAction | null {
  if (event.origin !== 'USER') return null;
  if (!isActionEvent(event)) return null;
  if (!('seat' in event) || event.seat !== heroSeat) return null;
  return event.kind as StrategyTraceAction;
}

export interface GenerateStrategyTracesDeps {
  /** The server's own clock reading (ADR-0040 — never read internally). */
  readonly now: Timestamp;
  /** `ONLINE` unless the caller is the backfill script. */
  readonly source?: StrategyTraceSource;
}

/**
 * Replay one COMPLETED hand and store a REFERENCE trace for every Hero decision point.
 *
 * Total over its inputs: a hand with no session, no recorded Hero seat, or no Hero decision
 * points at all is not an error — it returns `ok([])`. Only a genuine lookup/storage failure
 * (a missing hand row, a corrupt log, a write error) comes back as `err`.
 */
export function generateStrategyTracesForHand(
  db: GtoDatabase,
  handId: HandId,
  deps: GenerateStrategyTracesDeps,
): DbResult<readonly StrategyDecisionTraceInsertResult[]> {
  const source = deps.source ?? 'ONLINE';

  const handRow = getHand(db, handId);
  if (!handRow.ok) return handRow;
  if (handRow.value === null) {
    return dbErr('NOT_FOUND', `hand ${handId} does not exist`, { table: 'hands', id: handId });
  }

  const session = getSession(db, handRow.value.sessionId);
  if (!session.ok) return session;
  if (session.value === null || session.value.table.heroSeat === null) {
    // No Hero recorded for this hand's session: nothing to trace, and not this function's
    // place to invent one. Benign, not an error.
    return ok([]);
  }
  const heroSeat = session.value.table.heroSeat;

  const loaded = loadStoredHand(db, handId);
  if (!loaded.ok) return loaded;
  const hand = loaded.value;

  const rows: StrategyDecisionTraceInsert[] = [];
  for (const event of hand.events) {
    const actualHeroAction = heroActionTakenAt(event, heroSeat);
    if (actualHeroAction === null) continue;

    const commandSeq = event.commandSeq;
    // Command 0 is always `HAND_STARTED`/blinds, never a voluntary Hero action; guarded
    // defensively rather than assumed.
    if (commandSeq <= 0) continue;

    const before = handAtCommand(hand, commandSeq - 1);
    if (!before.ok) continue; // Unreachable for a well-formed stored log; skip, never throw.
    const state = before.value.state;
    if (state.phase !== 'BETTING' || state.actorSeat !== heroSeat) continue;

    const model = computeStrategy(state, heroSeat);
    if (model.kind !== 'READY') continue; // An honest refusal: record nothing (CLAUDE.md rule 7).

    rows.push({
      id: asId<'StrategyDecisionTrace'>(`${handId}:${commandSeq}`),
      handId,
      commandSeq,
      street: model.street,
      heroSeat,
      strategyMode: 'REFERENCE',
      strategyVersion: STRATEGY_VERSION,
      family: model.family,
      actions: model.actions.map((action) => ({
        action: action.kind,
        frequencyBps: action.frequencyBps,
        toAmountMbb: action.toAmountMbb,
      })),
      primaryAction: model.primary.kind,
      recommendedToAmountMbb: recommendedToAmountOf(model.primary),
      heroEquityBps: toBps(model.metrics.equity),
      potOddsBps: toBps(model.metrics.potOdds),
      spr: model.metrics.spr === null ? null : Math.max(0, Math.round(model.metrics.spr)),
      provenanceQuality: model.quality,
      environmentStatus: model.environment.status,
      actualHeroAction,
      computedAt: deps.now,
      source,
    });
  }

  return insertStrategyTraces(db, rows);
}

// ---------------------------------------------------------------------------
// Backfill support
// ---------------------------------------------------------------------------
//
// `apps/web/scripts/backfill-strategy-traces.ts` lives OUTSIDE `apps/web/src/server/`, the
// one directory ESLint permits to import `@gto-self/db` (that boundary keeps the native
// `better-sqlite3` module out of anything Next could bundle into a client component). The
// two small reads the script needs are exposed here instead, so it never imports `@gto-self/
// db` itself.

/** True when this hand already has at least one stored trace row. */
export function hasStrategyTraces(db: GtoDatabase, handId: HandId): DbResult<boolean> {
  const rows = listTracesForHand(db, handId);
  if (!rows.ok) return rows;
  return ok(rows.value.length > 0);
}

/**
 * Every hand id with `finished_at IS NOT NULL`, in no particular order — the backfill
 * script's own candidate list. A thin read, not a repository: it exists here rather than in
 * `@gto-self/db` because it is backfill-specific and this module already owns the boundary.
 */
export function listCompletedHandIds(db: GtoDatabase): readonly HandId[] {
  return db
    .select({ id: hands.id, finishedAt: hands.finishedAt })
    .from(hands)
    .all()
    .filter((row) => row.finishedAt !== null)
    .map((row) => asId<'Hand'>(row.id));
}
