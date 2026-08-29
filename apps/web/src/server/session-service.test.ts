// @vitest-environment node
//
// Server code is Node code: it opens a native SQLite binding and `@gto-self/db` resolves
// its migrations folder from `import.meta.url`, which is not a `file:` URL under the
// project's default happy-dom environment. The DOM is irrelevant to everything here.
/**
 * `startSession` against a REAL migrated database. The interesting parts are the ones a
 * pure test cannot reach: player reuse, the `game_presets` foreign key, and the promise
 * that a rejected submission leaves nothing behind.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { asId, sequentialIdFactory, Money } from '@gto-self/shared';
import type { PlayerId } from '@gto-self/shared';
import { createPlayer, timestamp } from '@gto-self/player-core';
import { CP_NL50_6MAX_ANTE, SEAT_INDEXES } from '@gto-self/poker-core';
import type { SeatIndex } from '@gto-self/poker-core';
import {
  getSession,
  insertPlayer,
  listPlayers,
  openTestDatabase,
  type DatabaseHandle,
} from '@gto-self/db';
import type { SeatFormValue, SessionFormValue } from '../lib/session-setup/contract.js';
import { emptySeatForm } from '../lib/session-setup/plan.js';
import { searchPlayers, startSession } from './session-service.js';

const NOW = timestamp(1_700_000_000_000);

function seat(overrides: Partial<SeatFormValue> = {}): SeatFormValue {
  return { ...emptySeatForm(), occupancy: 'ACTIVE', nickname: 'x', stackText: '100', ...overrides };
}

function form(overrides: Partial<SessionFormValue> = {}): SessionFormValue {
  return {
    presetId: CP_NL50_6MAX_ANTE.presetId,
    anteEnabled: true,
    label: 'Tuesday grind',
    buttonSeat: 0,
    autoTopUpEnabled: false,
    autoTopUpTargetText: '100',
    seats: SEAT_INDEXES.map((index) =>
      index < 3
        ? seat({ nickname: `Villain ${index}`, isHero: index === 0 })
        : { ...emptySeatForm(), occupancy: 'EMPTY' as const },
    ),
    ...overrides,
  };
}

function withSeat(
  value: SessionFormValue,
  index: SeatIndex,
  patch: Partial<SeatFormValue>,
): SessionFormValue {
  return {
    ...value,
    seats: value.seats.map((s, i) => (i === index ? { ...s, ...patch } : s)),
  };
}

describe('startSession', () => {
  let handle: DatabaseHandle;
  const deps = () => ({ ids: sequentialIdFactory('id'), now: NOW });

  beforeEach(() => {
    handle = openTestDatabase();
    return () => handle.close();
  });

  it('writes the session, its six seats, its preset row and its players', () => {
    const result = startSession(handle.db, form(), deps());
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (!result.ok) return;

    const stored = getSession(handle.db, asId<'Session'>(result.sessionId));
    expect(stored.ok).toBe(true);
    if (!stored.ok || stored.value === null) return;
    expect(stored.value.label).toBe('Tuesday grind');
    expect(stored.value.presetId).toBe(CP_NL50_6MAX_ANTE.presetId);
    expect(stored.value.table.config.ante.enabled).toBe(true);
    expect(stored.value.table.heroSeat).toBe(0);
    expect(stored.value.table.buttonSeat).toBe(0);
    expect(stored.value.table.seats[0].stack).toBe(Money.mbb(100_000));
    expect(stored.value.table.seats[3].occupancy).toBe('EMPTY');
    expect(stored.value.autoTopUp).toBeNull();

    // The preset row the session's foreign key needs was created for it.
    const preset = handle.sqlite
      .prepare(`select count(*) as n from game_presets where preset_id = ?`)
      .get(CP_NL50_6MAX_ANTE.presetId);
    expect(preset).toEqual({ n: 1 });
    expect(listPlayers(handle.db)).toMatchObject({ ok: true });
  });

  it('REUSES an existing player rather than creating a second one with the same nickname', () => {
    const existing = createPlayer({
      id: asId<'Player'>('already-here') as PlayerId,
      nickname: 'Villain 1',
      createdAt: NOW,
    });
    expect(existing.ok).toBe(true);
    if (!existing.ok) return;
    expect(insertPlayer(handle.db, existing.value).ok).toBe(true);

    // Typed by hand, in different casing and spacing, with no autocomplete pick.
    const result = startSession(
      handle.db,
      withSeat(form(), 1, { nickname: '  villain 1 ' }),
      deps(),
    );
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (!result.ok) return;

    const players = listPlayers(handle.db);
    expect(players.ok).toBe(true);
    if (!players.ok) return;
    expect(players.value.filter((p) => p.normalizedNickname === 'villain 1')).toHaveLength(1);
    expect(players.value).toHaveLength(3);

    const stored = getSession(handle.db, asId<'Session'>(result.sessionId));
    if (!stored.ok || stored.value === null) throw new Error('session missing');
    expect(stored.value.table.seats[1].playerId).toBe('already-here');
    // The entered nickname is preserved on the player, not overwritten by the new casing.
    expect(players.value.find((p) => p.id === 'already-here')?.nickname).toBe('Villain 1');
  });

  it('reuses a player picked from the autocomplete by id', () => {
    const existing = createPlayer({
      id: asId<'Player'>('picked') as PlayerId,
      nickname: 'Nemesis',
      createdAt: NOW,
    });
    if (!existing.ok) throw new Error('fixture');
    insertPlayer(handle.db, existing.value);

    const result = startSession(
      handle.db,
      withSeat(form(), 2, { nickname: 'Nemesis', existingPlayerId: 'picked' }),
      deps(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stored = getSession(handle.db, asId<'Session'>(result.sessionId));
    if (!stored.ok || stored.value === null) throw new Error('session missing');
    expect(stored.value.table.seats[2].playerId).toBe('picked');
    const players = listPlayers(handle.db);
    if (!players.ok) return;
    expect(players.value.filter((p) => p.normalizedNickname === 'nemesis')).toHaveLength(1);
  });

  it('reports a picked player that has since disappeared instead of inventing one', () => {
    const result = startSession(
      handle.db,
      withSeat(form(), 2, { existingPlayerId: 'no-such-player' }),
      deps(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.code).toBe('NOT_FOUND');
    expect(result.issues[0]?.seat).toBe(2);
  });

  it('stores the auto top-up policy the form collected', () => {
    const result = startSession(
      handle.db,
      form({ autoTopUpEnabled: true, autoTopUpTargetText: '75.5' }),
      deps(),
    );
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (!result.ok) return;
    const stored = getSession(handle.db, asId<'Session'>(result.sessionId));
    if (!stored.ok || stored.value === null) throw new Error('session missing');
    expect(stored.value.autoTopUp).toEqual({
      enabled: true,
      targetStack: Money.mbb(75_500),
      threshold: Money.mbb(75_500),
    });
  });

  it('writes the optional HUD snapshot, and none when the fields are blank', () => {
    const result = startSession(
      handle.db,
      withSeat(form(), 1, { hud: { VPIP: '24.5', PFR: '19' }, hudHandsText: '1240' }),
      deps(),
    );
    expect(result.ok, JSON.stringify(result)).toBe(true);
    const snapshots = handle.sqlite
      .prepare(`select count(*) as n from player_hud_snapshots`)
      .get() as { readonly n: number };
    expect(snapshots.n).toBe(1);
    const stats = handle.sqlite
      .prepare(
        `select stat_key, entered_text, value_centipercent from player_hud_snapshot_stats order by ordinal`,
      )
      .all();
    expect(stats).toEqual([
      { stat_key: 'VPIP', entered_text: '24.5', value_centipercent: 2450 },
      { stat_key: 'PFR', entered_text: '19', value_centipercent: 1900 },
    ]);
  });

  it('ROLLS BACK everything when the engine rejects the table', () => {
    // One active seat: `poker-core` refuses a table that cannot deal a hand.
    const lonely = form({
      seats: SEAT_INDEXES.map((index) =>
        index === 0
          ? seat({ nickname: 'Hero', isHero: true })
          : { ...emptySeatForm(), occupancy: 'EMPTY' as const },
      ),
    });
    const result = startSession(handle.db, lonely, deps());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.code).toBe('NOT_ENOUGH_PLAYERS');

    // No player, no preset and no session survived the failed submission.
    for (const table of ['players', 'sessions', 'session_seats', 'game_presets']) {
      expect(
        handle.sqlite.prepare(`select count(*) as n from ${table}`).get(),
        `${table} should be empty`,
      ).toEqual({ n: 0 });
    }
  });

  it('rejects an unparseable stack before touching the database', () => {
    const result = startSession(handle.db, withSeat(form(), 1, { stackText: '1o0' }), deps());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.field).toBe('stackText');
    expect(handle.sqlite.prepare(`select count(*) as n from players`).get()).toEqual({ n: 0 });
  });

  it('rejects a malformed submission instead of trusting its shape', () => {
    for (const bad of [null, {}, { presetId: 1 }, { ...form(), seats: [] }]) {
      const result = startSession(handle.db, bad, deps());
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.issues.length).toBeGreaterThan(0);
    }
  });

  it('reuses an existing preset row instead of failing on the unique key', () => {
    const first = startSession(handle.db, form(), deps());
    expect(first.ok).toBe(true);
    const second = startSession(
      handle.db,
      form({
        seats: form().seats.map((s, i) => ({
          ...s,
          nickname: s.nickname === '' ? '' : `Other ${i}`,
        })),
      }),
      { ids: sequentialIdFactory('second'), now: NOW },
    );
    expect(second.ok, JSON.stringify(second)).toBe(true);
    expect(handle.sqlite.prepare(`select count(*) as n from game_presets`).get()).toEqual({ n: 1 });
    expect(handle.sqlite.prepare(`select count(*) as n from sessions`).get()).toEqual({ n: 2 });
  });
});

describe('searchPlayers', () => {
  let handle: DatabaseHandle;
  beforeEach(() => {
    handle = openTestDatabase();
    for (const nickname of ['Dan', 'Danny', 'Nemesis']) {
      const player = createPlayer({
        id: asId<'Player'>(nickname.toLowerCase()) as PlayerId,
        nickname,
        createdAt: NOW,
      });
      if (player.ok) insertPlayer(handle.db, player.value);
    }
    return () => handle.close();
  });

  it('finds players by nickname prefix, exact match first', () => {
    const found = searchPlayers(handle.db, 'dan');
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.matches.map((m) => m.nickname)).toEqual(['Dan', 'Danny']);
    expect(found.matches[0]?.kind).toBe('EXACT');
  });

  it('returns nothing for a blank or unmatched query, and never throws', () => {
    for (const query of ['', '   ', 'zzz']) {
      const found = searchPlayers(handle.db, query);
      expect(found.ok).toBe(true);
      if (found.ok) expect(found.matches).toEqual([]);
    }
  });

  it('refuses a non-string query', () => {
    expect(searchPlayers(handle.db, 42).ok).toBe(false);
  });
});
