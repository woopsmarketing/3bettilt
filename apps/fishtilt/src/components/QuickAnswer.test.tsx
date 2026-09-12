import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderBothThemes } from '../lib/testing/renderBothThemes.js';
import { QuickAnswer } from './QuickAnswer.js';

describe('QuickAnswer (D-S3-13)', () => {
  it('is a region named by its label, holding the answer at the prose size', () => {
    renderBothThemes(
      <QuickAnswer>
        <p>팟 오즈는 콜 금액과 팟의 비율입니다.</p>
      </QuickAnswer>,
    );
    const region = screen.getByRole('region', { name: '빠른 답' });
    expect(region.className).toContain('bg-ground-800');
    expect(region.querySelector('p:last-child')?.parentElement?.className).toContain('text-prose');
    expect(region.querySelector('p:last-child')?.parentElement?.className).toContain('prose-ko');
    expect(screen.getByText('팟 오즈는 콜 금액과 팟의 비율입니다.')).toBeInTheDocument();
  });

  it('takes a custom label', () => {
    renderBothThemes(<QuickAnswer label="한 줄 요약">답</QuickAnswer>);
    expect(screen.getByRole('region', { name: '한 줄 요약' })).toBeInTheDocument();
    expect(screen.getByText('한 줄 요약').className).toContain('text-brand-500');
  });
});
