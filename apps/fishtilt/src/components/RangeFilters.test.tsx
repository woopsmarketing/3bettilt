import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { STRATEGY_POSITIONS, type StrategyPosition } from '@gto-self/strategy-core';
import {
  POSITION_GLOSS,
  POSITION_LABEL,
  positionAccessibleName,
  RANGE_SPOTS,
  RANGE_STACK_DEPTHS,
  SPOT_LABEL,
  type RangeSpot,
  type RangeStackDepth,
} from '../features/range/index.js';
import { RangeFilters, unsupportedConditionsSentence } from './RangeFilters.js';

function ControlledFilters() {
  const [heroPosition, setHeroPosition] = useState<StrategyPosition>('BTN');
  const [spot, setSpot] = useState<RangeSpot>('RFI');
  const [stackDepth, setStackDepth] = useState<RangeStackDepth>(100);
  return (
    <RangeFilters
      heroPosition={heroPosition}
      onHeroPositionChange={setHeroPosition}
      spot={spot}
      onSpotChange={setSpot}
      stackDepth={stackDepth}
      onStackDepthChange={setStackDepth}
    />
  );
}

describe('RangeFilters', () => {
  it('renders all six positions as real, enabled buttons — including BB', () => {
    render(<ControlledFilters />);
    for (const position of STRATEGY_POSITIONS) {
      const button = screen.getByRole('button', { name: positionAccessibleName(position) });
      expect(button).toBeEnabled();
    }
  });

  it('marks the current position as pressed', () => {
    render(<ControlledFilters />);
    expect(screen.getByRole('button', { name: positionAccessibleName('BTN') })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: positionAccessibleName('UTG') })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('calls onHeroPositionChange when a position is clicked', async () => {
    const user = userEvent.setup();
    render(<ControlledFilters />);
    await user.click(screen.getByRole('button', { name: positionAccessibleName('CO') }));
    expect(screen.getByRole('button', { name: positionAccessibleName('CO') })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  /*
   * `docs/FISHTILT_STATE.md` ruling 65. The rule, not one label: a beginner meeting the
   * position control must be able to find out what the abbreviation means without leaving
   * the page, and a screen-reader user must hear the name rather than three spelled-out
   * letters. Written over `STRATEGY_POSITIONS` so a seventh seat cannot ship unglossed.
   */
  it('shows the bare abbreviation but announces the Korean name (ADR-0053 + §48)', () => {
    render(<ControlledFilters />);
    for (const position of STRATEGY_POSITIONS) {
      const button = screen.getByRole('button', { name: positionAccessibleName(position) });
      // Visible text stays the international notation ...
      expect(button).toHaveTextContent(POSITION_LABEL[position]);
      // ... and the accessible name carries the gloss the visible label cannot.
      expect(button).toHaveAccessibleName(expect.stringContaining(POSITION_GLOSS[position]));
      expect(button).toHaveAccessibleName(expect.stringContaining(POSITION_LABEL[position]));
    }
  });

  it('explains every offered abbreviation once, in a legend under the control', () => {
    render(<ControlledFilters />);
    for (const position of STRATEGY_POSITIONS) {
      expect(
        screen.getByText(`${POSITION_LABEL[position]} ${POSITION_GLOSS[position]}`),
      ).toBeInTheDocument();
    }
  });

  /*
   * WP-S3-19 (review B-M3). The five unshipped values used to be five real `disabled`
   * buttons with a 준비 중 badge. The HONESTY stays — every unsupported situation is still
   * named on the page, in words — but the FORM is one statement of the supported scope,
   * never a grid of dead controls. So: no disabled button anywhere, the scope line names
   * the shipped condition, and the "not yet" sentence is built from the same lists.
   */
  it('offers no disabled control at all — the only buttons are the six positions', () => {
    render(<ControlledFilters />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(STRATEGY_POSITIONS.length);
    for (const button of buttons) expect(button).toBeEnabled();
    expect(screen.queryByText('준비 중')).not.toBeInTheDocument();
  });

  it('states the one supported situation up front: 6인 · 100BB · First In', () => {
    render(<ControlledFilters />);
    const conditions = screen.getByRole('region', { name: '조건' });
    expect(conditions).toHaveTextContent('지금은');
    expect(conditions).toHaveTextContent('6인 · 100BB · 아무도 참여하지 않았을 때 (First In)');
    expect(conditions).toHaveTextContent('한 가지 상황만 다룹니다');
    expect(screen.getByText('상황').nextElementSibling).toHaveTextContent(SPOT_LABEL.RFI);
    expect(screen.getByText('스택').nextElementSibling).toHaveTextContent('100BB');
    expect(screen.getByText('테이블').nextElementSibling).toHaveTextContent('6인');
  });

  it('still names every unsupported spot and stack — as text, never as a control', () => {
    render(<ControlledFilters />);
    const sentence = unsupportedConditionsSentence();
    expect(screen.getByText(sentence)).toBeInTheDocument();
    expect(sentence).toContain('지원하지 않습니다');
    for (const spot of RANGE_SPOTS) {
      if (spot === 'RFI') continue;
      expect(sentence).toContain(SPOT_LABEL[spot]);
      expect(screen.queryByRole('button', { name: new RegExp(SPOT_LABEL[spot], 'u') })).toBeNull();
    }
    for (const depth of RANGE_STACK_DEPTHS) {
      if (depth === 100) continue;
      expect(sentence).toContain(`${depth}BB`);
      expect(screen.queryByRole('button', { name: new RegExp(`^${depth}BB`, 'u') })).toBeNull();
    }
    // The deepest bucket is open-ended, "150BB+", as the filter copy always said.
    expect(sentence).toContain('150BB+');
  });

  it('never mentions GTO anywhere in the filters', () => {
    render(<ControlledFilters />);
    expect(document.body.textContent?.toUpperCase()).not.toContain('GTO');
  });
});
