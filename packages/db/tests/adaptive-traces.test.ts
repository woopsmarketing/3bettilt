/**
 * `adaptive_strategy_traces` — the DERIVED ADAPTIVE trace layer (WP-J design §7).
 *
 * The properties under test are the ones the audit trail rests on:
 *
 * 1. What goes in comes back out: every JSON document decoded into the same typed structure
 *    that was handed in, including the evidence array that makes an adaptive number
 *    defensible rather than asserted (`CLAUDE.md` rule 3).
 * 2. A re-submitted decision point writes NOTHING and says so, so a re-render or a retry
 *    converges instead of accumulating.
 * 3. A duplicated id inside ONE call is refused before anything is written.
 * 4. The insert-only guarantee is the DATABASE's, not the repository's: a raw UPDATE and a
 *    raw DELETE through the driver both abort and the row survives.
 * 5. A corrupt JSON document is a typed `CORRUPT_ROW` on read, never a plausible object and
 *    never a crash (`CLAUDE.md` rule 5).
 * 6. The foreign keys are enforced — an adaptive trace for a hand that does not exist is
 *    refused.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  asId,
  isOk,
  Money,
  unwrap,
  type HandId,
  type PlayerId,
  type SessionId,
} from '@gto-self/shared';
import { createPlayer, timestamp } from '@gto-self/player-core';
import { insertCompletedHand } from '../src/repositories/hands.js';
import { insertPlayer } from '../src/repositories/players.js';
import { insertSession } from '../src/repositories/sessions.js';
import { insertStrategyTraces } from '../src/repositories/strategy-traces.js';
import {
  getAdaptiveTrace,
  insertAdaptiveTraces,
  listAdaptiveTracesForHand,
} from '../src/repositories/adaptive-traces.js';
import {
  adaptiveStrategyTraces,
  openTestDatabase,
  type AdaptiveStrategyTrace,
  type AdaptiveStrategyTraceId,
  type DatabaseHandle,
  type StrategyDecisionTraceId,
} from '../src/index.js';
import {
  buildShowdownFixtureHand,
  buildShowdownTable,
  withoutInsertOnlyGuards,
} from './fixture.js';

const T0 = timestamp(1_700_000_000_000);
const T1 = timestamp(1_700_000_060_000);
const SESSION = asId<'Session'>('sess-1') as SessionId;
const HAND = asId<'Hand'>('hand-showdown-1') as HandId;
const SEAT = (n: number): PlayerId => asId<'Player'>(`seat-${n}`) as PlayerId;
const REFERENCE_TRACE = asId<'StrategyDecisionTrace'>('hand-showdown-1:0');
const ADAPTIVE_TRACE = asId<'AdaptiveStrategyTrace'>('hand-showdown-1:0:ADAPTIVE');

/** SQLite reports an aborted trigger with the RAISE message, not a constraint marker. */
const INSERT_ONLY = /is insert-only/u;

/**
 * A FULL trace: every JSON array non-empty, both sizing buckets present, both money columns
 * present, an adjustment carrying its whole evidence chain, and both snapshot maps holding a
 * present and an absent snapshot. A column this fixture leaves at its default is a column
 * the round-trip does not actually prove.
 */
function fullTrace(over: Partial<AdaptiveStrategyTrace> = {}): AdaptiveStrategyTrace {
  return {
    id: ADAPTIVE_TRACE,
    handId: HAND,
    commandSeq: 0,
    referenceTraceId: REFERENCE_TRACE,
    street: 'FLOP',
    heroSeat: 0,
    status: 'ADAPTED',
    adaptivePolicyVersion: 'adaptive-policy-v1',
    primaryVillainPlayerId: SEAT(2),
    opponentCount: 2,
    baselineActions: [
      { action: 'BET', frequencyBps: 5_500, toAmountMbb: Money.mbb(5_000) },
      { action: 'CHECK', frequencyBps: 4_500, toAmountMbb: null },
    ],
    adaptiveActions: [
      { action: 'BET', frequencyBps: 7_500, toAmountMbb: Money.mbb(6_700) },
      { action: 'CHECK', frequencyBps: 2_500, toAmountMbb: null },
    ],
    frequencyDeltas: [
      { action: 'BET', deltaBps: 2_000 },
      { action: 'CHECK', deltaBps: -2_000 },
    ],
    baselinePrimaryAction: 'BET',
    adaptivePrimaryAction: 'BET',
    baselineToAmountMbb: Money.mbb(5_000),
    adaptiveToAmountMbb: Money.mbb(6_700),
    baselineSizingBucket: 3,
    adaptiveSizingBucket: 4,
    totalShiftBps: 1_850,
    capApplied: true,
    adjustments: [
      {
        ruleId: 'FOLD_TO_CBET_HIGH',
        stat: 'FOLD_TO_CBET_FLOP',
        opponentPlayerId: 'seat-2',
        priorBps: 4_500,
        observedBps: 7_100,
        estimateBps: 5_827,
        sampleN: 42,
        confidenceBps: 5_122,
        sources: [
          // The two readings that were pooled into `estimateBps`, kept apart: a thin manual
          // entry and a real model denominator are NOT the same evidence.
          { source: 'MANUAL_HUD', valueBps: 7_500, sampleN: 12, note: 'HUD 표본 수 미입력' },
          { source: 'LEARNED_MODEL', valueBps: 7_000, sampleN: 30, note: null },
        ],
        target: 'AGGRESSION',
        contributionBps: 1_000,
        deviationBps: 1_327,
        cappedBy: 'RULE_MAX',
        reasonKey: 'OPPONENT_OVERFOLDS_FLOP',
      },
      {
        ruleId: 'CHECK_RAISE_HIGH',
        stat: 'CHECK_RAISE_FLOP',
        opponentPlayerId: 'seat-2',
        priorBps: 800,
        observedBps: 400,
        estimateBps: 700,
        sampleN: 25,
        confidenceBps: 3_846,
        sources: [{ source: 'LEARNED_MODEL', valueBps: 400, sampleN: 25, note: null }],
        target: 'AGGRESSION',
        // SIGNED: a de-escalating rule moves mass the other way.
        contributionBps: -250,
        deviationBps: -100,
        // Nothing held this one back; it got everything it asked for.
        cappedBy: null,
        reasonKey: 'OPPONENT_CHECK_RAISES',
      },
      {
        // THE GUARD-RAIL ROW. A rule that moved nothing is still recorded, and the pair
        // (large `deviationBps`, `contributionBps: 0`, `cappedBy`) is the only thing that can
        // tell a later reader "we saw the read and REFUSED it" apart from "we saw nothing".
        // The trace is insert-only, so if this is not written now it can never be recovered.
        ruleId: 'FOLD_TO_CBET_HIGH',
        stat: 'FOLD_TO_CBET_FLOP',
        opponentPlayerId: 'seat-3',
        priorBps: 4_500,
        observedBps: 8_000,
        estimateBps: 7_100,
        sampleN: 120,
        confidenceBps: 8_000,
        sources: [{ source: 'LEARNED_MODEL', valueBps: 8_000, sampleN: 120, note: null }],
        target: 'AGGRESSION',
        contributionBps: 0,
        deviationBps: 2_600,
        cappedBy: 'AGGRESSIVE_PLAYER_BEHIND',
        reasonKey: 'OPPONENT_OVERFOLDS_FLOP',
      },
    ],
    manualHudSnapshotIds: [
      { playerId: 'seat-2', snapshotId: 'hud-1' },
      { playerId: 'seat-3', snapshotId: null },
    ],
    playerModelSnapshotIds: [
      { playerId: 'seat-2', snapshotId: 'model-1' },
      { playerId: 'seat-3', snapshotId: null },
    ],
    playerModelVersion: 3,
    computedAt: T1,
    source: 'LIVE',
    ...over,
  };
}

describe('adaptive strategy trace persistence', () => {
  let handle: DatabaseHandle;

  beforeEach(() => {
    handle = openTestDatabase();
    for (const seat of [0, 1, 2, 3] as const) {
      unwrap(
        insertPlayer(
          handle.db,
          unwrap(createPlayer({ id: SEAT(seat), nickname: `Seat ${seat}`, createdAt: T0 })),
        ),
      );
    }
    unwrap(
      insertSession(handle.db, {
        id: SESSION,
        label: null,
        presetId: null,
        table: buildShowdownTable(),
        createdAt: T0,
        updatedAt: T0,
        closedAt: null,
        autoTopUp: null,
        seatAutoTopUp: {},
        seatStackUnverified: {},
      }),
    );
    unwrap(
      insertCompletedHand(handle.db, {
        sessionId: SESSION,
        hand: buildShowdownFixtureHand(),
        startedAt: T0,
        finishedAt: T1,
      }),
    );
    unwrap(
      insertStrategyTraces(handle.db, [
        {
          id: REFERENCE_TRACE,
          handId: HAND,
          commandSeq: 0,
          street: 'FLOP',
          heroSeat: 0,
          strategyMode: 'REFERENCE',
          strategyVersion: 'strategy-v1',
          family: 'CBET_IP',
          actions: [{ action: 'BET', frequencyBps: 10_000, toAmountMbb: Money.mbb(5_000) }],
          primaryAction: 'BET',
          recommendedToAmountMbb: Money.mbb(5_000),
          heroEquityBps: 5_200,
          potOddsBps: 3_300,
          spr: 4,
          provenanceQuality: 'HEURISTIC',
          environmentStatus: 'OK',
          actualHeroAction: 'BET',
          computedAt: T1,
          source: 'ONLINE',
        },
      ]),
    );
    return () => handle.close();
  });

  const rowCount = (): number =>
    (
      handle.sqlite.prepare(`select count(*) as n from adaptive_strategy_traces`).get() as {
        readonly n: number;
      }
    ).n;

  // -------------------------------------------------------------------------
  // round trip
  // -------------------------------------------------------------------------

  it('round-trips a full trace: every JSON document comes back as the structure that went in', () => {
    const trace = fullTrace();
    expect(unwrap(insertAdaptiveTraces(handle.db, [trace]))).toEqual([
      { id: ADAPTIVE_TRACE, outcome: 'PERSISTED' },
    ]);

    expect(unwrap(getAdaptiveTrace(handle.db, ADAPTIVE_TRACE))).toEqual(trace);
    expect(unwrap(listAdaptiveTracesForHand(handle.db, HAND))).toEqual([trace]);
  });

  it('reads back a nullable-everything INSUFFICIENT_DATA trace unchanged', () => {
    const trace = fullTrace({
      status: 'INSUFFICIENT_DATA',
      referenceTraceId: null,
      primaryVillainPlayerId: null,
      adaptiveToAmountMbb: null,
      baselineToAmountMbb: null,
      baselineSizingBucket: null,
      adaptiveSizingBucket: null,
      totalShiftBps: 0,
      capApplied: false,
      adjustments: [],
      playerModelVersion: null,
      source: 'BACKFILL',
    });
    unwrap(insertAdaptiveTraces(handle.db, [trace]));
    expect(unwrap(getAdaptiveTrace(handle.db, ADAPTIVE_TRACE))).toEqual(trace);
  });

  it('keeps a REFUSED rule distinguishable from an absent one after the round trip', () => {
    unwrap(insertAdaptiveTraces(handle.db, [fullTrace()]));

    const stored = unwrap(getAdaptiveTrace(handle.db, ADAPTIVE_TRACE));
    expect(stored).not.toBeNull();
    const guarded = stored?.adjustments.find((entry) => entry.opponentPlayerId === 'seat-3');

    // The rule contributed nothing — and the row still carries WHY, plus the size of the read
    // it was refused on. Without both fields this is indistinguishable from a rule that saw a
    // perfectly ordinary opponent, and an insert-only row can never be corrected later.
    expect(guarded?.contributionBps).toBe(0);
    expect(guarded?.cappedBy).toBe('AGGRESSIVE_PLAYER_BEHIND');
    expect(guarded?.deviationBps).toBe(2_600);

    // ...and a rule that WAS unconstrained still says so, so `cappedBy` is a real signal
    // rather than a field that is always populated.
    const free = stored?.adjustments.find((entry) => entry.ruleId === 'CHECK_RAISE_HIGH');
    expect(free?.cappedBy).toBeNull();
    expect(free?.deviationBps).toBe(-100);
  });

  it('returns null for an id that was never written', () => {
    expect(unwrap(getAdaptiveTrace(handle.db, asId<'AdaptiveStrategyTrace'>('nope')))).toBeNull();
    expect(unwrap(listAdaptiveTracesForHand(handle.db, HAND))).toEqual([]);
    expect(unwrap(insertAdaptiveTraces(handle.db, []))).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // exactly once
  // -------------------------------------------------------------------------

  it('re-submitting the same decision point writes NOTHING and reports ALREADY_PERSISTED', () => {
    expect(unwrap(insertAdaptiveTraces(handle.db, [fullTrace()]))[0]?.outcome).toBe('PERSISTED');
    // A different composition under the SAME id must not overwrite the stored one either.
    const second = unwrap(
      insertAdaptiveTraces(handle.db, [fullTrace({ totalShiftBps: 9_999, capApplied: false })]),
    );
    expect(second).toEqual([{ id: ADAPTIVE_TRACE, outcome: 'ALREADY_PERSISTED' }]);
    expect(rowCount()).toBe(1);
    expect(unwrap(getAdaptiveTrace(handle.db, ADAPTIVE_TRACE))?.totalShiftBps).toBe(1_850);
  });

  it('REFUSES a duplicate id inside one call and writes nothing at all', () => {
    const result = insertAdaptiveTraces(handle.db, [fullTrace(), fullTrace()]);
    expect(isOk(result)).toBe(false);
    if (!isOk(result)) expect(result.error.code).toBe('INVALID_INPUT');
    expect(rowCount()).toBe(0);
  });

  it('writes a whole batch in ONE transaction', () => {
    const written = unwrap(
      insertAdaptiveTraces(handle.db, [
        fullTrace(),
        fullTrace({
          id: asId<'AdaptiveStrategyTrace'>('hand-showdown-1:4:ADAPTIVE'),
          commandSeq: 4,
          street: 'TURN',
        }),
      ]),
    );
    expect(written.map((row) => row.outcome)).toEqual(['PERSISTED', 'PERSISTED']);
    // `command_seq` ascending, which is decision order.
    expect(unwrap(listAdaptiveTracesForHand(handle.db, HAND)).map((row) => row.commandSeq)).toEqual(
      [0, 4],
    );
  });

  // -------------------------------------------------------------------------
  // the database's guarantee, not the repository's
  // -------------------------------------------------------------------------

  it('REJECTS a raw UPDATE and a raw DELETE, and the row survives both', () => {
    unwrap(insertAdaptiveTraces(handle.db, [fullTrace()]));

    expect(() =>
      handle.sqlite.prepare(`update adaptive_strategy_traces set total_shift_bps = 0`).run(),
    ).toThrow(INSERT_ONLY);
    expect(() => handle.sqlite.prepare(`delete from adaptive_strategy_traces`).run()).toThrow(
      INSERT_ONLY,
    );
    // ... and through the barrel-exported table object, which is the import a later phase
    // would actually write.
    expect(() =>
      handle.db.update(adaptiveStrategyTraces).set({ status: 'INSUFFICIENT_DATA' }).run(),
    ).toThrow(INSERT_ONLY);
    expect(() => handle.db.delete(adaptiveStrategyTraces).run()).toThrow(INSERT_ONLY);

    expect(rowCount()).toBe(1);
    expect(unwrap(getAdaptiveTrace(handle.db, ADAPTIVE_TRACE))).toEqual(fullTrace());
  });

  // -------------------------------------------------------------------------
  // corruption is reported, never guessed at
  // -------------------------------------------------------------------------

  it('reports a corrupt adjustments_json as CORRUPT_ROW rather than crashing or passing', () => {
    unwrap(insertAdaptiveTraces(handle.db, [fullTrace()]));
    // Simulates a file corrupted BY OTHER MEANS — nothing in `src/` can reach this state.
    withoutInsertOnlyGuards(handle, () => {
      handle.sqlite
        .prepare(`update adaptive_strategy_traces set adjustments_json = '[{"ruleId":1}]'`)
        .run();
    });

    const result = getAdaptiveTrace(handle.db, ADAPTIVE_TRACE);
    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(result.error.code).toBe('CORRUPT_ROW');
      expect(result.error.context.field).toBe('adjustments_json[0].ruleId');
    }
  });

  it('reports a non-null, non-string cappedBy as CORRUPT_ROW rather than coercing it', () => {
    unwrap(insertAdaptiveTraces(handle.db, [fullTrace()]));
    // A row whose cap field went missing entirely: `undefined` must NOT read back as "nothing
    // capped this rule", because that is a materially different claim about the hand.
    withoutInsertOnlyGuards(handle, () => {
      handle.sqlite
        .prepare(
          `update adaptive_strategy_traces
             set adjustments_json = json_remove(adjustments_json, '$[0].cappedBy')`,
        )
        .run();
    });

    const result = getAdaptiveTrace(handle.db, ADAPTIVE_TRACE);
    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(result.error.code).toBe('CORRUPT_ROW');
      expect(result.error.context.field).toBe('adjustments_json[0].cappedBy');
    }
  });

  it('reports an out-of-vocabulary action inside a JSON mix as CORRUPT_ROW', () => {
    unwrap(insertAdaptiveTraces(handle.db, [fullTrace()]));
    withoutInsertOnlyGuards(handle, () => {
      handle.sqlite
        .prepare(
          `update adaptive_strategy_traces set adaptive_actions_json = '[{"action":"SHOVE","frequencyBps":10000,"toAmountMbb":null}]'`,
        )
        .run();
    });

    const result = getAdaptiveTrace(handle.db, ADAPTIVE_TRACE);
    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(result.error.code).toBe('CORRUPT_ROW');
      expect(result.error.context.field).toBe('adaptive_actions_json[0].action');
    }
  });

  it('reports unparseable JSON as CORRUPT_ROW rather than throwing', () => {
    unwrap(insertAdaptiveTraces(handle.db, [fullTrace()]));
    withoutInsertOnlyGuards(handle, () => {
      handle.sqlite
        .prepare(`update adaptive_strategy_traces set frequency_delta_json = '{not json'`)
        .run();
    });

    const result = getAdaptiveTrace(handle.db, ADAPTIVE_TRACE);
    expect(isOk(result)).toBe(false);
    if (!isOk(result)) expect(result.error.code).toBe('CORRUPT_ROW');
  });

  // -------------------------------------------------------------------------
  // referential integrity
  // -------------------------------------------------------------------------

  it('REFUSES a trace for a hand that does not exist', () => {
    const result = insertAdaptiveTraces(handle.db, [
      fullTrace({
        id: asId<'AdaptiveStrategyTrace'>('no-such-hand:0:ADAPTIVE'),
        handId: asId<'Hand'>('no-such-hand') as HandId,
        referenceTraceId: null,
      }),
    ]);
    expect(isOk(result)).toBe(false);
    expect(rowCount()).toBe(0);
  });

  it('REFUSES a trace pointing at a REFERENCE trace or a villain that does not exist', () => {
    for (const broken of [
      fullTrace({
        referenceTraceId: asId<'StrategyDecisionTrace'>('no-such-trace') as StrategyDecisionTraceId,
      }),
      fullTrace({ primaryVillainPlayerId: asId<'Player'>('no-such-player') as PlayerId }),
    ]) {
      expect(isOk(insertAdaptiveTraces(handle.db, [broken]))).toBe(false);
    }
    expect(rowCount()).toBe(0);
  });

  it('REFUSES a second trace for the same (hand_id, command_seq) under a different id', () => {
    unwrap(insertAdaptiveTraces(handle.db, [fullTrace()]));
    const result = insertAdaptiveTraces(handle.db, [
      fullTrace({ id: 'hand-showdown-1:0:ADAPTIVE-v2' as AdaptiveStrategyTraceId }),
    ]);
    expect(isOk(result)).toBe(false);
    expect(rowCount()).toBe(1);
  });
});
