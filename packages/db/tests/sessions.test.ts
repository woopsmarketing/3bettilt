/**
 * `game_presets`, `sessions` and `session_seats`.
 *
 * A session's configuration — including its `RakeConfig` and `FeeConfig` — must survive a
 * round trip byte for byte, because every money outcome in the hands it holds was computed
 * under exactly those numbers.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { asId, Money, unwrap, type PlayerId, type SessionId } from '@gto-self/shared';
import { createPlayer, timestamp } from '@gto-self/player-core';
import {
  createTable,
  seatPlayer,
  setButtonSeat,
  setHeroSeat,
  setSeatOccupancy,
} from '@gto-self/poker-core';
import * as sessionRepository from '../src/repositories/sessions.js';
import * as presetRepository from '../src/repositories/presets.js';
import { insertPlayer } from '../src/repositories/players.js';
import { openTestDatabase, type DatabaseHandle } from '../src/client.js';
import { sessionSeats } from '../src/schema.js';
import { MANUAL_FEE_PRESET } from './fixture.js';

const T0 = timestamp(1_700_000_000_000);
const T1 = timestamp(1_700_000_060_000);
const SESSION = asId<'Session'>('sess-1') as SessionId;

/** A deliberately awkward exact integer: it must come back unchanged, not as a float. */
const ODD_STACK = Money.mbb(93_701);

describe('presets and sessions', () => {
  let handle: DatabaseHandle;
  beforeEach(() => {
    handle = openTestDatabase();
    for (const seat of [0, 1, 2] as const) {
      unwrap(
        insertPlayer(
          handle.db,
          unwrap(
            createPlayer({
              id: asId<'Player'>(`seat-${seat}`) as PlayerId,
              nickname: `Seat ${seat}`,
              createdAt: T0,
            }),
          ),
        ),
      );
    }
    return () => handle.close();
  });

  function buildSessionTable() {
    let table = unwrap(createTable(MANUAL_FEE_PRESET));
    table = unwrap(seatPlayer(table, 0, asId<'Player'>('seat-0') as PlayerId, ODD_STACK));
    table = unwrap(seatPlayer(table, 1, asId<'Player'>('seat-1') as PlayerId, Money.mbb(100_000)));
    table = unwrap(seatPlayer(table, 2, asId<'Player'>('seat-2') as PlayerId, Money.mbb(48_320)));
    table = unwrap(setSeatOccupancy(table, 2, 'SITTING_OUT'));
    table = unwrap(setButtonSeat(table, 0));
    return unwrap(setHeroSeat(table, 0));
  }

  it('round-trips a preset document through poker-core validation', () => {
    unwrap(presetRepository.insertPreset(handle.db, MANUAL_FEE_PRESET, T0));
    const loaded = presetRepository.getPreset(handle.db, MANUAL_FEE_PRESET.presetId);
    expect(loaded.ok && loaded.value?.config).toEqual(MANUAL_FEE_PRESET);
    expect(loaded.ok && loaded.value?.config.rake.quantum).toBe(20);
    expect(loaded.ok && loaded.value?.config.fee.triggerPolicy).toBe('MANUAL');

    const again = presetRepository.insertPreset(handle.db, MANUAL_FEE_PRESET, T0);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error.code).toBe('CONFLICT');
  });

  it('round-trips a session with its RakeConfig, FeeConfig, seats and EXACT integer stacks', () => {
    unwrap(presetRepository.insertPreset(handle.db, MANUAL_FEE_PRESET, T0));
    const table = buildSessionTable();
    unwrap(
      sessionRepository.insertSession(handle.db, {
        id: SESSION,
        label: 'Tuesday grind',
        presetId: MANUAL_FEE_PRESET.presetId,
        table,
        createdAt: T0,
        updatedAt: T0,
        closedAt: null,
      }),
    );

    const loaded = sessionRepository.getSession(handle.db, SESSION);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok || loaded.value === null) return;
    expect(loaded.value.table).toEqual(table);
    expect(loaded.value.table.config.rake).toEqual(MANUAL_FEE_PRESET.rake);
    expect(loaded.value.table.config.fee).toEqual(MANUAL_FEE_PRESET.fee);
    expect(loaded.value.table.seats[0].stack).toBe(ODD_STACK);
    expect(Number.isInteger(loaded.value.table.seats[0].stack)).toBe(true);
    expect(loaded.value.table.seats[2].occupancy).toBe('SITTING_OUT');
    expect(loaded.value.table.seats[3].occupancy).toBe('EMPTY');
    expect(loaded.value.table.seats[3].playerId).toBeNull();
    expect(loaded.value.table.buttonSeat).toBe(0);
    expect(loaded.value.table.heroSeat).toBe(0);

    // The stack really is an INTEGER in the column, not a float that rounded back.
    const raw = handle.sqlite
      .prepare(`select stack, typeof(stack) as t from session_seats where seat = 0`)
      .get() as { readonly stack: number; readonly t: string };
    expect(raw.t).toBe('integer');
    expect(raw.stack).toBe(93_701);
  });

  it('writes all six seat rows, so an empty seat is a fact rather than a missing row', () => {
    unwrap(
      sessionRepository.insertSession(handle.db, {
        id: SESSION,
        label: null,
        presetId: null,
        table: buildSessionTable(),
        createdAt: T0,
        updatedAt: T0,
        closedAt: null,
      }),
    );
    expect(handle.db.select().from(sessionSeats).all()).toHaveLength(6);
  });

  it('keeps its OWN config copy: editing the preset does not rewrite the session', () => {
    unwrap(presetRepository.insertPreset(handle.db, MANUAL_FEE_PRESET, T0));
    unwrap(
      sessionRepository.insertSession(handle.db, {
        id: SESSION,
        label: null,
        presetId: MANUAL_FEE_PRESET.presetId,
        table: buildSessionTable(),
        createdAt: T0,
        updatedAt: T0,
        closedAt: null,
      }),
    );
    unwrap(
      presetRepository.updatePreset(
        handle.db,
        { ...MANUAL_FEE_PRESET, rake: { ...MANUAL_FEE_PRESET.rake, numerator: 3 } },
        T1,
      ),
    );
    const loaded = sessionRepository.getSession(handle.db, SESSION);
    expect(loaded.ok && loaded.value?.table.config.rake.numerator).toBe(5);
    const preset = presetRepository.getPreset(handle.db, MANUAL_FEE_PRESET.presetId);
    expect(preset.ok && preset.value?.config.rake.numerator).toBe(3);
  });

  it('writes the table state back, and closes a session', () => {
    const table = buildSessionTable();
    unwrap(
      sessionRepository.insertSession(handle.db, {
        id: SESSION,
        label: null,
        presetId: null,
        table,
        createdAt: T0,
        updatedAt: T0,
        closedAt: null,
      }),
    );
    const advanced = { ...table, handNumber: 7, buttonSeat: 1 as const };
    unwrap(sessionRepository.updateSessionTable(handle.db, SESSION, advanced, T1));
    const loaded = sessionRepository.getSession(handle.db, SESSION);
    expect(loaded.ok && loaded.value?.table.handNumber).toBe(7);
    expect(loaded.ok && loaded.value?.table.buttonSeat).toBe(1);
    expect(loaded.ok && loaded.value?.updatedAt).toBe(T1);

    unwrap(sessionRepository.closeSession(handle.db, SESSION, T1));
    const closed = sessionRepository.getSession(handle.db, SESSION);
    expect(closed.ok && closed.value?.closedAt).toBe(T1);
    const open = sessionRepository.listSessions(handle.db, { includeClosed: false });
    expect(open.ok && open.value).toHaveLength(0);
  });

  /**
   * `closeSession` writes `closedAt` into `updated_at` as well. A backwards `updated_at` is
   * a typed error everywhere else in this phase (`player-core`'s `touch`,
   * `recordObservation`), and rewinding it would reorder this session against writes that
   * really did happen later.
   */
  it('refuses to move updated_at BACKWARDS when closing a session', () => {
    const table = buildSessionTable();
    unwrap(
      sessionRepository.insertSession(handle.db, {
        id: SESSION,
        label: null,
        presetId: null,
        table,
        createdAt: T0,
        updatedAt: T0,
        closedAt: null,
      }),
    );
    unwrap(sessionRepository.updateSessionTable(handle.db, SESSION, table, T1));

    const backwards = sessionRepository.closeSession(handle.db, SESSION, T0);
    expect(backwards.ok).toBe(false);
    if (!backwards.ok) {
      expect(backwards.error.code).toBe('INVALID_INPUT');
      expect(backwards.error.context.field).toBe('updated_at');
    }
    // Nothing was written: the session is still open at the later timestamp.
    const stillOpen = sessionRepository.getSession(handle.db, SESSION);
    expect(stillOpen.ok && stillOpen.value?.closedAt).toBeNull();
    expect(stillOpen.ok && stillOpen.value?.updatedAt).toBe(T1);

    // Closing AT the stored updated_at is fine — only moving backwards is refused.
    unwrap(sessionRepository.closeSession(handle.db, SESSION, T1));
    const closed = sessionRepository.getSession(handle.db, SESSION);
    expect(closed.ok && closed.value?.closedAt).toBe(T1);
  });

  it('reports NOT_FOUND when closing a session that does not exist', () => {
    const missing = sessionRepository.closeSession(
      handle.db,
      asId<'Session'>('ghost') as SessionId,
      T1,
    );
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe('NOT_FOUND');
  });

  it('refuses a seat pointing at a player that does not exist', () => {
    let table = unwrap(createTable(MANUAL_FEE_PRESET));
    table = unwrap(seatPlayer(table, 0, asId<'Player'>('ghost') as PlayerId, Money.mbb(1_000)));
    const written = sessionRepository.insertSession(handle.db, {
      id: SESSION,
      label: null,
      presetId: null,
      table,
      createdAt: T0,
      updatedAt: T0,
      closedAt: null,
    });
    expect(written.ok).toBe(false);
    if (!written.ok) expect(written.error.code).toBe('CONSTRAINT_VIOLATION');
  });

  it('reports a corrupt row when the stored config is not a valid TableConfig', () => {
    unwrap(
      sessionRepository.insertSession(handle.db, {
        id: SESSION,
        label: null,
        presetId: null,
        table: buildSessionTable(),
        createdAt: T0,
        updatedAt: T0,
        closedAt: null,
      }),
    );
    handle.sqlite.prepare(`update sessions set config_json = '{"nope":1}'`).run();
    const loaded = sessionRepository.getSession(handle.db, SESSION);
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) expect(loaded.error.code).toBe('CORRUPT_ROW');
  });
});
