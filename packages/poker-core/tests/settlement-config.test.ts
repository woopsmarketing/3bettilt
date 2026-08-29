/**
 * Split pots and odd chips (§7.13, assumption #12), and the configuration flags that
 * exist so ambiguous poker rules are data rather than code (CLAUDE.md rule 7).
 */
import { describe, expect, it } from 'vitest';
import { Money } from '@gto-self/shared';
import { DEFAULT_RULE_OPTIONS, validateTableConfig, withStakeDisplay } from '../src/config.js';
import { oddChipOrder, splitPot } from '../src/settlement.js';
import { call, check, dealBoard, betTo } from '../src/commands.js';
import {
  ANTE_PRESET,
  BB,
  NO_ANTE_PRESET,
  buildTable,
  cards,
  ids,
  sixHanded,
  start,
} from '../src/testing.js';
import { stacks, step } from './_helpers.js';

describe('odd chips on a split pot', () => {
  it('goes to the first winner clockwise from the button, not the lowest seat', () => {
    // Button on seat 2: clockwise from it, seat 3 comes before seat 1.
    const st = start(
      buildTable({
        stacks: { 0: BB(100), 1: BB(100), 2: BB(100), 3: BB(100), 4: BB(100), 5: BB(100) },
        buttonSeat: 2,
      }),
      ids(),
    ).state;

    expect(oddChipOrder(st, [1, 3])).toEqual([3, 1]);
    expect(oddChipOrder(st, [0, 4, 5])).toEqual([4, 5, 0]);

    const shares = splitPot(st, Money.mbb(4751), [1, 3]);
    expect(Money.sum(shares.map((s) => s.amount))).toBe(4751);
    expect(shares.find((s) => s.seat === 3)?.amount).toBe(2376);
    expect(shares.find((s) => s.seat === 1)?.amount).toBe(2375);
  });

  it('goes to the lowest seat index when configured that way', () => {
    const config = {
      ...NO_ANTE_PRESET,
      rules: { ...DEFAULT_RULE_OPTIONS, oddChipRule: 'LOWEST_SEAT_INDEX' as const },
    };
    const st = start(
      buildTable({
        config,
        stacks: { 0: BB(100), 1: BB(100), 2: BB(100), 3: BB(100), 4: BB(100), 5: BB(100) },
        buttonSeat: 2,
      }),
      ids(),
    ).state;

    expect(oddChipOrder(st, [1, 3])).toEqual([1, 3]);
    const shares = splitPot(st, Money.mbb(4751), [1, 3]);
    expect(shares.find((s) => s.seat === 1)?.amount).toBe(2376);
    expect(shares.find((s) => s.seat === 3)?.amount).toBe(2375);
  });

  it('splits a real pot with a remaining milliBB end to end', () => {
    const f = ids();
    let hand = start(
      buildTable({ stacks: { 0: BB(100), 1: BB(100), 2: BB(100) }, buttonSeat: 0 }),
      f,
    );
    hand = step(hand, call(), f); // BTN limps
    hand = step(hand, call(), f); // SB completes
    hand = step(hand, check(), f); // BB checks
    hand = step(hand, dealBoard(cards('Ah Kd 7c')), f);
    hand = step(hand, check(), f); // SB
    hand = step(hand, betTo(Money.mbb(1001)), f); // BB leads an awkward size
    hand = step(hand, call(), f); // BTN
    hand = step(hand, call(), f); // SB
    hand = step(hand, dealBoard(cards('2d')), f);
    for (let i = 0; i < 3; i += 1) hand = step(hand, check(), f);
    hand = step(hand, dealBoard(cards('Js')), f);
    for (let i = 0; i < 3; i += 1) hand = step(hand, check(), f);

    expect(hand.state.potTotal).toBe(6003); // 3 x (1000 + 1001)
    // rake floor(6003 * 5 / 100) = 300, net 5703; split two ways = 2851 + one odd chip.
    hand = step(hand, { kind: 'AWARD_POTS', awards: [{ potIndex: 0, winners: [1, 2] }] }, f);
    expect(hand.state.totalRake).toBe(300);

    const award = hand.events.find((e) => e.kind === 'POT_AWARDED');
    expect(award).toMatchObject({ grossAmount: 6003, rake: 300, netAmount: 5703 });
    expect(stacks(hand.state)).toEqual({
      0: 97999, // 100000 - 2001
      1: 100851, // 97999 + 2852 (the odd chip, first clockwise from the button)
      2: 100850, // 97999 + 2851
    });
  });
});

describe('the big blind option flag', () => {
  it('closes the round without an option when bigBlindHasOption is off', () => {
    const config = {
      ...NO_ANTE_PRESET,
      rules: { ...DEFAULT_RULE_OPTIONS, bigBlindHasOption: false },
    };
    const f = ids();
    let hand = start(sixHanded(config), f);
    for (let i = 0; i < 4; i += 1) hand = step(hand, call(), f); // UTG HJ CO BTN limp
    hand = step(hand, call(), f); // the SB completes

    // Nobody owes chips and the flag says the big blind gets no option.
    expect(hand.state.actorSeat).toBeNull();
    expect(hand.state.phase).toBe('AWAITING_BOARD');
    expect(hand.state.pendingStreet).toBe('FLOP');
    expect(hand.state.potTotal).toBe(6000);
  });
});

describe('table configuration validation', () => {
  const bad = (patch: Record<string, unknown>) =>
    validateTableConfig({ ...NO_ANTE_PRESET, ...patch } as never);

  it('accepts the shipped presets', () => {
    expect(validateTableConfig(NO_ANTE_PRESET).ok).toBe(true);
    expect(validateTableConfig(ANTE_PRESET).ok).toBe(true);
  });

  it('rejects impossible blinds, bets and stacks', () => {
    expect(bad({ blinds: { smallBlind: Money.mbb(0), bigBlind: Money.mbb(1000) } }).ok).toBe(false);
    expect(bad({ blinds: { smallBlind: Money.mbb(2000), bigBlind: Money.mbb(1000) } }).ok).toBe(
      false,
    );
    expect(bad({ minBet: Money.mbb(0) }).ok).toBe(false);
    expect(bad({ referenceStack: Money.mbb(0) }).ok).toBe(false);
    expect(
      bad({ ante: { enabled: true, mode: 'PER_DEALT_IN_PLAYER', amount: Money.mbb(-1) } }).ok,
    ).toBe(false);
  });

  it('rejects an impossible rake configuration', () => {
    expect(bad({ rake: { ...NO_ANTE_PRESET.rake, denominator: 0 } }).ok).toBe(false);
    expect(bad({ rake: { ...NO_ANTE_PRESET.rake, numerator: -1 } }).ok).toBe(false);
    expect(bad({ rake: { ...NO_ANTE_PRESET.rake, numerator: 101 } }).ok).toBe(false);
    expect(bad({ rake: { ...NO_ANTE_PRESET.rake, cap: Money.mbb(-1) } }).ok).toBe(false);
  });

  it('rejects an ante mode it does not implement rather than half-building it', () => {
    const result = bad({
      ante: { enabled: true, mode: 'BIG_BLIND_ANTE', amount: Money.mbb(160) },
    });
    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_CONFIG' } });
  });

  it('reaches NL100 by changing only the cap and the display', () => {
    const nl100 = withStakeDisplay(ANTE_PRESET, {
      presetId: 'CP_NL100_6MAX_ANTE',
      label: 'CoinPoker NL100 6-max (ante)',
      rakeCap: Money.mbb(6000),
      rakeQuantum: Money.mbb(10), // one cent at BB = 1.00
      bigBlindValue: 1,
    });
    expect(validateTableConfig(nl100).ok).toBe(true);
    expect(nl100.rake.cap).toBe(6000);
    expect(nl100.display.bigBlindValue).toBe(1);
    // Nothing about the game itself moved.
    expect(nl100.blinds).toEqual(ANTE_PRESET.blinds);
    expect(nl100.ante).toEqual(ANTE_PRESET.ante);
    expect(nl100.rake.numerator).toBe(5);
    expect(nl100.rake.denominator).toBe(100);
  });
});
