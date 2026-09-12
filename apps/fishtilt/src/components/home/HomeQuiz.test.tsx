import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { practiceHubCards } from '../../features/quiz/index.js';
import { renderBothThemes } from '../../lib/testing/renderBothThemes.js';
import { HomeQuiz } from './HomeQuiz.js';

describe('HomeQuiz', () => {
  it('lists every quiz as a row: a link when built, badge text when not', () => {
    const quizzes = practiceHubCards();
    const { container } = renderBothThemes(
      <HomeQuiz quizzes={quizzes} practiceHref="/x/practice" />,
    );
    expect(container.querySelectorAll('[data-quiz]')).toHaveLength(quizzes.length);
    for (const quiz of quizzes) {
      if (quiz.route?.available === true) {
        expect(screen.getByRole('link', { name: new RegExp(quiz.label, 'u') })).toHaveAttribute(
          'href',
          quiz.route.path,
        );
      } else {
        expect(screen.queryByRole('link', { name: new RegExp(quiz.label, 'u') })).toBeNull();
      }
      expect(container.textContent).toContain(quiz.description);
    }
    expect(screen.getByRole('link', { name: '퀴즈 전체 보기' })).toHaveAttribute(
      'href',
      '/x/practice',
    );
  });

  it('never renders GTO or a verdict', () => {
    const { container } = renderBothThemes(
      <HomeQuiz quizzes={practiceHubCards()} practiceHref={null} />,
    );
    expect(container.textContent).not.toContain('GTO');
    expect(screen.queryByRole('link', { name: '퀴즈 전체 보기' })).toBeNull();
  });
});
