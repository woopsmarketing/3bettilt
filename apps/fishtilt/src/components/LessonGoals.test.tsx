import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MDX_ALLOWED_COMPONENTS } from '../../mdx-components.js';
import { MDX_COMPONENT_ALLOW_LIST } from '../content/allowList.js';
import { measureContent } from '../content/threshold.js';
import { renderBothThemes } from '../lib/testing/renderBothThemes.js';
import { LessonGoals } from './LessonGoals.js';

const GOALS = ['한 판의 단계를 순서대로 말할 수 있다', '블라인드를 누가 내는지 안다'];

describe('LessonGoals', () => {
  it('renders a named region with one list item per goal, in the given order', () => {
    renderBothThemes(<LessonGoals items={GOALS} />);
    const region = screen.getByRole('region', { name: '이 레슨에서 배우는 것' });
    const items = within(region).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(GOALS);
    expect(region.dataset['lesson']).toBe('goals');
  });

  it('adds no heading, so the lesson outline stays the prose sections', () => {
    renderBothThemes(<LessonGoals items={GOALS} />);
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('renders nothing for an empty list rather than an empty box', () => {
    const { container } = renderBothThemes(<LessonGoals items={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('accepts a custom title', () => {
    renderBothThemes(<LessonGoals items={GOALS} title="목표" />);
    expect(screen.getByRole('region', { name: '목표' })).toBeInTheDocument();
  });

  it('is on the MDX allow-list under the name prose calls it by', () => {
    expect(MDX_COMPONENT_ALLOW_LIST).toContain('LessonGoals');
    expect(MDX_ALLOWED_COMPONENTS.LessonGoals).toBe(LessonGoals);
  });

  it('does not move a lesson’s measured length, because items are attributes', () => {
    const without = '문단 하나.\n';
    const withGoals = `문단 하나.\n\n<LessonGoals items={['이 문장은 속성이라 본문 길이에 들어가지 않습니다']} />\n`;
    expect(measureContent(withGoals).proseCharacters).toBe(measureContent(without).proseCharacters);
    expect(measureContent(withGoals).componentUses).toContain('LessonGoals');
  });
});
