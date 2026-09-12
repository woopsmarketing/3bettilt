import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MDX_ALLOWED_COMPONENTS } from '../../mdx-components.js';
import { MDX_COMPONENT_ALLOW_LIST } from '../content/allowList.js';
import { measureContent } from '../content/threshold.js';
import { renderBothThemes } from '../lib/testing/renderBothThemes.js';
import { LessonSummary } from './LessonSummary.js';

const SUMMARY = ['카드 두 장을 받고 순서대로 돈을 겁니다.', '판은 두 가지 방법으로 끝납니다.'];

describe('LessonSummary', () => {
  it('renders the KeyPoint well with an ordered list of the given sentences', () => {
    const { container } = renderBothThemes(<LessonSummary items={SUMMARY} />);
    const aside = container.querySelector('aside[data-variant="key"]');
    expect(aside).not.toBeNull();
    expect(screen.getByText('한눈에 정리')).toBeInTheDocument();
    const list = container.querySelector('ol[data-lesson="summary"]');
    expect(list).not.toBeNull();
    const items = within(list as HTMLElement).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(SUMMARY);
  });

  it('renders nothing for an empty list', () => {
    const { container } = renderBothThemes(<LessonSummary items={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('is on the MDX allow-list under the name prose calls it by', () => {
    expect(MDX_COMPONENT_ALLOW_LIST).toContain('LessonSummary');
    expect(MDX_ALLOWED_COMPONENTS.LessonSummary).toBe(LessonSummary);
  });

  it('does not move a lesson’s measured length, because items are attributes', () => {
    const without = '문단 하나.\n';
    const withSummary = `문단 하나.\n\n<LessonSummary items={['이 문장은 속성이라 본문 길이에 들어가지 않습니다']} />\n`;
    expect(measureContent(withSummary).proseCharacters).toBe(
      measureContent(without).proseCharacters,
    );
  });
});
