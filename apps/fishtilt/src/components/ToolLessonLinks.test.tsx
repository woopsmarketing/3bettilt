import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { contentById, hrefOfContent } from '../content/graph.js';
import { ToolLessonLinks } from './ToolLessonLinks.js';

/*
 * This block replaced six private copies of the same "lesson card" function, each of which
 * could hold exactly one lesson. Two properties matter: it renders the site's ONE card
 * (`LinkCard`, which owns the markup and the 준비 중 branch), and it resolves destinations
 * through the content graph rather than accepting a path from a caller.
 */
describe('ToolLessonLinks', () => {
  it('renders one card per id, linked where the content graph says it may be', () => {
    render(<ToolLessonLinks title="핸드레인지를 배우고 싶다면" ids={['poker-range', 'hand-matrix']} />);
    const section = screen.getByRole('region', { name: '핸드레인지를 배우고 싶다면' });
    expect(within(section).getAllByRole('listitem')).toHaveLength(2);

    for (const id of ['poker-range', 'hand-matrix']) {
      const record = contentById(id);
      const title = within(section).getByText(record.title);
      const href = hrefOfContent(record);
      if (href !== null) {
        expect(title.closest('a'), id).toHaveAttribute('href', href);
      } else {
        // A record that is not written yet is readable text with a badge, never a link.
        expect(title.closest('a'), id).toBeNull();
      }
    }
  });

  it('shows the heading and the optional description above the list', () => {
    render(
      <ToolLessonLinks
        title="아웃을 세는 법을 처음부터 배우고 싶다면"
        description="아웃 개수는 직접 세야 합니다."
        ids={['outs']}
      />,
    );
    expect(
      screen.getByRole('heading', { name: '아웃을 세는 법을 처음부터 배우고 싶다면' }),
    ).toBeInTheDocument();
    expect(screen.getByText('아웃 개수는 직접 세야 합니다.')).toBeInTheDocument();
  });

  it('carries each lesson’s own description and meta, not a restatement', () => {
    const record = contentById('pot-odds');
    render(<ToolLessonLinks title="팟 오즈" ids={['pot-odds']} />);
    expect(screen.getByText(record.description)).toBeInTheDocument();
  });

  it('renders nothing at all rather than a heading over an empty list', () => {
    const { container } = render(<ToolLessonLinks title="비어 있음" ids={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('throws for an unknown id instead of rendering a blank card', () => {
    expect(() => render(<ToolLessonLinks title="없는 것" ids={['not-a-real-lesson']} />)).toThrow(
      /No such content id/u,
    );
  });
});
