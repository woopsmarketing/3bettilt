// @vitest-environment node
//
// Server code is Node code: it opens a native SQLite binding and `@gto-self/db` resolves
// its migrations folder from `import.meta.url`, which is not a `file:` URL under the
// project's default happy-dom environment. The DOM is irrelevant to everything here.
/**
 * `syncSessionSeats` and `replaceSeatPlayer` against a REAL migrated database.
 *
 * Nothing is mocked. Every property asserted here is a property of what actually comes back
 * out of SQLite, because every one of them is a claim about persistence:
 *
 * 1. **A corrected stack survives a re-read**, and the write is NARROW — the auto top-up
 *    columns and `sessions.hand_number` are untouched by it (ADR-0075).
 * 2. **The money rule is enforced before anything is written.** Negative, fractional and zero
 *    stacks are refused, and the stored row is byte-identical afterwards (`CLAUDE.md` rule 1).
 * 3. **One player, one seat** (ADR-0076) — refused in the payload AND against the seats the
 *    payload does not mention.
 * 4. **A nickname reuses the existing player**; a refused replacement leaves no orphan row.
 * 5. **A blank HUD field is an ABSENT row, never a zero**, and a correction APPENDS.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { asId, Money, sequentialIdFactory } from '@gto-self/shared';
import type { PlayerId } from '@gto-self/shared';
import { timestamp } from '@gto-self/player-core';
import { CP_NL50_6MAX_ANTE, SEAT_INDEXES } from '@gto-self/poker-core';
import {
  closeSession,
  getSession,
  latestExternalProfileForPlayer,
  listExternalHudSnapshotsForPlayer,
  listPlayers,
  openTestDatabase,
  type DatabaseHandle,
} from '@gto-self/db';
import { appendTypedExternalHud } from './external-hud-entry-service.js';
import type { SeatFormValue, SessionFormValue } from '../lib/session-setup/contract.js';
import { emptySeatForm } from '../lib/session-setup/plan.js';
import { startSession } from './session-service.js';
import { replaceSeatPlayer, syncSessionSeats } from './seat-state-service.js';
import type { SyncSessionSeatsValue } from '../lib/table/contract.js';

const NOW = timestamp(1_700_000_000_000);
const LATER = timestamp(1_700_000_060_000);

function seat(overrides: Partial<SeatFormValue> = {}): SeatFormValue {
  return { ...emptySeatForm(), occupancy: 'ACTIVE', nickname: 'x', stackText: '100', ...overrides };
}

/** Seats 0-2 occupied (`Villain 0..2`), auto top-up ON so its columns have something to lose. */
function form(overrides: Partial<SessionFormValue> = {}): SessionFormValue {
  return {
    presetId: CP_NL50_6MAX_ANTE.presetId,
    anteEnabled: true,
    label: 'seat state',
    buttonSeat: 0,
    autoTopUpEnabled: true,
    autoTopUpTargetText: '100',
    seats: SEAT_INDEXES.map((index) =>
      index < 3
        ? seat({ nickname: `Villain ${index}`, isHero: index === 0 })
        : { ...emptySeatForm(), occupancy: 'EMPTY' as const },
    ),
    ...overrides,
  };
}

describe('syncSessionSeats / replaceSeatPlayer', () => {
  let handle: DatabaseHandle;
  const deps = (now = LATER) => ({ ids: sequentialIdFactory('gen'), now });

  beforeEach(() => {
    handle = openTestDatabase();
    return () => handle.close();
  });

  function startFixture(value: SessionFormValue = form(), idPrefix = 'id'): string {
    const started = startSession(handle.db, value, {
      ids: sequentialIdFactory(idPrefix),
      now: NOW,
    });
    if (!started.ok) throw new Error(JSON.stringify(started.issues));
    return started.sessionId;
  }

  function read(sessionId: string) {
    const stored = getSession(handle.db, asId<'Session'>(sessionId));
    if (!stored.ok || stored.value === null) throw new Error('session not readable');
    return stored.value;
  }

  function playerAt(sessionId: string, index: 0 | 1 | 2 | 3 | 4 | 5): PlayerId {
    const held = read(sessionId).table.seats[index].playerId;
    if (held === null) throw new Error(`seat ${index} holds no player`);
    return held;
  }

  /** The six seats as they are stored right now, as a sync payload. */
  function currentSeats(sessionId: string): SyncSessionSeatsValue['seats'] {
    const stored = read(sessionId);
    const table = stored.table;
    return SEAT_INDEXES.map((index) => ({
      seat: index,
      occupancy: table.seats[index].occupancy,
      playerId: table.seats[index].playerId,
      stack: table.seats[index].stack,
      stackUnverified: stored.seatStackUnverified[index] === true,
    }));
  }

  // -------------------------------------------------------------------------
  // syncSessionSeats — WP-5 / ADR-0075
  // -------------------------------------------------------------------------

  it('persists a corrected stack, and a re-read still has it', () => {
    const sessionId = startFixture();
    const seats = currentSeats(sessionId).map((entry) =>
      entry.seat === 1 ? { ...entry, stack: 73_500 } : entry,
    );

    const result = syncSessionSeats(handle.db, { sessionId, seats, buttonSeat: 2 }, deps());
    expect(result, JSON.stringify(result)).toEqual({ ok: true });

    const stored = read(sessionId);
    expect(stored.table.seats[1].stack).toBe(Money.mbb(73_500));
    expect(stored.table.seats[0].stack).toBe(Money.mbb(100_000));
    expect(stored.table.buttonSeat).toBe(2);
  });

  it('never touches the auto top-up columns or sessions.hand_number', () => {
    const sessionId = startFixture();
    const before = read(sessionId);
    expect(before.seatAutoTopUp[0]).toBeDefined();

    const result = syncSessionSeats(
      handle.db,
      {
        sessionId,
        seats: currentSeats(sessionId).map((entry) =>
          entry.seat === 0 ? { ...entry, stack: 12_345 } : entry,
        ),
        buttonSeat: 0,
      },
      deps(),
    );
    expect(result.ok, JSON.stringify(result)).toBe(true);

    const after = read(sessionId);
    expect(after.seatAutoTopUp).toEqual(before.seatAutoTopUp);
    expect(after.autoTopUp).toEqual(before.autoTopUp);
    expect(after.table.handNumber).toBe(before.table.handNumber);
    expect(after.table.heroSeat).toBe(before.table.heroSeat);
    expect(after.table.config).toEqual(before.table.config);
  });

  it('stores a null button seat as null rather than leaving the old one', () => {
    const sessionId = startFixture();
    const result = syncSessionSeats(
      handle.db,
      { sessionId, seats: currentSeats(sessionId), buttonSeat: null },
      deps(),
    );
    expect(result.ok, JSON.stringify(result)).toBe(true);
    expect(read(sessionId).table.buttonSeat).toBeNull();
  });

  it('persists a seat going SITTING_OUT while keeping its chips', () => {
    const sessionId = startFixture();
    const seats = currentSeats(sessionId).map((entry) =>
      entry.seat === 2 ? { ...entry, occupancy: 'SITTING_OUT' as const } : entry,
    );
    const result = syncSessionSeats(handle.db, { sessionId, seats, buttonSeat: 0 }, deps());
    expect(result.ok, JSON.stringify(result)).toBe(true);

    const stored = read(sessionId);
    expect(stored.table.seats[2].occupancy).toBe('SITTING_OUT');
    expect(stored.table.seats[2].stack).toBe(Money.mbb(100_000));
  });

  // --- the money path. Refusals must write NOTHING. ---

  it.each([
    ['negative', -1],
    ['fractional', 50_000.5],
    ['zero on an occupied seat', 0],
    ['out of range', Money.MAX_MILLI_BB + 1],
    ['not a number', Number.NaN],
  ])('refuses a %s stack and writes nothing', (_label, stack) => {
    const sessionId = startFixture();
    const before = read(sessionId);

    const seats = currentSeats(sessionId).map((entry) =>
      entry.seat === 1 ? { ...entry, stack } : entry,
    );
    const result = syncSessionSeats(handle.db, { sessionId, seats, buttonSeat: 0 }, deps());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('INVALID_INPUT');

    const after = read(sessionId);
    expect(after.table.seats[1].stack).toBe(before.table.seats[1].stack);
    expect(after.updatedAt).toBe(before.updatedAt);
  });

  it('refuses an EMPTY seat that still carries chips or a player', () => {
    const sessionId = startFixture();
    const withChips = syncSessionSeats(
      handle.db,
      {
        sessionId,
        seats: [{ seat: 3, occupancy: 'EMPTY', playerId: null, stack: 1, stackUnverified: false }],
        buttonSeat: 0,
      },
      deps(),
    );
    expect(withChips.ok).toBe(false);
    if (!withChips.ok) expect(withChips.code).toBe('INVALID_INPUT');

    const withPlayer = syncSessionSeats(
      handle.db,
      {
        sessionId,
        seats: [{ seat: 3, occupancy: 'EMPTY', playerId: playerAt(sessionId, 0), stack: 0 }],
        buttonSeat: 0,
      },
      deps(),
    );
    expect(withPlayer.ok).toBe(false);
    if (!withPlayer.ok) expect(withPlayer.code).toBe('INVALID_INPUT');
    expect(read(sessionId).table.seats[3].occupancy).toBe('EMPTY');
  });

  it('refuses an occupied seat that names no player', () => {
    const sessionId = startFixture();
    const result = syncSessionSeats(
      handle.db,
      {
        sessionId,
        seats: [
          { seat: 1, occupancy: 'ACTIVE', playerId: null, stack: 50_000, stackUnverified: false },
        ],
        buttonSeat: 0,
      },
      deps(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('INVALID_INPUT');
  });

  it('refuses a duplicated seat and an out-of-range seat index', () => {
    const sessionId = startFixture();
    const held = playerAt(sessionId, 0);
    const twice = syncSessionSeats(
      handle.db,
      {
        sessionId,
        seats: [
          { seat: 0, occupancy: 'ACTIVE', playerId: held, stack: 50_000, stackUnverified: false },
          { seat: 0, occupancy: 'ACTIVE', playerId: held, stack: 60_000, stackUnverified: false },
        ],
        buttonSeat: 0,
      },
      deps(),
    );
    expect(twice.ok).toBe(false);
    if (!twice.ok) expect(twice.code).toBe('INVALID_INPUT');

    const outOfRange = syncSessionSeats(
      handle.db,
      {
        sessionId,
        seats: [
          { seat: 9, occupancy: 'ACTIVE', playerId: held, stack: 50_000, stackUnverified: false },
        ],
        buttonSeat: 0,
      },
      deps(),
    );
    expect(outOfRange.ok).toBe(false);
    if (!outOfRange.ok) expect(outOfRange.code).toBe('INVALID_INPUT');
    expect(read(sessionId).table.seats[0].stack).toBe(Money.mbb(100_000));
  });

  it('refuses one player in two seats — inside the payload and against the stored lineup', () => {
    const sessionId = startFixture();
    const first = playerAt(sessionId, 0);

    const inPayload = syncSessionSeats(
      handle.db,
      {
        sessionId,
        seats: [
          { seat: 0, occupancy: 'ACTIVE', playerId: first, stack: 50_000, stackUnverified: false },
          { seat: 1, occupancy: 'ACTIVE', playerId: first, stack: 50_000, stackUnverified: false },
        ],
        buttonSeat: 0,
      },
      deps(),
    );
    expect(inPayload.ok).toBe(false);
    if (!inPayload.ok) expect(inPayload.code).toBe('PLAYER_ALREADY_SEATED');

    // Seat 0 is NOT in this payload, but it still holds `first`.
    const againstStored = syncSessionSeats(
      handle.db,
      {
        sessionId,
        seats: [
          { seat: 1, occupancy: 'ACTIVE', playerId: first, stack: 50_000, stackUnverified: false },
        ],
        buttonSeat: 0,
      },
      deps(),
    );
    expect(againstStored.ok).toBe(false);
    if (!againstStored.ok) expect(againstStored.code).toBe('PLAYER_ALREADY_SEATED');

    expect(read(sessionId).table.seats[1].playerId).toBe(playerAt(sessionId, 1));
  });

  it('refuses a missing session and a closed one', () => {
    const missing = syncSessionSeats(
      handle.db,
      {
        sessionId: 'no-such-session',
        seats: [{ seat: 0, occupancy: 'EMPTY', playerId: null, stack: 0, stackUnverified: false }],
        buttonSeat: null,
      },
      deps(),
    );
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.code).toBe('NOT_FOUND');

    const sessionId = startFixture();
    const seats = currentSeats(sessionId);
    const closed = closeSession(handle.db, asId<'Session'>(sessionId), LATER);
    expect(closed.ok, JSON.stringify(closed)).toBe(true);

    const refused = syncSessionSeats(handle.db, { sessionId, seats, buttonSeat: 0 }, deps());
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.code).toBe('SESSION_CLOSED');
  });

  // -------------------------------------------------------------------------
  // replaceSeatPlayer — WP-2 / ADR-0076
  // -------------------------------------------------------------------------

  it('reuses the existing player behind a typed nickname instead of creating a duplicate', () => {
    const sessionId = startFixture();
    const before = listPlayers(handle.db, {});
    expect(before.ok).toBe(true);
    if (!before.ok) return;

    // `Villain 4` does not sit anywhere yet, but the player row exists from an earlier sitting.
    const otherSession = startFixture(
      form({
        label: 'earlier',
        seats: SEAT_INDEXES.map((index) =>
          index < 3
            ? seat({ nickname: `Bystander ${index}`, isHero: index === 0 })
            : { ...emptySeatForm(), occupancy: 'EMPTY' as const },
        ),
      }),
      'other',
    );
    expect(otherSession).not.toBe(sessionId);
    const known = listPlayers(handle.db, {});
    if (!known.ok) return;
    const bystander = known.value.find((player) => player.nickname === 'Bystander 1');
    expect(bystander).toBeDefined();

    const result = replaceSeatPlayer(
      handle.db,
      {
        sessionId,
        seat: 1,
        playerId: null,
        nickname: 'Bystander 1',
        stack: null,
        requireNew: false,
        externalHud: {},
      },
      deps(),
    );
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (!result.ok) return;
    expect(result.playerId).toBe(bystander?.id);
    expect(result.createdPlayer).toBe(false);
    expect(result.nickname).toBe('Bystander 1');

    const after = listPlayers(handle.db, {});
    if (!after.ok) return;
    expect(after.value.filter((player) => player.nickname === 'Bystander 1')).toHaveLength(1);
    expect(read(sessionId).table.seats[1].playerId).toBe(bystander?.id);
  });

  it('creates a genuinely new player and leaves the seat stack and occupancy alone', () => {
    const sessionId = startFixture();
    const seats = currentSeats(sessionId).map((entry) =>
      entry.seat === 2 ? { ...entry, occupancy: 'SITTING_OUT' as const, stack: 42_000 } : entry,
    );
    expect(syncSessionSeats(handle.db, { sessionId, seats, buttonSeat: 0 }, deps()).ok).toBe(true);

    const result = replaceSeatPlayer(
      handle.db,
      {
        sessionId,
        seat: 2,
        playerId: null,
        nickname: 'Newcomer',
        stack: null,
        requireNew: false,
        externalHud: {},
      },
      deps(),
    );
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (!result.ok) return;
    expect(result.createdPlayer).toBe(true);

    const stored = read(sessionId);
    expect(stored.table.seats[2].playerId).toBe(result.playerId);
    // The stack is NOT invented for the newcomer: it is exactly what the seat already held.
    expect(stored.table.seats[2].stack).toBe(Money.mbb(42_000));
    expect(stored.table.seats[2].occupancy).toBe('SITTING_OUT');
  });

  it('refuses seating one player twice, and rolls back so no orphan player is left behind', () => {
    const sessionId = startFixture();
    const before = listPlayers(handle.db, {});
    if (!before.ok) return;

    const byNickname = replaceSeatPlayer(
      handle.db,
      {
        sessionId,
        seat: 1,
        playerId: null,
        nickname: 'Villain 0',
        stack: null,
        requireNew: false,
        externalHud: { VPIP: '25' },
      },
      deps(),
    );
    expect(byNickname.ok).toBe(false);
    if (!byNickname.ok) expect(byNickname.code).toBe('PLAYER_ALREADY_SEATED');

    const byId = replaceSeatPlayer(
      handle.db,
      {
        sessionId,
        seat: 1,
        playerId: playerAt(sessionId, 0),
        nickname: null,
        stack: null,
        requireNew: false,
        externalHud: {},
      },
      deps(),
    );
    expect(byId.ok).toBe(false);
    if (!byId.ok) expect(byId.code).toBe('PLAYER_ALREADY_SEATED');

    const after = listPlayers(handle.db, {});
    if (!after.ok) return;
    expect(after.value).toHaveLength(before.value.length);
    // The refused HUD entry above must not have been written either.
    const hud = listExternalHudSnapshotsForPlayer(handle.db, playerAt(sessionId, 0));
    expect(hud.ok).toBe(true);
    if (hud.ok) expect(hud.value).toHaveLength(0);
  });

  it('allows re-selecting the player already in the seat', () => {
    const sessionId = startFixture();
    const held = playerAt(sessionId, 1);
    const result = replaceSeatPlayer(
      handle.db,
      {
        sessionId,
        seat: 1,
        playerId: held,
        nickname: null,
        stack: null,
        requireNew: false,
        externalHud: {},
      },
      deps(),
    );
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (!result.ok) return;
    expect(result.playerId).toBe(held);
    expect(result.createdPlayer).toBe(false);
    expect(read(sessionId).table.seats[1].playerId).toBe(held);
  });

  it('omits a blank HUD field instead of storing it as zero', () => {
    const sessionId = startFixture();
    const result = replaceSeatPlayer(
      handle.db,
      {
        sessionId,
        seat: 1,
        playerId: null,
        nickname: 'HUD Guy',
        stack: null,
        requireNew: false,
        externalHud: { VPIP: '28', PFR: '', THREE_BET: '  ', WTSD: '31.5' },
      },
      deps(),
    );
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (!result.ok) return;
    expect(result.externalHudAppended).toBe(true);

    const latest = latestExternalProfileForPlayer(handle.db, asId<'Player'>(result.playerId));
    expect(latest.ok).toBe(true);
    if (!latest.ok || latest.value === null) return;
    expect(latest.value.stats.map((stat) => stat.key).sort()).toEqual(['VPIP', 'WTSD']);
    expect(latest.value.stats.map((stat) => stat.enteredText).sort()).toEqual(['28', '31.5']);
    expect(latest.value.sampleN).toBeNull();
    expect(latest.value.importBatchId).toContain('manual-entry');
  });

  it('APPENDS a corrected HUD reading, keeping the previous snapshot, and ADAPTIVE reads the newest', () => {
    const sessionId = startFixture();
    const first = replaceSeatPlayer(
      handle.db,
      {
        sessionId,
        seat: 1,
        playerId: null,
        nickname: 'HUD Guy',
        stack: null,
        requireNew: false,
        externalHud: { VPIP: '28' },
      },
      deps(NOW),
    );
    expect(first.ok, JSON.stringify(first)).toBe(true);
    if (!first.ok) return;

    const second = replaceSeatPlayer(
      handle.db,
      {
        sessionId,
        seat: 1,
        playerId: first.playerId,
        nickname: null,
        stack: null,
        requireNew: false,
        externalHud: { VPIP: '31' },
      },
      deps(LATER),
    );
    expect(second.ok, JSON.stringify(second)).toBe(true);
    if (!second.ok) return;
    expect(second.externalHudAppended).toBe(true);

    const history = listExternalHudSnapshotsForPlayer(handle.db, asId<'Player'>(first.playerId));
    expect(history.ok).toBe(true);
    if (!history.ok) return;
    expect(history.value).toHaveLength(2);
    expect([...history.value].map((snapshot) => snapshot.stats[0]?.enteredText).sort()).toEqual([
      '28',
      '31',
    ]);

    // The returned ADAPTIVE input points at the NEWEST snapshot and carries its number.
    expect(second.adaptiveInput.externalHudSnapshotId).toBe(history.value[0]?.id);
    expect(second.adaptiveInput.externalHudRecordedAt).toBe(LATER);
    const vpip = second.adaptiveInput.observations.find(
      (observation) => observation.key === 'VPIP' && observation.source === 'EXTERNAL_HUD',
    );
    expect(vpip?.valueBps).toBe(3100);
  });

  it('writes no second snapshot when the entry is identical to the latest one', () => {
    const sessionId = startFixture();
    const first = replaceSeatPlayer(
      handle.db,
      {
        sessionId,
        seat: 1,
        playerId: null,
        nickname: 'HUD Guy',
        stack: null,
        requireNew: false,
        externalHud: { VPIP: '28' },
      },
      deps(NOW),
    );
    if (!first.ok) throw new Error(first.message);

    const again = replaceSeatPlayer(
      handle.db,
      {
        sessionId,
        seat: 1,
        playerId: first.playerId,
        nickname: null,
        stack: null,
        requireNew: false,
        externalHud: { VPIP: '28', PFR: '' },
      },
      deps(LATER),
    );
    expect(again.ok, JSON.stringify(again)).toBe(true);
    if (!again.ok) return;
    expect(again.externalHudAppended).toBe(false);

    const history = listExternalHudSnapshotsForPlayer(handle.db, asId<'Player'>(first.playerId));
    if (!history.ok) return;
    expect(history.value).toHaveLength(1);
  });

  it('refuses an unparseable HUD value and writes neither the snapshot nor the seat', () => {
    const sessionId = startFixture();
    const before = read(sessionId).table.seats[1].playerId;

    const result = replaceSeatPlayer(
      handle.db,
      {
        sessionId,
        seat: 1,
        playerId: null,
        nickname: 'Broken HUD',
        stack: null,
        requireNew: false,
        externalHud: { VPIP: '250' },
      },
      deps(),
    );
    expect(result.ok).toBe(false);
    expect(read(sessionId).table.seats[1].playerId).toBe(before);
    const players = listPlayers(handle.db, {});
    if (!players.ok) return;
    expect(players.value.some((player) => player.nickname === 'Broken HUD')).toBe(false);
  });

  // --- seating an EMPTY seat (WP-2 follow-up). The stack is REQUIRED and comes from the user. ---

  it('seats a player at an EMPTY seat with the stack the user counted, and it survives a re-read', () => {
    const sessionId = startFixture();
    expect(read(sessionId).table.seats[4].occupancy).toBe('EMPTY');

    const result = replaceSeatPlayer(
      handle.db,
      {
        sessionId,
        seat: 4,
        playerId: null,
        nickname: 'Walk-in',
        stack: 87_500,
        requireNew: false,
        externalHud: { VPIP: '24' },
      },
      deps(),
    );
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (!result.ok) return;
    expect(result.seatedEmpty).toBe(true);
    expect(result.createdPlayer).toBe(true);
    expect(result.externalHudAppended).toBe(true);

    const stored = read(sessionId);
    expect(stored.table.seats[4].occupancy).toBe('ACTIVE');
    expect(stored.table.seats[4].playerId).toBe(result.playerId);
    expect(stored.table.seats[4].stack).toBe(Money.mbb(87_500));
    // The stack is EXACTLY what was sent — never inherited from another seat.
    expect(stored.table.seats[0].stack).toBe(Money.mbb(100_000));
  });

  it('reports seatedEmpty false when it merely replaces an occupant', () => {
    const sessionId = startFixture();
    const result = replaceSeatPlayer(
      handle.db,
      {
        sessionId,
        seat: 1,
        playerId: null,
        nickname: 'Swap In',
        stack: null,
        requireNew: false,
        externalHud: {},
      },
      deps(),
    );
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (!result.ok) return;
    expect(result.seatedEmpty).toBe(false);
  });

  it('refuses to seat an EMPTY seat with no stack, and writes nothing at all', () => {
    const sessionId = startFixture();
    const before = listPlayers(handle.db, {});
    if (!before.ok) return;

    const result = replaceSeatPlayer(
      handle.db,
      {
        sessionId,
        seat: 4,
        playerId: null,
        nickname: 'Walk-in',
        stack: null,
        requireNew: false,
        externalHud: {},
      },
      deps(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('INVALID_INPUT');

    expect(read(sessionId).table.seats[4].occupancy).toBe('EMPTY');
    const after = listPlayers(handle.db, {});
    if (!after.ok) return;
    expect(after.value).toHaveLength(before.value.length);
  });

  it.each([
    ['zero', 0],
    ['negative', -5_000],
    ['fractional', 50_000.5],
    ['out of range', Money.MAX_MILLI_BB + 1],
    ['not a number', Number.NaN],
  ])('refuses to seat an EMPTY seat with a %s stack', (_label, stack) => {
    const sessionId = startFixture();
    const result = replaceSeatPlayer(
      handle.db,
      {
        sessionId,
        seat: 4,
        playerId: null,
        nickname: 'Walk-in',
        stack,
        requireNew: false,
        externalHud: {},
      },
      deps(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('INVALID_INPUT');

    const stored = read(sessionId);
    expect(stored.table.seats[4].occupancy).toBe('EMPTY');
    expect(stored.table.seats[4].stack).toBe(Money.mbb(0));
    const players = listPlayers(handle.db, {});
    if (!players.ok) return;
    expect(players.value.some((player) => player.nickname === 'Walk-in')).toBe(false);
  });

  it('refuses a stack sent for a seat that already holds a player', () => {
    const sessionId = startFixture();
    const before = read(sessionId).table.seats[1];

    const result = replaceSeatPlayer(
      handle.db,
      {
        sessionId,
        seat: 1,
        playerId: null,
        nickname: 'Swap In',
        stack: 50_000,
        requireNew: false,
        externalHud: {},
      },
      deps(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('INVALID_INPUT');

    const after = read(sessionId).table.seats[1];
    expect(after.playerId).toBe(before.playerId);
    expect(after.stack).toBe(before.stack);
  });

  it('refuses to seat an already-seated player at an EMPTY seat', () => {
    const sessionId = startFixture();
    const result = replaceSeatPlayer(
      handle.db,
      {
        sessionId,
        seat: 4,
        playerId: playerAt(sessionId, 0),
        nickname: null,
        stack: 50_000,
        requireNew: false,
        externalHud: {},
      },
      deps(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('PLAYER_ALREADY_SEATED');
    expect(read(sessionId).table.seats[4].occupancy).toBe('EMPTY');
  });

  it('refuses a missing session, a closed session and an ambiguous identity', () => {
    const sessionId = startFixture();

    const both = replaceSeatPlayer(
      handle.db,
      {
        sessionId,
        seat: 1,
        playerId: playerAt(sessionId, 1),
        nickname: 'Someone',
        stack: null,
        requireNew: false,
        externalHud: {},
      },
      deps(),
    );
    expect(both.ok).toBe(false);
    if (!both.ok) expect(both.code).toBe('INVALID_INPUT');

    const neither = replaceSeatPlayer(
      handle.db,
      {
        sessionId,
        seat: 1,
        playerId: null,
        nickname: '   ',
        stack: null,
        requireNew: false,
        externalHud: {},
      },
      deps(),
    );
    expect(neither.ok).toBe(false);
    if (!neither.ok) expect(neither.code).toBe('INVALID_INPUT');

    const missing = replaceSeatPlayer(
      handle.db,
      {
        sessionId: 'no-such-session',
        seat: 1,
        playerId: null,
        nickname: 'X',
        stack: null,
        requireNew: false,
        externalHud: {},
      },
      deps(),
    );
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.code).toBe('NOT_FOUND');

    const closed = closeSession(handle.db, asId<'Session'>(sessionId), LATER);
    expect(closed.ok).toBe(true);
    const refused = replaceSeatPlayer(
      handle.db,
      {
        sessionId,
        seat: 1,
        playerId: null,
        nickname: 'X',
        stack: null,
        requireNew: false,
        externalHud: {},
      },
      deps(),
    );
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.code).toBe('SESSION_CLOSED');
  });

  it('refuses a player id that names no row', () => {
    const sessionId = startFixture();
    const result = replaceSeatPlayer(
      handle.db,
      {
        sessionId,
        seat: 1,
        playerId: 'player-does-not-exist',
        nickname: null,
        stack: null,
        requireNew: false,
        externalHud: {},
      },
      deps(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('NOT_FOUND');
  });

  // -------------------------------------------------------------------------
  // requireNew — ADR-0079
  // -------------------------------------------------------------------------

  /**
   * The review's own reproduction, as a test.
   *
   * `Villain 1` holds a TEN-stat `EXTERNAL_HUD` profile. Under `새 플레이어 추가` the user types
   * their nickname again (with stray spaces and the wrong case) and two numbers. Before
   * ADR-0079 that returned `{ ok: true, createdPlayer: false }`, appended a SECOND snapshot,
   * and — because ADAPTIVE reads the latest snapshot WHOLE and never merges per key
   * (ADR-0069) — collapsed the effective profile from ten stats to two.
   *
   * `requireNew: true` refuses it instead, and the refusal must be total: no `players` row,
   * no `EXTERNAL_HUD` snapshot, no seat write.
   */
  const TEN_STATS = {
    VPIP: '31',
    PFR: '24',
    THREE_BET: '9',
    FOLD_TO_THREE_BET: '48',
    STEAL: '38',
    CBET_ANY_STREET: '62',
    FOLD_TO_CBET_ANY_STREET: '26',
    CHECK_RAISE_ANY_STREET: '11',
    WTSD: '29',
    WSD: '53',
  } as const;

  /** A player who EXISTS with a full profile but sits in no seat of `sessionId`. */
  function knownOutsider(nickname = 'Bystander 1'): PlayerId {
    startFixture(
      form({
        label: 'earlier',
        seats: SEAT_INDEXES.map((index) =>
          index < 3
            ? seat({ nickname: `Bystander ${index}`, isHero: index === 0 })
            : { ...emptySeatForm(), occupancy: 'EMPTY' as const },
        ),
      }),
      'outsider',
    );
    const known = listPlayers(handle.db, {});
    if (!known.ok) throw new Error(known.error.message);
    const found = known.value.find((player) => player.nickname === nickname);
    if (found === undefined) throw new Error(`${nickname} was not created`);
    const appended = appendTypedExternalHud(handle.db, found.id, TEN_STATS, {
      ids: sequentialIdFactory('hud'),
      now: NOW,
    });
    expect(appended.ok, JSON.stringify(appended)).toBe(true);
    return found.id;
  }

  it.each([
    ['exactly', 'Bystander 1'],
    ['with surrounding whitespace', '  Bystander 1  '],
    ['in a different case', 'bYsTaNdEr 1'],
    ['both', '  bystander 1  '],
  ])(
    'REFUSES requireNew when the typed nickname matches an existing player %s, and writes NOTHING',
    (_label, typed) => {
      const outsider = knownOutsider();
      const sessionId = startFixture(form(), 'target');

      const playersBefore = listPlayers(handle.db, {});
      if (!playersBefore.ok) return;
      const snapshotsBefore = listExternalHudSnapshotsForPlayer(handle.db, outsider);
      if (!snapshotsBefore.ok) return;
      expect(snapshotsBefore.value).toHaveLength(1);
      const profileBefore = latestExternalProfileForPlayer(handle.db, outsider);
      if (!profileBefore.ok) return;
      expect(profileBefore.value?.stats).toHaveLength(10);
      const seatBefore = read(sessionId).table.seats[4];

      const refused = replaceSeatPlayer(
        handle.db,
        {
          sessionId,
          seat: 4,
          playerId: null,
          nickname: typed,
          stack: 100_000,
          requireNew: true,
          externalHud: { VPIP: '31' },
        },
        deps(),
      );

      expect(refused.ok).toBe(false);
      if (refused.ok) return;
      expect(refused.code).toBe('PLAYER_EXISTS');
      // The message names the match, so the UI can point at the right row in the picker.
      expect(refused.message).toContain('Bystander 1');
      expect(refused.message).toContain(outsider);

      // Nothing at all was written: no player row...
      const playersAfter = listPlayers(handle.db, {});
      if (!playersAfter.ok) return;
      expect(playersAfter.value.map((player) => player.id)).toEqual(
        playersBefore.value.map((player) => player.id),
      );
      // ... no SECOND external HUD snapshot ...
      const snapshotsAfter = listExternalHudSnapshotsForPlayer(handle.db, outsider);
      if (!snapshotsAfter.ok) return;
      expect(snapshotsAfter.value).toHaveLength(1);
      // ... so the EFFECTIVE profile ADAPTIVE reads is still all ten stats, not one.
      const profileAfter = latestExternalProfileForPlayer(handle.db, outsider);
      if (!profileAfter.ok) return;
      expect(profileAfter.value?.stats).toHaveLength(10);
      // ... and the seat is untouched.
      expect(read(sessionId).table.seats[4]).toEqual(seatBefore);
    },
  );

  it('REFUSES requireNew together with a player id — the two instructions contradict', () => {
    const outsider = knownOutsider();
    const sessionId = startFixture(form(), 'target');

    const refused = replaceSeatPlayer(
      handle.db,
      {
        sessionId,
        seat: 4,
        playerId: outsider,
        nickname: null,
        stack: 100_000,
        requireNew: true,
        externalHud: {},
      },
      deps(),
    );
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.code).toBe('INVALID_INPUT');
    expect(read(sessionId).table.seats[4].occupancy).toBe('EMPTY');
  });

  it('ACCEPTS requireNew for a nickname that really is new', () => {
    knownOutsider();
    const sessionId = startFixture(form(), 'target');

    const result = replaceSeatPlayer(
      handle.db,
      {
        sessionId,
        seat: 4,
        playerId: null,
        nickname: 'Genuinely New',
        stack: 100_000,
        requireNew: true,
        externalHud: { VPIP: '31' },
      },
      deps(),
    );
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (!result.ok) return;
    expect(result.createdPlayer).toBe(true);
    expect(result.externalHudAppended).toBe(true);
    expect(read(sessionId).table.seats[4].playerId).toBe(result.playerId);
  });

  /**
   * The regression guard for the OTHER half of ADR-0079: reuse-by-nickname is still correct
   * when the caller did not claim the player was new. Picking `Bystander 1` from the roster
   * keeps their id, and a typed correction still APPENDS a snapshot exactly as WP-3 intends.
   */
  it('KEEPS the existing reuse path when requireNew is false — by id and by nickname', () => {
    const outsider = knownOutsider();
    const sessionId = startFixture(form(), 'target');

    const byId = replaceSeatPlayer(
      handle.db,
      {
        sessionId,
        seat: 4,
        playerId: outsider,
        nickname: null,
        stack: 100_000,
        requireNew: false,
        externalHud: {},
      },
      deps(),
    );
    expect(byId.ok, JSON.stringify(byId)).toBe(true);
    if (!byId.ok) return;
    expect(byId.playerId).toBe(outsider);
    expect(byId.createdPlayer).toBe(false);

    // And by nickname, onto a different seat, after vacating this one is not needed: seat 3
    // is empty too, but one player may hold only one seat — so re-pick the SAME seat, which
    // is the WP-3 "type a corrected number for the current occupant" path.
    const byNickname = replaceSeatPlayer(
      handle.db,
      {
        sessionId,
        seat: 4,
        playerId: null,
        nickname: '  bystander 1  ',
        stack: null,
        requireNew: false,
        externalHud: { VPIP: '44' },
      },
      deps(),
    );
    expect(byNickname.ok, JSON.stringify(byNickname)).toBe(true);
    if (!byNickname.ok) return;
    expect(byNickname.playerId).toBe(outsider);
    expect(byNickname.createdPlayer).toBe(false);
    expect(byNickname.externalHudAppended).toBe(true);

    // History is intact (insert-only): the ten-stat snapshot is still stored underneath.
    const snapshots = listExternalHudSnapshotsForPlayer(handle.db, outsider);
    if (!snapshots.ok) return;
    expect(snapshots.value).toHaveLength(2);
  });

  // -------------------------------------------------------------------------
  // stack_unverified — ADR-0078(b), migration 0010
  // -------------------------------------------------------------------------

  it('persists an UNVERIFIED stack as unverified, so a re-read still warns about it', () => {
    const sessionId = startFixture();
    expect(read(sessionId).seatStackUnverified).toEqual({});

    // The quick-skip shape: seat 1 keeps its pre-hand number and is marked 확인 필요.
    const seats = currentSeats(sessionId).map((entry) =>
      entry.seat === 1 ? { ...entry, stackUnverified: true } : entry,
    );
    expect(syncSessionSeats(handle.db, { sessionId, seats, buttonSeat: 0 }, deps()).ok).toBe(true);

    const stored = read(sessionId);
    expect(stored.seatStackUnverified).toEqual({ 1: true });
    // The number itself is unchanged — the flag is a warning ABOUT it, not a change to it.
    expect(stored.table.seats[1].stack).toBe(Money.mbb(100_000));

    // Stating the stack clears the mark, in the same write that carries the new number.
    const restated = currentSeats(sessionId).map((entry) =>
      entry.seat === 1 ? { ...entry, stack: 73_500, stackUnverified: false } : entry,
    );
    expect(
      syncSessionSeats(handle.db, { sessionId, seats: restated, buttonSeat: 0 }, deps(LATER)).ok,
    ).toBe(true);
    const cleared = read(sessionId);
    expect(cleared.seatStackUnverified).toEqual({});
    expect(cleared.table.seats[1].stack).toBe(Money.mbb(73_500));
  });

  it('marks a REPLACED seat unverified and a newly SEATED one confirmed', () => {
    const sessionId = startFixture();
    // ONE factory across both calls, so the two new players cannot collide on `id`.
    const shared = deps();

    // Replacing: the stack carried over belongs to the previous occupant, so it is unverified.
    const replaced = replaceSeatPlayer(
      handle.db,
      {
        sessionId,
        seat: 1,
        playerId: null,
        nickname: 'Swap In',
        stack: null,
        requireNew: true,
        externalHud: {},
      },
      shared,
    );
    expect(replaced.ok, JSON.stringify(replaced)).toBe(true);
    expect(read(sessionId).seatStackUnverified).toEqual({ 1: true });

    // Seating an EMPTY seat: the stack came from the user in this very request, so it is not.
    const seated = replaceSeatPlayer(
      handle.db,
      {
        sessionId,
        seat: 4,
        playerId: null,
        nickname: 'Walk-in',
        stack: 100_000,
        requireNew: true,
        externalHud: {},
      },
      shared,
    );
    expect(seated.ok, JSON.stringify(seated)).toBe(true);
    const stored = read(sessionId);
    expect(stored.seatStackUnverified).toEqual({ 1: true });
    expect(stored.seatStackUnverified[4]).toBeUndefined();
  });

  it('REFUSES a seat-state write with no stackUnverified rather than assuming confirmed', () => {
    const sessionId = startFixture();
    const seats = currentSeats(sessionId).map(({ stackUnverified: _drop, ...rest }) => rest);
    const refused = syncSessionSeats(handle.db, { sessionId, seats, buttonSeat: 0 }, deps());
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.code).toBe('INVALID_INPUT');
  });
});
