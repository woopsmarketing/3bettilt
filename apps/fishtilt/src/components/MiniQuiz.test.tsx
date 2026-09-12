import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MiniQuiz, type MiniQuizQuestion } from './MiniQuiz.js';

const QUESTIONS: readonly MiniQuizQuestion[] = [
  {
    question: '핸드레인지는 무엇을 뜻할까요?',
    options: ['정확한 두 장', '들고 있을 수 있는 패의 묶음'],
    answer: 1,
    explanation: '가능성 있는 패를 묶어서 보는 방법입니다.',
  },
  {
    question: '대각선 칸은 무엇일까요?',
    options: ['같은 무늬', '같은 숫자'],
    answer: 1,
    explanation: '대각선은 같은 숫자 두 장입니다.',
  },
];

describe('MiniQuiz', () => {
  it('renders every option as a real button with a 44px touch target', () => {
    render(<MiniQuiz questions={QUESTIONS} />);
    const option = screen.getByRole('button', { name: '들고 있을 수 있는 패의 묶음' });
    expect(option.className).toContain('min-h-11');
  });

  it('shows no explanation before the reader has answered', () => {
    render(<MiniQuiz questions={QUESTIONS} />);
    expect(screen.queryByText(/가능성 있는 패를 묶어서/u)).not.toBeInTheDocument();
  });

  it('explains the answer whether the reader was right or wrong', async () => {
    const user = userEvent.setup();
    render(<MiniQuiz questions={QUESTIONS} />);
    await user.click(screen.getByRole('button', { name: '정확한 두 장' }));
    expect(screen.getByText(/가능성 있는 패를 묶어서/u)).toBeInTheDocument();
    expect(screen.getByText('아쉬워요')).toBeInTheDocument();
  });

  it('marks a correct answer in words, not by colour alone', async () => {
    const user = userEvent.setup();
    render(<MiniQuiz questions={QUESTIONS} />);
    await user.click(screen.getByRole('button', { name: '들고 있을 수 있는 패의 묶음' }));
    expect(screen.getByText('정답이에요')).toBeInTheDocument();
  });

  it('announces progress and score through a live region', async () => {
    const user = userEvent.setup();
    render(<MiniQuiz questions={QUESTIONS} />);
    expect(screen.getByText('2문제')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '들고 있을 수 있는 패의 묶음' }));
    expect(screen.getByText('1 / 2문제 · 맞힌 문제 1개')).toBeInTheDocument();
  });

  it('lets the reader start over', async () => {
    const user = userEvent.setup();
    render(<MiniQuiz questions={QUESTIONS} />);
    await user.click(screen.getByRole('button', { name: '정확한 두 장' }));
    await user.click(screen.getByRole('button', { name: '다시 풀기' }));
    expect(screen.queryByText('아쉬워요')).not.toBeInTheDocument();
    expect(screen.getByText('2문제')).toBeInTheDocument();
  });

  it('renders no heading of its own by default — the article section owns it', () => {
    render(<MiniQuiz questions={QUESTIONS} />);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: '확인 문제' })).toBeInTheDocument();
  });

  it('throws for a question whose answer is not one of its options', () => {
    expect(() =>
      render(
        <MiniQuiz
          questions={[{ question: 'q', options: ['a', 'b'], answer: 5, explanation: 'e' }]}
        />,
      ),
    ).toThrow(/outside its options/u);
  });
});
