import { parseCards, unwrap, type Card } from '@gto-self/shared';
import { describe, expect, it } from 'vitest';
import { evaluateHand } from './evaluate.js';
import { analyzeHeroHand, HERO_BLOCKERS, nutStrengthOnBoard } from './heroHand.js';

const cards = (text: string): Card[] => unwrap(parseCards(text));
const hole = (text: string): [Card, Card] => {
  const parsed = cards(text);
  const [a, b] = parsed;
  if (a === undefined || b === undefined || parsed.length !== 2) {
    throw new Error(`"${text}" is not two cards`);
  }
  return [a, b];
};
const analyze = (heroText: string, boardText: string) =>
  analyzeHeroHand(hole(heroText), cards(boardText));

const R = {
  '2': 0,
  '3': 1,
  '4': 2,
  '5': 3,
  '6': 4,
  '7': 5,
  '8': 6,
  '9': 7,
  T: 8,
  J: 9,
  Q: 10,
  K: 11,
  A: 12,
} as const;

describe('the worked examples from the specification', () => {
  it('Ah Kh on Qh Jh 2c is the nut flush draw plus a gutshot with two overcards', () => {
    const features = analyze('Ah Kh', 'Qh Jh 2c');
    expect(features.value.category).toBe('HIGH_CARD');
    expect(features.madeClass).toBe('ACE_HIGH');
    expect(features.draws.flushDraw).toEqual({
      suit: 'h',
      holeCardsInSuit: 2,
      highRank: R.A,
      betterFlushCards: 0,
      nutClass: 'NUT',
    });
    expect(features.draws.straightDraw?.kind).toBe('GUTSHOT');
    expect(features.draws.straightDraw?.outRanks).toEqual([R.T]);
    expect(features.overcardCount).toBe(2);
    // The flush draw is live, so nothing here is a backdoor.
    expect(features.draws.backdoorFlushDraw).toBeNull();
    expect(features.draws.backdoorStraightDraw).toBe(false);
    expect(features.blockers).toContain('NUT_FLUSH_DRAW_BLOCKER');
    expect(features.blockers).toContain('FLUSH_DRAW_BLOCKER');
  });

  it('5c 5d on 5h 8s 8d is FIVES full of eights, from a set', () => {
    const features = analyze('5c 5d', '5h 8s 8d');
    expect(features.value.category).toBe('FULL_HOUSE');
    expect(features.value.ranks).toEqual([R['5'], R['8']]); // fives full of eights
    expect(features.madeClass).toBe('FULL_HOUSE');
    expect(features.tripsKind).toBe('SET');
    expect(features.holeCardsUsed).toBe(2);
    // The evaluator, not intuition, is the authority here.
    expect(features.value.strength).toBe(evaluateHand(cards('5c 5d 5h 8s 8d')).strength);
  });

  it('Tc 9c on 8c 7d 2h is an open-ender with a backdoor flush draw', () => {
    const features = analyze('Tc 9c', '8c 7d 2h');
    expect(features.madeClass).toBe('NO_MADE_HAND');
    expect(features.draws.straightDraw?.kind).toBe('OESD');
    expect(features.draws.straightDraw?.outRanks).toEqual([R['6'], R.J]);
    expect(features.draws.flushDraw).toBeNull();
    expect(features.draws.backdoorFlushDraw).toEqual({ suit: 'c', holeCardsInSuit: 2 });
    expect(features.overcardCount).toBe(2);
  });

  it('pocket sevens on 9 5 2 is an UNDERPAIR that still beats two board ranks', () => {
    const features = analyze('7c 7d', '9h 5s 2c');
    expect(features.value.category).toBe('PAIR');
    expect(features.madeClass).toBe('UNDERPAIR');
    expect(features.pocketPair).toBe(true);
    expect(features.pairRank).toBe(R['7']);
    expect(features.boardRanksBeaten).toBe(2);
    expect(features.pairedBoardRankIndex).toBe(-1);
    expect(features.kicker).toBeNull();
    // Same hand on a board it beats nothing on.
    expect(analyze('7c 7d', 'Ah Kd Qc').boardRanksBeaten).toBe(0);
    expect(analyze('7c 7d', 'Ah Kd Qc').madeClass).toBe('UNDERPAIR');
  });
});

describe('pair classification', () => {
  it('reads an overpair', () => {
    const features = analyze('Qh Qd', 'Js 7d 2c');
    expect(features.madeClass).toBe('OVERPAIR');
    expect(features.overcardCount).toBe(2);
    expect(features.boardRanksBeaten).toBe(3);
  });

  it('reads top, middle and bottom pair by index into the distinct board ranks', () => {
    expect(analyze('Kh 5s', 'Ks 7d 4c').madeClass).toBe('TOP_PAIR');
    expect(analyze('Kh 5s', 'Ks 7d 4c').pairedBoardRankIndex).toBe(0);
    expect(analyze('7h 2d', 'Ks 7d 4c').madeClass).toBe('MIDDLE_PAIR');
    expect(analyze('7h 2d', 'Ks 7d 4c').pairedBoardRankIndex).toBe(1);
    expect(analyze('4h 2d', 'Ks 7d 4c').madeClass).toBe('BOTTOM_PAIR');
    expect(analyze('4h 2d', 'Ks 7d 4c').pairedBoardRankIndex).toBe(2);
  });

  it('keeps indexing by distinct board rank on a four-card board', () => {
    expect(analyze('Th 2d', 'Ks Td 7c 4h').madeClass).toBe('MIDDLE_PAIR');
    expect(analyze('Th 2d', 'Ks Td 7c 4h').pairedBoardRankIndex).toBe(1);
    expect(analyze('7h 2d', 'Ks Td 7c 4h').madeClass).toBe('MIDDLE_PAIR');
    expect(analyze('7h 2d', 'Ks Td 7c 4h').pairedBoardRankIndex).toBe(2);
    expect(analyze('4d 2d', 'Ks Td 7c 4h').madeClass).toBe('BOTTOM_PAIR');
    expect(analyze('4d 2d', 'Ks Td 7c 4h').pairedBoardRankIndex).toBe(3);
  });

  it('reads a pair that is entirely the board as BOARD_PAIR', () => {
    const features = analyze('Ah Qd', 'Ks Kh 2c');
    expect(features.value.category).toBe('PAIR');
    expect(features.madeClass).toBe('BOARD_PAIR');
    expect(features.kicker).toBeNull();
    expect(features.holeCardsUsed).toBe(2); // the ace and queen play as kickers
  });
});

describe('kicker significance', () => {
  it('calls an ace with top pair the top kicker', () => {
    const features = analyze('Ah Ks', 'Kh 7d 2c');
    expect(features.madeClass).toBe('TOP_PAIR');
    expect(features.kicker).toEqual({
      rank: R.A,
      kickerClass: 'TOP',
      betterKickerCount: 0,
      plays: true,
    });
  });

  it('counts only the kickers an opponent could actually hold', () => {
    // Queen kicker on a K 7 2 board: only the ace beats it.
    const second = analyze('Kh Qs', 'Ks 7d 2c');
    expect(second.kicker?.betterKickerCount).toBe(1);
    expect(second.kicker?.kickerClass).toBe('SECOND');
    // Jack kicker: ace and queen beat it.
    const third = analyze('Kh Js', 'Ks 7d 2c');
    expect(third.kicker?.betterKickerCount).toBe(2);
    expect(third.kicker?.kickerClass).toBe('THIRD');
    // Five kicker: everything above it that is not on the board beats it.
    const weak = analyze('Kh 5s', 'Ks 7d 2c');
    expect(weak.kicker?.betterKickerCount).toBe(7);
    expect(weak.kicker?.kickerClass).toBe('WEAK');
  });

  it('reports a kicker that does not play, rather than discarding it', () => {
    const features = analyze('Ah 2s', 'As Kd Qc Jh 9d');
    expect(features.madeClass).toBe('TOP_PAIR');
    expect(features.kicker?.rank).toBe(R['2']);
    expect(features.kicker?.plays).toBe(false);
  });
});

describe('two pair, sets and trips', () => {
  it('separates both-hole-cards two pair from the board-assisted kinds', () => {
    expect(analyze('Kh 7d', 'Ks 7c 2h').twoPairKind).toBe('BOTH_HOLE_CARDS');
    expect(analyze('Kh 3d', 'Ks 7c 7h').twoPairKind).toBe('ONE_HOLE_PLUS_BOARD_PAIR');
    expect(analyze('9h 9d', 'Ks Kh 2c').twoPairKind).toBe('POCKET_PAIR_PLUS_BOARD_PAIR');
    expect(analyze('Ah 3d', 'Ks Kh 7c 7d 2s').twoPairKind).toBe('BOARD_TWO_PAIR');
  });

  it('separates a set from trips and from a board trips', () => {
    const set = analyze('9h 9d', '9s 7c 2h');
    expect(set.madeClass).toBe('SET');
    expect(set.tripsKind).toBe('SET');
    expect(set.holeCardsUsed).toBe(2);

    // A five-card board is what makes `holeCardsUsed` interesting: with three board cards
    // all five cards are forced, so both hole cards always count.
    const trips = analyze('Kh 3d', 'Ks Kc 7h 2s 5d');
    expect(trips.madeClass).toBe('TRIPS');
    expect(trips.tripsKind).toBe('TRIPS');
    expect(trips.holeCardsUsed).toBe(1);
    expect(analyze('Kh 2d', 'Ks Kc 7h').tripsKind).toBe('TRIPS');

    const boardTrips = analyze('Ah Qd', 'Ks Kh Kc 2s 5d');
    expect(boardTrips.madeClass).toBe('TRIPS');
    expect(boardTrips.tripsKind).toBe('BOARD_TRIPS');
    expect(boardTrips.holeCardsUsed).toBe(2); // both hole cards play as kickers
  });

  it('reports the trips source of a full house', () => {
    expect(analyze('9h 9d', '9s 7c 7h').tripsKind).toBe('SET');
    expect(analyze('7h 2d', '7s 7c 9h').tripsKind).toBe('TRIPS');
    expect(analyze('Ah Kd', '7s 7c 7h 9d 9s').tripsKind).toBe('BOARD_TRIPS');
  });
});

describe('flushes and straights', () => {
  it('reads the nut flush', () => {
    const features = analyze('Ah 5h', 'Kh 7h 2h');
    expect(features.madeClass).toBe('FLUSH');
    expect(features.flush).toEqual({
      suit: 'h',
      highRank: R.A,
      betterFlushCards: 0,
      nutClass: 'NUT',
      isNut: true,
      holeCardsInSuit: 2,
    });
  });

  it('reads a second-nut flush', () => {
    const features = analyze('Kh 5h', 'Qh 7h 2h');
    expect(features.flush?.isNut).toBe(false);
    expect(features.flush?.betterFlushCards).toBe(1);
    expect(features.flush?.nutClass).toBe('SECOND_NUT');
  });

  it('reads the nut straight and a dominated one', () => {
    const nut = analyze('9h 8d', '7s 6c 5h');
    expect(nut.madeClass).toBe('STRAIGHT');
    expect(nut.straight).toEqual({ topRank: R['9'], bestPossibleTop: R['9'], isNut: true });

    const dominated = analyze('4h 3d', '7s 6c 5h');
    expect(dominated.straight?.topRank).toBe(R['7']);
    expect(dominated.straight?.bestPossibleTop).toBe(R['9']);
    expect(dominated.straight?.isNut).toBe(false);
  });

  it('describes a straight flush through the straight, not through the flush', () => {
    const features = analyze('9h 8h', '7h 6h 5h');
    expect(features.madeClass).toBe('STRAIGHT_FLUSH');
    expect(features.flush).toBeNull(); // edge choice 13
    expect(features.straight).toEqual({
      topRank: R['9'],
      bestPossibleTop: R['9'],
      isNut: true,
    });
    expect(features.isNuts).toBe(true);
  });
});

describe('draws', () => {
  it('reads a one-hole-card flush draw on a monotone flop', () => {
    const features = analyze('Ah 2c', 'Kh Qh 7h');
    expect(features.draws.flushDraw).toEqual({
      suit: 'h',
      holeCardsInSuit: 1,
      highRank: R.A,
      betterFlushCards: 0,
      nutClass: 'NUT',
    });
    expect(features.blockers).toContain('NUT_FLUSH_BLOCKER');
  });

  it('does not invent a hero flush draw from a four-flush board', () => {
    const features = analyze('Ac 2d', 'Kh Qh 7h 3h');
    expect(features.draws.flushDraw).toBeNull();
    expect(features.boardFeatures.suits.fourFlush).toBe(true);
  });

  it('reads a weak flush draw as weak, counting only UNSEEN better cards', () => {
    // Hero's best heart is the five. Nine ranks beat it, but the king and queen of hearts
    // are on the board and would be part of hero's own flush, so seven are live.
    const features = analyze('5h 4h', 'Kh Qh 7c');
    expect(features.draws.flushDraw?.betterFlushCards).toBe(7);
    expect(features.draws.flushDraw?.nutClass).toBe('WEAK');
  });

  it('separates an open-ender from a double gutshot', () => {
    const oesd = analyze('Tc 9d', '8c 7d 2h');
    expect(oesd.draws.straightDraw?.kind).toBe('OESD');
    // 8 7 on J 9 5: T and 6 both complete, but there is no run of four.
    const doubleGutter = analyze('8h 7d', 'Jh 9s 5c');
    expect(doubleGutter.draws.straightDraw?.kind).toBe('DOUBLE_GUTSHOT');
    expect(doubleGutter.draws.straightDraw?.outRanks).toEqual([R['6'], R.T]);
  });

  it('is ace-low aware at both ends of the wheel', () => {
    // 3 2 on 5 4 K: the ace and the six both play, so this is open-ended.
    const wheelEnd = analyze('2h 3d', '4s 5c Kh');
    expect(wheelEnd.draws.straightDraw?.kind).toBe('OESD');
    expect(wheelEnd.draws.straightDraw?.outRanks).toEqual([R['6'], R.A]);
    // A K on Q J: only the ten plays, so this is a gutshot, not an open-ender.
    const broadway = analyze('Ah Kd', 'Qs Js 2c');
    expect(broadway.draws.straightDraw?.kind).toBe('GUTSHOT');
  });

  it('does not count an out that only puts a straight on the board', () => {
    // T 9 on 4 5 6 7: the three would make the board's own 3-4-5-6-7, so it is not an out.
    const features = analyze('Th 9d', '4h 5d 6s 7c');
    expect(features.draws.straightDraw?.kind).toBe('GUTSHOT');
    expect(features.draws.straightDraw?.outRanks).toEqual([R['8']]);
  });

  it('reports backdoor draws on the flop only', () => {
    const flop = analyze('Kh Th', 'Qh 5s 2c');
    expect(flop.draws.backdoorFlushDraw).toEqual({ suit: 'h', holeCardsInSuit: 2 });
    const turn = analyzeHeroHand(hole('Kh Th'), cards('Qh 5s 2c 3d'));
    expect(turn.draws.backdoorFlushDraw).toBeNull();
    // The same K T 9 shape is a backdoor straight draw on the flop and nothing on the turn.
    expect(analyze('Th 9d', 'Ks 5c 2h').draws.backdoorStraightDraw).toBe(true);
    expect(analyzeHeroHand(hole('Th 9d'), cards('Ks 5c 2h 3d')).draws.backdoorStraightDraw).toBe(
      false,
    );
    // A board that leaves hero with no three-covered window is not a backdoor draw either.
    expect(analyze('Th 2d', 'Ks 8c 3h').draws.backdoorStraightDraw).toBe(false);
  });

  it('finds a backdoor straight draw when a window is three-covered', () => {
    // K T 9: the K-high window holds K, T and 9, and hero supplies two of them.
    const features = analyze('Th 9d', 'Ks 5c 2h');
    expect(features.boardFeatures.straightness.straightWindowCount).toBe(0);
    expect(features.draws.straightDraw).toBeNull();
    expect(features.draws.backdoorStraightDraw).toBe(true);
    // Four of a window's ranks is a real gutshot, not a backdoor.
    const gutshot = analyze('Th 9d', 'Jh 7s 2c');
    expect(gutshot.draws.straightDraw?.kind).toBe('GUTSHOT');
    expect(gutshot.draws.straightDraw?.outRanks).toEqual([R['8']]);
    expect(gutshot.draws.backdoorStraightDraw).toBe(false);
  });

  it('reports no draws on the river', () => {
    const features = analyze('Ah Kh', 'Qh Jh 2c 3d 4s');
    expect(features.draws.flushDraw).toBeNull();
    expect(features.draws.backdoorFlushDraw).toBeNull();
    expect(features.draws.backdoorStraightDraw).toBe(false);
  });

  it('does not report a flush draw to a hero who already has the flush', () => {
    const features = analyze('Ah 5h', 'Kh 7h 2h 3d');
    expect(features.madeClass).toBe('FLUSH');
    expect(features.draws.flushDraw).toBeNull();
  });

  it('does report a straight draw to a hero who already has a pair', () => {
    const features = analyze('Qh Jd', 'Qs Ts 9c');
    expect(features.madeClass).toBe('TOP_PAIR');
    expect(features.draws.straightDraw?.kind).toBe('OESD');
    expect(features.draws.straightDraw?.outRanks).toEqual([R['8'], R.K]);
  });
});

describe('blockers', () => {
  it('emits nothing hero does not actually hold', () => {
    const features = analyze('7c 6d', 'Ah Kd 2s');
    for (const blocker of features.blockers) expect(HERO_BLOCKERS).toContain(blocker);
    expect(features.blockers).toEqual([]);
  });

  it('reads the nut and second-nut flush blockers', () => {
    expect(analyze('Ah 2c', 'Kh Qh 7h').blockers).toContain('NUT_FLUSH_BLOCKER');
    expect(analyze('Jh 2c', 'Kh Qh 7h').blockers).toContain('SECOND_NUT_FLUSH_BLOCKER');
    expect(analyze('Jh 2c', 'Kh Qh 7h').blockers).not.toContain('NUT_FLUSH_BLOCKER');
  });

  it('reads flush-draw blockers only while cards are still to come', () => {
    expect(analyze('Ah 2c', 'Kh Qh 7d').blockers).toContain('NUT_FLUSH_DRAW_BLOCKER');
    expect(analyze('Ah 2c', 'Kh Qh 7d').blockers).toContain('FLUSH_DRAW_BLOCKER');
    expect(analyze('Ah 2c', 'Kh Qh 7d 3s 4d').blockers).not.toContain('FLUSH_DRAW_BLOCKER');
  });

  it('reads straight blockers off the currently possible windows', () => {
    // On 9 8 7 the best straight is J-high, needing a jack and a ten.
    const features = analyze('Jc 2d', '9h 8d 7s');
    expect(features.blockers).toContain('NUT_STRAIGHT_BLOCKER');
    expect(features.blockers).toContain('STRAIGHT_BLOCKER');
    // A five plays in a lower window only, so it blocks a straight but not the nut one.
    const lower = analyze('5c 2d', '9h 8d 7s');
    expect(lower.blockers).toContain('STRAIGHT_BLOCKER');
    expect(lower.blockers).not.toContain('NUT_STRAIGHT_BLOCKER');
  });

  it('reads top-pair and board-pair blockers', () => {
    expect(analyze('Kh 2c', 'Ks 7d 4h').blockers).toContain('TOP_PAIR_BLOCKER');
    expect(analyze('Kh 2c', 'Ks Kd 4h').blockers).toContain('BOARD_PAIR_BLOCKER');
    expect(analyze('7h 2c', 'Ks Kd 4h').blockers).not.toContain('BOARD_PAIR_BLOCKER');
  });

  it('returns blockers in the declared order', () => {
    const features = analyze('Ah Kh', 'Qh Jh 2c');
    const positions = features.blockers.map((blocker) => HERO_BLOCKERS.indexOf(blocker));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});

describe('the nuts', () => {
  it('is the best hand any two cards could make on the board', () => {
    const board = cards('As Ks Qs Js Ts');
    expect(nutStrengthOnBoard(board)).toBe(evaluateHand(board).strength);
    const royal = analyzeHeroHand(hole('2c 3d'), board);
    expect(royal.isNuts).toBe(true);
    expect(royal.playsTheBoard).toBe(true);
    expect(royal.holeCardsUsed).toBe(0);
  });

  it('ignores hero card removal, so it is a property of the board', () => {
    const board = cards('Kh 7h 2h');
    const nuts = analyzeHeroHand(hole('Ah Qh'), board);
    const second = analyzeHeroHand(hole('Qh Jh'), board);
    expect(nuts.nutStrength).toBe(second.nutStrength);
    expect(nuts.isNuts).toBe(true);
    expect(second.isNuts).toBe(false);
  });

  it('separates "the nut flush" from "the nuts"', () => {
    // A 5 of hearts is the nut FLUSH — no higher flush card exists — but A Q of hearts is
    // a better hand, so it is not THE NUTS.
    const features = analyzeHeroHand(hole('Ah 5h'), cards('Kh 7h 2h'));
    expect(features.flush?.isNut).toBe(true);
    expect(features.isNuts).toBe(false);
  });

  it('accepts a precomputed nut strength for batch callers', () => {
    const board = cards('Kh 7h 2h');
    const precomputed = nutStrengthOnBoard(board);
    const features = analyzeHeroHand(hole('Ah 5h'), board, { nutStrength: precomputed });
    expect(features.nutStrength).toBe(precomputed);
    expect(features).toEqual(analyzeHeroHand(hole('Ah 5h'), board));
  });

  it('refuses a malformed board', () => {
    expect(() => nutStrengthOnBoard(cards('Kh 7h'))).toThrow(/3, 4 or 5/);
  });
});

describe('structure and determinism', () => {
  it('refuses a hole card that is already on the board', () => {
    expect(() => analyzeHeroHand(hole('Kh 7h'), cards('Kh 2c 3d'))).toThrow(/distinct/);
  });

  it('is deterministic', () => {
    expect(analyze('Ah Kh', 'Qh Jh 2c')).toEqual(analyze('Ah Kh', 'Qh Jh 2c'));
  });

  it('carries the board features alongside the hand', () => {
    const features = analyze('Ah Kh', 'Qh Jh 2c');
    expect(features.boardFeatures.street).toBe('FLOP');
    expect(features.street).toBe('FLOP');
    expect(features.board).toEqual(cards('Qh Jh 2c'));
    expect(features.hole).toEqual(cards('Ah Kh'));
  });
});
