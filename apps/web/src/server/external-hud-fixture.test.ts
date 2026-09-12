import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const fixturePath = join(import.meta.dirname, '../../scripts/fixtures/external-hud-2026-09.json');

interface FixturePlayer {
  readonly nickname: string;
}

interface Fixture {
  readonly players: readonly FixturePlayer[];
}

describe('external-hud-2026-09.json fixture', () => {
  const fixture: Fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as Fixture;

  it('carries all 18 known nicknames with no duplicates and no invented data', () => {
    const nicknames = fixture.players.map((player) => player.nickname);
    expect(nicknames).toHaveLength(18);
    expect(new Set(nicknames).size).toBe(18);
    expect(nicknames).toEqual(
      expect.arrayContaining([
        'Shadow7',
        'STORM88',
        'Ssallabd',
        'Dre4mTe4m',
        '15shasha',
        'Thestral4ik',
        'Dennism97',
        'Pivovarich',
        'acn1977',
        'AlmostAll',
        'Xzappa59',
        'Superlove',
        'vonKoren',
        'SweetLittleLies',
        'LastChance40',
        'Liedetectors',
        'sk0ln13x',
        'LukaAncelotti',
      ]),
    );
  });

  it('carries 15shasha refreshed lifetime values, distinct from the prior snapshot', () => {
    const shasha = fixture.players.find((player) => player.nickname === '15shasha') as
      | (FixturePlayer & Record<string, unknown>)
      | undefined;
    expect(shasha).toBeDefined();
    expect(shasha?.THREE_BET).toBe(14);
    expect(shasha?.FOLD_TO_CBET).toBe(28);
    expect(shasha?.WSD).toBe(51);
  });
});
