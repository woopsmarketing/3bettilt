import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AnsweredQuestion, QuizQuestion } from '../features/quiz/index.js';
import { QuizResult } from './QuizResult.js';

const QUESTION: QuizQuestion = {
  id: 'q1',
  type: 'FIXTURE',
  prompt: 'K9s는 이 포지션의 레인지에 포함될까요?',
  answers: [
    { id: 'INCLUDE', label: '포함' },
    { id: 'EXCLUDE', label: '제외' },
  ],
  correctness: { kind: 'SINGLE', correctAnswerId: 'INCLUDE' },
  explanation: '이 포지션의 레인지에는 K9s가 포함되어 있습니다.',
};

const WRONG_ANSWER: AnsweredQuestion = {
  question: QUESTION,
  answerId: 'EXCLUDE',
  isCorrect: false,
};

describe('QuizResult', () => {
  it('shows the score and focuses its own heading', () => {
    render(
      <QuizResult
        score={{ totalQuestions: 3, answeredCount: 3, correctCount: 2, incorrectCount: 1 }}
        wrong={[WRONG_ANSWER]}
        onRetryWrongOnly={vi.fn()}
        onRestart={vi.fn()}
      />,
    );
    expect(screen.getByText('총 3문제 중 2개 정답')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '퀴즈 결과' })).toHaveFocus();
  });

  it('lists every missed question with its correct answer and explanation', () => {
    render(
      <QuizResult
        score={{ totalQuestions: 1, answeredCount: 1, correctCount: 0, incorrectCount: 1 }}
        wrong={[WRONG_ANSWER]}
        onRetryWrongOnly={vi.fn()}
        onRestart={vi.fn()}
      />,
    );
    expect(screen.getByText(QUESTION.prompt)).toBeInTheDocument();
    expect(screen.getByText('포함')).toBeInTheDocument();
    expect(screen.getByText(QUESTION.explanation)).toBeInTheDocument();
  });

  it('shows, for each missed question, what the reader answered beside the correct answer', () => {
    render(
      <QuizResult
        score={{ totalQuestions: 1, answeredCount: 1, correctCount: 0, incorrectCount: 1 }}
        wrong={[WRONG_ANSWER]}
        onRetryWrongOnly={vi.fn()}
        onRestart={vi.fn()}
      />,
    );
    expect(screen.getByText('내 답')).toBeInTheDocument();
    expect(screen.getByText('제외')).toBeInTheDocument();
    expect(screen.getByText('정답')).toBeInTheDocument();
    expect(screen.getByText('포함')).toBeInTheDocument();
  });

  it('announces the score once in a status region and never adds a second one', () => {
    render(
      <QuizResult
        score={{ totalQuestions: 3, answeredCount: 3, correctCount: 2, incorrectCount: 1 }}
        wrong={[WRONG_ANSWER]}
        onRetryWrongOnly={vi.fn()}
        onRestart={vi.fn()}
      />,
    );
    const statuses = screen.getAllByRole('status');
    expect(statuses).toHaveLength(1);
    expect(statuses[0]).toHaveTextContent('총 3문제 중 2개 정답');
  });

  it('renders the lesson and tool the bank points at, once, under 이어서 보기', () => {
    render(
      <QuizResult
        score={{ totalQuestions: 1, answeredCount: 1, correctCount: 1, incorrectCount: 0 }}
        wrong={[]}
        onRetryWrongOnly={vi.fn()}
        onRestart={vi.fn()}
        related={{ relatedTool: 'range', relatedConcept: 'poker-range' }}
      />,
    );
    expect(screen.getByText('이어서 보기')).toBeInTheDocument();
    const list = screen.getByRole('list', { name: '이어서 보기' });
    // One row for the lesson, one for the tool — and the block appears once, not per question.
    expect(within(list).getAllByRole('link')).toHaveLength(2);
    expect(screen.getAllByText('이어서 보기')).toHaveLength(1);
  });

  it('says so, without a missed list, when nothing was missed', () => {
    render(
      <QuizResult
        score={{ totalQuestions: 2, answeredCount: 2, correctCount: 2, incorrectCount: 0 }}
        wrong={[]}
        onRetryWrongOnly={vi.fn()}
        onRestart={vi.fn()}
      />,
    );
    expect(screen.getByText('모든 문제를 맞혔습니다!')).toBeInTheDocument();
    expect(screen.queryByText('다시 봐야 할 문제')).not.toBeInTheDocument();
  });

  it('offers 틀린 패 다시 풀기 only when there is something to retry', () => {
    const { rerender } = render(
      <QuizResult
        score={{ totalQuestions: 1, answeredCount: 1, correctCount: 0, incorrectCount: 1 }}
        wrong={[WRONG_ANSWER]}
        onRetryWrongOnly={vi.fn()}
        onRestart={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: '틀린 패 다시 풀기' })).toBeInTheDocument();

    rerender(
      <QuizResult
        score={{ totalQuestions: 1, answeredCount: 1, correctCount: 1, incorrectCount: 0 }}
        wrong={[]}
        onRetryWrongOnly={vi.fn()}
        onRestart={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: '틀린 패 다시 풀기' })).not.toBeInTheDocument();
  });

  it('calls onRetryWrongOnly and onRestart from their own buttons', async () => {
    const user = userEvent.setup();
    const onRetryWrongOnly = vi.fn();
    const onRestart = vi.fn();
    render(
      <QuizResult
        score={{ totalQuestions: 1, answeredCount: 1, correctCount: 0, incorrectCount: 1 }}
        wrong={[WRONG_ANSWER]}
        onRetryWrongOnly={onRetryWrongOnly}
        onRestart={onRestart}
      />,
    );
    await user.click(screen.getByRole('button', { name: '틀린 패 다시 풀기' }));
    expect(onRetryWrongOnly).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: '처음부터 다시 풀기' }));
    expect(onRestart).toHaveBeenCalledTimes(1);
  });
});
