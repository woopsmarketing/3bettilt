/**
 * Generating `adaptive_strategy_traces`: what 상대 적응 · ADAPTIVE would have recommended at
 * every Hero decision point of an already-persisted, COMPLETED hand, and the whole evidence
 * chain that produced it.
 *
 * ## The ADAPTIVE sibling of `strategy-trace-service.ts`
 *
 * Step for step the same replay: load the hand header and its session for the recorded Hero
 * seat, walk Hero's own voluntary actions, rebuild the exact `HandState` before each one with
 * `handAtCommand`, and ask the SAME functions the live panel asks. The only difference is that
 * there are two of them rather than one — `computeStrategy` for the REFERENCE baseline, then
 * `computeAdaptive` over the panel model it returned (`apps/web/src/lib/table/adaptive.ts`,
 * which is what `StrategyPanel` itself calls). Nothing here re-derives a frequency, a bucket,
 * a confidence or a deviation; every stored field is a read off `AdaptiveRecommendation`
 * (`CLAUDE.md` rules 2 and 5).
 *
 * ## Reusing the LIVE composition is the point, not a convenience
 *
 * The opponent inputs come from `loadAdaptiveOpponentInputs` (`adaptive-service.ts`) and from
 * nowhere else. That module is the ONLY place the `MANUAL_HUD_MAX_EFFECTIVE_N` sample cap and
 * the two source-mapping tables are applied, so assembling an `AdaptiveOpponentInput` here
 * would silently bypass the cap and make the stored trace disagree with the numbers the user
 * was shown. Same reasoning for `computeAdaptive`: a second composition path would be a second,
 * drifting answer.
 *
 * ## Refusals are not errors, and "we knew nothing" IS a record
 *
 * A decision point `computeStrategy` refuses (`REFUSED`) or cannot build a query for
 * (`NO_HAND`), or that `computeAdaptive` declines to compose over at all (`null` — an
 * `UNSUPPORTED` preflop family, where the engine itself disclaims its answer), is SKIPPED: no
 * row, and the replay continues to the hand's other decision points.
 *
 * A decision point where the composition ran but no rule cleared its confidence gate is NOT
 * skipped. `composeAdaptive` answers it as `status: 'INSUFFICIENT_DATA'` with the baseline mix
 * echoed verbatim, and that row is written. Three reasons, all load-bearing:
 *
 *   1. It is the honest record of what was known at the time (design contract §J7: a trace is
 *      a snapshot of the evidence, and "there was none" is evidence about the review).
 *   2. Skipping would make "we had no data on this opponent" indistinguishable from
 *      "generation never ran for this hand" — and the backfill script's own skip check reads
 *      exactly that difference, so a hand of entirely unknown villains would be recomputed on
 *      every backfill run, forever.
 *   3. It keeps the ADAPTIVE trace set 1:1 with the REFERENCE trace set for a hand, so a later
 *      review can diff them decision by decision without a join that silently drops rows.
 *
 * The schema was built for these rows: `ADAPTIVE_TRACE_STATUSES` documents `INSUFFICIENT_DATA`
 * as "the stored `adaptive_actions_json` IS the baseline, verbatim". Nothing is invented in
 * that state.
 *
 * ## Exactly once
 *
 * `insertAdaptiveTraces` treats a duplicate `id` (`${handId}:${commandSeq}:ADAPTIVE`) as
 * `ALREADY_PERSISTED` — a no-op for that row rather than an error — so re-running this for an
 * already-traced hand writes nothing extra. The table is insert-only and trigger-enforced: a
 * later recomposition under a new policy version is a NEW row, never a rewrite (ADR-0060/0066).
 * A trace therefore keeps agreeing with the evidence that existed when it was written even
 * after that evidence is superseded by a newer HUD or model snapshot.
 *
 * ## Read-only over everything except its own table
 *
 * `hands`, `hand_events`, `hand_players`, `sessions`, `player_hud_snapshots`,
 * `player_model_snapshots`, `strategy_decision_traces` are all read. The only write is
 * `insertAdaptiveTraces`.
 *
 * ## Not a hot path
 *
 * This runs after a hand has already reached `COMPLETE` and been durably persisted — never
 * during an interactive betting decision (ADR-0043).
 */
import { asId, ok, type HandId } from '@gto-self/shared';
import type { Timestamp } from '@gto-self/player-core';
import { handAtCommand, isActionEvent, type HandEvent, type SeatIndex } from '@gto-self/poker-core';
import type {
  AdaptiveAdjustment,
  AdaptiveOpponentSummary,
  AdaptiveRecommendation,
} from '@gto-self/adaptive-core';
import {
  dbErr,
  getHand,
  getSession,
  insertAdaptiveTraces,
  listAdaptiveTracesForHand,
  listHandSeats,
  listTracesForHand,
  loadStoredHand,
  type AdaptiveStrategyTraceInsert,
  type AdaptiveStrategyTraceInsertResult,
  type AdaptiveTraceAction,
  type AdaptiveTraceAdjustment,
  type AdaptiveTraceFrequencyDelta,
  type AdaptiveTraceSnapshotRef,
  type AdaptiveTraceSource,
  type DbResult,
  type GtoDatabase,
  type StrategyDecisionTraceId,
} from '@gto-self/db';
import type { AdaptiveOpponentInputWire, AdaptiveSeatInput } from '../lib/table/contract.js';
import { computeStrategy } from '../lib/table/strategy.js';
import { computeAdaptive } from '../lib/table/adaptive.js';
import { loadAdaptiveOpponentInputs } from './adaptive-service.js';

/**
 * Hero's own voluntary action at this event, or `null`. Identical predicate to the REFERENCE
 * service's — an ADAPTIVE trace must cover exactly the decision points a REFERENCE trace
 * covers, so the two are deliberately the same three checks rather than two similar ones.
 */
function isHeroDecision(event: HandEvent, heroSeat: SeatIndex): boolean {
  if (event.origin !== 'USER') return false;
  if (!isActionEvent(event)) return false;
  return 'seat' in event && event.seat === heroSeat;
}

/** `baseline_actions_json` / `adaptive_actions_json`: `{action, frequencyBps, toAmountMbb}`. */
function baselineActionsOf(recommendation: AdaptiveRecommendation): readonly AdaptiveTraceAction[] {
  return recommendation.baseline.actions.map((action) => ({
    action: action.kind,
    frequencyBps: action.frequencyBps,
    toAmountMbb: action.toAmountMbb,
  }));
}

function adaptiveActionsOf(recommendation: AdaptiveRecommendation): readonly AdaptiveTraceAction[] {
  return recommendation.actions.map((action) => ({
    action: action.kind,
    frequencyBps: action.frequencyBps,
    toAmountMbb: action.toAmountMbb,
  }));
}

/** `frequency_delta_json`: the SIGNED per-kind movement `adaptive - baseline`, already on the row. */
function frequencyDeltasOf(
  recommendation: AdaptiveRecommendation,
): readonly AdaptiveTraceFrequencyDelta[] {
  return recommendation.actions.map((action) => ({
    action: action.kind,
    deltaBps: action.deltaBps,
  }));
}

/**
 * `adjustments_json`: every rule that fired, WITHOUT its authored `note`.
 *
 * The note is the rule table's own prose and `ruleId` reconstructs it exactly. Copying it into
 * every row would duplicate authored text into storage, and would make re-wording a note a
 * schema-versioning problem — the stored rows would disagree with the live rule table for no
 * gain. The structured evidence (`stat`, sample, confidence, prior/observed/estimate, EACH
 * source's own reading, the deviation, the cap that clipped it, the signed contribution, the
 * reason key) is what makes the row re-arguable, and all of it is here.
 *
 * `AdaptiveStatSourceRef` is REBUILT into `AdaptiveTraceSourceRef` rather than passed through:
 * `@gto-self/db` may not import the composition layer, so the two are structurally identical
 * types that deliberately do not share a declaration. The field-by-field copy is the layering
 * rule made visible, not redundancy.
 */
function adjustmentsOf(
  adjustments: readonly AdaptiveAdjustment[],
): readonly AdaptiveTraceAdjustment[] {
  return adjustments.map((adjustment) => ({
    ruleId: adjustment.ruleId,
    stat: adjustment.stat,
    opponentPlayerId: adjustment.opponentPlayerId,
    priorBps: adjustment.priorBps,
    observedBps: adjustment.observedBps,
    estimateBps: adjustment.estimateBps,
    sampleN: adjustment.sampleN,
    confidenceBps: adjustment.confidenceBps,
    sources: adjustment.sources.map((source) => ({
      source: source.source,
      valueBps: source.valueBps,
      sampleN: source.sampleN,
      note: source.note,
    })),
    target: adjustment.target,
    contributionBps: adjustment.contributionBps,
    deviationBps: adjustment.deviationBps,
    // The one field that lets a stored trace explain a rule that moved NOTHING: with
    // `deviationBps` beside it, `cappedBy: 'AGGRESSIVE_PLAYER_BEHIND'` reads as "we saw the
    // read, and the guard refused it", not as "we saw nothing".
    cappedBy: adjustment.cappedBy,
    reasonKey: adjustment.reasonKey,
  }));
}

/**
 * The two provenance maps. One entry per opponent the composition actually considered, in the
 * recommendation's own order, with an explicit `null` when that opponent had no snapshot of
 * that kind — "this opponent had nothing" is a different fact from "this opponent was absent".
 */
function snapshotRefs(
  opponents: readonly AdaptiveOpponentSummary[],
  pick: (opponent: AdaptiveOpponentSummary) => string | null,
): readonly AdaptiveTraceSnapshotRef[] {
  return opponents.map((opponent) => ({ playerId: opponent.playerId, snapshotId: pick(opponent) }));
}

/** The `PRIMARY`-role opponent, or `null` when the ordering facts could not name one. */
function primaryVillainOf(
  recommendation: AdaptiveRecommendation,
): AdaptiveOpponentSummary | undefined {
  return recommendation.opponents.find((opponent) => opponent.role === 'PRIMARY');
}

export interface GenerateAdaptiveTracesDeps {
  /** The server's own clock reading (ADR-0040 — never read internally). */
  readonly now: Timestamp;
  /** `LIVE` unless the caller is the backfill script. */
  readonly source?: AdaptiveTraceSource;
}

/**
 * Internal. `${handId}:${commandSeq}` -> the REFERENCE trace id that exists for it.
 *
 * Read ONCE per hand rather than per decision point, and never assumed: `reference_trace_id`
 * is nullable exactly because the REFERENCE row may not have been written (a LIVE composition
 * predates it; a failed deferred call left a gap). A corrupt REFERENCE row fails this read and
 * therefore fails the whole generation, deliberately — a provenance pointer is not worth
 * guessing at, and `DbResult`'s `err` branch is where storage corruption belongs.
 */
function referenceTraceIdsFor(
  db: GtoDatabase,
  handId: HandId,
): DbResult<ReadonlyMap<number, StrategyDecisionTraceId>> {
  const traces = listTracesForHand(db, handId);
  if (!traces.ok) return traces;
  const byCommandSeq = new Map<number, StrategyDecisionTraceId>();
  for (const trace of traces.value) byCommandSeq.set(trace.commandSeq, trace.id);
  return ok(byCommandSeq);
}

/**
 * Internal. The seats of THIS hand, as the hand itself recorded them.
 *
 * Read from `hand_players`, never from whoever is sitting there now: a seat can change hands
 * between the hand being played and the trace being generated (a sit-out, a rebuy, a seat
 * correction), and a trace that named the CURRENT occupant would attribute one player's
 * evidence to another player's decision. Hero's own seat is excluded — hero is not an opponent,
 * and including it would put hero's own profile into `opponents` and both snapshot maps.
 */
function opponentSeatsOf(
  db: GtoDatabase,
  handId: HandId,
  heroSeat: SeatIndex,
): DbResult<{
  readonly seats: readonly AdaptiveSeatInput[];
  readonly seatPlayerIds: ReadonlyMap<number, string>;
}> {
  const handSeats = listHandSeats(db, handId);
  if (!handSeats.ok) return handSeats;

  const seats: AdaptiveSeatInput[] = [];
  const seatPlayerIds = new Map<number, string>();
  for (const record of handSeats.value) {
    if (record.playerId === null) continue;
    seatPlayerIds.set(record.seat, record.playerId);
    if (record.seat === heroSeat) continue;
    seats.push({
      playerId: record.playerId,
      seatIndex: record.seat,
      // Display text only. `AdaptiveOpponentInput.nickname` reaches no stored trace column —
      // the row identifies an opponent by `playerId` — so this replay does not spend a read
      // resolving a label that cannot affect a single number or a single stored byte.
      nickname: null,
    });
  }
  return ok({ seats, seatPlayerIds });
}

/**
 * Replay one COMPLETED hand and store an ADAPTIVE trace for every Hero decision point the
 * composition layer could actually answer.
 *
 * Total over its inputs in the same way its REFERENCE sibling is: a hand whose session records
 * no Hero seat, or that has no Hero decision points at all, is not an error — it returns
 * `ok([])`. Only a genuine lookup/storage failure comes back as `err`.
 *
 * ORDERING: call this AFTER `generateStrategyTracesForHand` for the same hand. The REFERENCE
 * rows are looked up, not assumed, so running it first is not a correctness failure — it just
 * stores `reference_trace_id: null`, and the table is insert-only, so the link cannot be filled
 * in afterwards.
 */
export function generateAdaptiveTracesForHand(
  db: GtoDatabase,
  handId: HandId,
  deps: GenerateAdaptiveTracesDeps,
): DbResult<readonly AdaptiveStrategyTraceInsertResult[]> {
  const source = deps.source ?? 'LIVE';

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

  const lineup = opponentSeatsOf(db, handId, heroSeat);
  if (!lineup.ok) return lineup;

  // ONCE per hand. Every opponent's HUD and learned-model rows are already written and frozen
  // by the time a completed hand is replayed, so they cannot change between this hand's
  // decision points — re-reading them per decision would be wasted work AND would let two rows
  // of the same trace disagree if a write landed mid-replay.
  const opponentInputs = loadAdaptiveOpponentInputs(db, lineup.value.seats);
  if (!opponentInputs.ok) {
    // A failed HUD / model read is a FAILURE, not an empty profile: an unreadable row and a
    // player with no rows would otherwise both silently mean "adapt against nothing".
    return dbErr(
      'STORAGE_FAILURE',
      `adaptive opponent inputs for hand ${handId}: ${opponentInputs.message}`,
      { table: 'adaptive_strategy_traces', id: handId },
    );
  }
  const inputs: readonly AdaptiveOpponentInputWire[] = opponentInputs.inputs;

  const referenceIds = referenceTraceIdsFor(db, handId);
  if (!referenceIds.ok) return referenceIds;

  const rows: AdaptiveStrategyTraceInsert[] = [];
  for (const event of hand.events) {
    if (!isHeroDecision(event, heroSeat)) continue;

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

    const recommendation = computeAdaptive(model, inputs, lineup.value.seatPlayerIds);
    // `null` only for a spot the REFERENCE engine itself disclaims (`UNSUPPORTED`). Composing
    // an exploit on top of an answer the engine does not stand behind would store a
    // player-specific number derived from a non-answer.
    if (recommendation === null) continue;

    const primaryAction = recommendation.primaryAction;
    // Structurally unreachable: REFERENCE never returns an empty action set, and
    // `primaryAction` is `null` only then. `adaptive_primary_action` is NOT NULL and there is
    // no honest value to put in it, so the decision point is skipped rather than filled in.
    if (primaryAction === null) continue;

    const primaryVillain = primaryVillainOf(recommendation);
    const sizing = recommendation.sizing;

    rows.push({
      id: asId<'AdaptiveStrategyTrace'>(`${handId}:${commandSeq}:ADAPTIVE`),
      handId,
      commandSeq,
      // The REFERENCE trace for the SAME decision point when one has been written, else null.
      referenceTraceId: referenceIds.value.get(commandSeq) ?? null,
      street: recommendation.baseline.street,
      heroSeat,
      status: recommendation.status,
      adaptivePolicyVersion: recommendation.policyVersion,
      primaryVillainPlayerId:
        primaryVillain === undefined ? null : asId<'Player'>(primaryVillain.playerId),
      // The count that DETERMINES the global shift cap (2000 bps heads-up, 1000 multiway,
      // design §4.3), so `total_shift_bps` and `cap_applied` beside it stay auditable from the
      // row alone. The number of opponents whose evidence was consulted is a different figure
      // and is already recorded, per opponent, in the two snapshot-id maps.
      opponentCount: recommendation.baseline.activeOpponentCount,
      baselineActions: baselineActionsOf(recommendation),
      adaptiveActions: adaptiveActionsOf(recommendation),
      frequencyDeltas: frequencyDeltasOf(recommendation),
      baselinePrimaryAction: recommendation.baseline.primaryKind,
      adaptivePrimaryAction: primaryAction.kind,
      // All four sizing columns come from `AdaptiveSizing` and from nothing else, so the
      // bucket and the amount on a row always describe the SAME size. Reading the amount off
      // the action rows instead would lose the moved size entirely: `AdaptiveAction.toAmountMbb`
      // echoes the baseline by design, and the adapted amount exists only here. `null` for all
      // four when REFERENCE recommended no sized action at all; `-1` in a bucket column is the
      // engine's own ALL_IN / not-a-rung sentinel, which the sizing pass never moves.
      baselineToAmountMbb: sizing === null ? null : sizing.fromToAmountMbb,
      adaptiveToAmountMbb: sizing === null ? null : sizing.toToAmountMbb,
      baselineSizingBucket: sizing === null ? null : sizing.fromBucketIndex,
      adaptiveSizingBucket: sizing === null ? null : sizing.toBucketIndex,
      totalShiftBps: recommendation.totalShiftBps,
      capApplied: recommendation.capApplied,
      adjustments: adjustmentsOf(recommendation.adjustments),
      manualHudSnapshotIds: snapshotRefs(
        recommendation.opponents,
        (opponent) => opponent.manualHudSnapshotId,
      ),
      playerModelSnapshotIds: snapshotRefs(
        recommendation.opponents,
        (opponent) => opponent.learnedSnapshotId,
      ),
      // The PRIMARY villain's learned snapshot version — the one profile that actually drove
      // the rule table (design §9). Every other opponent's snapshot id is in the maps above.
      playerModelVersion: primaryVillain?.learnedModelVersion ?? null,
      computedAt: deps.now,
      source,
    });
  }

  return insertAdaptiveTraces(db, rows);
}

// ---------------------------------------------------------------------------
// Backfill support
// ---------------------------------------------------------------------------
//
// `apps/web/scripts/backfill-adaptive-traces.ts` lives OUTSIDE `apps/web/src/server/`, the one
// directory ESLint permits to import `@gto-self/db` (that boundary keeps the native
// `better-sqlite3` module out of anything Next could bundle into a client component). The read
// the script needs is exposed here instead, exactly as `strategy-trace-service.ts` exposes its
// own. `listCompletedHandIds` is NOT duplicated here — the script imports the REFERENCE
// service's, because "every finished hand" is one question with one answer.

/** True when this hand already has at least one stored ADAPTIVE trace row. */
export function hasAdaptiveTraces(db: GtoDatabase, handId: HandId): DbResult<boolean> {
  const rows = listAdaptiveTracesForHand(db, handId);
  if (!rows.ok) return rows;
  return ok(rows.value.length > 0);
}
