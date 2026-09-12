import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { QuizQuestion } from '../features/quiz/index.js';
import { QuizQuestionCard } from './QuizQuestionCard.js';

const SINGLE_QUESTION: QuizQuestion = {
  id: 'q1',
  type: 'FIXTURE',
  prompt: 'K9s는 이 포지션의 레인지에 포함될까요?',
  visual: { kind: 'HAND_CLASS', key: 'K9s' },
  answers: [
    { id: 'INCLUDE', label: '포함' },
    { id: 'EXCLUDE', label: '제외' },
  ],
  correctness: { kind: 'SINGLE', correctAnswerId: 'INCLUDE' },
  explanation: '이 포지션의 레인지에는 K9s가 포함되어 있습니다.',
};

const MIXED_QUESTION: QuizQuestion = {
  id: 'q2',
  type: 'FIXTURE',
  prompt: '보드가 로열 플러시일 때 누가 이길까요?',
  answers: [
    { id: 'HERO', label: '히어로' },
    { id: 'VILLAIN', label: '빌런' },
    { id: 'TIE', label: '무승부' },
  ],
  correctness: { kind: 'MIXED', correctAnswerIds: ['TIE'] },
  explanation: '보드 다섯 장이 이미 로열 플러시라서 무승부입니다.',
};

describe('QuizQuestionCard', () => {
  it('renders the prompt as a heading and focuses it on mount', () => {
    render(
      <QuizQuestionCard
        question={SINGLE_QUESTION}
        index={0}
        total={3}
        answer={undefined}
        onAnswer={vi.fn()}
        onNext={vi.fn()}
        isLast={false}
      />,
    );
    const heading = screen.getByRole('heading', { level: 2, name: SINGLE_QUESTION.prompt });
    expect(heading).toHaveFocus();
  });

  it('renders the question visual', () => {
    render(
      <QuizQuestionCard
        question={SINGLE_QUESTION}
        index={0}
        total={3}
        answer={undefined}
        onAnswer={vi.fn()}
        onNext={vi.fn()}
        isLast={false}
      />,
    );
    expect(screen.getByRole('group', { name: 'K9s' })).toBeInTheDocument();
  });

  it('shows no feedback and no next button before answering', () => {
    render(
      <QuizQuestionCard
        question={SINGLE_QUESTION}
        index={0}
        total={3}
        answer={undefined}
        onAnswer={vi.fn()}
        onNext={vi.fn()}
        isLast={false}
      />,
    );
    expect(screen.queryByText(SINGLE_QUESTION.explanation)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '다음 문제' })).not.toBeInTheDocument();
  });

  it('answering calls onAnswer with the chosen option id', async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    render(
      <QuizQuestionCard
        question={SINGLE_QUESTION}
        index={0}
        total={3}
        answer={undefined}
        onAnswer={onAnswer}
        onNext={vi.fn()}
        isLast={false}
      />,
    );
    await user.click(screen.getByRole('button', { name: /포함/u }));
    expect(onAnswer).toHaveBeenCalledWith('INCLUDE');
  });

  it('shows the explanation and marks a correct answer in words, not colour alone', () => {
    render(
      <QuizQuestionCard
        question={SINGLE_QUESTION}
        index={0}
        total={3}
        answer={{ question: SINGLE_QUESTION, answerId: 'INCLUDE', isCorrect: true }}
        onAnswer={vi.fn()}
        onNext={vi.fn()}
        isLast={false}
      />,
    );
    expect(screen.getByText('정답이에요')).toBeInTheDocument();
    expect(screen.getByText(SINGLE_QUESTION.explanation)).toBeInTheDocument();
  });

  it('marks a wrong answer in words and disables every button', () => {
    render(
      <QuizQuestionCard
        question={SINGLE_QUESTION}
        index={0}
        total={3}
        answer={{ question: SINGLE_QUESTION, answerId: 'EXCLUDE', isCorrect: false }}
        onAnswer={vi.fn()}
        onNext={vi.fn()}
        isLast={false}
      />,
    );
    expect(screen.getByText('아쉬워요')).toBeInTheDocument();
    for (const button of screen.getAllByRole('button', { name: /포함|제외/u })) {
      expect(button).toBeDisabled();
    }
  });

  it('labels the next button 다음 문제 when more questions remain, and 결과 보기 on the last', () => {
    const { rerender } = render(
      <QuizQuestionCard
        question={SINGLE_QUESTION}
        index={0}
        total={3}
        answer={{ question: SINGLE_QUESTION, answerId: 'INCLUDE', isCorrect: true }}
        onAnswer={vi.fn()}
        onNext={vi.fn()}
        isLast={false}
      />,
    );
    expect(screen.getByRole('button', { name: '다음 문제' })).toBeInTheDocument();

    rerender(
      <QuizQuestionCard
        question={SINGLE_QUESTION}
        index={2}
        total={3}
        answer={{ question: SINGLE_QUESTION, answerId: 'INCLUDE', isCorrect: true }}
        onAnswer={vi.fn()}
        onNext={vi.fn()}
        isLast
      />,
    );
    expect(screen.getByRole('button', { name: '결과 보기' })).toBeInTheDocument();
  });

  it('a MIXED question reveals the accepted answer, not a forced winner', () => {
    render(
      <QuizQuestionCard
        question={MIXED_QUESTION}
        index={0}
        total={1}
        answer={{ question: MIXED_QUESTION, answerId: 'HERO', isCorrect: false }}
        onAnswer={vi.fn()}
        onNext={vi.fn()}
        isLast
      />,
    );
    expect(screen.getByText('아쉬워요')).toBeInTheDocument();
    const tieButton = screen.getByRole('button', { name: /무승부/u });
    expect(tieButton).toHaveTextContent('○');
  });
});
