import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderBothThemes } from '../lib/testing/renderBothThemes.js';
import { ArticleHero } from './ArticleHero.js';
import { ArticleMeta } from './ArticleMeta.js';
import { EditorialHero } from './EditorialHero.js';

describe('ArticleHero / EditorialHero — names onto PageHero (D-S3-12/13)', () => {
  it('ArticleHero renders the article variant with category, deck and meta', () => {
    const { container } = renderBothThemes(
      <ArticleHero
        category="읽을거리"
        title="팟 오즈, 3분 만에"
        deck="콜할지 말지를 숫자로 정하는 법."
        meta={<ArticleMeta level="INTRO" readMinutes={3} />}
      />,
    );
    expect(container.querySelector('header')?.getAttribute('data-variant')).toBe('article');
    expect(screen.getByText('읽을거리').className).toContain('text-brand-500');
    expect(screen.getByRole('heading', { level: 1, name: '팟 오즈, 3분 만에' })).toBeInTheDocument();
    expect(screen.getByText('콜할지 말지를 숫자로 정하는 법.')).toBeInTheDocument();
    expect(screen.getByText('약 3분')).toBeInTheDocument();
  });

  it('EditorialHero renders the hero variant, split only when it has a visual', () => {
    const { container, rerender } = renderBothThemes(
      <EditorialHero
        eyebrow="3BETTILT"
        title="홀덤, 눈으로 이해하세요"
        lead="표를 눌러보며 배웁니다."
        visual={<svg data-testid="art" />}
        facts={[{ label: '핸드', value: '169' }]}
      >
        <a href="/learn">시작하기</a>
      </EditorialHero>,
    );
    const header = container.querySelector('header');
    expect(header?.getAttribute('data-variant')).toBe('hero');
    expect(header?.getAttribute('data-layout')).toBe('split');
    expect(screen.getByRole('heading', { level: 1 }).className).toContain('text-hero-h1');
    expect(screen.getByRole('link', { name: '시작하기' })).toBeInTheDocument();
    expect(screen.getByRole('term')).toHaveTextContent('핸드');

    rerender(<EditorialHero title="홀덤" />);
    expect(container.querySelector('header')?.getAttribute('data-layout')).toBe('stack');
  });
});
