import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { contentById, hrefOfContent } from '../../../../content/graph.js';
import { routeById } from '../../../../lib/routes.js';
import StartingHandQuizPage, { metadata } from './page.js';

/*
 * The client island (`Quiz`, and the question bank it is fed) has its own suites
 * (`Quiz.test.tsx`, `startingHandQuestions.test.ts`). This file pins the SERVER shell:
 * header copy, that the quiz actually renders with real questions, the "not advice"
 * disclaimer, and the two cross-links (the lesson and the Starting Hand Explorer) — the
 * same shape `starting-hand/page.test.tsx` already uses for its own page.
 */
describe('/practice/starting-hand-quiz page shell', () => {
  it('renders the page header', () => {
    render(<StartingHandQuizPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('시작 핸드 퀴즈');
  });

  it('has exactly one h1', () => {
    render(<StartingHandQuizPage />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('renders the quiz with real questions, not an empty state', () => {
    render(<StartingHandQuizPage />);
    expect(screen.getByText(/1 \/ 10문제/u)).toBeInTheDocument();
    expect(screen.queryByText('아직 풀 수 있는 문제가 없습니다.')).not.toBeInTheDocument();
  });

  it('asks the exact prompt the brief specifies', () => {
    render(<StartingHandQuizPage />);
    expect(
      screen.getByRole('heading', { level: 2, name: '어느 쪽이 더 강할까요?' }),
    ).toBeInTheDocument();
  });

  it('states plainly that this is a comparison, not advice', () => {
    render(<StartingHandQuizPage />);
    expect(
      screen.getByText('이 퀴즈는 "잘 플레이하는 법"을 알려주지 않습니다'),
    ).toBeInTheDocument();
  });

  it('never claims a hand should be played, raised or folded', () => {
    render(<StartingHandQuizPage />);
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/해야\s?합니다/u);
    expect(text).not.toMatch(/레이즈하세요|폴드하세요|콜하세요/u);
  });

  it('links back to the starting-hand-ranking lesson, honestly reflecting its current status', () => {
    const lesson = contentById('starting-hand-ranking');
    const href = hrefOfContent(lesson);

    render(<StartingHandQuizPage />);
    expect(screen.getByText(lesson.title)).toBeInTheDocument();
    if (href !== null) {
      const linked = screen.getAllByRole('link').some((el) => el.getAttribute('href') === href);
      expect(linked, `no link points at ${href}`).toBe(true);
    } else {
      expect(screen.getAllByText('준비 중').length).toBeGreaterThan(0);
    }
  });

  it('sends the reader on to the Starting Hand Explorer, a real available tool', () => {
    const route = routeById('toolStartingHand');
    expect(route.available).toBe(true);
    render(<StartingHandQuizPage />);
    expect(screen.getByRole('link', { name: '시작 핸드 탐색기 열기' })).toHaveAttribute(
      'href',
      route.path,
    );
  });

  it('sets page metadata that names the quiz', () => {
    expect(metadata.title).toContain('시작 핸드 퀴즈');
    expect(metadata.description).toBeTruthy();
  });

  it('never mentions GTO', () => {
    render(<StartingHandQuizPage />);
    expect(document.body.textContent?.toUpperCase()).not.toContain('GTO');
  });

  it('carries no affiliate, casino or sign-up surface', () => {
    render(<StartingHandQuizPage />);
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href') ?? '').toMatch(/^\/(?!\/)/u);
    }
  });
});
