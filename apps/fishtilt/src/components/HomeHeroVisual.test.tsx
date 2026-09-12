import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { bestFiveOf } from '@gto-self/strategy-core';
import { parseCards } from '@gto-self/shared';
import { handReading } from '../features/tools/handRank.js';
import { renderBothThemes } from '../lib/testing/renderBothThemes.js';
import { HERO_CARDS_TEXT, heroHand } from './home/homeModel.js';
import { HomeHeroVisual } from './HomeHeroVisual.js';

/*
 * The hero visual is VA-01's hybrid with the scene half drawn in CSS: what is asserted is
 * the EXACT half (five real card faces, named by the evaluator), the slot the photo drops
 * into (same frame, same overlay box, no `<img>` until a photo is given), and the rules
 * every visual on this site keeps — tokens only, both themes, no text in the picture,
 * nothing interactive.
 */
describe('HomeHeroVisual (VA-01 hybrid)', () => {
  it('draws the five exact cards, spades ace to ten, as real card faces', () => {
    const { container } = renderBothThemes(<HomeHeroVisual />);
    const parsed = parseCards(HERO_CARDS_TEXT);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.value).toHaveLength(5);
    // Five card faces, all spades, rank glyphs A K Q J 10 in that order — and nothing else
    // is text: the scene is pure decoration.
    const text = container.textContent ?? '';
    expect(text.replace(/\s+/gu, '')).toBe('A♠K♠Q♠J♠10♠');
  });

  it('names the picture with what the evaluator says the five cards make — never a typed name', () => {
    renderBothThemes(<HomeHeroVisual />);
    const parsed = parseCards(HERO_CARDS_TEXT);
    if (!parsed.ok) throw new Error(parsed.error);
    const reading = handReading(bestFiveOf(parsed.value).value);
    const picture = screen.getByRole('img');
    expect(picture.getAttribute('aria-label')).toBe(`${reading}: 스페이드 A K Q J 10`);
    expect(heroHand().reading).toBe(reading);
    // One name, said once: the cards inside are decorative.
    expect(screen.getAllByRole('img')).toHaveLength(1);
  });

  it('keeps the cards inside VA-01’s reserved overlay band of the 4:5 frame', () => {
    const { container } = renderBothThemes(<HomeHeroVisual />);
    const frame = container.querySelector('[data-hero-visual]');
    expect(frame?.className).toContain('aspect-[4/5]');
    const overlay = screen.getByRole('img');
    // x 8–92 %, y 64–94 % (manifest VA-01 safe area), so a photo behind it needs no re-layout.
    expect(overlay.className).toContain('inset-x-[8%]');
    expect(overlay.className).toContain('top-[64%]');
    expect(overlay.className).toContain('bottom-[6%]');
  });

  it('renders the CSS scene when there is no photo, and next/image when there is one', () => {
    const { container, unmount } = renderBothThemes(<HomeHeroVisual />);
    expect(container.querySelector('[data-hero-visual]')?.getAttribute('data-hero-visual')).toBe(
      'scene',
    );
    expect(container.querySelector('img')).toBeNull();
    unmount();

    const { container: withPhoto } = renderBothThemes(
      <HomeHeroVisual photo={{ src: '/og.png' }} />,
    );
    expect(withPhoto.querySelector('[data-hero-visual]')?.getAttribute('data-hero-visual')).toBe(
      'photo',
    );
    const image = withPhoto.querySelector('img');
    expect(image).not.toBeNull();
    expect(image?.getAttribute('alt')).toBe('');
    // The overlay is unchanged by the photo: same box, same name.
    expect(screen.getByRole('img').className).toContain('top-[64%]');
  });

  it('is decorative apart from the one named picture: no text, no id, no interaction', () => {
    const { container } = renderBothThemes(<HomeHeroVisual />);
    expect(container.querySelector('text')).toBeNull();
    expect(container.querySelector('[id]')).toBeNull();
    expect(container.querySelectorAll('a, button, [tabindex], input')).toHaveLength(0);
    expect(container.innerHTML).not.toContain('GTO');
  });
});
