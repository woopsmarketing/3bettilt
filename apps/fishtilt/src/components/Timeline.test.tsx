import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderBothThemes } from '../lib/testing/renderBothThemes.js';
import { Timeline } from './Timeline.js';

const STEPS = [
  { title: '카드 두 장을 받는다', meta: '프리플랍' },
  { title: '플랍 세 장이 열린다', body: <p>이제 다섯 장 중 세 장이 보입니다.</p> },
  { title: '턴과 리버' },
];

describe('Timeline (D-S3-12)', () => {
  it('is an ordered list of the steps, in order, numbered visibly', () => {
    renderBothThemes(<Timeline steps={STEPS} aria-label="핸드 진행" />);
    const list = screen.getByRole('list', { name: '핸드 진행' });
    expect(list.tagName).toBe('OL');
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[1]?.querySelector('[aria-hidden="true"]')?.textContent).toBe('2');
    expect(items[0]?.textContent).toContain('프리플랍');
    expect(items[1]?.textContent).toContain('다섯 장 중 세 장');
  });

  it('draws the rail with the border token and needs no JavaScript', () => {
    const { container } = renderBothThemes(<Timeline steps={STEPS} />);
    expect(container.querySelector('li')?.className).toContain('border-l border-line-500');
    expect(container.querySelector('button')).toBeNull();
  });

  it('renders nothing for no steps', () => {
    const { container } = renderBothThemes(<Timeline steps={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
