import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderBothThemes } from '../lib/testing/renderBothThemes.js';
import { StatCard } from './StatCard.js';

describe('StatCard (D-S3-13)', () => {
  it('renders the value large and tabular, the label under it, the note last', () => {
    const { container } = renderBothThemes(<StatCard value="169" label="핸드 클래스" note="13×13" />);
    const [value, label, note] = [...container.querySelectorAll('p')];
    expect(value?.textContent).toBe('169');
    expect(value?.className).toContain('tabular');
    expect(label?.textContent).toBe('핸드 클래스');
    expect(note?.textContent).toBe('13×13');
  });

  it('is typography only by default and a bordered card only when asked', () => {
    const { container, rerender } = renderBothThemes(<StatCard value="1" label="a" />);
    expect(container.firstElementChild?.className).not.toContain('border');
    rerender(<StatCard value="1" label="a" variant="card" />);
    expect(container.firstElementChild?.className).toContain('border-line-500');
  });

  it('takes a node as its value, so the number can be a <Fact>', () => {
    renderBothThemes(<StatCard value={<span data-testid="fact">1,326</span>} label="콤보" />);
    expect(screen.getByTestId('fact')).toHaveTextContent('1,326');
  });
});
