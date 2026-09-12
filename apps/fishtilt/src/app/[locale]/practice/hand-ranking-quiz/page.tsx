/**
 * `/practice/hand-ranking-quiz` — 족보 퀴즈 (WP-L3; Stage 3 layout in WP-S3-15). Ten
 * questions, drawn from `features/quiz/handRankingQuestions.ts`'s hand-authored fixtures,
 * each verified against `strategy-core`'s real evaluator at generation time — never a
 * typed-in winner (CLAUDE.md rule 2). `Quiz` (WP-L1) owns the whole interactive session:
 * scoring, one-shot answering, and `틀린 문제 다시 풀기` (retry-wrong-only).
 *
 * A plain Server Component, like `/tools/hand-checker` and `/tools/starting-hand`: no
 * `searchParams`, no dynamic rendering, so the route stays statically prerendered. The one
 * interactive island is `Quiz` (`'use client'`).
 *
 * Three bands: the recessed header (`QuizPageHeader`), the round itself in the reading
 * column so the cards and the big answer buttons sit under the eye, then the notes and the
 * way onward (`QuizOnward`). The question bank and the seed are untouched.
 */
import type { Metadata } from 'next';
import { pageMetadata, routeBreadcrumbs } from '../../../../lib/seo/index.js';
import { ExplanationCard } from '../../../../components/ExplanationCard.js';
import { Quiz } from '../../../../components/Quiz.js';
import { QuizOnward } from '../../../../components/QuizOnward.js';
import { QuizPageHeader } from '../../../../components/QuizPageHeader.js';
import { Section } from '../../../../components/Section.js';
import { SectionHeading } from '../../../../components/SectionHeading.js';
import {
  HAND_RANKING_QUESTIONS,
  HAND_RANKING_QUIZ_SEED,
} from '../../../../features/quiz/handRankingQuestions.js';
import { routeById } from '../../../../lib/routes.js';

const QUESTION_LIMIT = 10;

export const metadata: Metadata = pageMetadata({
  path: routeById('practiceHandRanking').path,
  title: '족보 퀴즈',
  description:
    '두 핸드 중 어떤 패가 이기는지 직접 맞혀보세요. 정답은 그 자리에서 바로 확인하고, 틀린 문제만 다시 풀 수 있습니다.',
  index: true,
});

export default function HandRankingQuizPage() {
  return (
    <main>
      <Section
        width="breakout"
        tone="recessed"
        padded="compact"
        divider="bottom"
        aria-label="퀴즈 소개"
      >
        <QuizPageHeader
          trail={routeBreadcrumbs('practiceHandRanking')}
          title="족보 퀴즈"
          description="두 핸드 중 어떤 패가 이기는지 직접 맞혀보세요. 정답은 실제 족보 평가 결과로 채점됩니다."
          facts={[
            { label: '문제 수', value: `${QUESTION_LIMIT}문제` },
            { label: '고르는 것', value: '핸드 A · 핸드 B · 무승부' },
            { label: '채점', value: '족보 평가기가 그 자리에서' },
          ]}
        />
      </Section>

      <Section width="breakout" aria-label="퀴즈 풀기">
        <div className="mx-auto max-w-reading">
          <Quiz
            questions={HAND_RANKING_QUESTIONS}
            seed={HAND_RANKING_QUIZ_SEED}
            limit={QUESTION_LIMIT}
            title="족보 퀴즈"
          />
        </div>
      </Section>

      <Section width="breakout" divider="top" aria-label="이 퀴즈에 대해">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-5">
            <SectionHeading title="무승부도 있습니다" className="mb-4" />
            <ExplanationCard>
              <p>
                포커에서는 두 핸드의 강도가 완전히 같아 팟을 나눠 갖는 무승부(찹)도 실제로 일어나는
                결과입니다. 이 퀴즈에서는 무승부가 정답인 문제도 있으니, 항상 어느 한쪽이 이긴다고
                가정하지 마세요.
              </p>
            </ExplanationCard>
          </div>
          <div className="lg:col-span-7">
            <QuizOnward
              lessonHeading="족보를 처음부터 다시 확인하고 싶다면"
              lesson="hand-rankings"
              tool="toolHandChecker"
              toolHeading="내 패의 족보를 직접 판정해보고 싶다면"
              toolDescription="이 퀴즈와 같은 평가기로, 아무 카드나 골라 족보를 바로 확인할 수 있습니다."
            />
          </div>
        </div>
      </Section>
    </main>
  );
}
