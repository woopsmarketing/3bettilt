import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderBothThemes } from '../../lib/testing/renderBothThemes.js';
import { LessonNav } from './LessonNav.js';

const END = { practiceHref: '/x/practice', topicsHref: '/x/learn#topics' };
const PREV = { href: '/x/learn/prev', title: '이전 레슨', meta: '초급 · 약 4분' };
const NEXT = { href: '/x/learn/next', title: '다음 레슨', meta: '초급 · 약 5분' };

describe('LessonNav', () => {
  it('renders prev and next by curriculum order, and no end band while a next exists', () => {
    renderBothThemes(<LessonNav prev={PREV} next={NEXT} end={END} />);
    const nav = screen.getByRole('navigation', { name: '다음으로 읽기' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /이전 레슨/u })).toHaveAttribute('href', PREV.href);
    expect(screen.getByRole('link', { name: /다음 레슨/u })).toHaveAttribute('href', NEXT.href);
    expect(screen.queryByText('로드맵의 마지막 레슨입니다')).toBeNull();
  });

  it('on the last lesson says there is no next lesson, and points at the quiz and the topics', () => {
    renderBothThemes(<LessonNav prev={PREV} end={END} />);
    expect(screen.getByText('로드맵의 마지막 레슨입니다')).toBeInTheDocument();
    expect(screen.getByText(/다음 레슨은 없습니다/u)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '퀴즈로 확인하기' })).toHaveAttribute(
      'href',
      END.practiceHref,
    );
    expect(screen.getByRole('link', { name: '주제별로 다시 보기' })).toHaveAttribute(
      'href',
      END.topicsHref,
    );
    // No fabricated "다음" entry.
    expect(screen.queryByText('다음', { exact: true })).toBeNull();
    expect(screen.getByRole('link', { name: /이전 레슨/u })).toBeInTheDocument();
  });

  it('marks a planned neighbour 준비 중 instead of linking it', () => {
    renderBothThemes(<LessonNav next={{ href: null, title: '아직 없는 레슨' }} end={END} />);
    expect(screen.queryByRole('link', { name: /아직 없는 레슨/u })).toBeNull();
    expect(screen.getByText('준비 중')).toBeInTheDocument();
  });

  it('shows the quiz as 준비 중 rather than a dead link when practice is unavailable', () => {
    renderBothThemes(<LessonNav prev={PREV} end={{ ...END, practiceHref: null }} />);
    expect(screen.queryByRole('link', { name: '퀴즈로 확인하기' })).toBeNull();
    expect(screen.getByText('퀴즈로 확인하기')).toBeInTheDocument();
  });
});
