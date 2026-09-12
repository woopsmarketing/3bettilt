import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SectionHeading } from './SectionHeading.js';

describe('SectionHeading', () => {
  it('renders the title as an <h2> by default', () => {
    render(<SectionHeading title="시작 패의 구조" />);
    expect(screen.getByRole('heading', { level: 2, name: '시작 패의 구조' })).toBeInTheDocument();
  });

  it('renders as <h3> when asked, for a nested sub-section', () => {
    render(<SectionHeading title="하위 제목" as="h3" />);
    expect(screen.getByRole('heading', { level: 3, name: '하위 제목' })).toBeInTheDocument();
  });

  it('renders the optional description', () => {
    render(<SectionHeading title="제목" description="설명 문구" />);
    expect(screen.getByText('설명 문구')).toBeInTheDocument();
  });

  it('omits the description paragraph entirely when none is given', () => {
    const { container } = render(<SectionHeading title="제목" />);
    expect(container.querySelector('p')).not.toBeInTheDocument();
  });
});
