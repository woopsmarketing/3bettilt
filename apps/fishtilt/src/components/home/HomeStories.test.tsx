import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BLOG_CONTENT_TYPE_ANCHOR, hrefOfContent } from '../../content/graph.js';
import { FIXTURE_STORY } from '../../content/stories/testing/fixtureStory.js';
import { HAND_STORY_DISCLOSURE } from '../../content/stories/types.js';
import type { HandStoryRecord } from '../../content/types.js';
import { renderBothThemes } from '../../lib/testing/renderBothThemes.js';
import { routeById } from '../../lib/routes.js';
import { HomeStories } from './HomeStories.js';
import { homeStories } from './homeModel.js';

/*
 * Stories are being written while the home ships (0 published at the time of writing), so
 * both states are proved against the test-only fixture story: with stories the first is
 * featured with its own cards, board and disclosure; with none the band states the promise
 * and links only to the real blog hub. Nothing in the component changes between the two.
 */
const SECOND: HandStoryRecord = {
  ...FIXTURE_STORY,
  id: 'blog-fixture-second',
  slug: 'fixture-second',
  title: '두 번째 픽스처 스토리',
};

const blogHref = routeById('blog').path;

describe('HomeStories', () => {
  it('with zero stories, shows the promise and links only to the blog hub — no fake titles', () => {
    const model = homeStories([]);
    expect(model.featured).toBeNull();
    const { container } = renderBothThemes(<HomeStories {...model} blogHref={blogHref} />);
    expect(container.querySelector('[data-stories="coming-soon"]')).not.toBeNull();
    expect(container.querySelector('[data-featured-story]')).toBeNull();
    expect(container.querySelectorAll('[role="img"]')).toHaveLength(0);
    const links = Array.from(container.querySelectorAll('a[href]')).map((a) =>
      a.getAttribute('href'),
    );
    expect(links).toEqual([blogHref]);
    expect(container.textContent).not.toContain('준비 중');
  });

  it('with one story, features it: its own cards, its board, its title as a link, the disclosure', () => {
    const model = homeStories([FIXTURE_STORY]);
    const { container } = renderBothThemes(<HomeStories {...model} blogHref={blogHref} />);
    const featured = container.querySelector('[data-featured-story]');
    expect(featured?.getAttribute('data-featured-story')).toBe(FIXTURE_STORY.id);
    expect(screen.getByRole('link', { name: FIXTURE_STORY.title })).toHaveAttribute(
      'href',
      hrefOfContent(FIXTURE_STORY),
    );
    // The hero's two cards and the three streets come from the record, drawn as card faces.
    expect(screen.getByRole('group', { name: /내 패 카드: Qs Qh/u })).toBeInTheDocument();
    expect(within(featured as HTMLElement).getAllByRole('img').length).toBeGreaterThanOrEqual(7);
    expect(container.textContent).toContain(HAND_STORY_DISCLOSURE);
    // Only one story: the secondary column says the next one is coming, and offers the hub.
    expect(container.querySelectorAll('[data-story]')).toHaveLength(0);
    expect(screen.getByRole('link', { name: /스토리 전체 보기/u })).toHaveAttribute(
      'href',
      `${blogHref}#${BLOG_CONTENT_TYPE_ANCHOR['hand-story']}`,
    );
  });

  it('with two stories, the second is a row beside the featured one', () => {
    const model = homeStories([FIXTURE_STORY, SECOND]);
    const { container } = renderBothThemes(<HomeStories {...model} blogHref={blogHref} />);
    const rows = container.querySelectorAll('[data-story]');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.getAttribute('data-story')).toBe(SECOND.id);
    expect(screen.getByRole('link', { name: SECOND.title })).toHaveAttribute(
      'href',
      hrefOfContent(SECOND),
    );
  });

  it('never renders GTO', () => {
    const { container } = renderBothThemes(
      <HomeStories {...homeStories([FIXTURE_STORY])} blogHref={blogHref} />,
    );
    expect(container.textContent).not.toContain('GTO');
  });
});
