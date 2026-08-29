import { describe, expect, it } from 'vitest';
import { asId, isErr, unwrap, type PlayerId } from '@gto-self/shared';
import {
  MAX_NICKNAME_LENGTH,
  createPlayer,
  findByNickname,
  normalizeNickname,
  renamePlayer,
  sameNickname,
  searchPlayersByNickname,
  setArchived,
  setDisplayAlias,
  type NicknameOwner,
  type Player,
} from './player.js';
import { timestamp } from './time.js';

const id = (value: string) => asId<'Player'>(value);
const T0 = timestamp(1_700_000_000_000);
const T1 = timestamp(1_700_000_060_000);

const player = (overrides: Partial<Parameters<typeof createPlayer>[0]> = {}): Player =>
  unwrap(createPlayer({ id: id('p1'), nickname: 'Villain One', createdAt: T0, ...overrides }));

const owner = (value: string, normalized: string): NicknameOwner => ({
  id: id(value),
  normalizedNickname: normalized,
});

describe('normalizeNickname', () => {
  it('trims, collapses internal whitespace and lowercases', () => {
    expect(normalizeNickname('  Deep   Stack\tDan ')).toBe('deep stack dan');
  });

  it('applies NFKC so compatibility forms compare equal', () => {
    expect(normalizeNickname('ﬁsh')).toBe('fish'); // U+FB01 fi ligature
    expect(normalizeNickname('Ａce')).toBe('ace'); // U+FF21 fullwidth A
  });

  it('lowercases locale-independently', () => {
    // toLocaleLowerCase under a Turkish locale would produce a dotless i and make the
    // stored key depend on the machine.
    expect(normalizeNickname('I')).toBe('i');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(normalizeNickname('   ')).toBe('');
  });

  it('backs sameNickname', () => {
    expect(sameNickname('Villain One', ' villain   one ')).toBe(true);
    expect(sameNickname('Villain One', 'Villain Two')).toBe(false);
  });
});

describe('createPlayer', () => {
  it('keeps the entered nickname and stores the normalized form alongside it', () => {
    const created = player({ nickname: '  Deep Stack Dan ' });
    expect(created.nickname).toBe('Deep Stack Dan');
    expect(created.normalizedNickname).toBe('deep stack dan');
    expect(created.displayAlias).toBeNull();
    expect(created.archived).toBe(false);
    expect(created.createdAt).toBe(T0);
    expect(created.updatedAt).toBe(T0);
  });

  it('accepts and trims an optional display alias', () => {
    expect(player({ displayAlias: '  Dan  ' }).displayAlias).toBe('Dan');
    expect(player({ displayAlias: null }).displayAlias).toBeNull();
  });

  it('rejects an empty, whitespace-only or control-character nickname', () => {
    for (const nickname of ['', '   ', 'line\nbreak', 'tab\there', 'bell\u0007']) {
      const result = createPlayer({ id: id('p1'), nickname, createdAt: T0 });
      expect(isErr(result) && result.error.code).toBe('INVALID_NICKNAME');
    }
  });

  it('rejects a nickname longer than the limit, counting code points', () => {
    const long = 'a'.repeat(MAX_NICKNAME_LENGTH + 1);
    const result = createPlayer({ id: id('p1'), nickname: long, createdAt: T0 });
    expect(isErr(result) && result.error.code).toBe('INVALID_NICKNAME');
    expect(isErr(result) && result.error.context.actual).toBe(MAX_NICKNAME_LENGTH + 1);
    const atLimit = createPlayer({
      id: id('p1'),
      nickname: 'a'.repeat(MAX_NICKNAME_LENGTH),
      createdAt: T0,
    });
    expect(atLimit.ok).toBe(true);
  });

  it('rejects an empty display alias with its own code', () => {
    const result = createPlayer({
      id: id('p1'),
      nickname: 'Villain',
      displayAlias: '   ',
      createdAt: T0,
    });
    expect(isErr(result) && result.error.code).toBe('INVALID_ALIAS');
  });

  it('rejects an invalid timestamp', () => {
    const result = createPlayer({ id: id('p1'), nickname: 'Villain', createdAt: 1.5 as never });
    expect(isErr(result) && result.error.code).toBe('INVALID_TIMESTAMP');
  });

  it('rejects a duplicate normalized nickname and names the conflicting id', () => {
    const result = createPlayer(
      { id: id('p2'), nickname: '  VILLAIN   one ', createdAt: T0 },
      { existing: [owner('p1', 'villain one')] },
    );
    expect(isErr(result) && result.error.code).toBe('DUPLICATE_NICKNAME');
    expect(isErr(result) && result.error.context.conflictingId).toBe('p1');
  });

  it('allows a nickname that does not collide after normalization', () => {
    const result = createPlayer(
      { id: id('p2'), nickname: 'Villain Two', createdAt: T0 },
      { existing: [owner('p1', 'villain one')] },
    );
    expect(result.ok).toBe(true);
  });
});

describe('renamePlayer', () => {
  it('re-derives the normalized nickname and bumps updatedAt', () => {
    const renamed = unwrap(renamePlayer(player(), 'Nit Nelly', T1));
    expect(renamed.nickname).toBe('Nit Nelly');
    expect(renamed.normalizedNickname).toBe('nit nelly');
    expect(renamed.updatedAt).toBe(T1);
    expect(renamed.createdAt).toBe(T0);
  });

  it('does not treat the player as its own duplicate', () => {
    const existing = player();
    const result = renamePlayer(existing, 'villain one', T1, { existing: [existing] });
    expect(result.ok).toBe(true);
  });

  it('rejects a collision with another player', () => {
    const result = renamePlayer(player(), 'Nit Nelly', T1, {
      existing: [owner('p2', 'nit nelly')],
    });
    expect(isErr(result) && result.error.code).toBe('DUPLICATE_NICKNAME');
  });

  it('rejects a backwards updatedAt', () => {
    const result = renamePlayer(player(), 'Nit Nelly', timestamp(T0 - 1));
    expect(isErr(result) && result.error.code).toBe('TIMESTAMP_OUT_OF_ORDER');
  });

  it('leaves the previous record untouched', () => {
    const original = player();
    unwrap(renamePlayer(original, 'Nit Nelly', T1));
    expect(original.nickname).toBe('Villain One');
  });
});

describe('setDisplayAlias and setArchived', () => {
  it('sets and clears the alias', () => {
    const withAlias = unwrap(setDisplayAlias(player(), ' Dan ', T1));
    expect(withAlias.displayAlias).toBe('Dan');
    expect(unwrap(setDisplayAlias(withAlias, null, T1)).displayAlias).toBeNull();
  });

  it('rejects an invalid alias and a backwards timestamp', () => {
    expect(isErr(setDisplayAlias(player(), '  ', T1))).toBe(true);
    const backwards = setDisplayAlias(player(), 'Dan', timestamp(T0 - 1));
    expect(isErr(backwards) && backwards.error.code).toBe('TIMESTAMP_OUT_OF_ORDER');
  });

  it('archives instead of deleting, and can un-archive', () => {
    const archived = unwrap(setArchived(player(), true, T1));
    expect(archived.archived).toBe(true);
    expect(archived.id).toBe(player().id);
    expect(unwrap(setArchived(archived, false, T1)).archived).toBe(false);
  });
});

describe('nickname lookup and search', () => {
  const players: readonly NicknameOwner[] = [
    owner('p1', 'villain one'),
    owner('p2', 'villain two'),
    owner('p3', 'the villain'),
    owner('p4', 'nit nelly'),
  ];

  it('finds an exact match regardless of entered casing or spacing', () => {
    expect(findByNickname(players, ' VILLAIN   One ')?.id).toBe('p1' as PlayerId);
    expect(findByNickname(players, 'nobody')).toBeUndefined();
  });

  it('ranks exact, then prefix, then substring, with deterministic ties', () => {
    const matches = searchPlayersByNickname(players, 'villain');
    expect(matches.map((m) => [m.player.id, m.kind])).toEqual([
      ['p1', 'PREFIX'],
      ['p2', 'PREFIX'],
      ['p3', 'SUBSTRING'],
    ]);
    expect(searchPlayersByNickname(players, 'Villain ONE')[0]?.kind).toBe('EXACT');
  });

  it('returns nothing for a blank query and honours the limit', () => {
    expect(searchPlayersByNickname(players, '   ')).toEqual([]);
    expect(searchPlayersByNickname(players, 'villain', { limit: 2 })).toHaveLength(2);
    expect(searchPlayersByNickname(players, 'villain', { limit: 0 })).toEqual([]);
  });
});
