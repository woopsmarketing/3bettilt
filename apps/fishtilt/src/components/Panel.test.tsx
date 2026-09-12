import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Panel } from './Panel.js';

describe('Panel', () => {
  it('renders its children inside a bordered container', () => {
    render(<Panel>내용</Panel>);
    expect(screen.getByText('내용')).toBeInTheDocument();
  });

  it('defaults to a <div> so nested panels never produce redundant unlabelled <section>s', () => {
    const { container } = render(<Panel>내용</Panel>);
    expect(container.firstElementChild?.tagName).toBe('DIV');
  });

  it('renders as a <section> when asked, for top-level page grouping', () => {
    const { container } = render(<Panel as="section">내용</Panel>);
    expect(container.firstElementChild?.tagName).toBe('SECTION');
  });
});
