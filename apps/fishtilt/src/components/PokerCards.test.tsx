import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { rankOf, suitOf, type Card } from '@gto-self/shared';
import { handClassByKey } from '@gto-self/strategy-core';
import { handClassFacts } from '@gto-self/learn-core';
import { cardAccessibleName } from './PokerCard.js';
import { PokerCards } from './PokerCards.js';
import { Callout } from './Callout.js';

/** `PokerCard`'s accessible name is Korean — `무늬 랭크`, "스페이드 A" — not the drawn glyph
 *  ("A♠") and not the two-letter parse form ("As"). It was the glyph, which a screen reader
 *  reads aloud as "A black spade suit": English, on a Korean site
 *  (`docs/FISHTILT_STATE.md` ruling 85). Built from `cardAccessibleName` itself, so this file
 *  cannot drift from the one place those names are spelled. */
const cardName = (card: Card): string => cardAccessibleName(rankOf(card), suitOf(card));

describe('PokerCards', () => {
  it('draws the hand class’s own representative combo, not an author’s choice', () => {
    const handClass = handClassByKey('AKs');
    expect(handClass).toBeDefined();
    if (handClass === undefined) return;
    const [high, low] = handClassFacts(handClass).exampleCards;
    render(<PokerCards hand="AKs" />);
    expect(screen.getByRole('img', { name: cardName(high) })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: cardName(low) })).toBeInTheDocument();
  });

  it('reads the hand out in plain Korean beside the cards', () => {
    render(<PokerCards hand="AKo" />);
    expect(screen.getByText('AKo')).toBeInTheDocument();
    expect(screen.getByText('에이스 킹 오프수트')).toBeInTheDocument();
    expect(screen.getByText('다른 무늬의 A와 K')).toBeInTheDocument();
  });

  it('accepts explicit cards and parses them through shared', () => {
    render(<PokerCards cards="As Kh" />);
    expect(screen.getByRole('img', { name: '스페이드 A' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '하트 K' })).toBeInTheDocument();
  });

  it('throws for a hand that is not one of the 169', () => {
    expect(() => render(<PokerCards hand="AKx" />)).toThrow(/169/u);
  });

  it('throws for cards that do not parse, rather than drawing the wrong picture', () => {
    expect(() => render(<PokerCards cards="As As" />)).toThrow(/duplicate/u);
    expect(() => render(<PokerCards cards="Zz" />)).toThrow();
  });
});

describe('Callout', () => {
  it('renders its title and children as an aside, distinct from body prose', () => {
    const { container } = render(<Callout title="한 칸은 패 한 개가 아닙니다">본문</Callout>);
    expect(screen.getByText('한 칸은 패 한 개가 아닙니다')).toBeInTheDocument();
    expect(screen.getByText('본문')).toBeInTheDocument();
    expect(container.querySelector('aside')).not.toBeNull();
  });
});
