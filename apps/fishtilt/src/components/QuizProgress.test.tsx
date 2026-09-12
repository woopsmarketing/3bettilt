import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QuizProgress } from './QuizProgress.js';

describe('QuizProgress', () => {
  it('announces the exact progress sentence the quiz has always announced', () => {
    render(
      <QuizProgress states={['correct', 'wrong', 'current', 'todo']} index={2} correctCount={1} />,
    );
    // Pinned verbatim: `hand-ranking-quiz.spec.ts` and `Quiz.test.tsx` both read this string.
    expect(screen.getByText('3 / 4문제 · 맞힌 문제 1개')).toBeInTheDocument();
  });

  it('draws one segment per question, hidden from assistive technology, each stamped with its state', () => {
    const { container } = render(
      <QuizProgress
        states={['correct', 'wrong', 'current', 'todo', 'todo']}
        index={2}
        correctCount={1}
      />,
    );
    const rail = container.querySelector('[aria-hidden="true"]');
    expect(rail).not.toBeNull();
    const segments = Array.from(rail?.querySelectorAll('[data-state]') ?? []);
    expect(segments.map((segment) => segment.getAttribute('data-state'))).toEqual([
      'correct',
      'wrong',
      'current',
      'todo',
      'todo',
    ]);
    // The rail is decoration: it must never add a control the responsive audit has to measure.
    expect(rail?.querySelectorAll('button, a')).toHaveLength(0);
  });

  it('is a polite live region, so a new question is announced without interrupting', () => {
    render(<QuizProgress states={['current']} index={0} correctCount={0} />);
    expect(screen.getByText('1 / 1문제 · 맞힌 문제 0개')).toHaveAttribute('aria-live', 'polite');
  });
});
