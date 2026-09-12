// @vitest-environment node
//
// Server code is Node code (native SQLite binding); the happy-dom default environment has no
// `file:` `import.meta.url`, which `@gto-self/db`'s migration resolution needs.
/**
 * `generateAdaptiveTracesForHand` against a REAL migrated database.
 *
 * The hand is built through `poker-core`'s public API on a session's own stored table and the
 * opponent evidence is written through the REAL repositories, exactly like
 * `strategy-trace-service.test.ts` and `adaptive-service.test.ts` — a synthetic fixture would
 * fail the `hand_players` / `player_hud_snapshots` foreign keys rather than test anything.
 *
 * The properties that would be silent regressions if they broke:
 *
 * 1. Every JSON column ROUND-TRIPS: what this service serialized is exactly what
 *    `decodeAdaptiveStrategyTraceRow` gives back. A decoder disagreement has to fail here, at
 *    the writing boundary, rather than months later when someone reads the trace.
 * 2. Exactly-once. A second run writes nothing.
 * 3. An opponent we know NOTHING about still produces a row, as `INSUFFICIENT_DATA` with the
 *    baseline echoed. See the service header for why that is a record and not noise.
 * 4. `reference_trace_id` is a LOOKUP, not an assumption: present when the REFERENCE trace
 *    exists, `null` when it does not.
 * 5. IMMUTABILITY (ADR-0060/0066, design §J7): a later HUD snapshot cannot change a trace that
 *    was already written. The trace is a snapshot of what was known.
 * 6. The seat -> player map comes from the HAND's own seat rows, so a seat that later holds a
 *    different player still traces the player who actually played that hand.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  asId,
  Money,
  parseCards,
  sequentialIdFactory,
  unwrap,
  type PlayerId,
  type SessionId,
} from '@gto-self/shared';
import {
  DEFAULT_SNAPSHOT_CONFIDENCE_CONFIG,
  createHudSnapshot,
  createPlayer,
  snapshotConfidence,
  timestamp,
} from '@gto-self/player-core';
import type {
  HudStatInput,
  ModelStatCount,
  ModelStatKey,
  ObservedPosition,
  PlayerModelContent,
} from '@gto-self/player-core';
import {
  applyCommands,
  awardPots,
  betTo,
  call,
  CP_NL50_6MAX_ANTE,
  dealBoard,
  fold,
  raiseTo,
  seatPlayer,
  SEAT_INDEXES,
  setHoleCards,
  startHand,
  vacateSeat,
  type Hand,
  type TableState,
} from '@gto-self/poker-core';
import {
  adaptiveStrategyTraces,
  getSession,
  insertAnalysisResults,
  insertHudSnapshot,
  insertPlayer,
  listAdaptiveTracesForHand,
  listHandSeats,
  openTestDatabase,
  type AdaptiveStrategyTraceRow,
  type AnalysisRunId,
  type DatabaseHandle,
  type GtoDatabase,
  type ModelSnapshotId,
} from '@gto-self/db';
import type { SeatFormValue, SessionFormValue } from '../lib/session-setup/contract.js';
import { emptySeatForm } from '../lib/session-setup/plan.js';
import { startSession } from './session-service.js';
import { persistCompletedHand } from './hand-history-service.js';
import { generateStrategyTracesForHand } from './strategy-trace-service.js';
import { generateAdaptiveTracesForHand } from './adaptive-trace-service.js';

const NOW = timestamp(1_800_000_000_000);

function seat(overrides: Partial<SeatFormValue> = {}): SeatFormValue {
  return { ...emptySeatForm(), occupancy: 'ACTIVE', nickname: 'x', stackText: '100', ...overrides };
}

function form(): SessionFormValue {
  return {
    presetId: CP_NL50_6MAX_ANTE.presetId,
    anteEnabled: true,
    label: 'Adaptive trace session',
    buttonSeat: 0,
    autoTopUpEnabled: false,
    autoTopUpTargetText: '100',
    seats: SEAT_INDEXES.map((index) =>
      index < 3
        ? seat({ nickname: `적응 상대 ${index}`, isHero: index === 0 })
        : { ...emptySeatForm(), occupancy: 'EMPTY' as const },
    ),
  };
}

let handle: DatabaseHandle;
let db: GtoDatabase;
let sessionId: SessionId;
let table: TableState;
let runCounter = 0;

beforeEach(() => {
  handle = openTestDatabase();
  db = handle.db;
  runCounter = 0;
  const started = startSession(db, form(), { ids: sequentialIdFactory('s'), now: NOW });
  if (!started.ok) throw new Error(started.issues.map((issue) => issue.message).join('; '));
  sessionId = asId<'Session'>(started.sessionId);
  const stored = getSession(db, sessionId);
  if (!stored.ok || stored.value === null) throw new Error('the session did not come back');
  table = stored.value.table;
  expect(table.heroSeat).toBe(0);
});

/* -------------------------------------------------------------------------- */
/* The hand — Hero faces a bet on every postflop street                        */
/* -------------------------------------------------------------------------- */

/**
 * Hero (seat 0, button) opens preflop, the SB folds, the BB calls, and the BB then leads on
 * every street with Hero calling. FOUR Hero decisions: the preflop RAISE and three CALLs.
 *
 * Hero facing a bet postflop is what gives the composition a PRIMARY villain there (the last
 * aggressor on the street). In a spot where Hero closes the action there is nobody behind and
 * nobody betting, so `classifyOpponents` names no PRIMARY at all and every rule is starved by
 * construction — which would make this file test the empty case three times over.
 */
function playFacedHand(handId: string, forTable: TableState = table): Hand {
  const ids = sequentialIdFactory(`ev-${handId}`);
  const hand = unwrap(startHand(forTable, { handId: asId<'Hand'>(handId) }, ids));
  return unwrap(
    applyCommands(
      hand,
      [
        setHoleCards(0, unwrap(parseCards('Ah Kd')), false),
        raiseTo(Money.fromBB(3)),
        fold(),
        call(),
        dealBoard(unwrap(parseCards('7c 2d Ts'))),
        betTo(Money.fromBB(3)),
        call(),
        dealBoard(unwrap(parseCards('4h'))),
        betTo(Money.fromBB(6)),
        call(),
        dealBoard(unwrap(parseCards('9s'))),
        betTo(Money.fromBB(12)),
        call(),
        setHoleCards(2, unwrap(parseCards('Qs Jc')), true),
        awardPots([{ potIndex: 0, winners: [0] }]),
      ],
      ids,
    ),
  );
}

function persist(hand: Hand): void {
  const result = persistCompletedHand(
    db,
    {
      sessionId,
      events: hand.events.map((event) => ({ ...event })),
      startedAt: 1_799_999_700_000,
      finishedAt: 1_799_999_800_000,
    },
    { now: NOW },
  );
  if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
}

/** The player who actually sat in `seatIndex` for this hand, per `hand_players`. */
function playerAt(handId: string, seatIndex: number): PlayerId {
  const seats = listHandSeats(db, asId<'Hand'>(handId));
  if (!seats.ok) throw new Error(seats.error.message);
  const found = seats.value.find((record) => record.seat === seatIndex);
  if (found === undefined || found.playerId === null) {
    throw new Error(`hand ${handId} has no player at seat ${seatIndex}`);
  }
  return found.playerId;
}

/* -------------------------------------------------------------------------- */
/* Opponent evidence — real repository writes only                             */
/* -------------------------------------------------------------------------- */

const EIGHT_HUD_READINGS: readonly HudStatInput[] = [
  { key: 'VPIP', enteredText: '31' },
  { key: 'PFR', enteredText: '24' },
  { key: 'THREE_BET', enteredText: '11' },
  { key: 'FOLD_TO_THREE_BET', enteredText: '58' },
  { key: 'CBET_FLOP', enteredText: '78' },
  { key: 'FOLD_TO_CBET_FLOP', enteredText: '34' },
  { key: 'WTSD', enteredText: '35' },
  { key: 'WON_AT_SHOWDOWN', enteredText: '51' },
];

function writeHud(playerId: PlayerId, id: string, handSample: number | null = 900): void {
  const built = createHudSnapshot({
    id: asId<'Snapshot'>(id),
    playerId,
    recordedAt: NOW,
    handSample,
    stats: EIGHT_HUD_READINGS,
  });
  if (!built.ok) throw new Error(built.error.message);
  const written = insertHudSnapshot(db, built.value);
  if (!written.ok) throw new Error(written.error.message);
}

const count = (
  key: ModelStatKey,
  position: ObservedPosition | null,
  opportunities: number,
  actions: number,
): ModelStatCount => ({
  key,
  position,
  opportunities,
  actions,
  confidence: snapshotConfidence(opportunities, DEFAULT_SNAPSHOT_CONFIDENCE_CONFIG),
});

function modelContent(
  playerId: PlayerId,
  globalStats: readonly ModelStatCount[],
): PlayerModelContent {
  const sourceObservationCount = globalStats.reduce((sum, row) => sum + row.opportunities, 0);
  return {
    playerId,
    analysisAlgorithmVersion: 1,
    inputHash: `hash-${playerId}-${sourceObservationCount}`,
    sourceHandCount: 400,
    sourceObservationCount,
    sourceShowCount: 0,
    globalStats,
    spotStats: [],
    showEvidence: [],
    betSizes: [],
    confidence: {
      k: DEFAULT_SNAPSHOT_CONFIDENCE_CONFIG.k,
      learningThreshold: DEFAULT_SNAPSHOT_CONFIDENCE_CONFIG.learningThreshold,
      knownThreshold: DEFAULT_SNAPSHOT_CONFIDENCE_CONFIG.knownThreshold,
      overall: snapshotConfidence(400, DEFAULT_SNAPSHOT_CONFIDENCE_CONFIG),
    },
  };
}

/** Writes one learned snapshot through the real analysis repository, which assigns its version. */
function writeModel(playerId: PlayerId, globalStats: readonly ModelStatCount[]): ModelSnapshotId {
  runCounter += 1;
  const snapshotId = asId<'ModelSnapshot'>(`snap-${runCounter}`) as ModelSnapshotId;
  const written = insertAnalysisResults(db, {
    runId: asId<'AnalysisRun'>(`run-${runCounter}`) as AnalysisRunId,
    sessionId,
    startedAt: NOW,
    finishedAt: timestamp(NOW + 10),
    algorithmVersion: 1,
    status: 'SUCCESS',
    handCount: 400,
    observationCount: globalStats.reduce((sum, row) => sum + row.opportunities, 0),
    showCount: 0,
    players: [
      {
        outcome: 'SNAPSHOT_CREATED',
        playerId,
        snapshotId,
        content: modelContent(playerId, globalStats),
        createdAt: timestamp(NOW + 10),
      },
    ],
  });
  if (!written.ok) throw new Error(written.error.message);
  return snapshotId;
}

/** A villain who c-bets far more than the prior on every street, over a real denominator. */
const RELENTLESS_BETTOR: readonly ModelStatCount[] = [
  count('CBET_FLOP', null, 140, 118),
  count('CBET_TURN', null, 110, 92),
  count('CBET_RIVER', null, 90, 74),
  count('THREE_BET', null, 220, 34),
  count('FOLD_TO_CBET_FLOP', null, 130, 96),
  count('WTSD', null, 180, 68),
];

/** A villain who three-bets far more than the prior — read at Hero's preflop open. */
const THREE_BETTOR: readonly ModelStatCount[] = [count('THREE_BET', null, 240, 42)];

/** Both villains of the hand, with real HUD rows and real learned snapshots. */
function giveBothVillainsEvidence(handId: string): {
  readonly sbPlayerId: PlayerId;
  readonly bbPlayerId: PlayerId;
} {
  const sbPlayerId = playerAt(handId, 1);
  const bbPlayerId = playerAt(handId, 2);
  writeHud(sbPlayerId, 'hud-sb');
  writeHud(bbPlayerId, 'hud-bb');
  writeModel(sbPlayerId, THREE_BETTOR);
  writeModel(bbPlayerId, RELENTLESS_BETTOR);
  return { sbPlayerId, bbPlayerId };
}

/* -------------------------------------------------------------------------- */
/* Raw-row access, for the round-trip and immutability assertions              */
/* -------------------------------------------------------------------------- */

function rawRows(handId: string): readonly AdaptiveStrategyTraceRow[] {
  return db
    .select()
    .from(adaptiveStrategyTraces)
    .all()
    .filter((row) => row.handId === handId)
    .sort((a, b) => a.commandSeq - b.commandSeq);
}

function decodedRows(handId: string) {
  const listed = listAdaptiveTracesForHand(db, asId<'Hand'>(handId));
  if (!listed.ok) throw new Error(`${listed.error.code}: ${listed.error.message}`);
  return listed.value;
}

function generate(handId: string, source?: 'LIVE' | 'BACKFILL') {
  const result = generateAdaptiveTracesForHand(db, asId<'Hand'>(handId), { now: NOW, source });
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.value;
}

/* -------------------------------------------------------------------------- */

describe('generateAdaptiveTracesForHand', () => {
  it('writes one row per Hero decision, and every JSON column round-trips through the decoder', () => {
    const hand = playFacedHand('hand-adaptive');
    persist(hand);
    const { bbPlayerId } = giveBothVillainsEvidence('hand-adaptive');

    const written = generate('hand-adaptive');
    // Preflop RAISE + a CALL on each of flop/turn/river.
    expect(written).toHaveLength(4);
    expect(written.every((row) => row.outcome === 'PERSISTED')).toBe(true);

    // `listAdaptiveTracesForHand` decodes every row through `decodeAdaptiveStrategyTraceRow`,
    // so reaching this line at all proves the decoder accepted everything that was written.
    const traces = decodedRows('hand-adaptive');
    expect(traces).toHaveLength(4);
    expect(traces.map((trace) => trace.street)).toEqual(['PREFLOP', 'FLOP', 'TURN', 'RIVER']);

    for (const trace of traces) {
      expect(trace.handId).toBe('hand-adaptive');
      expect(trace.heroSeat).toBe(0);
      expect(trace.source).toBe('LIVE');
      expect(trace.computedAt).toBe(NOW);
      expect(trace.adaptivePolicyVersion.length).toBeGreaterThan(0);
      expect(trace.id).toBe(`hand-adaptive:${trace.commandSeq}:ADAPTIVE`);
      expect(['ADAPTED', 'INSUFFICIENT_DATA']).toContain(trace.status);

      // Both mixes are legal: baseline on REFERENCE's 500-bps grid, adaptive on the 100-bps grid, both summing to exactly 10000.
      for (const set of [trace.baselineActions, trace.adaptiveActions]) {
        expect(set.length).toBeGreaterThan(0);
        expect(set.reduce((sum, action) => sum + action.frequencyBps, 0)).toBe(10_000);
      }
      expect(trace.adaptiveActions.every((action) => action.frequencyBps % 100 === 0)).toBe(true);

      // The deltas are the two mixes' own difference, not a separately computed number.
      const baselineBy = new Map(trace.baselineActions.map((a) => [a.action, a.frequencyBps]));
      for (const delta of trace.frequencyDeltas) {
        const adapted = trace.adaptiveActions.find((a) => a.action === delta.action);
        expect(adapted).toBeDefined();
        expect(delta.deltaBps).toBe(
          (adapted?.frequencyBps ?? 0) - (baselineBy.get(delta.action) ?? 0),
        );
      }

      // Both provenance maps name every opponent the composition considered, and the two
      // agree on that list.
      expect(trace.manualHudSnapshotIds.map((ref) => ref.playerId)).toEqual(
        trace.playerModelSnapshotIds.map((ref) => ref.playerId),
      );
      expect(trace.opponentCount).toBeGreaterThanOrEqual(1);
      expect(trace.totalShiftBps).toBeGreaterThanOrEqual(0);
    }

    // At least one decision point actually adapted, with its whole evidence chain stored.
    const adapted = traces.filter((trace) => trace.status === 'ADAPTED');
    expect(adapted.length).toBeGreaterThan(0);
    for (const trace of adapted) {
      expect(trace.adjustments.length).toBeGreaterThan(0);
      for (const adjustment of trace.adjustments) {
        expect(adjustment.ruleId.length).toBeGreaterThan(0);
        expect(adjustment.stat.length).toBeGreaterThan(0);
        expect(adjustment.reasonKey.length).toBeGreaterThan(0);
        expect(adjustment.sampleN).toBeGreaterThan(0);
        expect(adjustment.confidenceBps).toBeGreaterThanOrEqual(2500);
        expect(adjustment.sources.length).toBeGreaterThan(0);
        // The read's own size, reconcilable against the two fields it came from.
        expect(adjustment.deviationBps).toBe(adjustment.estimateBps - adjustment.priorBps);
        for (const source of adjustment.sources) {
          expect(['MANUAL_HUD', 'LEARNED_MODEL']).toContain(source.source);
          // Each source keeps its OWN reading and denominator. The pooled estimate is a
          // blend; without the split, a 12-hand manual entry and a 900-observation model read
          // back as the same evidence, and the trace can never be rewritten to say otherwise.
          expect(source.valueBps).toBeGreaterThanOrEqual(0);
          expect(source.valueBps).toBeLessThanOrEqual(10_000);
          expect(source.sampleN).toBeGreaterThanOrEqual(0);
        }
        // The pooled denominator is the sources' own sum, so a dropped source is visible.
        expect(adjustment.sampleN).toBe(
          adjustment.sources.reduce((sum, source) => sum + source.sampleN, 0),
        );
        // The authored rule note is deliberately NOT stored: `ruleId` reconstructs it.
        expect(Object.keys(adjustment)).not.toContain('note');
      }
    }

    // The postflop decisions face the BB's bet, so the BB is the PRIMARY villain there and
    // its learned model version is the one recorded.
    const flop = traces[1];
    expect(flop?.primaryVillainPlayerId).toBe(bbPlayerId);
    expect(flop?.playerModelVersion).toBe(1);

    // ROUND TRIP: the decoded structures are exactly the JSON that was stored — no field is
    // dropped, added or reshaped between `JSON.stringify` here and the decoder there.
    const raws = rawRows('hand-adaptive');
    expect(raws).toHaveLength(4);
    for (const [index, raw] of raws.entries()) {
      const trace = traces[index];
      expect(JSON.parse(raw.baselineActionsJson)).toEqual(trace?.baselineActions);
      expect(JSON.parse(raw.adaptiveActionsJson)).toEqual(trace?.adaptiveActions);
      expect(JSON.parse(raw.frequencyDeltaJson)).toEqual(trace?.frequencyDeltas);
      expect(JSON.parse(raw.adjustmentsJson)).toEqual(trace?.adjustments);
      expect(JSON.parse(raw.manualHudSnapshotIdsJson)).toEqual(trace?.manualHudSnapshotIds);
      expect(JSON.parse(raw.playerModelSnapshotIdsJson)).toEqual(trace?.playerModelSnapshotIds);
    }
  });

  it('stores how big each read was and WHICH ceiling clipped it, not just the outcome', () => {
    // The trace table is INSERT-ONLY. A contribution alone cannot distinguish "this opponent
    // was unremarkable here" from "this opponent was extreme and a ceiling held the rule
    // back", and no later write can add the difference back. So both facts are written now.
    const hand = playFacedHand('hand-capped');
    persist(hand);
    // A villain so far past the prior that every rule reading them wants more than its own
    // ceiling allows — the only way `cappedBy` is reachable through the real service.
    writeModel(playerAt('hand-capped', 2), [
      count('CBET_FLOP', null, 4000, 3880),
      count('CBET_TURN', null, 3000, 2900),
      count('CBET_RIVER', null, 2500, 2400),
      count('FOLD_TO_CBET_FLOP', null, 3000, 2850),
    ]);
    generate('hand-capped');

    const capped = decodedRows('hand-capped').flatMap((trace) => trace.adjustments);
    expect(capped.length).toBeGreaterThan(0);

    // `deviationBps` is the read itself, and it agrees with the two numbers it is derived
    // from. A writer that dropped the field and stored a constant fails here.
    for (const adjustment of capped) {
      expect(adjustment.deviationBps).toBe(adjustment.estimateBps - adjustment.priorBps);
    }

    const clipped = capped.filter((adjustment) => adjustment.cappedBy !== null);
    expect(clipped.length).toBeGreaterThan(0);
    for (const adjustment of clipped) {
      expect(adjustment.cappedBy).toBe('RULE_MAX');
      // The evidence outran what the rule was allowed to do with it — which is precisely the
      // thing a reader six months later cannot otherwise reconstruct.
      expect(Math.abs(adjustment.contributionBps)).toBeLessThan(Math.abs(adjustment.deviationBps));
    }
  });

  it('records NO cap when nothing held a rule back, so cappedBy is a signal not a constant', () => {
    const hand = playFacedHand('hand-uncapped');
    persist(hand);
    giveBothVillainsEvidence('hand-uncapped');
    generate('hand-uncapped');

    const ordinary = decodedRows('hand-uncapped').flatMap((trace) => trace.adjustments);
    expect(ordinary.length).toBeGreaterThan(0);
    expect(ordinary.every((adjustment) => adjustment.cappedBy === null)).toBe(true);
    // The reads are real, they simply fit inside every ceiling.
    expect(ordinary.some((adjustment) => adjustment.deviationBps !== 0)).toBe(true);
  });

  it('is exactly-once: a second run persists nothing and changes no row', () => {
    const hand = playFacedHand('hand-twice');
    persist(hand);
    giveBothVillainsEvidence('hand-twice');

    const first = generate('hand-twice');
    expect(first.every((row) => row.outcome === 'PERSISTED')).toBe(true);
    const before = rawRows('hand-twice');

    const second = generate('hand-twice');
    expect(second.every((row) => row.outcome === 'ALREADY_PERSISTED')).toBe(true);
    expect(rawRows('hand-twice')).toEqual(before);
    expect(rawRows('hand-twice')).toHaveLength(4);
  });

  it('still records a decision point when NOTHING is known about the opponents', () => {
    const hand = playFacedHand('hand-unknown');
    persist(hand);
    // Deliberately no HUD row and no learned snapshot for either villain.

    const written = generate('hand-unknown');
    expect(written).toHaveLength(4);

    const traces = decodedRows('hand-unknown');
    expect(traces).toHaveLength(4);
    for (const trace of traces) {
      expect(trace.status).toBe('INSUFFICIENT_DATA');
      expect(trace.adjustments).toEqual([]);
      // The honest record: the adapted mix IS the baseline, verbatim, and nothing moved.
      expect(
        trace.adaptiveActions.map((a) => ({ action: a.action, frequencyBps: a.frequencyBps })),
      ).toEqual(
        trace.baselineActions.map((a) => ({ action: a.action, frequencyBps: a.frequencyBps })),
      );
      expect(trace.frequencyDeltas.every((delta) => delta.deltaBps === 0)).toBe(true);
      expect(trace.totalShiftBps).toBe(0);
      expect(trace.capApplied).toBe(false);
      // Provenance is still recorded, as an explicit "this opponent had no snapshot".
      expect(trace.manualHudSnapshotIds.every((ref) => ref.snapshotId === null)).toBe(true);
      expect(trace.playerModelSnapshotIds.every((ref) => ref.snapshotId === null)).toBe(true);
      expect(trace.playerModelVersion).toBeNull();
    }
  });

  it('links reference_trace_id when the REFERENCE trace exists, and leaves it null when it does not', () => {
    const linked = playFacedHand('hand-linked');
    persist(linked);
    // A second hand in the same session takes the next hand number (UNIQUE(session, number)).
    const unlinked = playFacedHand('hand-unlinked', { ...table, handNumber: 1 });
    persist(unlinked);
    giveBothVillainsEvidence('hand-linked');

    // REFERENCE first, for this hand only — the ordering `actions/hand-history.ts` schedules.
    const reference = generateStrategyTracesForHand(db, asId<'Hand'>('hand-linked'), { now: NOW });
    expect(reference.ok).toBe(true);

    generate('hand-linked');
    for (const trace of decodedRows('hand-linked')) {
      expect(trace.referenceTraceId).toBe(`hand-linked:${trace.commandSeq}`);
    }

    // The second hand never had its REFERENCE traces generated: the link is honestly null
    // rather than pointing at a row that does not exist.
    generate('hand-unlinked');
    for (const trace of decodedRows('hand-unlinked')) {
      expect(trace.referenceTraceId).toBeNull();
    }
  });

  it('is immutable: a NEW HUD snapshot afterwards does not alter a stored trace (ADR-0060/0066)', () => {
    const hand = playFacedHand('hand-frozen');
    persist(hand);
    const { bbPlayerId } = giveBothVillainsEvidence('hand-frozen');

    generate('hand-frozen');
    const before = rawRows('hand-frozen');
    expect(before).toHaveLength(4);
    const beforeJson = JSON.stringify(before);

    // A completely different HUD reading for the same villain, written the way the app writes
    // one: a NEW insert-only row, never an update.
    const replacement = createHudSnapshot({
      id: asId<'Snapshot'>('hud-bb-2'),
      playerId: bbPlayerId,
      recordedAt: timestamp(NOW + 60_000),
      handSample: 5,
      stats: [
        { key: 'CBET_FLOP', enteredText: '4' },
        { key: 'FOLD_TO_CBET_FLOP', enteredText: '95' },
        { key: 'WTSD', enteredText: '2' },
      ],
    });
    if (!replacement.ok) throw new Error(replacement.error.message);
    const inserted = insertHudSnapshot(db, replacement.value);
    expect(inserted.ok).toBe(true);

    // Byte-identical: the trace is a snapshot of what was known when it was written.
    expect(JSON.stringify(rawRows('hand-frozen'))).toBe(beforeJson);

    // And a re-run over the new evidence still writes nothing — the existing rows stand.
    const rerun = generate('hand-frozen');
    expect(rerun.every((row) => row.outcome === 'ALREADY_PERSISTED')).toBe(true);
    expect(JSON.stringify(rawRows('hand-frozen'))).toBe(beforeJson);
  });

  it("traces the players who were in the hand's own seats, not the seat's current occupant", () => {
    const original = playFacedHand('hand-original');
    persist(original);
    const originalBb = playerAt('hand-original', 2);

    // A DIFFERENT person takes seat 2 and plays the next hand there.
    const newcomer = createPlayer({
      id: asId<'Player'>('newcomer'),
      nickname: '새 상대',
      createdAt: NOW,
    });
    if (!newcomer.ok) throw new Error(newcomer.error.message);
    const storedNewcomer = insertPlayer(db, newcomer.value);
    if (!storedNewcomer.ok) throw new Error(storedNewcomer.error.message);

    const reseated = unwrap(
      seatPlayer(vacateSeat(table, 2), 2, asId<'Player'>('newcomer'), Money.fromBB(100)),
    );
    const later = playFacedHand('hand-later', { ...reseated, handNumber: 1 });
    persist(later);
    expect(playerAt('hand-later', 2)).toBe('newcomer');

    // The evidence belongs to the ORIGINAL occupant; the newcomer has none.
    giveBothVillainsEvidence('hand-original');

    // The older hand is traced AFTER the seat changed hands.
    generate('hand-original');
    const originalTraces = decodedRows('hand-original');
    const originalPlayers = new Set(
      originalTraces.flatMap((trace) => trace.manualHudSnapshotIds.map((ref) => ref.playerId)),
    );
    expect(originalPlayers.has(originalBb)).toBe(true);
    expect(originalPlayers.has('newcomer')).toBe(false);
    expect(originalTraces[1]?.primaryVillainPlayerId).toBe(originalBb);

    generate('hand-later');
    const laterTraces = decodedRows('hand-later');
    const laterPlayers = new Set(
      laterTraces.flatMap((trace) => trace.manualHudSnapshotIds.map((ref) => ref.playerId)),
    );
    expect(laterPlayers.has('newcomer')).toBe(true);
    expect(laterPlayers.has(originalBb)).toBe(false);
    expect(laterTraces[1]?.primaryVillainPlayerId).toBe('newcomer');
  });
});
