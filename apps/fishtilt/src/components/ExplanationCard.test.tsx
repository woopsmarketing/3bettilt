import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ExplanationCard } from './ExplanationCard.js';

describe('ExplanationCard', () => {
  it('renders as an <aside>, distinct from ordinary page content', () => {
    const { container } = render(<ExplanationCard>내용</ExplanationCard>);
    expect(container.firstElementChild?.tagName).toBe('ASIDE');
  });

  it('renders the optional title and the body', () => {
    render(<ExplanationCard title="쉽게 설명하면">본문 내용</ExplanationCard>);
    expect(screen.getByText('쉽게 설명하면')).toBeInTheDocument();
    expect(screen.getByText('본문 내용')).toBeInTheDocument();
  });

  it('marks itself visually distinct from Panel with a left accent border, not colour alone', () => {
    const { container } = render(<ExplanationCard>내용</ExplanationCard>);
    expect(container.firstElementChild?.className).toContain('border-l-4');
  });
});
