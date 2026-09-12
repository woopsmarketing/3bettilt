import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RangeQuizPage, { metadata } from './page.js';
import { contentById, hrefOfContent } from '../../../../content/graph.js';
import {
  positionAccessibleName,
  RANGE_LABEL,
  RANGE_PROVENANCE_SENTENCE,
} from '../../../../features/range/index.js';

/*
 * Wiring test only. `RangeQuiz` (the client island) has its own thorough suite
 * (`RangeQuiz.test.tsx`) — this proves the server-rendered shell: the page heading, that the
 * setup screen (not a blank page) is what greets a visitor, and that the page never mentions
 * GTO — the same discipline `/tools/range/page.test.tsx` pins for its own page.
 */
describe('/practice/range-quiz page shell', () => {
  it('renders exactly one h1', () => {
    render(<RangeQuizPage />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('레인지 퀴즈');
  });

  it('renders the position picker up front, ready to use', () => {
    render(<RangeQuizPage />);
    expect(screen.getByRole('button', { name: positionAccessibleName('BTN') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '퀴즈 시작' })).toBeEnabled();
  });

  /*
   * WP-Q2 / P2-m9. The page asked a beginner to answer 학습용 기본 레인지 questions with no
   * definition of that term anywhere on it and no route to the lesson that teaches it. Both
   * assertions fail against the original page.
   */
  it('defines the term it scores against, and links to the lesson that teaches it', () => {
    const lesson = contentById('poker-range');
    render(<RangeQuizPage />);
    expect(screen.getByText(`${RANGE_LABEL}란 무엇인가요?`)).toBeInTheDocument();
    expect(document.body.textContent).toContain(RANGE_PROVENANCE_SENTENCE);

    const title = screen.getByText(lesson.title);
    const href = hrefOfContent(lesson);
    if (href !== null) {
      expect(title.closest('a')).toHaveAttribute('href', href);
    } else {
      expect(title.closest('a')).toBeNull();
    }
  });

  it('puts 퀴즈 시작 ahead of the two axes that can never change', () => {
    render(<RangeQuizPage />);
    const body = document.body.innerHTML;
    const startIndex = body.indexOf('퀴즈 시작');
    const conditionsIndex = body.indexOf('이 퀴즈가 쓰는 조건');
    expect(startIndex).toBeGreaterThan(-1);
    expect(conditionsIndex).toBeGreaterThan(-1);
    expect(startIndex).toBeLessThan(conditionsIndex);
    // The unsupported situations are still named on the page (as text, B-M3), just no
    // longer in front of the only control that does anything.
    const conditions = screen.getByRole('region', { name: '조건' });
    expect(conditions).toHaveTextContent('Facing Open');
    expect(conditions).toHaveTextContent('지원하지 않습니다');
    expect(screen.queryByRole('button', { name: /Facing Open/u })).toBeNull();
  });

  it('sets page metadata naming the quiz', () => {
    expect(metadata.title).toContain('레인지 퀴즈');
    expect(metadata.description).toBeTruthy();
  });

  it('never mentions GTO', () => {
    render(<RangeQuizPage />);
    expect(document.body.textContent?.toUpperCase()).not.toContain('GTO');
  });
});
