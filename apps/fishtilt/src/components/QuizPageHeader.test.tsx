import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QuizPageHeader } from './QuizPageHeader.js';

import { routeBreadcrumbs } from '../lib/seo/index.js';

const TRAIL = routeBreadcrumbs('practiceHandRanking');

describe('QuizPageHeader', () => {
  it('renders one h1 with the title and the facts list under it', () => {
    render(
      <QuizPageHeader
        trail={TRAIL}
        title="족보 퀴즈"
        description="두 핸드 중 어떤 패가 이기는지 맞혀보세요."
        facts={[
          { label: '문제 수', value: '10문제' },
          { label: '채점', value: '그 자리에서' },
        ]}
      />,
    );
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('족보 퀴즈');

    const facts = screen.getByRole('list', { name: '퀴즈 정보' });
    expect(within(facts).getAllByRole('listitem')).toHaveLength(2);
    expect(within(facts).getByText('문제 수')).toBeInTheDocument();
    expect(within(facts).getByText('10문제')).toBeInTheDocument();
  });

  it('defaults the eyebrow to 퀴즈 and lets a page override it', () => {
    const { rerender } = render(
      <QuizPageHeader trail={TRAIL} title="T" description="D" facts={[]} />,
    );
    expect(screen.getByText('퀴즈', { selector: 'p, span' })).toBeInTheDocument();
    rerender(<QuizPageHeader trail={TRAIL} title="T" description="D" facts={[]} eyebrow="연습" />);
    expect(screen.getByText('연습')).toBeInTheDocument();
  });
});
