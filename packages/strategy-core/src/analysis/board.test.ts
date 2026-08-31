import { parseCards, unwrap, type Card } from '@gto-self/shared';
import { describe, expect, it } from 'vitest';
import {
  analyzeBoard,
  analyzeBoardTransition,
  BOARD_TENDENCY_CRITERIA,
  boardStreetOf,
  rankBandOf,
  STRAIGHT_WINDOWS,
} from './board.js';

const board = (text: string): Card[] => unwrap(parseCards(text));

describe('street and rank bands', () => {
  it('maps card count to street', () => {
    expect(boardStreetOf(3)).toBe('FLOP');
    expect(boardStreetOf(4)).toBe('TURN');
    expect(boardStreetOf(5)).toBe('RIVER');
    expect(() => boardStreetOf(2)).toThrow(/3, 4 or 5/);
    expect(() => boardStreetOf(6)).toThrow(/3, 4 or 5/);
  });

  it('bands ranks at the documented boundaries', () => {
    expect(rankBandOf(0)).toBe('LOW'); // '2'
    expect(rankBandOf(4)).toBe('LOW'); // '6'
    expect(rankBandOf(5)).toBe('MID'); // '7'
    expect(rankBandOf(7)).toBe('MID'); // '9'
    expect(rankBandOf(8)).toBe('HIGH'); // 'T'
    expect(rankBandOf(12)).toBe('HIGH'); // 'A'
  });
});

describe('the ten straight windows', () => {
  it('runs from the wheel to broadway', () => {
    expect(STRAIGHT_WINDOWS).toHaveLength(10);
    expect(STRAIGHT_WINDOWS[0]?.topRank).toBe(3); // five-high
    expect(STRAIGHT_WINDOWS[0]?.ranks).toEqual([12, 3, 2, 1, 0]); // A 5 4 3 2
    expect(STRAIGHT_WINDOWS[9]?.topRank).toBe(12);
    expect(STRAIGHT_WINDOWS[9]?.ranks).toEqual([12, 11, 10, 9, 8]);
    for (const window of STRAIGHT_WINDOWS) expect(window.ranks).toHaveLength(5);
  });
});

describe('rank texture', () => {
  it('reads a monotone broadway flop', () => {
    const features = analyzeBoard(board('As Ks Qs'));
    expect(features.street).toBe('FLOP');
    expect(features.highCardClass).toBe('ACE_HIGH');
    expect(features.highCardRank).toBe(12);
    expect(features.lowCardRank).toBe(10);
    expect(features.broadwayCount).toBe(3);
    expect(features.composition).toEqual({ LOW: 0, MID: 0, HIGH: 3 });
    expect(features.pairing).toBe('UNPAIRED');
    expect(features.suits.flopPattern).toBe('MONOTONE');
    expect(features.suits.maxSuitCount).toBe(3);
    expect(features.suits.flushPossible).toBe(true);
    expect(features.suits.fourFlush).toBe(false);
    expect(features.suits.dominantSuit).toBe('s');
    expect(features.straightness.connectivity).toBe('LOW_CONNECTED');
    expect(features.straightness.straightWindowCount).toBe(1);
    expect(features.straightness.bestPossibleStraightTop).toBe(12);
  });

  it('counts cards, not distinct ranks, in the composition', () => {
    const features = analyzeBoard(board('Kd Kc 2s'));
    expect(features.composition).toEqual({ LOW: 1, MID: 0, HIGH: 2 });
    expect(features.broadwayCount).toBe(2);
    expect(features.distinctRanksDesc).toEqual([11, 0]);
    expect(features.rankCounts[11]).toBe(2);
  });

  it('classifies every pairing shape', () => {
    expect(analyzeBoard(board('As Kd 7c')).pairing).toBe('UNPAIRED');
    expect(analyzeBoard(board('Kd Kc 2s')).pairing).toBe('PAIRED');
    expect(analyzeBoard(board('Ts Th Td')).pairing).toBe('TRIPS');
    expect(analyzeBoard(board('7s 7h 4d 4c 9s')).pairing).toBe('TWO_PAIR');
    expect(analyzeBoard(board('9s 9h 9d 4c 4s')).pairing).toBe('FULL_HOUSE');
    expect(analyzeBoard(board('2s 2h 2d 2c 5s')).pairing).toBe('QUADS');
    expect(analyzeBoard(board('7s 7h 4d 4c 9s')).doublePaired).toBe(true);
    expect(analyzeBoard(board('Kd Kc 2s')).doublePaired).toBe(false);
    expect(analyzeBoard(board('Kd Kc 2s')).paired).toBe(true);
    expect(analyzeBoard(board('As Kd 7c')).paired).toBe(false);
  });
});

describe('suit texture', () => {
  it('separates monotone, two-tone and rainbow flops', () => {
    expect(analyzeBoard(board('As Ks Qs')).suits.flopPattern).toBe('MONOTONE');
    expect(analyzeBoard(board('7h 8h 9c')).suits.flopPattern).toBe('TWO_TONE');
    expect(analyzeBoard(board('Ah 7d 2c')).suits.flopPattern).toBe('RAINBOW');
  });

  it('keeps the flop pattern as a fact about the flop on later streets', () => {
    const river = analyzeBoard(board('As Ks Qs 2h 3d'));
    expect(river.suits.flopPattern).toBe('MONOTONE');
    expect(river.suits.maxSuitCount).toBe(3);
    expect(river.suits.flushPossible).toBe(true);
    expect(river.suits.fourFlush).toBe(false);
    expect(river.suits.flushOnBoard).toBe(false);
  });

  it('reads four- and five-card suits', () => {
    const fourFlush = analyzeBoard(board('Ah Kh 2h 5h'));
    expect(fourFlush.suits.fourFlush).toBe(true);
    expect(fourFlush.suits.flushOnBoard).toBe(false);
    const flushOnBoard = analyzeBoard(board('Ah Kh 2h 5h 9h'));
    expect(flushOnBoard.suits.flushOnBoard).toBe(true);
    expect(flushOnBoard.suits.maxSuitCount).toBe(5);
    expect(flushOnBoard.suits.counts).toEqual([0, 5, 0, 0]);
  });
});

describe('straight connectivity', () => {
  it('counts the windows a two-card holding can complete', () => {
    const connected = analyzeBoard(board('7h 8h 9c'));
    expect(connected.straightness.straightWindowCount).toBe(3);
    expect(connected.straightness.connectivity).toBe('HIGHLY_CONNECTED');
    expect(connected.straightness.maxWindowCoverage).toBe(3);
    expect(connected.straightness.bestPossibleStraightTop).toBe(9); // J-high, with T J
    expect(connected.straightness.rankSpan).toBe(2);
  });

  it('reads a disconnected board as disconnected', () => {
    const dry = analyzeBoard(board('Kd Kc 2s'));
    expect(dry.straightness.straightWindowCount).toBe(0);
    expect(dry.straightness.connectivity).toBe('DISCONNECTED');
    expect(dry.straightness.bestPossibleStraightTop).toBe(-1);
    expect(analyzeBoard(board('Ah 7d 2c')).straightness.connectivity).toBe('DISCONNECTED');
  });

  it('reports the one-card windows and the straight on the board', () => {
    const turn = analyzeBoard(board('5h 6d 7c 8s'));
    expect(turn.straightness.oneCardStraightWindowCount).toBe(2); // 4 and 9 both play
    expect(turn.straightness.straightOnBoard).toBe(false);
    const river = analyzeBoard(board('5h 6d 7c 8s 9h'));
    expect(river.straightness.straightOnBoard).toBe(true);
    expect(river.straightness.straightOnBoardTop).toBe(7); // nine-high
  });

  it('is wheel aware', () => {
    const wheel = analyzeBoard(board('Ah 2d 3c 4s 5h'));
    expect(wheel.straightness.straightOnBoard).toBe(true);
    expect(wheel.straightness.straightOnBoardTop).toBe(3); // five-high
    expect(wheel.straightness.windowCoverage[0]).toBe(5);
  });

  it('covers exactly the windows a board belongs to', () => {
    // 7 8 9: windows topped by 9, T and J each hold all three ranks.
    const coverage = analyzeBoard(board('7h 8h 9c')).straightness.windowCoverage;
    expect(coverage).toEqual([0, 0, 1, 2, 3, 3, 3, 2, 1, 0]);
  });
});

describe('static / dynamic tendency', () => {
  it('documents its own criteria', () => {
    expect(BOARD_TENDENCY_CRITERIA).toContain('STATIC');
    expect(BOARD_TENDENCY_CRITERIA).toContain('DYNAMIC');
  });

  it('carries HEURISTIC provenance with a mandatory note', () => {
    const features = analyzeBoard(board('Kd Kc 2s'));
    expect(features.tendency.provenance).toBe('HEURISTIC');
    expect(features.tendency.note).toContain('score');
  });

  it('calls a paired dry high board STATIC', () => {
    const features = analyzeBoard(board('Kd Kc 2s'));
    expect(features.tendencyScore).toBe(-1); // suit 0 + connectivity 0 - paired 1
    expect(features.tendency.value).toBe('STATIC');
  });

  it('calls an ace-high rainbow disconnected board STATIC', () => {
    const features = analyzeBoard(board('Ah 7d 2c'));
    expect(features.tendencyScore).toBe(0);
    expect(features.tendency.value).toBe('STATIC');
  });

  it('calls a connected two-tone middling board DYNAMIC', () => {
    const features = analyzeBoard(board('7h 8h 9c'));
    expect(features.tendencyScore).toBe(4); // two-tone 1 + highly connected 3
    expect(features.tendency.value).toBe('DYNAMIC');
    expect(analyzeBoard(board('Jh Th 9s')).tendency.value).toBe('DYNAMIC');
  });

  it('leaves a monotone broadway flop in the middle rather than forcing it', () => {
    const features = analyzeBoard(board('As Ks Qs'));
    expect(features.tendencyScore).toBe(3); // flush possible 2 + low connected 1
    expect(features.tendency.value).toBe('SEMI_DYNAMIC');
  });
});

describe('turn and river transitions', () => {
  it('sees a flush draw get there', () => {
    const transition = analyzeBoardTransition(board('6h 7h 2c'), board('6h 7h 2c 9h'));
    expect(transition.newCardRank).toBe(7);
    expect(transition.newCardSuit).toBe('h');
    expect(transition.flushDrawCompleted).toBe(true);
    expect(transition.fourFlushArrived).toBe(false);
    expect(transition.flushOnBoardArrived).toBe(false);
    expect(transition.overcard).toBe(true);
    expect(transition.boardPaired).toBe(false);
    expect(transition.straightsNowPossible).toBe(2);
    expect(transition.straightDrawCompleted).toBe(true);
    expect(transition.connectivityIncreased).toBe(true);
    expect(transition.after.suits.flushPossible).toBe(true);
    expect(transition.before.suits.flushPossible).toBe(false);
  });

  it('sees the board pair', () => {
    const transition = analyzeBoardTransition(board('2s 5d 9c'), board('2s 5d 9c 5h'));
    expect(transition.boardPaired).toBe(true);
    expect(transition.pairingChanged).toBe(true);
    expect(transition.after.pairing).toBe('PAIRED');
    expect(transition.overcard).toBe(false);
  });

  it('sees an overcard arrive and the top rank change', () => {
    const transition = analyzeBoardTransition(board('Kd Kc 2s'), board('Kd Kc 2s Ah'));
    expect(transition.overcard).toBe(true);
    expect(transition.topRankChanged).toBe(true);
    expect(transition.after.highCardClass).toBe('ACE_HIGH');
    expect(transition.boardPaired).toBe(false);
  });

  it('sees a fourth and a fifth card of a suit', () => {
    const fourth = analyzeBoardTransition(board('Ah Kh 2h'), board('Ah Kh 2h 5h'));
    expect(fourth.fourFlushArrived).toBe(true);
    expect(fourth.flushDrawCompleted).toBe(false); // the flush was already possible
    const fifth = analyzeBoardTransition(board('Ah Kh 2h 5h'), board('Ah Kh 2h 5h 9h'));
    expect(fifth.flushOnBoardArrived).toBe(true);
  });

  it('sees a straight arrive on the board', () => {
    const transition = analyzeBoardTransition(board('5h 6d 7c 8s'), board('5h 6d 7c 8s 9h'));
    expect(transition.straightOnBoardArrived).toBe(true);
    expect(transition.after.straightness.straightOnBoardTop).toBe(7);
  });

  it('reports a tendency change when the turn opens the board up', () => {
    const transition = analyzeBoardTransition(board('6h 7h 2c'), board('6h 7h 2c 9h'));
    expect(transition.before.tendency.value).toBe('STATIC');
    expect(transition.after.tendency.value).toBe('DYNAMIC');
    expect(transition.tendencyChanged).toBe(true);
  });

  it('reports no tendency change when the turn is a blank', () => {
    const transition = analyzeBoardTransition(board('Kd 7c 2s'), board('Kd 7c 2s 4h'));
    expect(transition.before.tendency.value).toBe('STATIC');
    expect(transition.after.tendency.value).toBe('STATIC');
    expect(transition.tendencyChanged).toBe(false);
  });

  it('refuses a transition that is not an extension', () => {
    expect(() => analyzeBoardTransition(board('Kd 7c 2s'), board('Kd 7c 9h 2s'))).toThrow(
      /extend the earlier board/,
    );
    expect(() => analyzeBoardTransition(board('Kd 7c 2s'), board('Kd 7c 2s 9h 4d'))).toThrow(
      /exactly one card/,
    );
  });
});

describe('input guards', () => {
  it('refuses a malformed board', () => {
    expect(() => analyzeBoard(board('Kd 7c'))).toThrow(/3, 4 or 5/);
    const duplicated = [...board('Kd 7c'), ...board('Kd')] as Card[];
    expect(() => analyzeBoard(duplicated)).toThrow(/distinct/);
  });

  it('is deterministic', () => {
    expect(analyzeBoard(board('As Ks Qs'))).toEqual(analyzeBoard(board('As Ks Qs')));
  });
});
