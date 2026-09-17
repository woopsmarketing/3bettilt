import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageHero } from './PageHero.js';

describe('PageHero', () => {
  it('renders the title as the page <h1>', () => {
    render(<PageHero title="홀덤, 외우지 말고 눈으로 이해하세요." />);
    expect(
      screen.getByRole('heading', { level: 1, name: '홀덤, 외우지 말고 눈으로 이해하세요.' }),
    ).toBeInTheDocument();
  });

  it('renders the optional eyebrow and description', () => {
    render(<PageHero eyebrow="3BETTILT" title="제목" description="설명" />);
    expect(screen.getByText('3BETTILT')).toBeInTheDocument();
    expect(screen.getByText('설명')).toBeInTheDocument();
  });

  it('renders an actions slot only when children are given', () => {
    const { rerender, container } = render(<PageHero title="제목" />);
    expect(container.querySelector('[data-slot="actions"]')).not.toBeInTheDocument();
    rerender(
      <PageHero title="제목">
        <button type="button">시작하기</button>
      </PageHero>,
    );
    expect(screen.getByRole('button', { name: '시작하기' })).toBeInTheDocument();
  });
});

describe('PageHero — Stage 3 variants (D-S3-13)', () => {
  it('defaults to the article scale and the stacked layout', () => {
    const { container } = render(<PageHero title="제목" />);
    const header = container.querySelector('header');
    expect(header?.getAttribute('data-variant')).toBe('article');
    expect(header?.getAttribute('data-layout')).toBe('stack');
    expect(screen.getByRole('heading', { level: 1 }).className).toContain('text-article-h1');
  });

  it('the hero variant uses the display scale', () => {
    render(<PageHero variant="hero" title="제목" />);
    expect(screen.getByRole('heading', { level: 1 }).className).toContain('text-hero-h1');
  });

  it('sets the lead in the prose measure with Korean line breaking', () => {
    render(<PageHero title="제목" description="리드 문장" />);
    const lead = screen.getByText('리드 문장');
    expect(lead.className).toContain('max-w-lead');
    expect(lead.className).toContain('prose-ko');
    expect(lead.className).not.toMatch(/max-w-\[/u);
  });

  it('renders the meta slot between the lead and the actions', () => {
    const { container } = render(
      <PageHero title="제목" description="리드" meta={<p>입문 · 약 4분</p>}>
        <a href="/learn">배우기</a>
      </PageHero>,
    );
    const texts = [...container.querySelectorAll('p, a')].map((el) => el.textContent);
    expect(texts.indexOf('리드')).toBeLessThan(texts.indexOf('입문 · 약 4분'));
    expect(texts.indexOf('입문 · 약 4분')).toBeLessThan(texts.indexOf('배우기'));
  });

  it('splits text and visual into two columns only when both a visual and split are given', () => {
    const { container, rerender } = render(
      <PageHero title="제목" layout="split" visual={<svg data-testid="art" />} />,
    );
    const header = container.querySelector('header');
    expect(header?.getAttribute('data-layout')).toBe('split');
    expect(header?.className).toContain('lg:grid-cols-12');
    // The text column comes first in the DOM, so the h1 is the first thing announced.
    expect(header?.firstElementChild?.querySelector('h1')).not.toBeNull();
    expect(header?.lastElementChild?.querySelector('[data-testid="art"]')).not.toBeNull();

    rerender(<PageHero title="제목" layout="split" />);
    expect(container.querySelector('header')?.getAttribute('data-layout')).toBe('stack');
  });

  it('renders the micro-facts as a definition list', () => {
    render(
      <PageHero
        variant="hero"
        title="제목"
        facts={[
          { label: '핸드', value: '169' },
          { label: '자리', value: '6' },
        ]}
      />,
    );
    const terms = screen.getAllByRole('term').map((el) => el.textContent);
    expect(terms).toEqual(['핸드', '자리']);
    expect(screen.getAllByRole('definition').map((el) => el.textContent)).toEqual(['169', '6']);
  });
});
