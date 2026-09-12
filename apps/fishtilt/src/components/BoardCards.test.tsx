import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderBothThemes } from '../lib/testing/renderBothThemes.js';
import { BoardCards } from './BoardCards.js';

describe('BoardCards (D-S3-14)', () => {
  it('groups the board by street, each group named, each card a PokerCard', () => {
    renderBothThemes(<BoardCards flop="As Kd 7c" turn="2h" river="Ts" />);
    const flop = screen.getByRole('group', { name: '플랍' });
    expect(within(flop).getAllByRole('img')).toHaveLength(3);
    expect(within(flop).getByRole('img', { name: '스페이드 A' })).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: '턴' })).getAllByRole('img')).toHaveLength(1);
    expect(within(screen.getByRole('group', { name: '리버' })).getByRole('img', { name: '스페이드 T' })).toBeInTheDocument();
  });

  it('shows only the streets dealt so far, in order', () => {
    const { container } = renderBothThemes(<BoardCards flop="As Kd 7c" turn="2h" />);
    expect([...container.querySelectorAll('[data-street]')].map((el) => el.getAttribute('data-street'))).toEqual(['flop', 'turn']);
  });

  it('renders nothing before the flop', () => {
    const { container } = renderBothThemes(<BoardCards />);
    expect(container.innerHTML).toBe('');
  });

  it('rejects a malformed street and a wrong card count as a build failure', () => {
    expect(() => renderBothThemes(<BoardCards flop="As Kd" />)).toThrow(/expected 3/u);
    expect(() => renderBothThemes(<BoardCards turn="Zz" />)).toThrow();
    expect(() => renderBothThemes(<BoardCards flop="As As Kd" />)).toThrow();
  });
});
