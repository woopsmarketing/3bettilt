import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { contentById, hrefOfContent } from '../../content/graph.js';
import { HAND_STORY_DISCLOSURE } from '../../content/stories/types.js';
import type { HandRecord } from '../../content/types.js';
import { renderBothThemes } from '../../lib/testing/renderBothThemes.js';
import { GUIDES_LABEL, HandOnward, STORIES_LABEL } from './HandOnward.js';
import { guidesFor, storiesFeaturing } from './handGraph.js';

function handRecord(id: string): HandRecord {
  const record = contentById(id);
  if (record.kind !== 'hands') throw new Error(`fixture: ${id} is not a hand record`);
  return record;
}

describe('HandOnward', () => {
  it('renders the stories that actually feature the hand, with the disclosure visible', () => {
    const qq = handRecord('hand-qq');
    renderBothThemes(<HandOnward record={qq} />);
    const stories = screen.getByRole('region', { name: STORIES_LABEL });
    expect(within(stories).getByText(HAND_STORY_DISCLOSURE, { exact: false })).toBeInTheDocument();
    const rows = within(stories).getAllByRole('listitem');
    expect(rows).toHaveLength(storiesFeaturing(qq).length);
    const featured = contentById('blog-qq-vs-72o-flop-227');
    expect(within(stories).getByRole('link', { name: featured.title })).toHaveAttribute(
      'href',
      hrefOfContent(featured),
    );
    // Two shipped stories deal QQ to the hero; the row note appears once per such story.
    expect(
      within(stories).getAllByText('주인공이 이 패를 들었습니다').length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('renders the guides group with declared and reverse-linked guides, link xor 준비 중', () => {
    const aks = handRecord('hand-aks');
    renderBothThemes(<HandOnward record={aks} />);
    const guides = screen.getByRole('region', { name: GUIDES_LABEL });
    const rows = within(guides).getAllByRole('listitem');
    expect(rows).toHaveLength(guidesFor(aks).length);
    for (const row of rows) {
      const links = within(row).queryAllByRole('link');
      const badges = within(row).queryAllByText('준비 중');
      expect(links.length + badges.length, row.textContent ?? '').toBe(1);
    }
    expect(within(guides).getByText(contentById('blog-is-ak-good').title)).toBeInTheDocument();
  });

  it('renders nothing at all for a hand with no guides and no stories', () => {
    const lonely: HandRecord = {
      ...handRecord('hand-22'),
      id: 'hand-fixture-lonely',
      slug: 'fixture-lonely',
      handKey: 'ZZx',
      relatedArticles: [],
    };
    const { container } = renderBothThemes(<HandOnward record={lonely} />);
    expect(container.textContent).toBe('');
  });
});
