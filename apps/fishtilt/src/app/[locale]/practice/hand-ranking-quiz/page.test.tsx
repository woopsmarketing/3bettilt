import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { contentById, hrefOfContent } from '../../../../content/graph.js';
import HandRankingQuizPage, { metadata } from './page.js';

/*
 * The client island (`Quiz`, and the question bank it is fed) has its own suites
 * (`Quiz.test.tsx`, `handRankingQuestions.test.ts`). This file pins the SERVER shell: header
 * copy, that the quiz actually renders with real questions, the tie-callout copy, and the
 * cross-link to the hand-rankings lesson — the same shape `hand-checker/page.test.tsx` and
 * `starting-hand/page.test.tsx` already use for their own pages.
 */
describe('/practice/hand-ranking-quiz page shell', () => {
  it('renders the page header', () => {
    render(<HandRankingQuizPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('족보 퀴즈');
  });

  it('has exactly one h1', () => {
    render(<HandRankingQuizPage />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('renders the quiz with real questions, not an empty state', () => {
    render(<HandRankingQuizPage />);
    expect(screen.getByText(/1 \/ 10문제/u)).toBeInTheDocument();
    expect(screen.queryByText('아직 풀 수 있는 문제가 없습니다.')).not.toBeInTheDocument();
  });

  it('asks the exact prompt the brief specifies', () => {
    render(<HandRankingQuizPage />);
    expect(
      screen.getByRole('heading', { level: 2, name: '어느 쪽이 이길까요?' }),
    ).toBeInTheDocument();
  });

  it('offers 무승부 as a real third answer, not only "A"/"B"', () => {
    render(<HandRankingQuizPage />);
    expect(screen.getByRole('button', { name: '무승부' })).toBeInTheDocument();
  });

  it('tells the reader a tie is a genuine possible outcome, not hidden', () => {
    render(<HandRankingQuizPage />);
    expect(screen.getByText('무승부도 있습니다')).toBeInTheDocument();
  });

  it('links back to the hand-rankings lesson, honestly reflecting its current status', () => {
    const lesson = contentById('hand-rankings');
    const href = hrefOfContent(lesson);

    render(<HandRankingQuizPage />);
    expect(screen.getByText(lesson.title)).toBeInTheDocument();
    if (href !== null) {
      const linked = screen.getAllByRole('link').some((el) => el.getAttribute('href') === href);
      expect(linked, `no link points at ${href}`).toBe(true);
    } else {
      expect(screen.getAllByText('준비 중').length).toBeGreaterThan(0);
    }
  });

  it('sets page metadata that names the quiz', () => {
    expect(metadata.title).toContain('족보 퀴즈');
    expect(metadata.description).toBeTruthy();
  });

  it('never mentions GTO', () => {
    render(<HandRankingQuizPage />);
    expect(document.body.textContent?.toUpperCase()).not.toContain('GTO');
  });

  it('carries no affiliate, casino or sign-up surface', () => {
    render(<HandRankingQuizPage />);
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href') ?? '').toMatch(/^\/(?!\/)/u);
    }
  });
});
