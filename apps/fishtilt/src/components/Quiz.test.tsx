import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { answerQuestion, createQuizSession, type QuizQuestion } from '../features/quiz/index.js';
import { Quiz, segmentStates } from './Quiz.js';

function question(id: string, correctAnswerId: 'A' | 'B' = 'A'): QuizQuestion {
  return {
    id,
    type: 'FIXTURE',
    prompt: `문제 ${id}`,
    answers: [
      { id: 'A', label: `A안-${id}` },
      { id: 'B', label: `B안-${id}` },
    ],
    correctness: { kind: 'SINGLE', correctAnswerId },
    explanation: `설명 ${id}`,
  };
}

const QUESTIONS: readonly QuizQuestion[] = [
  question('1', 'A'),
  question('2', 'B'),
  question('3', 'A'),
];

/** Answers whichever question is currently on screen with `answerId`, then advances. */
async function answerCurrent(user: ReturnType<typeof userEvent.setup>, answerId: 'A' | 'B') {
  const label = new RegExp(`^${answerId}안-`, 'u');
  await user.click(screen.getByRole('button', { name: label }));
  await user.click(screen.getByRole('button', { name: /다음 문제|결과 보기/u }));
}

describe('Quiz', () => {
  it('shows progress for the first question on mount', () => {
    render(<Quiz questions={QUESTIONS} seed={1} />);
    expect(screen.getByText(/1 \/ 3문제 · 맞힌 문제 0개/u)).toBeInTheDocument();
  });

  it('is reproducible: the same seed presents the same first question every mount', () => {
    const { unmount } = render(<Quiz questions={QUESTIONS} seed={777} />);
    const firstPrompt = screen.getByRole('heading', { level: 2 }).textContent;
    unmount();

    render(<Quiz questions={QUESTIONS} seed={777} />);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(firstPrompt);
  });

  it('renders an honest empty state for a question bank with nothing in it', () => {
    render(<Quiz questions={[]} seed={1} />);
    expect(screen.getByRole('status')).toHaveTextContent('아직 풀 수 있는 문제가 없습니다');
  });

  it('answering every question correctly reaches a perfect result screen', async () => {
    const user = userEvent.setup();
    render(<Quiz questions={QUESTIONS} seed={5} className="quiz-root" />);

    for (let i = 0; i < QUESTIONS.length; i += 1) {
      const heading = screen.getByRole('heading', { level: 2 });
      const id = heading.textContent?.replace('문제 ', '');
      const correct = QUESTIONS.find((q) => q.id === id)?.correctness;
      const correctId = correct?.kind === 'SINGLE' ? correct.correctAnswerId : 'A';
      await answerCurrent(user, correctId as 'A' | 'B');
    }

    expect(screen.getByText('총 3문제 중 3개 정답')).toBeInTheDocument();
    expect(screen.getByText('모든 문제를 맞혔습니다!')).toBeInTheDocument();
  });

  it('retry-wrong-only replays only the missed question, and a perfect retry clears it', async () => {
    const user = userEvent.setup();
    render(<Quiz questions={QUESTIONS} seed={5} />);

    // Answer every question with 'A' — right for question 1 and 3 (correct id 'A'), wrong
    // for question 2 (correct id 'B'), regardless of shuffle order.
    for (let i = 0; i < QUESTIONS.length; i += 1) {
      await answerCurrent(user, 'A');
    }

    expect(screen.getByText('총 3문제 중 2개 정답')).toBeInTheDocument();
    expect(screen.getByText('문제 2')).toBeInTheDocument(); // the missed question is listed

    await user.click(screen.getByRole('button', { name: '틀린 패 다시 풀기' }));

    // Only the missed question remains, unanswered.
    expect(screen.getByText(/1 \/ 1문제 · 맞힌 문제 0개/u)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('문제 2');

    await answerCurrent(user, 'B'); // now answer it correctly

    expect(screen.getByText('총 1문제 중 1개 정답')).toBeInTheDocument();
    expect(screen.getByText('모든 문제를 맞혔습니다!')).toBeInTheDocument();
  });

  it('exposes exactly one status region after an answer — the feedback, not a second live count', async () => {
    // `hand-ranking-quiz.spec.ts` reads `getByRole('status')` in strict mode after answering.
    const user = userEvent.setup();
    render(<Quiz questions={QUESTIONS} seed={5} />);
    await user.click(screen.getByRole('button', { name: /^A안-/u }));
    const statuses = screen.getAllByRole('status');
    expect(statuses).toHaveLength(1);
    expect(statuses[0]).toHaveTextContent(/정답이에요|아쉬워요/u);
  });

  it('처음부터 다시 풀기 restarts the whole original bank', async () => {
    const user = userEvent.setup();
    render(<Quiz questions={QUESTIONS} seed={5} />);
    for (let i = 0; i < QUESTIONS.length; i += 1) {
      await answerCurrent(user, 'A');
    }
    expect(screen.getByText('총 3문제 중 2개 정답')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '처음부터 다시 풀기' }));
    expect(screen.getByText(/1 \/ 3문제 · 맞힌 문제 0개/u)).toBeInTheDocument();
  });
});

describe('segmentStates', () => {
  it('marks answered questions by correctness, the one on screen as current, the rest as todo', () => {
    let session = createQuizSession(QUESTIONS, 5);
    const [first, second] = session.questions;
    if (first === undefined || second === undefined) throw new Error('fixture needs 2 questions');
    const rightFor = (q: QuizQuestion) =>
      q.correctness.kind === 'SINGLE' ? q.correctness.correctAnswerId : 'A';
    const wrongFor = (q: QuizQuestion) => (rightFor(q) === 'A' ? 'B' : 'A');

    session = answerQuestion(session, first.id, rightFor(first));
    session = answerQuestion(session, second.id, wrongFor(second));

    expect(segmentStates(session, 2)).toEqual(['correct', 'wrong', 'current']);
    // Before any answer, only the current segment differs from todo.
    expect(segmentStates(createQuizSession(QUESTIONS, 5), 0)).toEqual(['current', 'todo', 'todo']);
  });
});
