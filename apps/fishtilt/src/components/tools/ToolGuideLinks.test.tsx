import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderBothThemes } from '../../lib/testing/renderBothThemes.js';
import { toolGuideLinkGroups } from '../../features/tools/guideLinks.js';
import { ToolGuideLinks } from './ToolGuideLinks.js';

describe('ToolGuideLinks', () => {
  it('renders one named region per group, each a plain list of rows', () => {
    const groups = toolGuideLinkGroups('toolEquity');
    renderBothThemes(<ToolGuideLinks groups={groups} title="승률, 더 깊이" />);
    const block = screen.getByRole('region', { name: '승률, 더 깊이' });
    for (const group of groups) {
      const region = within(block).getByRole('region', { name: group.label });
      expect(within(region).getAllByRole('listitem')).toHaveLength(group.links.length);
      for (const link of group.links) {
        if (link.href !== null) {
          expect(
            within(region).getByRole('link', {
              name: new RegExp(link.title.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'),
            }),
          ).toHaveAttribute('href', link.href);
        }
      }
    }
  });

  it('renders an unpublished piece as 준비 중 with no anchor', () => {
    renderBothThemes(
      <ToolGuideLinks
        title="테스트"
        groups={[
          {
            label: '더 배우기',
            links: [{ key: 'x', href: null, title: '아직 없는 글', meta: null }],
          },
        ]}
      />,
    );
    expect(screen.getByText('아직 없는 글').closest('a')).toBeNull();
    expect(screen.getByText('준비 중')).toBeInTheDocument();
  });

  it('renders nothing for no groups', () => {
    const { container } = renderBothThemes(<ToolGuideLinks groups={[]} title="빈" />);
    expect(container.innerHTML).toBe('');
  });
});
