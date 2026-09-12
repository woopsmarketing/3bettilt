// @vitest-environment node
//
// Server code is Node code: it opens a native SQLite binding and `@gto-self/db` resolves its
// migrations folder from `import.meta.url`, which is not a `file:` URL under the project's
// default happy-dom environment. The DOM is irrelevant to everything here.
/**
 * The `HudStatKey` / `ModelStatKey` -> `AdaptiveStatKey` mapping, against a REAL migrated
 * database, over rows written through the REAL repositories.
 *
 * Nothing here is mocked, and that is the point: every property under test is a property of
 * what actually comes back out of SQLite, not of a hand-written literal that happens to look
 * like it. The four that would be silent regressions if they broke:
 *
 * 1. **The `MANUAL_HUD_MAX_EFFECTIVE_N` clamp.** `adaptive-core` deliberately does NOT apply
 *    it (`buildAdjustmentProfile` takes `sampleN` at face value so the trace cannot disagree
 *    with the maths), so this file is the ONLY thing that proves a 40,000-hand HUD is read as
 *    1,000 — and that the user is told so.
 * 2. **`FOLD_BB_TO_STEAL` reads the `position: 'BB'` row.** The fixture below gives the `null`
 *    aggregate and the BB row DIFFERENT numbers, so an accidental alias back to the aggregate
 *    changes an asserted value instead of passing quietly.
 * 3. **`opportunities === 0` emits nothing.** "Never had the chance" must not become 0%.
 * 4. **Manual and learned readings are not merged here.** Two sources for one stat stay two
 *    observations; pooling is `buildAdjustmentProfile`'s job and both survive into `sources`.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { asId, sequentialIdFactory } from '@gto-self/shared';
import type { SessionId } from '@gto-self/shared';
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
  insertAnalysisResults,
  insertExternalHudSnapshot,
  insertHudSnapshot,
  insertPlayer,
  latestHudSnapshotForPlayer,
  openTestDatabase,
  type AnalysisRunId,
  type DatabaseHandle,
  type GtoDatabase,
  type ModelSnapshotId,
} from '@gto-self/db';
import { createExternalHudSnapshot } from '@gto-self/player-core';
import type { ExternalHudStatInput } from '@gto-self/player-core';
import {
  buildAdjustmentProfile,
  manualHudSampleCap,
  MANUAL_HUD_MAX_CONFIDENCE_BPS,
} from '@gto-self/adaptive-core';
import type { AdaptiveStatObservation } from '@gto-self/adaptive-core';
import {
  EXTERNAL_HUD_GENERIC_APPLIED_PER_STREET_NOTE,
  EXTERNAL_HUD_SCOPE_NOTE,
  FOLD_BB_TO_STEAL_SCOPE_NOTE,
  HUD_SAMPLE_MISSING_NOTE,
  STEAL_SCOPE_NOTE,
  loadAdaptiveOpponentInput,
  loadAdaptiveOpponentInputs,
} from './adaptive-service.js';
import { startFixtureSession } from '../../tests/support/analysis-fixture.js';

const NOW = timestamp(1_800_000_000_000);
const VILLAIN = asId<'Player'>('villain-1');

let handle: DatabaseHandle;
let db: GtoDatabase;
/** A real `sessions` row, because `analysis_runs.session_id` is a restrict FK. */
let sessionId: SessionId;
let runCounter = 0;

beforeEach(() => {
  handle = openTestDatabase();
  db = handle.db;
  runCounter = 0;
  // The fixture session seats its own two players; the villain below is a separate row, which
  // is legal — a snapshot's player does not have to be in the run's scoping session.
  sessionId = startFixtureSession(db, {
    label: 'adaptive-fixture',
    nicknames: ['히어로', '상대'],
    ids: sequentialIdFactory('sess'),
    now: NOW,
  }).sessionId;

  const player = createPlayer({ id: VILLAIN, nickname: '빌런', createdAt: NOW });
  if (!player.ok) throw new Error(player.error.message);
  const written = insertPlayer(db, player.value);
  if (!written.ok) throw new Error(written.error.message);
});

afterEach(() => {
  handle.close();
});

/* -------------------------------------------------------------------------- */
/* Fixtures — real repository writes only                                      */
/* -------------------------------------------------------------------------- */

function writeHud(stats: readonly HudStatInput[], handSample: number | null, id = 'hud-1'): void {
  const built = createHudSnapshot({
    id: asId<'Snapshot'>(id),
    playerId: VILLAIN,
    recordedAt: NOW,
    handSample,
    stats,
  });
  if (!built.ok) throw new Error(built.error.message);
  const written = insertHudSnapshot(db, built.value);
  if (!written.ok) throw new Error(written.error.message);
}

function writeExternal(stats: readonly ExternalHudStatInput[], id = 'external-1'): void {
  const built = createExternalHudSnapshot({
    id: asId<'Snapshot'>(id),
    playerId: VILLAIN,
    recordedAt: NOW,
    importBatchId: 'batch-1',
    stats,
  });
  if (!built.ok) throw new Error(built.error.message);
  const written = insertExternalHudSnapshot(db, built.value);
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

/**
 * A minimal but REAL `PlayerModelContent`: global stats only. The spot, bet-size and
 * show-evidence tables are exercised by `packages/db`'s own round-trip test; the mapping
 * under test here reads `globalStats` and nothing else.
 */
function modelContent(globalStats: readonly ModelStatCount[]): PlayerModelContent {
  const sourceObservationCount = globalStats.reduce((sum, row) => sum + row.opportunities, 0);
  return {
    playerId: VILLAIN,
    analysisAlgorithmVersion: 1,
    inputHash: `hash-${globalStats.length}-${sourceObservationCount}`,
    sourceHandCount: 250,
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
      overall: snapshotConfidence(250, DEFAULT_SNAPSHOT_CONFIDENCE_CONFIG),
    },
  };
}

/** Writes one snapshot through the real analysis repository, which assigns its version. */
function writeModel(globalStats: readonly ModelStatCount[]): ModelSnapshotId {
  runCounter += 1;
  const snapshotId = asId<'ModelSnapshot'>(`snap-${runCounter}`) as ModelSnapshotId;
  const written = insertAnalysisResults(db, {
    runId: asId<'AnalysisRun'>(`run-${runCounter}`) as AnalysisRunId,
    sessionId,
    startedAt: NOW,
    finishedAt: timestamp(NOW + 10),
    algorithmVersion: 1,
    status: 'SUCCESS',
    handCount: 250,
    observationCount: globalStats.reduce((sum, row) => sum + row.opportunities, 0),
    showCount: 0,
    players: [
      {
        outcome: 'SNAPSHOT_CREATED',
        playerId: VILLAIN,
        snapshotId,
        content: modelContent(globalStats),
        createdAt: timestamp(NOW + 10),
      },
    ],
  });
  if (!written.ok) throw new Error(written.error.message);
  return snapshotId;
}

/** The input for the villain, or a thrown failure message. */
function load(seatIndex = 3, nickname: string | null = '빌런') {
  const result = loadAdaptiveOpponentInput(db, VILLAIN, seatIndex, nickname);
  if (!result.ok) throw new Error(result.message);
  return result.input;
}

const bySource = (
  observations: readonly AdaptiveStatObservation[],
  source: AdaptiveStatObservation['source'],
): readonly AdaptiveStatObservation[] => observations.filter((o) => o.source === source);

const find = (
  observations: readonly AdaptiveStatObservation[],
  key: AdaptiveStatObservation['key'],
  source: AdaptiveStatObservation['source'],
): AdaptiveStatObservation => {
  const hit = observations.find((o) => o.key === key && o.source === source);
  if (hit === undefined) throw new Error(`no ${source} observation for ${key}`);
  return hit;
};

/** The eight readings the manual HUD vocabulary can carry, with distinct values. */
const ALL_EIGHT: readonly HudStatInput[] = [
  { key: 'VPIP', enteredText: '28.5' },
  { key: 'PFR', enteredText: '21' },
  { key: 'THREE_BET', enteredText: '9.25' },
  { key: 'FOLD_TO_THREE_BET', enteredText: '61' },
  { key: 'CBET_FLOP', enteredText: '72.5' },
  { key: 'FOLD_TO_CBET_FLOP', enteredText: '38' },
  { key: 'WTSD', enteredText: '31.75' },
  { key: 'WON_AT_SHOWDOWN', enteredText: '54' },
];

/* -------------------------------------------------------------------------- */
/* MANUAL_HUD                                                                  */
/* -------------------------------------------------------------------------- */

describe('MANUAL_HUD mapping (WP-J design contract §2.3)', () => {
  it('maps all eight HUD keys, renames WON_AT_SHOWDOWN to WSD, and assigns the value', () => {
    writeHud(ALL_EIGHT, 400);
    const input = load();
    const manual = bySource(input.observations, 'MANUAL_HUD');

    expect(manual.map((o) => o.key)).toEqual([
      'VPIP',
      'PFR',
      'THREE_BET',
      'FOLD_TO_THREE_BET',
      'CBET_FLOP',
      'FOLD_TO_CBET_FLOP',
      'WTSD',
      'WSD',
    ]);
    // The rename is the only interesting row: `player-core` calls it WON_AT_SHOWDOWN.
    expect(manual.some((o) => o.key === 'WSD')).toBe(true);

    // `valueBps = reading.value` is an ASSIGNMENT: CentiPercent and bps are the same unit.
    // Asserted against what the DATABASE actually stored, not against a literal, so a
    // conversion sneaking in on either side of the boundary shows up here.
    const stored = latestHudSnapshotForPlayer(db, VILLAIN);
    if (!stored.ok || stored.value === null) throw new Error('no stored snapshot');
    for (const reading of stored.value.stats) {
      const adaptiveKey = reading.key === 'WON_AT_SHOWDOWN' ? 'WSD' : reading.key;
      expect(find(manual, adaptiveKey, 'MANUAL_HUD').valueBps).toBe(reading.value);
    }
    // And the same numbers, spelled out, so the unit itself is pinned.
    expect(find(manual, 'VPIP', 'MANUAL_HUD').valueBps).toBe(2850);
    expect(find(manual, 'THREE_BET', 'MANUAL_HUD').valueBps).toBe(925);
    expect(find(manual, 'WSD', 'MANUAL_HUD').valueBps).toBe(5400);

    // 400 typed hands is far above every per-stat cap, so each reading is capped to its
    // OWN `floor(K / 2)` rather than sharing one flat number.
    for (const observation of manual) {
      expect(observation.sampleN).toBe(manualHudSampleCap(observation.key));
      // Review R1 MAJOR 3: the scope caveat is UNCONDITIONAL. A HUD hand count is not this
      // stat's opportunity count, and the common case used to ship with no note at all.
      expect(observation.note).not.toBeNull();
    }

    expect(input.manualHudSnapshotId).toBe('hud-1');
    expect(input.manualHudRecordedAt).toBe(NOW);
    expect(input.learnedSnapshotId).toBeNull();
    expect(input.learnedModelVersion).toBeNull();
    expect(input.seatIndex).toBe(3);
    expect(input.nickname).toBe('빌런');
  });

  it('CLAMPS a 40,000-hand HUD to that stat’s own cap and says so in the note', () => {
    writeHud(ALL_EIGHT, 40_000);
    const manual = bySource(load().observations, 'MANUAL_HUD');

    expect(manual).toHaveLength(8);
    for (const observation of manual) {
      expect(observation.sampleN).toBe(manualHudSampleCap(observation.key));
      // The user must be able to SEE that their 40,000-hand HUD was not read at face value.
      expect(observation.note).not.toBeNull();
      expect(observation.note).toContain('40000');
      expect(observation.note).toContain('유효 표본');
    }
  });

  it('holds a HUD-only profile at a third of full confidence, whatever is typed', () => {
    // Review R1 MAJOR 3. The old flat cap of 1000 was 25x the largest per-stat K and damped
    // nothing: 500 typed hands reached ~93% confidence on a street-scoped stat. The per-stat
    // `floor(K / 2)` cap makes the reachable ceiling `(K/2) / ((K/2) + K) = 1/3` for EVERY
    // stat — so typed testimony can move a FREQUENCY (gate 2500) but can never on its own
    // move a bet SIZE (gate 5000 heads-up / 7500 multiway).
    writeHud(ALL_EIGHT, 40_000);
    const profile = buildAdjustmentProfile(load());
    for (const key of ['VPIP', 'FOLD_TO_CBET_FLOP', 'WTSD', 'CBET_FLOP'] as const) {
      expect(profile.stats[key].confidenceBps).toBeLessThanOrEqual(MANUAL_HUD_MAX_CONFIDENCE_BPS);
      expect(profile.stats[key].confidenceBps).toBeGreaterThan(2500);
      expect(profile.stats[key].confidenceBps).toBeLessThan(5000);
    }
  });

  it('a HUD with no hand count carries sampleN 0 and the missing-sample note', () => {
    writeHud(ALL_EIGHT, null);
    const manual = bySource(load().observations, 'MANUAL_HUD');

    expect(manual).toHaveLength(8);
    expect(manual.every((o) => o.sampleN === 0)).toBe(true);
    // The note is the unconditional scope caveat PLUS the missing-sample marker.
    expect(manual.every((o) => o.note?.includes(HUD_SAMPLE_MISSING_NOTE))).toBe(true);

    // Zero weight is the consequence that matters: nothing moves off the anchor.
    const profile = buildAdjustmentProfile(load());
    expect(profile.stats.VPIP.confidenceBps).toBe(0);
    expect(profile.stats.VPIP.deviationBps).toBe(0);
    // The reading is still SUPPLIED, and is still shown — it simply carries no weight.
    expect(profile.stats.VPIP.available).toBe(true);
    expect(profile.stats.VPIP.sources[0]?.valueBps).toBe(2850);
  });

  it('only the readings the user actually entered become observations', () => {
    writeHud([{ key: 'VPIP', enteredText: '28.5' }], 200);
    const manual = bySource(load().observations, 'MANUAL_HUD');
    expect(manual).toHaveLength(1);
    expect(manual[0]?.key).toBe('VPIP');
  });

  it('reads the LATEST snapshot, never an older one', () => {
    writeHud([{ key: 'VPIP', enteredText: '10' }], 200, 'hud-old');
    const later = createHudSnapshot({
      id: asId<'Snapshot'>('hud-new'),
      playerId: VILLAIN,
      recordedAt: timestamp(NOW + 60_000),
      handSample: 300,
      stats: [{ key: 'VPIP', enteredText: '40' }],
    });
    if (!later.ok) throw new Error(later.error.message);
    const written = insertHudSnapshot(db, later.value);
    if (!written.ok) throw new Error(written.error.message);

    const input = load();
    expect(find(input.observations, 'VPIP', 'MANUAL_HUD').valueBps).toBe(4000);
    expect(input.manualHudSnapshotId).toBe('hud-new');
    expect(input.manualHudRecordedAt).toBe(NOW + 60_000);
  });
});

/* -------------------------------------------------------------------------- */
/* LEARNED_MODEL                                                               */
/* -------------------------------------------------------------------------- */

describe('LEARNED_MODEL mapping (WP-J design contract §2.3)', () => {
  it('maps the twelve stats, with FOLD_BB_TO_STEAL read from the BB row and not the aggregate', () => {
    const snapshotId = writeModel([
      count('VPIP', null, 300, 87),
      count('PFR', null, 300, 66),
      count('RFI', null, 300, 70), // unmapped
      count('STEAL_ATTEMPT', null, 120, 48),
      // The trap: the `null` AGGREGATE mixes SB and BB defence and is NOT fold-BB-to-steal.
      count('FOLD_TO_STEAL', null, 100, 30),
      // The only row that means "folded the BIG BLIND to a steal".
      count('FOLD_TO_STEAL', 'BB', 40, 34),
      count('THREE_BET', null, 200, 14),
      count('FOLD_TO_THREE_BET', null, 50, 31),
      count('FOUR_BET', null, 20, 3), // unmapped
      count('CBET_FLOP', null, 90, 58),
      count('CBET_TURN', null, 60, 27),
      count('CBET_RIVER', null, 30, 11),
      count('FOLD_TO_CBET_FLOP', null, 80, 46),
      count('FOLD_TO_CBET_TURN', null, 40, 22),
      count('FOLD_TO_CBET_RIVER', null, 20, 9),
      count('CHECK_RAISE_FLOP', null, 70, 6),
      count('CHECK_RAISE_TURN', null, 45, 3),
      count('CHECK_RAISE_RIVER', null, 25, 1),
      count('TURN_BARREL', null, 60, 27), // unmapped
      count('RIVER_BARREL', null, 30, 11), // unmapped
      count('WTSD', null, 3, 1),
      count('WSD', null, 44, 25),
    ]);

    const input = load();
    const learned = bySource(input.observations, 'LEARNED_MODEL');

    expect(learned.map((o) => o.key)).toEqual([
      'VPIP',
      'PFR',
      'STEAL',
      'FOLD_BB_TO_STEAL',
      'THREE_BET',
      'FOLD_TO_THREE_BET',
      'CBET_FLOP',
      'CBET_TURN',
      'CBET_RIVER',
      'FOLD_TO_CBET_FLOP',
      'FOLD_TO_CBET_TURN',
      'FOLD_TO_CBET_RIVER',
      'CHECK_RAISE_FLOP',
      'CHECK_RAISE_TURN',
      'CHECK_RAISE_RIVER',
      'WTSD',
      'WSD',
    ]);

    // THE ANTI-ALIASING ASSERTION. The BB row is 34/40 = 8500 bps over n=40; the aggregate
    // is 30/100 = 3000 bps over n=100. Reading the aggregate would fail both numbers.
    const foldBb = find(learned, 'FOLD_BB_TO_STEAL', 'LEARNED_MODEL');
    expect(foldBb.valueBps).toBe(8500);
    expect(foldBb.sampleN).toBe(40);
    expect(foldBb.note).toBe(FOLD_BB_TO_STEAL_SCOPE_NOTE);
    expect(foldBb.valueBps).not.toBe(3000);
    expect(foldBb.sampleN).not.toBe(100);

    // STEAL carries STEAL_ATTEMPT's own scope, verbatim.
    const steal = find(learned, 'STEAL', 'LEARNED_MODEL');
    expect(steal.valueBps).toBe(4000);
    expect(steal.sampleN).toBe(120);
    expect(steal.note).toBe(STEAL_SCOPE_NOTE);

    // `sampleN` is the stat's OWN opportunity count, and the rate is rounded to bps.
    expect(find(learned, 'CBET_FLOP', 'LEARNED_MODEL')).toMatchObject({
      valueBps: 6444, // 10000 * 58 / 90 = 6444.44…
      sampleN: 90,
      note: null,
    });
    expect(find(learned, 'WTSD', 'LEARNED_MODEL')).toMatchObject({
      valueBps: 3333, // 10000 * 1 / 3 = 3333.33…
      sampleN: 3,
    });

    expect(input.learnedSnapshotId).toBe(snapshotId);
    expect(input.learnedModelVersion).toBe(1);
    expect(input.manualHudSnapshotId).toBeNull();
    expect(input.manualHudRecordedAt).toBeNull();
  });

  it('a stat with zero opportunities produces NO observation — never 0%', () => {
    writeModel([
      count('VPIP', null, 300, 87),
      count('CHECK_RAISE_RIVER', null, 0, 0),
      count('FOLD_TO_CBET_RIVER', null, 0, 0),
    ]);
    const learned = bySource(load().observations, 'LEARNED_MODEL');

    expect(learned.map((o) => o.key)).toEqual(['VPIP']);
    expect(learned.some((o) => o.key === 'CHECK_RAISE_RIVER')).toBe(false);
    expect(learned.some((o) => o.key === 'FOLD_TO_CBET_RIVER')).toBe(false);

    // And downstream the stat reads as genuinely unknown, not as "never check-raises".
    const profile = buildAdjustmentProfile(load());
    expect(profile.stats.CHECK_RAISE_RIVER.available).toBe(false);
    expect(profile.stats.CHECK_RAISE_RIVER.sampleN).toBe(0);
    expect(profile.stats.CHECK_RAISE_RIVER.deviationBps).toBe(0);
  });

  it('a FOLD_TO_STEAL with only a null aggregate row yields no FOLD_BB_TO_STEAL at all', () => {
    // No BB row exists, so there is no honest fold-BB-to-steal reading. The aggregate is
    // NOT promoted into one.
    writeModel([count('FOLD_TO_STEAL', null, 100, 30), count('VPIP', null, 300, 87)]);
    const learned = bySource(load().observations, 'LEARNED_MODEL');
    expect(learned.map((o) => o.key)).toEqual(['VPIP']);
  });

  it('reads the LATEST snapshot version', () => {
    writeModel([count('VPIP', null, 100, 20)]);
    writeModel([count('VPIP', null, 100, 60)]);
    const input = load();
    expect(input.learnedModelVersion).toBe(2);
    expect(find(input.observations, 'VPIP', 'LEARNED_MODEL').valueBps).toBe(6000);
  });
});

/* -------------------------------------------------------------------------- */
/* EXTERNAL_HUD (WP-K)                                                         */
/* -------------------------------------------------------------------------- */

describe('EXTERNAL_HUD observations', () => {
  it('maps VPIP/PFR/STEAL/WTSD/WSD directly, and fans the generic street-blind keys out to their own key PLUS all three per-street policy keys', () => {
    writeExternal([
      { key: 'VPIP', enteredText: '29' },
      { key: 'CBET_ANY_STREET', enteredText: '67' },
      { key: 'FOLD_TO_CBET_ANY_STREET', enteredText: '26' },
      { key: 'CHECK_RAISE_ANY_STREET', enteredText: '7' },
    ]);
    const external = bySource(load().observations, 'EXTERNAL_HUD');
    // Each generic key is stored/displayed under its own ANY_STREET key AND ALSO reaches the
    // three per-street keys the existing frequency/sizing rules actually select on — otherwise
    // none of those rules would ever see it (WP-K §3/§7, see `adaptive-service.ts`).
    expect(external.map((o) => o.key).sort()).toEqual(
      [
        'VPIP',
        'CBET_ANY_STREET',
        'CBET_FLOP',
        'CBET_TURN',
        'CBET_RIVER',
        'FOLD_TO_CBET_ANY_STREET',
        'FOLD_TO_CBET_FLOP',
        'FOLD_TO_CBET_TURN',
        'FOLD_TO_CBET_RIVER',
        'CHECK_RAISE_ANY_STREET',
        'CHECK_RAISE_FLOP',
        'CHECK_RAISE_TURN',
        'CHECK_RAISE_RIVER',
      ].sort(),
    );
    expect(find(external, 'VPIP', 'EXTERNAL_HUD').valueBps).toBe(2_900);
    // The fanned-out per-street reading carries the exact same value as its generic source.
    expect(find(external, 'CBET_FLOP', 'EXTERNAL_HUD').valueBps).toBe(6_700);
    expect(find(external, 'CBET_TURN', 'EXTERNAL_HUD').valueBps).toBe(6_700);
    expect(find(external, 'CBET_RIVER', 'EXTERNAL_HUD').valueBps).toBe(6_700);
  });

  it('sampleN is always 0 — an external profile never carries a real opportunity count', () => {
    writeExternal([{ key: 'VPIP', enteredText: '29' }]);
    expect(find(load().observations, 'VPIP', 'EXTERNAL_HUD').sampleN).toBe(0);
  });

  it('marks a fanned-out per-street reading as street-blind, verbatim, for the UI', () => {
    writeExternal([{ key: 'CHECK_RAISE_ANY_STREET', enteredText: '17' }]);
    const external = bySource(load().observations, 'EXTERNAL_HUD');
    // The reading AS REPORTED keeps the plain lifetime note.
    expect(find(external, 'CHECK_RAISE_ANY_STREET', 'EXTERNAL_HUD').note).toBe(
      EXTERNAL_HUD_SCOPE_NOTE,
    );
    // Every stand-in says so, in Korean, on the line the strategy panel renders verbatim —
    // so a river check-raise number can never read as a river-specific measurement (WP-K
    // follow-up §3).
    for (const key of ['CHECK_RAISE_FLOP', 'CHECK_RAISE_TURN', 'CHECK_RAISE_RIVER'] as const) {
      expect(find(external, key, 'EXTERNAL_HUD').note).toBe(
        EXTERNAL_HUD_GENERIC_APPLIED_PER_STREET_NOTE,
      );
    }
    expect(EXTERNAL_HUD_GENERIC_APPLIED_PER_STREET_NOTE).toContain('스트리트 구분 없음');
  });

  it('carries the lifetime-scope note on every reading', () => {
    writeExternal([{ key: 'VPIP', enteredText: '29' }]);
    expect(find(load().observations, 'VPIP', 'EXTERNAL_HUD').note).toBe(
      '외부 HUD · 전체 기간(라이프타임) 기록',
    );
  });

  it('a stat the profile does not cover produces no observation at all', () => {
    writeExternal([{ key: 'VPIP', enteredText: '35' }]);
    expect(bySource(load().observations, 'EXTERNAL_HUD')).toHaveLength(1);
  });

  it('records the snapshot id and timestamp as provenance', () => {
    writeExternal([{ key: 'VPIP', enteredText: '29' }], 'external-42');
    const input = load();
    expect(input.externalHudSnapshotId).toBe('external-42');
    expect(input.externalHudRecordedAt).toBe(NOW);
  });

  it('a player with no external profile gets no EXTERNAL_HUD observations and null provenance', () => {
    writeHud([{ key: 'VPIP', enteredText: '28.5' }], 400);
    const input = load();
    expect(bySource(input.observations, 'EXTERNAL_HUD')).toHaveLength(0);
    expect(input.externalHudSnapshotId).toBeNull();
    expect(input.externalHudRecordedAt).toBeNull();
  });

  it('composes through buildAdjustmentProfile at the fixed policy confidence, ignoring a manual reading for the same stat', () => {
    writeExternal([{ key: 'VPIP', enteredText: '35' }]);
    writeHud([{ key: 'VPIP', enteredText: '20' }], 5_000);
    const profile = buildAdjustmentProfile(load());
    const vpip = profile.stats.VPIP;
    expect(vpip.sources).toEqual([{ source: 'EXTERNAL_HUD', valueBps: 3_500, sampleN: 0, note: '외부 HUD · 전체 기간(라이프타임) 기록' }]);
  });
});

/**
 * WP-K FOLLOW-UP §3 — REAL PER-STREET EVIDENCE BEATS THE GENERIC STAND-IN.
 *
 * The external HUD reports one lifetime `Check/Raise` with no street breakdown, and the
 * service fans it out to `CHECK_RAISE_{FLOP,TURN,RIVER}` so the rules can read it at all.
 * `EXTERNAL_HUD` also takes per-stat precedence over every other source. Left alone, those two
 * facts compose into a bug: a street-blind PROXY silently overriding a `CHECK_RAISE_RIVER`
 * this app measured itself over real river opportunities. The fan-out therefore skips exactly
 * the per-street keys a real reading already covers, so the two are never both applied.
 */
describe('generic fan-out vs real per-street readings', () => {
  const GENERIC_CHECK_RAISE: readonly ExternalHudStatInput[] = [
    { key: 'CHECK_RAISE_ANY_STREET', enteredText: '17' },
  ];

  it('generic HUD only: the stand-in reaches all three per-street keys', () => {
    writeExternal(GENERIC_CHECK_RAISE);
    const external = bySource(load().observations, 'EXTERNAL_HUD');
    for (const key of ['CHECK_RAISE_FLOP', 'CHECK_RAISE_TURN', 'CHECK_RAISE_RIVER'] as const) {
      expect(find(external, key, 'EXTERNAL_HUD').valueBps).toBe(1_700);
    }
  });

  it('generic HUD + a real street-specific stat: the real one wins, and is not doubled up', () => {
    writeExternal(GENERIC_CHECK_RAISE);
    // 60 real river opportunities, and a value nowhere near the generic 17%.
    writeModel([count('CHECK_RAISE_RIVER', null, 60, 3)]);

    const observations = load().observations;
    const external = bySource(observations, 'EXTERNAL_HUD');
    const externalKeys = external.map((o) => o.key);

    // The measured key is NOT written by the fan-out at all — not written and then outranked,
    // which would leave a losing reading in the trace as if it had contributed.
    expect(externalKeys).not.toContain('CHECK_RAISE_RIVER');
    // The two streets nobody measured still get the stand-in.
    expect(externalKeys).toContain('CHECK_RAISE_FLOP');
    expect(externalKeys).toContain('CHECK_RAISE_TURN');
    // And the reading AS REPORTED is still stored under its own key, for the profile panel.
    expect(externalKeys).toContain('CHECK_RAISE_ANY_STREET');

    // The estimate for the measured street is built from the measurement alone: 3/60 = 5%.
    const river = buildAdjustmentProfile(load()).stats.CHECK_RAISE_RIVER;
    expect(river.sources.map((source) => source.source)).toEqual(['LEARNED_MODEL']);
    expect(river.observedBps).toBe(500);
    // The unmeasured streets still read the external stand-in, at its fixed policy confidence.
    const flop = buildAdjustmentProfile(load()).stats.CHECK_RAISE_FLOP;
    expect(flop.sources.map((source) => source.source)).toEqual(['EXTERNAL_HUD']);
    expect(flop.observedBps).toBe(1_700);
  });

  it('a per-street key with NO real denominator does not displace the stand-in', () => {
    writeExternal(GENERIC_CHECK_RAISE);
    // `opportunities: 0` emits no observation at all, so nothing is covered and the stand-in
    // stays. The guard is `sampleN > 0`, never mere presence of a key.
    writeModel([count('CHECK_RAISE_RIVER', null, 0, 0)]);
    const external = bySource(load().observations, 'EXTERNAL_HUD');
    expect(find(external, 'CHECK_RAISE_RIVER', 'EXTERNAL_HUD').valueBps).toBe(1_700);
  });

  it('leaves a stat the source genuinely reports per-street under the normal precedence rule', () => {
    // `WTSD` is not a fan-out key, so EXTERNAL_HUD still wins over a real learned reading —
    // WP-K's per-stat precedence (ADR-0067) is unchanged by any of this.
    writeExternal([{ key: 'WTSD', enteredText: '38' }]);
    writeModel([count('WTSD', null, 200, 90)]);
    const wtsd = buildAdjustmentProfile(load()).stats.WTSD;
    expect(wtsd.sources.map((source) => source.source)).toEqual(['EXTERNAL_HUD']);
    expect(wtsd.observedBps).toBe(3_800);
  });
});

/* -------------------------------------------------------------------------- */
/* Both sources, and none                                                      */
/* -------------------------------------------------------------------------- */

describe('the two sources are kept separate', () => {
  it('one stat with both sources yields TWO observations that are not merged here', () => {
    writeHud([{ key: 'VPIP', enteredText: '28.5' }], 400);
    writeModel([count('VPIP', null, 300, 87)]);

    const input = load();
    const vpip = input.observations.filter((o) => o.key === 'VPIP');
    expect(vpip).toHaveLength(2);
    expect(vpip.map((o) => o.source).sort()).toEqual(['LEARNED_MODEL', 'MANUAL_HUD']);
    expect(find(vpip, 'VPIP', 'MANUAL_HUD')).toMatchObject({
      valueBps: 2850,
      sampleN: manualHudSampleCap('VPIP'),
    });
    expect(find(vpip, 'VPIP', 'LEARNED_MODEL')).toMatchObject({ valueBps: 2900, sampleN: 300 });

    // Both provenance pointers are populated, from the two rows that were actually read.
    expect(input.manualHudSnapshotId).toBe('hud-1');
    expect(input.learnedSnapshotId).toBe('snap-1');
    expect(input.learnedModelVersion).toBe(1);
  });

  it('end to end: buildAdjustmentProfile pools them and RETAINS both source refs', () => {
    writeHud([{ key: 'VPIP', enteredText: '28.5' }], 400);
    writeModel([count('VPIP', null, 300, 87)]);

    const profile = buildAdjustmentProfile(load());
    const vpip = profile.stats.VPIP;

    expect(vpip.sources.map((source) => source.source)).toEqual(['MANUAL_HUD', 'LEARNED_MODEL']);
    const manualN = manualHudSampleCap('VPIP');
    expect(vpip.sources).toEqual([
      {
        source: 'MANUAL_HUD',
        valueBps: 2850,
        sampleN: manualN,
        note: expect.stringContaining('유효 표본') as unknown as string,
      },
      { source: 'LEARNED_MODEL', valueBps: 2900, sampleN: 300, note: null },
    ]);
    // The manual leg is capped to `floor(K / 2)`; the learned leg keeps its REAL opportunity
    // count. Pooling is the sample-weighted mean, so the typed reading is deliberately the
    // minority voice next to 300 hands this app actually observed.
    expect(vpip.sampleN).toBe(manualN + 300);
    expect(vpip.observedBps).toBe(
      Math.round((2850 * manualN + 2900 * 300) / (manualN + 300)),
    );
    expect(vpip.available).toBe(true);
    expect(profile.manualHudSnapshotId).toBe('hud-1');
    expect(profile.learnedSnapshotId).toBe('snap-1');
    expect(profile.learnedModelVersion).toBe(1);
  });

  it('a player with no HUD and no snapshot is ok:true with no observations', () => {
    const input = load(2, null);
    expect(input).toEqual({
      playerId: VILLAIN,
      seatIndex: 2,
      nickname: null,
      observations: [],
      manualHudSnapshotId: null,
      manualHudRecordedAt: null,
      learnedSnapshotId: null,
      learnedModelVersion: null,
      externalHudSnapshotId: null,
      externalHudRecordedAt: null,
    });

    // Which composes into the identity element: 20 unavailable stats, zero deviation.
    const profile = buildAdjustmentProfile(input);
    expect(profile.totalObservedSampleN).toBe(0);
    expect(Object.values(profile.stats).every((stat) => stat.deviationBps === 0)).toBe(true);
    expect(Object.values(profile.stats).every((stat) => stat.available === false)).toBe(true);
  });

  it('an unknown player id is not an error — it is simply a player we know nothing about', () => {
    const result = loadAdaptiveOpponentInput(db, asId<'Player'>('never-seated'), 0, null);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.input.observations).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* The lineup read                                                             */
/* -------------------------------------------------------------------------- */

describe('loadAdaptiveOpponentInputs', () => {
  it('returns one input per seat, in the order given', () => {
    writeHud([{ key: 'VPIP', enteredText: '28.5' }], 400);
    const result = loadAdaptiveOpponentInputs(db, [
      { playerId: VILLAIN, seatIndex: 4, nickname: '빌런' },
      { playerId: 'never-seated', seatIndex: 1, nickname: null },
    ]);

    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (!result.ok) return;
    expect(result.inputs.map((input) => input.seatIndex)).toEqual([4, 1]);
    expect(result.inputs[0]?.observations).toHaveLength(1);
    expect(result.inputs[1]?.observations).toEqual([]);
  });

  it('an empty lineup is a valid, empty answer', () => {
    const result = loadAdaptiveOpponentInputs(db, []);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.inputs).toEqual([]);
  });

  it('rejects a malformed lineup rather than reading anything', () => {
    // The input arrives from the network; these are the three shapes a real lineup cannot have.
    expect(
      loadAdaptiveOpponentInputs(db, [{ playerId: '', seatIndex: 0, nickname: null }]),
    ).toEqual({ ok: false, message: 'every seat must name a player' });
    expect(
      loadAdaptiveOpponentInputs(db, [{ playerId: VILLAIN, seatIndex: 9, nickname: null }]).ok,
    ).toBe(false);
    expect(
      loadAdaptiveOpponentInputs(db, [
        { playerId: VILLAIN, seatIndex: 0, nickname: null },
        { playerId: VILLAIN, seatIndex: 1, nickname: null },
      ]).ok,
    ).toBe(false);
    expect(
      loadAdaptiveOpponentInputs(
        db,
        Array.from({ length: 7 }, (_unused, index) => ({
          playerId: `p-${index}`,
          seatIndex: 0,
          nickname: null,
        })),
      ).ok,
    ).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Isolation (design contract §6, J10.7 / J10.8)                               */
/* -------------------------------------------------------------------------- */

describe('the two sources never overwrite each other', () => {
  it('a new HUD snapshot does not touch the learned model, and vice versa', () => {
    writeModel([count('VPIP', null, 300, 87)]);
    const beforeHud = load();
    expect(beforeHud.learnedSnapshotId).toBe('snap-1');

    writeHud([{ key: 'VPIP', enteredText: '28.5' }], 400);
    const afterHud = load();
    // The learned reading is byte-identical; only a manual reading was added.
    expect(find(afterHud.observations, 'VPIP', 'LEARNED_MODEL')).toEqual(
      find(beforeHud.observations, 'VPIP', 'LEARNED_MODEL'),
    );
    expect(afterHud.learnedSnapshotId).toBe('snap-1');
    expect(afterHud.learnedModelVersion).toBe(1);

    writeModel([count('VPIP', null, 400, 200)]);
    const afterModel = load();
    // The manual reading is byte-identical; only the learned one moved.
    expect(find(afterModel.observations, 'VPIP', 'MANUAL_HUD')).toEqual(
      find(afterHud.observations, 'VPIP', 'MANUAL_HUD'),
    );
    expect(afterModel.manualHudSnapshotId).toBe('hud-1');
    expect(find(afterModel.observations, 'VPIP', 'LEARNED_MODEL').valueBps).toBe(5000);
    expect(afterModel.learnedModelVersion).toBe(2);
  });
});
