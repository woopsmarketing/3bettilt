import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { formatTitle } from '../../../lib/seo/index.js';
import PracticeHubPage, { metadata } from './page.js';

/*
 * All three of `practiceHubCards`' possible states — no registry entry yet, a registered
 * entry that is not available, and one that is — are constructed here rather than read off
 * the live `ROUTES`/`practiceHubCards()`. Today all three quizzes are genuinely unbuilt, but
 * that is a fact about how much of the product exists, not about this page's behaviour, and
 * WP-L2/L3 will falsify it within days — the exact trap `docs/FISHTILT_STATE.md` ruling 26
 * documents (its own worked example is this app's OTHER hub, `/tools`). Mocking the whole
 * `practiceHubCards` result means this test keeps proving the "route → link, no route or
 * unavailable → 준비 중" contract forever, in both directions, regardless of what has shipped.
 */
vi.mock('../../../features/quiz/index.js', () => ({
  practiceHubCards: () => [
    {
      id: 'practiceRange',
      label: '레인지 퀴즈',
      description: '레인지 퀴즈 설명입니다.',
      route: null,
    },
    {
      id: 'practiceHandRanking',
      label: '족보 퀴즈',
      description: '족보 퀴즈 설명입니다.',
      route: {
        id: 'practiceHandRanking',
        path: '/practice/hand-ranking',
        label: '족보 퀴즈',
        section: 'practice',
        available: false,
      },
    },
    {
      id: 'practiceStartingHand',
      label: '시작 핸드 퀴즈',
      description: '시작 핸드 퀴즈 설명입니다.',
      route: {
        id: 'practiceStartingHand',
        path: '/practice/starting-hand',
        label: '시작 핸드 퀴즈',
        section: 'practice',
        available: true,
      },
    },
  ],
}));

describe('/practice hub', () => {
  it('lists every planned quiz', () => {
    render(<PracticeHubPage />);
    expect(screen.getByText('레인지 퀴즈')).toBeInTheDocument();
    expect(screen.getByText('족보 퀴즈')).toBeInTheDocument();
    expect(screen.getByText('시작 핸드 퀴즈')).toBeInTheDocument();
  });

  it('renders 준비 중 for a quiz with no route entry yet', () => {
    render(<PracticeHubPage />);
    const card = screen.getByText('레인지 퀴즈').closest('li');
    expect(card).not.toBeNull();
    expect(card).toHaveTextContent('준비 중');
    expect(card?.querySelector('a')).toBeNull();
  });

  it('renders 준비 중 for a quiz whose route is registered but not available', () => {
    render(<PracticeHubPage />);
    const card = screen.getByText('족보 퀴즈').closest('li');
    expect(card).not.toBeNull();
    expect(card).toHaveTextContent('준비 중');
    expect(card?.querySelector('a')).toBeNull();
  });

  it('links a quiz whose route is registered and available, at its registry path', () => {
    render(<PracticeHubPage />);
    expect(screen.getByRole('link', { name: /시작 핸드 퀴즈/u })).toHaveAttribute(
      'href',
      '/practice/starting-hand',
    );
  });

  it('never links a quiz that is not available', () => {
    render(<PracticeHubPage />);
    const links = screen.getAllByRole('link');
    for (const link of links) {
      expect(link.getAttribute('href')).not.toBe('/practice/hand-ranking');
    }
  });

  it('says how many of the listed quizzes are usable rather than implying all of them are', () => {
    render(<PracticeHubPage />);
    expect(screen.getByText('전체 3개 중 1개를 풀 수 있습니다.')).toBeInTheDocument();
  });

  it('carries the beginner framing line', () => {
    render(<PracticeHubPage />);
    expect(screen.getByText(/읽었으면 직접 풀어보세요/u)).toBeInTheDocument();
  });

  it('has exactly one h1', () => {
    render(<PracticeHubPage />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('sets page metadata that names the quizzes', () => {
    /*
     * WP-7a: the `<title>` and the `<h1>` are deliberately different here — the heading is an
     * instruction to someone who has arrived, the title names the page for someone who has
     * not. Both are pinned, and so is the fact that they differ, so a later edit that
     * collapses one into the other is a decision someone has to make on purpose.
     */
    render(<PracticeHubPage />);
    const h1 = screen.getByRole('heading', { level: 1 }).textContent ?? '';
    expect(metadata.title).toBe(formatTitle('홀덤 퀴즈 | 족보·핸드레인지·시작 핸드 연습'));
    expect(h1).toBe('배운 내용을 직접 풀어보세요');
    expect(metadata.title).not.toBe(formatTitle(h1));
    expect(metadata.description).toBeTruthy();
  });

  it('never mentions GTO', () => {
    render(<PracticeHubPage />);
    expect(document.body.textContent?.toUpperCase()).not.toContain('GTO');
  });
});
