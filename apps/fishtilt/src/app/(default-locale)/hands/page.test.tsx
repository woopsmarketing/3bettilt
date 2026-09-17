import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type * as GraphModule from '../../../content/graph.js';
import type { HandRecord } from '../../../content/types.js';
import { contentOfKind } from '../../../content/graph.js';
import HandsIndexPage from './page.js';
import { DEFAULT_LOCALE, localePath } from '../../../lib/locale.js';

/** The localised form of a site path — what every href on the site carries (D-S3-02). */
const ko = (sitePath: string): string => localePath(DEFAULT_LOCALE, sitePath);

/*
 * Same honesty gate `/learn`'s hub proves: every hand visible, only the written ones
 * clickable. Since WP-S3-13a the hub renders each covered hand TWICE — once as a cell in the
 * static 13×13 index (`HandIndexMatrix`) and once as a row in the grouped list
 * (`HandHubGroups`) — so the assertions below count and scope rather than expecting one
 * element per hand.
 */

/**
 * A PLANNED hand fixture this test owns outright, so the "준비 중, never a link" branch is
 * always exercised no matter how many real hands are published. The `handKey` deliberately
 * does not match any of the 169 real classes: `handHubGroups` parks an unresolvable key
 * last without throwing, and the 13×13 index simply has no cell for it.
 */
const { PLANNED_HAND } = vi.hoisted(() => {
  const fixture: HandRecord = {
    kind: 'hands',
    id: 'hand-fixture-unwritten',
    slug: 'fixture-unwritten',
    title: '테스트 픽스처 핸드 (Fixture)',
    description: '테스트 전용, 절대 발행되지 않는 미작성 핸드 픽스처.',
    level: 'BASIC',
    topic: 'starting-hands',
    concepts: [],
    prerequisites: [],
    relatedConcepts: [],
    relatedTools: [],
    relatedHands: [],
    nextLessons: [],
    relatedArticles: [],
    status: 'PLANNED',
    indexable: false,
    readMinutes: null,
    handKey: 'ZZx',
  };
  return { PLANNED_HAND: fixture };
});

vi.mock('../../../content/graph.js', async (importOriginal) => {
  const actual = await importOriginal<typeof GraphModule>();
  return {
    ...actual,
    contentOfKind: (kind: Parameters<typeof actual.contentOfKind>[0]) =>
      kind === 'hands' ? [...actual.contentOfKind(kind), PLANNED_HAND] : actual.contentOfKind(kind),
  };
});

describe('/hands index', () => {
  const records = contentOfKind('hands') as readonly HandRecord[];

  it('lists every hand in the registry in the grouped list', () => {
    render(<HandsIndexPage />);
    const list = screen.getByRole('region', { name: '전체 핸드' });
    for (const record of records) {
      expect(within(list).getAllByText(record.handKey).length, record.id).toBeGreaterThanOrEqual(1);
    }
    expect(list.querySelectorAll('li')).toHaveLength(records.length);
  });

  it('links a written hand and marks an unwritten one 준비 중', () => {
    render(<HandsIndexPage />);
    const list = screen.getByRole('region', { name: '전체 핸드' });
    for (const record of records) {
      const links = within(list).queryAllByRole('link', {
        name: new RegExp(`^${record.handKey}\\b`, 'u'),
      });
      if (record.status === 'PUBLISHED') {
        expect(links, record.id).toHaveLength(1);
        expect(links[0], record.id).toHaveAttribute('href', ko(`/hands/${record.slug}`));
      } else {
        expect(links, record.id).toHaveLength(0);
      }
    }
    const planned = records.filter((record) => record.status === 'PLANNED').length;
    expect(within(list).queryAllByText('준비 중')).toHaveLength(planned);
    expect(
      screen.getByText(
        `전체 ${records.length}개 중 ${records.length - planned}개를 읽을 수 있습니다.`,
        { exact: false },
      ),
    ).toBeInTheDocument();
  });

  it('draws the static 13×13 index with one link per published hand', () => {
    render(<HandsIndexPage />);
    const nav = screen.getByRole('navigation', { name: '13×13 표에서 고르기' });
    const published = records.filter((record) => record.status === 'PUBLISHED');
    expect(within(nav).getAllByRole('link')).toHaveLength(published.length);
    expect(nav.querySelectorAll('[data-row]')).toHaveLength(169);
  });

  it('has exactly one h1 and links the ranking lesson and the explorer from the hero', () => {
    render(<HandsIndexPage />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: '169개 순위표 열기' })[0]).toHaveAttribute(
      'href',
      ko('/tools/starting-hand'),
    );
    expect(
      screen.getAllByRole('link', { name: '시작 패는 어떤 순서로 강할까요?' })[0],
    ).toHaveAttribute('href', ko('/learn/starting-hand-ranking'));
  });
});
