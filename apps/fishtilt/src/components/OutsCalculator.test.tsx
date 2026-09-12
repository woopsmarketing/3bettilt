import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { outsOdds, UNSEEN_AFTER_FLOP, UNSEEN_AFTER_TURN } from '@gto-self/learn-core';
import { DRAW_PRESETS } from '../features/tools/index.js';
import { OutsCalculator } from './OutsCalculator.js';

/*
 * The property this page exists for is the one this suite guards hardest: the exact answer
 * and the ×2/×4 shortcut are BOTH on screen, with the signed gap between them, in words as
 * well as digits. Teaching only the shortcut would teach a falsehood; hiding it would leave
 * a reader unable to read any other poker material.
 *
 * Every expected percentage is recomputed through `outsOdds` rather than typed, so the test
 * cannot drift away from the domain it is supposed to be checking.
 */
function percentOf(outs: number, street: 'FLOP' | 'TURN', field: 'next' | 'river'): string {
  const result = outsOdds({ outs, street });
  if (!result.ok) throw new Error(`fixture is not a legal draw: ${result.error}`);
  const value = field === 'next' ? result.value.nextCardProb : result.value.byRiverProb;
  return `${(value * 100).toFixed(1)}%`;
}

const outsField = () => screen.getByLabelText('내 아웃은 몇 장인가요?');

describe('OutsCalculator', () => {
  it('opens on a flush draw with a finished answer already computed', () => {
    render(<OutsCalculator />);
    expect(outsField()).toHaveValue('9');
    expect(screen.getAllByText(percentOf(9, 'FLOP', 'river')).length).toBeGreaterThan(0);
    expect(screen.getAllByText(percentOf(9, 'FLOP', 'next')).length).toBeGreaterThan(0);
  });

  it('shows the exact answer AND the shortcut AND the signed gap, on the flop', () => {
    render(<OutsCalculator />);
    expect(screen.getAllByText('정확한 계산')).toHaveLength(2);
    expect(screen.getByText('×2 규칙')).toBeInTheDocument();
    expect(screen.getByText('×4 규칙')).toBeInTheDocument();
    expect(screen.getByText('다음 카드 한 장 (턴)')).toBeInTheDocument();
    expect(screen.getByText('리버까지 두 장')).toBeInTheDocument();
    // 9 × 4 = 36.0% against a true 35.0%: the shortcut is high, and it says so in words.
    expect(screen.getByText('36.0%')).toBeInTheDocument();
    expect(screen.getAllByText(/규칙이 실제보다/u).length).toBe(2);
  });

  it('collapses to ONE comparison on the turn, because it is one event', async () => {
    const user = userEvent.setup();
    render(<OutsCalculator />);
    await user.click(screen.getByRole('button', { name: '턴 (카드 1장 남음)' }));
    expect(screen.getAllByText('정확한 계산')).toHaveLength(1);
    expect(screen.getByText('리버 한 장')).toBeInTheDocument();
    expect(screen.queryByText('×4 규칙')).not.toBeInTheDocument();
    expect(screen.getAllByText(percentOf(9, 'TURN', 'river')).length).toBeGreaterThan(0);
  });

  it('tells the reader how many cards are still unseen on the street they picked', async () => {
    const user = userEvent.setup();
    render(<OutsCalculator />);
    expect(screen.getAllByText(`${UNSEEN_AFTER_FLOP}장`).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: '턴 (카드 1장 남음)' }));
    expect(screen.getAllByText(`${UNSEEN_AFTER_TURN}장`).length).toBeGreaterThan(0);
  });

  it('fills the count from a preset and explains where that count came from', async () => {
    const user = userEvent.setup();
    render(<OutsCalculator />);
    const combo = DRAW_PRESETS.find((preset) => preset.id === 'flushPlusOpenEnded');
    expect(combo).toBeDefined();
    if (combo === undefined) return;
    // Clicked by its visible name rather than by an accessible-name regex: the label
    // contains "+", which a RegExp would read as a quantifier.
    await user.click(screen.getByText(combo.label));
    expect(outsField()).toHaveValue(String(combo.outs));
    expect(screen.getByText(combo.derivation)).toBeInTheDocument();
    /*
     * The selected preset is painted with the brand fill, and this line is a DESCENDANT of
     * that fill rather than the filled element itself — the only place in the app where that
     * is true, and therefore the one an audit of `bg-brand-600 text-text-100` class strings
     * misses. `text-100` is the page ink and inverts with the theme, so leaving it here puts
     * near-black on dark red in the light theme. It must be the ink that belongs to the fill.
     */
    expect(screen.getByText(combo.derivation).className).toContain('text-ink-on-brand');
    expect(screen.getAllByText(percentOf(combo.outs, 'FLOP', 'river')).length).toBeGreaterThan(0);
  });

  it('steps the count without ever producing an illegal one', async () => {
    const user = userEvent.setup();
    render(<OutsCalculator />);
    await user.click(screen.getByRole('button', { name: '아웃 한 장 늘리기' }));
    expect(outsField()).toHaveValue('10');
    await user.click(screen.getByRole('button', { name: '아웃 한 장 줄이기' }));
    expect(outsField()).toHaveValue('9');

    await user.clear(outsField());
    await user.type(outsField(), '0');
    expect(screen.getByRole('button', { name: '아웃 한 장 줄이기' })).toBeDisabled();

    await user.clear(outsField());
    await user.type(outsField(), String(UNSEEN_AFTER_FLOP));
    expect(screen.getByRole('button', { name: '아웃 한 장 늘리기' })).toBeDisabled();
  });

  it('explains an impossible count instead of clamping it', async () => {
    const user = userEvent.setup();
    render(<OutsCalculator />);
    await user.clear(outsField());
    await user.type(outsField(), '60');
    expect(outsField()).toHaveValue('60');
    expect(screen.getByRole('alert')).toHaveTextContent(
      new RegExp(`${UNSEEN_AFTER_FLOP}장입니다`, 'u'),
    );
    expect(screen.getByText('이 개수는 계산할 수 없습니다')).toBeInTheDocument();
  });

  it('turns a formerly legal count into an honest error when the street changes', async () => {
    const user = userEvent.setup();
    render(<OutsCalculator />);
    await user.clear(outsField());
    await user.type(outsField(), String(UNSEEN_AFTER_FLOP));
    expect(screen.queryByText('이 개수는 계산할 수 없습니다')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '턴 (카드 1장 남음)' }));
    // 47 is a real draw on the flop and an impossible one on the turn. It is not silently
    // reduced to 46 — the reader is told why.
    expect(outsField()).toHaveValue(String(UNSEEN_AFTER_FLOP));
    expect(screen.getByText('이 개수는 계산할 수 없습니다')).toBeInTheDocument();
  });

  it('rejects half a card with the domain’s own reason', async () => {
    const user = userEvent.setup();
    render(<OutsCalculator />);
    await user.clear(outsField());
    await user.type(outsField(), '9.5');
    expect(screen.getAllByText(/카드는 반 장이 없습니다/u).length).toBeGreaterThan(0);
  });

  it('asks for a number when the field is empty rather than showing a stale answer', async () => {
    const user = userEvent.setup();
    render(<OutsCalculator />);
    await user.clear(outsField());
    expect(screen.getByText('아직 계산할 수 없습니다')).toBeInTheDocument();
    expect(screen.queryByText('정확한 계산')).not.toBeInTheDocument();
  });

  it('adds the two disjoint events into the by-the-river figure it shows', () => {
    render(<OutsCalculator />);
    expect(screen.getByText('턴에서 바로 맞을 확률')).toBeInTheDocument();
    expect(screen.getByText('턴에 놓치고 리버에 맞을 확률')).toBeInTheDocument();
    expect(screen.getByText('둘을 더하면 리버까지')).toBeInTheDocument();
  });

  it('never says "GTO"', () => {
    render(<OutsCalculator />);
    expect(document.body.textContent?.toUpperCase()).not.toContain('GTO');
  });
});
