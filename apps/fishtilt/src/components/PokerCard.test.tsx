import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PokerCard } from './PokerCard.js';

describe('PokerCard', () => {
  it('gives a face-up card a Korean accessible name, not the suit glyph', () => {
    render(<PokerCard rank="A" suit="h" />);
    expect(screen.getByRole('img', { name: '하트 A' })).toBeInTheDocument();
  });

  it('draws "T" as "10" for a reader who has never seen ten as one letter', () => {
    render(<PokerCard rank="T" suit="s" />);
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('colours red suits with the dedicated suit-red ink, not the brand red', () => {
    render(<PokerCard rank="K" suit="d" />);
    const glyph = screen.getByText('♦');
    expect(glyph.className).toContain('text-suit-red-500');
    expect(glyph.className).not.toContain('brand');
  });

  it('renders the "black" suits in the light ink token, never plain black-on-black', () => {
    render(<PokerCard rank="K" suit="s" />);
    const glyph = screen.getByText('♠');
    expect(glyph.className).toContain('text-text-100');
  });

  it('gives every suit a visually distinct glyph, so colour is never the only signal', () => {
    render(
      <>
        <PokerCard rank="A" suit="s" />
        <PokerCard rank="A" suit="h" />
        <PokerCard rank="A" suit="d" />
        <PokerCard rank="A" suit="c" />
      </>,
    );
    expect(screen.getByText('♠')).toBeInTheDocument();
    expect(screen.getByText('♥')).toBeInTheDocument();
    expect(screen.getByText('♦')).toBeInTheDocument();
    expect(screen.getByText('♣')).toBeInTheDocument();
  });

  it('renders a face-down card with a Korean accessible name and no rank/suit text', () => {
    render(<PokerCard faceDown />);
    expect(screen.getByRole('img', { name: '뒷면 카드' })).toBeInTheDocument();
    expect(screen.queryByText('A')).not.toBeInTheDocument();
  });

  it('suppresses its own accessible name when decorative (a wrapping control owns it)', () => {
    const { container } = render(<PokerCard rank="A" suit="h" decorative />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    const root = container.firstElementChild;
    expect(root).toHaveAttribute('aria-hidden', 'true');
  });

  it('marks the selected state with more than colour alone (a ring, not just a hue shift)', () => {
    const { container } = render(<PokerCard rank="A" suit="h" selected />);
    const root = container.firstElementChild;
    expect(root?.className).toContain('ring-2');
    expect(root?.className).toContain('ring-brand-500');
  });

  it('dims a disabled card', () => {
    const { container } = render(<PokerCard rank="A" suit="h" disabled />);
    const root = container.firstElementChild;
    expect(root?.className).toContain('opacity-40');
  });
});
