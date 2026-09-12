import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { STRATEGY_POSITIONS } from '@gto-self/strategy-core';
import { describe, expect, it } from 'vitest';
import { resolveRange } from '../features/range/index.js';
import { rangeQuizQuery } from '../features/quiz/rangeQuestions.js';
import { positionAccessibleName } from '../features/range/index.js';
import { RangeQuiz } from './RangeQuiz.js';

describe('RangeQuiz — setup screen', () => {
  it('defaults to BTN, with 퀴즈 시작 enabled (a real supported combo, not offered-then-refused)', () => {
    render(<RangeQuiz />);
    expect(screen.getByRole('button', { name: positionAccessibleName('BTN') })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: '퀴즈 시작' })).toBeEnabled();
  });

  it('selecting BB explains why, rather than erroring, and disables 퀴즈 시작', async () => {
    const user = userEvent.setup();
    render(<RangeQuiz />);
    await user.click(screen.getByRole('button', { name: positionAccessibleName('BB') }));
    expect(screen.getByText(/빅블라인드는 첫 번째로 오픈하는 자리가 아닙니다/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '퀴즈 시작' })).toBeDisabled();
  });

  it('switching back to a supported position re-enables 퀴즈 시작 and clears the explanation', async () => {
    const user = userEvent.setup();
    render(<RangeQuiz />);
    await user.click(screen.getByRole('button', { name: positionAccessibleName('BB') }));
    expect(screen.getByRole('button', { name: '퀴즈 시작' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: positionAccessibleName('CO') }));
    expect(screen.getByRole('button', { name: '퀴즈 시작' })).toBeEnabled();
    expect(
      screen.queryByText(/빅블라인드는 첫 번째로 오픈하는 자리가 아닙니다/),
    ).not.toBeInTheDocument();
  });

  it('states the one supported condition and names the rest as unsupported — no disabled control (B-M3)', () => {
    render(<RangeQuiz />);
    const conditions = screen.getByRole('region', { name: '조건' });
    expect(conditions).toHaveTextContent('6인 · 100BB · 아무도 참여하지 않았을 때 (First In)');
    expect(conditions).toHaveTextContent('Facing Open');
    expect(conditions).toHaveTextContent('40BB');
    expect(conditions).toHaveTextContent('지원하지 않습니다');
    expect(screen.queryByRole('button', { name: /Facing Open/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^40BB/ })).toBeNull();
  });

  it('never offers a combination resolveRange cannot answer: 퀴즈 시작 tracks resolveRange for every position', async () => {
    const user = userEvent.setup();
    render(<RangeQuiz />);
    for (const position of STRATEGY_POSITIONS) {
      await user.click(screen.getByRole('button', { name: positionAccessibleName(position) }));
      const supported = resolveRange(rangeQuizQuery(position)).kind === 'RANGE';
      const startButton = screen.getByRole('button', { name: '퀴즈 시작' });
      if (supported) {
        expect(startButton).toBeEnabled();
      } else {
        expect(startButton).toBeDisabled();
      }
    }
  });

  it('never mentions GTO', () => {
    render(<RangeQuiz />);
    expect(document.body.textContent?.toUpperCase()).not.toContain('GTO');
  });
});

describe('RangeQuiz — starting a session', () => {
  it('퀴즈 시작 shows a real question drawn from the hand-class bank', async () => {
    const user = userEvent.setup();
    render(<RangeQuiz />);
    await user.click(screen.getByRole('button', { name: '퀴즈 시작' }));

    expect(screen.getByRole('button', { name: '다른 위치 선택' })).toBeInTheDocument();
    expect(screen.getByText(/^[2-9TJQKA]{2}[so]? — 현재 범위에 포함될까요\?/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '포함' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '제외' })).toBeInTheDocument();
  });

  it('다른 위치 선택 returns to the setup screen', async () => {
    const user = userEvent.setup();
    render(<RangeQuiz />);
    await user.click(screen.getByRole('button', { name: '퀴즈 시작' }));
    await user.click(screen.getByRole('button', { name: '다른 위치 선택' }));

    expect(screen.getByRole('button', { name: positionAccessibleName('BTN') })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: '퀴즈 시작' })).toBeInTheDocument();
  });
});
