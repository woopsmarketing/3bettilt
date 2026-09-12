import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { contentOfKind } from '../../content/graph.js';
import { factValue } from '../../content/facts.js';
import type { HandRecord } from '../../content/types.js';
import { DEFAULT_LOCALE, localePath } from '../../lib/locale.js';
import { renderBothThemes } from '../../lib/testing/renderBothThemes.js';
import { HandHubGroups } from './HandHubGroups.js';
import { HAND_FAMILY_LABEL } from './handGraph.js';

const RECORDS = contentOfKind('hands') as readonly HandRecord[];

describe('HandHubGroups', () => {
  it('renders three family groups holding every record once, as divided rows not cards', () => {
    const { container } = renderBothThemes(<HandHubGroups records={RECORDS} />);
    for (const label of Object.values(HAND_FAMILY_LABEL)) {
      expect(screen.getByRole('heading', { level: 3, name: label })).toBeInTheDocument();
    }
    expect(container.querySelectorAll('li')).toHaveLength(RECORDS.length);
    expect(container.querySelectorAll('ol')).toHaveLength(3);
  });

  it('every row is exactly one of a link or a 준비 중 badge, and shows the rank as a Fact', () => {
    const planned: HandRecord = {
      ...RECORDS[0]!,
      id: 'hand-fixture-planned',
      slug: 'fixture-planned',
      handKey: '72o',
      status: 'PLANNED',
      indexable: false,
      readMinutes: null,
    };
    const { container } = renderBothThemes(<HandHubGroups records={[...RECORDS, planned]} />);
    const rows = container.querySelectorAll('li');
    let linked = 0;
    for (const row of rows) {
      const links = within(row as HTMLElement).queryAllByRole('link');
      const badges = within(row as HTMLElement).queryAllByText('준비 중');
      expect(links.length + badges.length, row.textContent ?? '').toBe(1);
      linked += links.length;
    }
    expect(linked).toBe(RECORDS.filter((record) => record.status === 'PUBLISHED').length);

    const aa = RECORDS.find((record) => record.handKey === 'AA')!;
    const aaLink = screen.getByRole('link', { name: (name) => name.includes(aa.title) });
    expect(aaLink).toHaveAttribute('href', localePath(DEFAULT_LOCALE, `/hands/${aa.slug}`));
    expect(aaLink.textContent).toContain(`${factValue('HAND_RANK', 'AA')}위`);
  });
});
