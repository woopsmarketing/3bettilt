import { Fragment, type ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { splitAfterLead } from './leadSplit.js';

/*
 * The shapes asserted here are CONSTRUCTED, not sampled from a real hand page
 * (`docs/FISHTILT_STATE.md` ruling 26): Vitest has no MDX pipeline, and more importantly a
 * test that imported one of the twenty articles would be pinned to whatever that author
 * wrote this week. What matters is the compiler's output SHAPE — a flat fragment of block
 * children with `"\n"` between them — which is what these fixtures reproduce.
 */

/** What `@mdx-js/mdx` v3 emits for `lead\n\n## heading\n\nbody`. */
function compiledArticle(): ReactElement {
  return (
    <Fragment>
      {[
        <p key="lead">한 줄 답입니다.</p>,
        '\n',
        <h2 key="h">더 있는 이야기</h2>,
        '\n',
        <p key="body">본문입니다.</p>,
      ]}
    </Fragment>
  );
}

describe('splitAfterLead', () => {
  it('puts the first block in the lead and everything after it in the rest', () => {
    const { lead, rest } = splitAfterLead(compiledArticle());

    render(<div data-testid="lead">{lead}</div>);
    expect(screen.getByTestId('lead').textContent).toBe('한 줄 답입니다.');

    render(<div data-testid="rest">{rest}</div>);
    const restText = screen.getByTestId('rest').textContent ?? '';
    expect(restText).toContain('더 있는 이야기');
    expect(restText).toContain('본문입니다.');
    expect(restText).not.toContain('한 줄 답입니다.');
  });

  it('loses nothing: lead + rest is the whole article, in source order', () => {
    const { lead, rest } = splitAfterLead(compiledArticle());
    render(
      <div data-testid="all">
        {lead}
        {rest}
      </div>,
    );
    expect(screen.getByTestId('all').textContent).toBe('한 줄 답입니다.\n더 있는 이야기\n본문입니다.');
  });

  it('an article that is one block long has an empty rest, not a duplicated lead', () => {
    const single = (
      <Fragment>
        <p>한 줄뿐입니다.</p>
      </Fragment>
    );
    const { lead, rest } = splitAfterLead(single);
    expect(rest).toEqual([]);
    render(<div data-testid="lead">{lead}</div>);
    expect(screen.getByTestId('lead').textContent).toBe('한 줄뿐입니다.');
  });

  it('falls back to rendering the whole thing as the lead when handed an unexpected shape', () => {
    // Not a fragment of blocks — a bare element with no children. The page must still show
    // the article rather than throwing or dropping it.
    const odd = <p>단독 요소</p>;
    const { lead, rest } = splitAfterLead(odd);
    expect(rest).toEqual([]);
    render(<div data-testid="lead">{lead}</div>);
    expect(screen.getByTestId('lead').textContent).toBe('단독 요소');
  });

  it('renders nothing for an article component that returned null', () => {
    expect(splitAfterLead(null)).toEqual({ lead: [], rest: [] });
  });
});
