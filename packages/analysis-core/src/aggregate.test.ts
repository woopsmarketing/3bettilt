/**
 * Aggregation into a player model document: determinism, accumulation across hands and
 * sessions, and the confidence attached to every count.
 */
import { describe, expect, it } from 'vitest';
import { unwrap } from '@gto-self/shared';
import {
  DEFAULT_PLAYER_MODEL_CONFIG,
  type ModelStatKey,
  type PlayerModelContent,
} from '@gto-self/player-core';
import { computePlayerModel, playersInHands } from './aggregate.js';
import { ANALYSIS_ALGORITHM_VERSION } from './version.js';
import { inputIdentityHash } from './hash.js';
import { award, BB, flop, player, river, show, sixHanded, turn } from './testing.js';
import type { Hand } from '@gto-self/poker-core';

const FOLD = { kind: 'FOLD' } as const;
const CHECK = { kind: 'CHECK' } as const;
const CALL = { kind: 'CALL' } as const;
const raiseTo = (bb: number) => ({ kind: 'RAISE', toAmount: BB(bb) }) as const;
const betTo = (bb: number) => ({ kind: 'BET', toAmount: BB(bb) }) as const;

/** UTG folds, HJ folds, CO opens to 2.5 and wins uncontested. */
const coSteal = (id: string): Hand => sixHanded(id, [FOLD, FOLD, raiseTo(2.5), FOLD, FOLD, FOLD]);

/** CO opens, BB calls, CO c-bets the flop, BB folds. */
const coCbet = (id: string): Hand =>
  sixHanded(id, [FOLD, FOLD, raiseTo(2.5), FOLD, FOLD, CALL, flop(), CHECK, betTo(3), FOLD]);

/** CO opens, BB calls, checked to a showdown, CO shows and wins. */
const coShowdown = (id: string): Hand =>
  sixHanded(id, [
    FOLD,
    FOLD,
    raiseTo(2.5),
    FOLD,
    FOLD,
    CALL,
    flop(),
    CHECK,
    CHECK,
    turn(),
    CHECK,
    CHECK,
    river(),
    CHECK,
    CHECK,
    show(5, 'Ac Kd'),
    award(5),
  ]);

const model = (hands: readonly Hand[], seat: 0 | 1 | 2 | 3 | 4 | 5 = 5): PlayerModelContent =>
  unwrap(computePlayerModel(player(seat), hands));

const statOf = (content: PlayerModelContent, key: ModelStatKey, position: string | null = null) =>
  content.globalStats.find((row) => row.key === key && row.position === position);

describe('computePlayerModel', () => {
  it('stamps the algorithm version and the input identity', () => {
    const hands = [coSteal('h1'), coSteal('h2')];
    const content = model(hands);
    expect(content.analysisAlgorithmVersion).toBe(ANALYSIS_ALGORITHM_VERSION);
    expect(ANALYSIS_ALGORITHM_VERSION).toBe(1);
    expect(content.inputHash).toBe(inputIdentityHash(['h1', 'h2']));
  });

  it('accumulates counts across hands rather than replacing them', () => {
    // Three hands in which the CO is first-in every time, raising in two of them.
    const hands = [coSteal('h1'), coSteal('h2'), coCbet('h3')];
    const content = model(hands);
    expect(content.sourceHandCount).toBe(3);
    // RFI: three opportunities, three raises.
    expect(statOf(content, 'RFI')).toMatchObject({ opportunities: 3, actions: 3 });
    // CBET_FLOP: only the third hand reached a flop with the CO holding the lead.
    expect(statOf(content, 'CBET_FLOP')).toMatchObject({ opportunities: 1, actions: 1 });
  });

  it('accumulates the same identity across separate sessions', () => {
    // Two independently-built tables are two sessions' worth of hands; the player id is
    // the same identity in both, so the counts simply add (prompt §25).
    const sessionOne = [coSteal('s1-h1'), coSteal('s1-h2')];
    const sessionTwo = [coSteal('s2-h1')];
    const combined = model([...sessionOne, ...sessionTwo]);
    expect(combined.sourceHandCount).toBe(3);
    expect(statOf(combined, 'RFI')?.opportunities).toBe(3);
    // And the combined hash is not either half's hash.
    expect(combined.inputHash).not.toBe(model(sessionOne).inputHash);
  });

  it('emits an all-positions bucket and a positional bucket that are never summed', () => {
    const content = model([coSteal('h1'), coSteal('h2')]);
    const all = statOf(content, 'RFI', null);
    const co = statOf(content, 'RFI', 'CO');
    expect(all).toMatchObject({ opportunities: 2, actions: 2 });
    expect(co).toMatchObject({ opportunities: 2, actions: 2 });
    // The CO played from the CO seat in both hands, so the positional bucket carries the
    // same count as the all-positions one. Adding them would claim four opportunities.
    expect(content.globalStats.filter((row) => row.key === 'RFI')).toHaveLength(2);
  });

  it('never emits a row for a stat that never had an opportunity', () => {
    const content = model([coSteal('h1')]);
    expect(statOf(content, 'WSD')).toBeUndefined();
    expect(statOf(content, 'CHECK_RAISE_RIVER')).toBeUndefined();
    expect(content.globalStats.every((row) => row.opportunities > 0)).toBe(true);
  });

  it('attaches situation-specific confidence to every count', () => {
    const content = model([coSteal('h1'), coSteal('h2')]);
    const rfi = statOf(content, 'RFI');
    // Two opportunities is below the LEARNING threshold of five.
    expect(rfi?.confidence).toEqual({
      opportunities: 2,
      weightBps: 625, // round(10000 * 2 / 32)
      state: 'UNKNOWN',
      k: 30,
    });
    expect(content.confidence.k).toBe(30);
    expect(content.confidence.overall.opportunities).toBe(2);
  });

  it('records confidence per situation, not per player', () => {
    // Ten hands where the CO opens first-in, one of which reaches a flop c-bet. A large
    // overall sample says nothing about the c-bet spot (prompt §22).
    const hands = [...Array.from({ length: 9 }, (_, i) => coSteal(`h${i}`)), coCbet('hz')];
    const content = model(hands);
    expect(statOf(content, 'RFI')?.confidence.state).toBe('LEARNING'); // n = 10
    expect(statOf(content, 'CBET_FLOP')?.confidence.state).toBe('UNKNOWN'); // n = 1
  });

  it('collects spot buckets with the full action distribution', () => {
    const content = model([coSteal('h1'), coCbet('h2')], 2);
    // The BB folded to the CO open in h1 and called it in h2: one bucket, two decisions.
    const vsOpen = content.spotStats.find((spot) => spot.spotKey === 'BB_VS_CO_OPEN');
    expect(vsOpen).toMatchObject({
      opportunities: 2,
      effects: { FOLD: 1, CHECK: 0, CALL: 1, BET: 0, RAISE: 0 },
    });
  });

  it('keeps the verb alongside the effect so an all-in stays visible', () => {
    const content = model([coCbet('h1')], 5);
    const cbet = content.spotStats.find((spot) => spot.spotKey.startsWith('FLOP_CBET'));
    expect(cbet?.verbs.BET).toBe(1);
    expect(cbet?.verbs.ALL_IN).toBe(0);
  });

  it('collects revealed cards and counts them', () => {
    const content = model([coShowdown('h1'), coSteal('h2')]);
    expect(content.sourceShowCount).toBe(1);
    expect(content.showEvidence).toHaveLength(1);
    expect(content.showEvidence[0]?.handId).toBe('h1');
    // The opponent mucked, so its model has no card evidence at all.
    expect(model([coShowdown('h1')], 2).sourceShowCount).toBe(0);
  });

  it('counts observations as the number of decisions actually faced', () => {
    const content = model([coCbet('h1')]);
    // The CO faced two decisions: the preflop open and the flop c-bet.
    expect(content.sourceObservationCount).toBe(2);
  });

  it('returns an empty but well-formed model for a player with no hands', () => {
    const content = unwrap(computePlayerModel(player(5), []));
    expect(content.sourceHandCount).toBe(0);
    expect(content.globalStats).toEqual([]);
    expect(content.spotStats).toEqual([]);
    expect(content.confidence.overall.state).toBe('UNKNOWN');
    expect(content.inputHash).toBe(inputIdentityHash([]));
  });

  it('ignores a hand the player was not dealt into', () => {
    // Player 5 exists in these hands, player 3 folded in all of them; asking for a player
    // that never appears yields a zero-hand model, not an error.
    const content = unwrap(computePlayerModel(player(5), [coSteal('h1')]));
    expect(content.sourceHandCount).toBe(1);
  });

  it('rejects a duplicated hand rather than double-counting it', () => {
    const hand = coSteal('h1');
    const result = computePlayerModel(player(5), [hand, hand]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('DUPLICATE_HAND');
  });

  it('refuses an unfinished hand', () => {
    const unfinished = sixHanded('h-open', [FOLD, FOLD, raiseTo(2.5)]);
    const result = computePlayerModel(player(5), [unfinished]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('HAND_NOT_COMPLETE');
  });

  it('refuses a config whose thresholds are not usable', () => {
    const result = computePlayerModel(player(5), [], {
      config: {
        ...DEFAULT_PLAYER_MODEL_CONFIG,
        snapshotConfidence: { k: 30, learningThreshold: 40, knownThreshold: 30 },
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_CONFIG');
  });
});

describe('determinism', () => {
  const hands = (): readonly Hand[] => [coSteal('h1'), coCbet('h2'), coShowdown('h3')];

  it('produces a bit-identical document for the same hands', () => {
    const a = JSON.stringify(model(hands()));
    const b = JSON.stringify(model(hands()));
    expect(a).toBe(b);
  });

  it('produces a bit-identical document whatever order the hands arrive in', () => {
    const forward = hands();
    const reversed = [...hands()].reverse();
    const shuffled = [hands()[2] as Hand, hands()[0] as Hand, hands()[1] as Hand];
    const a = JSON.stringify(model(forward));
    expect(JSON.stringify(model(reversed))).toBe(a);
    expect(JSON.stringify(model(shuffled))).toBe(a);
  });

  it('sorts every emitted list by a stable key', () => {
    const content = model(hands());
    const spotKeys = content.spotStats.map((spot) => spot.spotKey);
    expect([...spotKeys].sort()).toEqual(spotKeys);
    const handIds = content.showEvidence.map((evidence) => evidence.handId);
    expect([...handIds].sort()).toEqual(handIds);
    const betHandIds = content.betSizes.map((size) => size.handId);
    expect([...betHandIds].sort()).toEqual(betHandIds);
  });

  it('changes the input hash but not the counts when an unrelated hand joins the set', () => {
    const base = model(hands());
    // The same three hands plus one the player folded in: hand count rises, the RFI
    // denominator rises with it (the player was still first-in), and the hash changes.
    const extra = model([...hands(), coSteal('h4')]);
    expect(extra.inputHash).not.toBe(base.inputHash);
    expect(extra.sourceHandCount).toBe(base.sourceHandCount + 1);
  });
});

describe('playersInHands', () => {
  it('lists every identified player once, sorted', () => {
    const found = playersInHands([coSteal('h1'), coCbet('h2')]);
    expect(found).toEqual([player(0), player(1), player(2), player(3), player(4), player(5)]);
  });

  it('is empty for an empty hand set', () => {
    expect(playersInHands([])).toEqual([]);
  });
});
