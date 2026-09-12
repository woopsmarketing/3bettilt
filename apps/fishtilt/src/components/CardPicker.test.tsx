import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { makeCard, type Card } from '@gto-self/shared';
import { CardPicker } from './CardPicker.js';

function ControlledPicker(props: {
  readonly initial?: readonly Card[];
  readonly usedCards?: readonly Card[];
  readonly max?: number;
}) {
  const [value, setValue] = useState<readonly Card[]>(props.initial ?? []);
  return (
    <CardPicker
      label="카드 선택"
      value={value}
      onChange={setValue}
      usedCards={props.usedCards}
      max={props.max}
    />
  );
}

describe('CardPicker', () => {
  it('exposes an accessible group name', () => {
    render(<ControlledPicker />);
    expect(screen.getByRole('group', { name: '카드 선택' })).toBeInTheDocument();
  });

  it('renders exactly 52 selectable buttons', () => {
    render(<ControlledPicker />);
    expect(screen.getAllByRole('button')).toHaveLength(52);
  });

  it('every button meets the 44px minimum touch target', () => {
    render(<ControlledPicker />);
    for (const button of screen.getAllByRole('button')) {
      expect(button.className).toContain('min-h-11');
      expect(button.className).toContain('min-w-11');
    }
  });

  /*
   * `/tools/equity` renders three pickers on one page and `/tools/hand-checker` two, so the
   * suit heading ids have to be unique per INSTANCE — they were a fixed string, which made
   * every `aria-labelledby` on the second and third picker resolve back to the first
   * picker's headings. Asserted as the rule (no id appears twice, every labelling reference
   * resolves) rather than against a particular id shape.
   */
  it('gives each instance its own suit heading ids, so two pickers can share a page', () => {
    const { container } = render(
      <div>
        <ControlledPicker />
        <ControlledPicker />
      </div>,
    );
    const ids = Array.from(container.querySelectorAll('[id]')).map((el) => el.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);

    const labelled = Array.from(container.querySelectorAll('[aria-labelledby]'));
    expect(labelled.length).toBeGreaterThan(0);
    for (const group of labelled) {
      const target = group.getAttribute('aria-labelledby') ?? '';
      // The heading a group points at must be inside that group's OWN picker, not the
      // first one on the page.
      const picker = group.closest('[aria-label="카드 선택"]');
      expect(picker).not.toBeNull();
      expect(picker?.querySelector(`[id="${target}"]`)).not.toBeNull();
    }
  });

  it('is keyboard operable: Tab reaches a card, Enter toggles it', async () => {
    const user = userEvent.setup();
    render(<ControlledPicker />);
    const aceOfSpades = screen.getByRole('button', { name: '스페이드 A 선택' });
    aceOfSpades.focus();
    expect(aceOfSpades).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: '스페이드 A 선택됨' })).toBeInTheDocument();
  });

  it('clicking toggles a card into and out of the controlled selection', async () => {
    const user = userEvent.setup();
    render(<ControlledPicker />);
    const button = screen.getByRole('button', { name: '하트 K 선택' });
    await user.click(button);
    expect(screen.getByRole('button', { name: '하트 K 선택됨' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: '하트 K 선택됨' }));
    expect(screen.getByRole('button', { name: '하트 K 선택' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('disables cards already used elsewhere, regardless of the current selection', () => {
    render(<ControlledPicker usedCards={[makeCard('A', 's')]} />);
    const usedButton = screen.getByRole('button', { name: '스페이드 A 사용됨' });
    expect(usedButton).toBeDisabled();
  });

  it('never lets a used card be clicked into the selection', async () => {
    const user = userEvent.setup();
    render(<ControlledPicker usedCards={[makeCard('A', 's')]} />);
    const usedButton = screen.getByRole('button', { name: '스페이드 A 사용됨' });
    await user.click(usedButton);
    expect(screen.getByRole('button', { name: '스페이드 A 사용됨' })).toBeInTheDocument();
  });

  it('disables further picks once `max` is reached, without discarding the existing selection', async () => {
    const user = userEvent.setup();
    render(<ControlledPicker max={2} />);
    await user.click(screen.getByRole('button', { name: '스페이드 A 선택' }));
    await user.click(screen.getByRole('button', { name: '스페이드 K 선택' }));
    const thirdCard = screen.getByRole('button', { name: '스페이드 Q 더 선택할 수 없음' });
    expect(thirdCard).toBeDisabled();
    // The two already picked stay picked and stay enabled (so they can be un-picked).
    expect(screen.getByRole('button', { name: '스페이드 A 선택됨' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '스페이드 K 선택됨' })).toBeEnabled();
  });

  it('groups rows by suit with a labelled, sighted-legible heading', () => {
    render(<ControlledPicker />);
    expect(screen.getByText('하트 (♥)')).toBeInTheDocument();
    expect(screen.getByText('하트 (♥)').className).toContain('text-300');
  });
});
