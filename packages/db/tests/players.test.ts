/**
 * `players` — identity, the normalized-nickname key, and the fact that there is no delete.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { asId, unwrap, type PlayerId } from '@gto-self/shared';
import { createPlayer, timestamp, type Player } from '@gto-self/player-core';
import * as playerRepository from '../src/repositories/players.js';
import { openTestDatabase, type DatabaseHandle } from '../src/client.js';
import { players } from '../src/schema.js';

const T0 = timestamp(1_700_000_000_000);
const T1 = timestamp(1_700_000_060_000);

function player(id: string, nickname: string, alias: string | null = null): Player {
  return unwrap(
    createPlayer({
      id: asId<'Player'>(id) as PlayerId,
      nickname,
      displayAlias: alias,
      createdAt: T0,
    }),
  );
}

describe('player repository', () => {
  let handle: DatabaseHandle;
  beforeEach(() => {
    handle = openTestDatabase();
    return () => handle.close();
  });

  it('round-trips a player with BOTH the entered and the normalized nickname', () => {
    const dan = player('p1', '  DeepStack  Dan ');
    expect(dan.nickname).toBe('DeepStack  Dan');
    expect(dan.normalizedNickname).toBe('deepstack dan');
    expect(playerRepository.insertPlayer(handle.db, dan).ok).toBe(true);

    const loaded = playerRepository.findPlayerById(handle.db, dan.id);
    expect(loaded.ok && loaded.value).toEqual(dan);

    const row = handle.db.select().from(players).all()[0];
    expect(row?.nickname).toBe('DeepStack  Dan');
    expect(row?.normalizedNickname).toBe('deepstack dan');
  });

  it('rejects a duplicate NORMALIZED nickname at the repository', () => {
    expect(playerRepository.insertPlayer(handle.db, player('p1', 'Dan')).ok).toBe(true);
    const clash = playerRepository.insertPlayer(handle.db, player('p2', '  dAn  '));
    expect(clash.ok).toBe(false);
    if (!clash.ok) expect(clash.error.code).toBe('CONFLICT');
  });

  it('rejects a duplicate NORMALIZED nickname at the UNIQUE INDEX, bypassing the repository', () => {
    expect(playerRepository.insertPlayer(handle.db, player('p1', 'Dan')).ok).toBe(true);
    expect(() =>
      handle.db
        .insert(players)
        .values({
          id: 'p2',
          nickname: 'dAn',
          normalizedNickname: 'dan',
          displayAlias: null,
          createdAt: T0,
          updatedAt: T0,
          archived: false,
        })
        .run(),
    ).toThrow(/UNIQUE constraint failed: players.normalized_nickname/u);
  });

  it('allows two players whose ENTERED nicknames differ only in an unnormalized way is impossible, but distinct names are fine', () => {
    expect(playerRepository.insertPlayer(handle.db, player('p1', 'Dan')).ok).toBe(true);
    expect(playerRepository.insertPlayer(handle.db, player('p2', 'Danny')).ok).toBe(true);
  });

  it('renames, re-deriving the normalized key and re-checking the collision', () => {
    const dan = player('p1', 'Dan');
    unwrap(playerRepository.insertPlayer(handle.db, dan));
    unwrap(playerRepository.insertPlayer(handle.db, player('p2', 'Erik')));

    const renamed = playerRepository.renamePlayerNickname(handle.db, dan.id, 'Big Dan', T1);
    expect(renamed.ok && renamed.value.nickname).toBe('Big Dan');
    expect(renamed.ok && renamed.value.normalizedNickname).toBe('big dan');
    expect(renamed.ok && renamed.value.updatedAt).toBe(T1);

    const collide = playerRepository.renamePlayerNickname(handle.db, dan.id, 'erik', T1);
    expect(collide.ok).toBe(false);
    if (!collide.ok) expect(collide.error.code).toBe('CONFLICT');
    // The failed rename wrote nothing.
    const reread = playerRepository.findPlayerById(handle.db, dan.id);
    expect(reread.ok && reread.value?.nickname).toBe('Big Dan');
  });

  it('sets and clears the display alias without touching the nickname', () => {
    const dan = player('p1', 'Dan');
    unwrap(playerRepository.insertPlayer(handle.db, dan));
    const aliased = playerRepository.setPlayerAlias(handle.db, dan.id, 'The Nit', T1);
    expect(aliased.ok && aliased.value.displayAlias).toBe('The Nit');
    expect(aliased.ok && aliased.value.nickname).toBe('Dan');
    const cleared = playerRepository.setPlayerAlias(handle.db, dan.id, null, T1);
    expect(cleared.ok && cleared.value.displayAlias).toBeNull();
  });

  it('archives instead of deleting, and archiving keeps the row and its key', () => {
    const dan = player('p1', 'Dan');
    unwrap(playerRepository.insertPlayer(handle.db, dan));
    const archived = playerRepository.archivePlayer(handle.db, dan.id, true, T1);
    expect(archived.ok && archived.value.archived).toBe(true);

    expect(handle.db.select().from(players).all()).toHaveLength(1);
    const listed = playerRepository.listPlayers(handle.db);
    expect(listed.ok && listed.value).toHaveLength(0);
    const withArchived = playerRepository.listPlayers(handle.db, { includeArchived: true });
    expect(withArchived.ok && withArchived.value).toHaveLength(1);
    // The nickname is still reserved: an archived player is retired, not gone.
    const reuse = playerRepository.insertPlayer(handle.db, player('p2', 'dan'));
    expect(reuse.ok).toBe(false);
  });

  it('exposes NO delete function', () => {
    const names = Object.keys(playerRepository);
    expect(names.filter((name) => /delete|remove|drop|purge/iu.test(name))).toEqual([]);
  });

  it('looks a player up by normalized nickname, accepting either form', () => {
    const dan = player('p1', 'DeepStack Dan');
    unwrap(playerRepository.insertPlayer(handle.db, dan));
    for (const query of ['DeepStack Dan', 'deepstack dan', '  DEEPSTACK   dan  ']) {
      const found = playerRepository.findPlayerByNormalizedNickname(handle.db, query);
      expect(found.ok && found.value?.id).toBe(dan.id);
    }
    const missing = playerRepository.findPlayerByNormalizedNickname(handle.db, 'nobody');
    expect(missing.ok && missing.value).toBeNull();
  });

  it('prefix-searches for the Phase-4 autocomplete, ranking EXACT before PREFIX', () => {
    for (const [id, nickname] of [
      ['p1', 'Dan'],
      ['p2', 'Danny'],
      ['p3', 'DanTheMan'],
      ['p4', 'Erik'],
    ] as const) {
      unwrap(playerRepository.insertPlayer(handle.db, player(id, nickname)));
    }
    const matches = playerRepository.searchPlayersByNicknamePrefix(handle.db, 'dan');
    expect(matches.ok).toBe(true);
    if (!matches.ok) return;
    expect(matches.value.map((match) => match.player.nickname)).toEqual([
      'Dan',
      'Danny',
      'DanTheMan',
    ]);
    expect(matches.value[0]?.kind).toBe('EXACT');
    expect(matches.value[1]?.kind).toBe('PREFIX');
  });

  it('treats LIKE wildcards in a query as literal text', () => {
    unwrap(playerRepository.insertPlayer(handle.db, player('p1', 'Dan')));
    unwrap(playerRepository.insertPlayer(handle.db, player('p2', '100%Nit')));
    const matches = playerRepository.searchPlayersByNicknamePrefix(handle.db, '100%');
    expect(matches.ok && matches.value.map((match) => match.player.nickname)).toEqual(['100%Nit']);
  });

  /**
   * `createPlayer` trims. `decodeNoteRow` already refused a body that "would change on
   * read"; the player decoder ran the same trimming constructor and never compared, so a
   * stored `'  Dan  '` came back as `'Dan'` — a read that quietly rewrote what was entered
   * (`CLAUDE.md` rule 3). Both entered fields are now compared.
   */
  it('reports a row whose stored nickname would be TRIMMED on read, rather than trimming it', () => {
    handle.db
      .insert(players)
      .values({
        id: 'p1',
        nickname: '  Dan  ',
        // The normalized column is correct, so this is the nickname check firing, not it.
        normalizedNickname: 'dan',
        displayAlias: null,
        createdAt: T0,
        updatedAt: T0,
        archived: false,
      })
      .run();
    const loaded = playerRepository.findPlayerById(handle.db, asId<'Player'>('p1') as PlayerId);
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) {
      expect(loaded.error.code).toBe('CORRUPT_ROW');
      expect(loaded.error.context.field).toBe('nickname');
      expect(loaded.error.context.actual).toBe('  Dan  ');
    }
    // The stored bytes are untouched: the decoder reported, it did not repair.
    expect(handle.db.select().from(players).all()[0]?.nickname).toBe('  Dan  ');
    // Every read path goes through the same decoder.
    expect(playerRepository.findPlayerByNormalizedNickname(handle.db, 'dan').ok).toBe(false);
    expect(playerRepository.listPlayers(handle.db).ok).toBe(false);
  });

  it('reports a row whose stored display_alias would be TRIMMED on read', () => {
    handle.db
      .insert(players)
      .values({
        id: 'p1',
        nickname: 'Dan',
        normalizedNickname: 'dan',
        displayAlias: ' The Nit ',
        createdAt: T0,
        updatedAt: T0,
        archived: false,
      })
      .run();
    const loaded = playerRepository.findPlayerById(handle.db, asId<'Player'>('p1') as PlayerId);
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) {
      expect(loaded.error.code).toBe('CORRUPT_ROW');
      expect(loaded.error.context.field).toBe('display_alias');
    }
  });

  it('still reads back a nickname whose INTERNAL spacing and case are unusual', () => {
    // The check must reject only what would CHANGE, never what is merely unusual.
    const dan = player('p1', 'DeepStack  DAN');
    unwrap(playerRepository.insertPlayer(handle.db, dan));
    const loaded = playerRepository.findPlayerById(handle.db, dan.id);
    expect(loaded.ok && loaded.value?.nickname).toBe('DeepStack  DAN');
  });

  it('reports a row whose normalized column is not the normalization of its nickname', () => {
    handle.db
      .insert(players)
      .values({
        id: 'p1',
        nickname: 'Dan',
        normalizedNickname: 'someone-else',
        displayAlias: null,
        createdAt: T0,
        updatedAt: T0,
        archived: false,
      })
      .run();
    const loaded = playerRepository.findPlayerById(handle.db, asId<'Player'>('p1') as PlayerId);
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) expect(loaded.error.code).toBe('CORRUPT_ROW');
  });
});
