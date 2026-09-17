/**
 * `/practice/starting-hand-quiz` — 시작 핸드 퀴즈 (WP-L3; Stage 3 layout in WP-S3-15). Ten
 * questions comparing two of the 169 starting-hand classes on EXACTLY the metric
 * `/tools/starting-hand` already shows — `@gto-self/learn-core`'s `HAND_STRENGTH` dataset —
 * never a second, differently-defined notion of "strength" (CLAUDE.md rule 2; see
 * `features/quiz/startingHandQuestions.ts`'s module doc). `Quiz` (WP-L1) owns the whole
 * interactive session.
 *
 * A plain Server Component, like `/tools/starting-hand` itself: no `searchParams`, no
 * dynamic rendering, so the route stays statically prerendered. The one interactive island
 * is `Quiz` (`'use client'`).
 *
 * This is a strength COMPARISON, not advice — the page states the metric, the two numbers,
 * and which is higher, and stops there. It does not say a hand should be played, raised,
 * folded or is "worth" anything (`features/quiz/startingHandQuestions.ts` and its test both
 * enforce this on the explanation copy).
 */
import type { Metadata } from 'next';
import {
  breadcrumbListJsonLd,
  JsonLd,
  pageMetadata,
  routeBreadcrumbs,
  webApplicationJsonLd,
} from '../../../../lib/seo/index.js';
import { ExplanationCard } from '../../../../components/ExplanationCard.js';
import { Quiz } from '../../../../components/Quiz.js';
import { QuizOnward } from '../../../../components/QuizOnward.js';
import { QuizPageHeader } from '../../../../components/QuizPageHeader.js';
import { Section } from '../../../../components/Section.js';
import { SectionHeading } from '../../../../components/SectionHeading.js';
import { STRENGTH_METRIC_LABEL } from '../../../../features/strength/index.js';
import {
  STARTING_HAND_QUESTIONS,
  STARTING_HAND_QUIZ_SEED,
} from '../../../../features/quiz/startingHandQuestions.js';
import { routeById } from '../../../../lib/routes.js';

const QUESTION_LIMIT = 10;

export const metadata: Metadata = pageMetadata({
  path: routeById('practiceStartingHand').path,
  title: '홀덤 시작 핸드 퀴즈 | 두 패 중 강한 쪽 맞히기',
  description:
    '두 시작 패 중 어느 쪽이 더 강한지 직접 비교해보세요. 프리플랍 기본 강도 데이터로 그 자리에서 바로 채점됩니다.',
  index: true,
});

export default function StartingHandQuizPage() {
  return (
    <main>
      <Section
        width="breakout"
        tone="recessed"
        padded="compact"
        divider="bottom"
        aria-label="퀴즈 소개"
      >
        {/* `WebApplication`, not `SoftwareApplication`: a scored quiz that runs in the
            browser, free, with no account — same reasoning as `ToolPageShell`. */}
        <JsonLd
          blocks={[
            breadcrumbListJsonLd(routeBreadcrumbs('practiceStartingHand')),
            webApplicationJsonLd({
              path: routeById('practiceStartingHand').path,
              name: '시작 핸드 퀴즈',
              description:
                '두 시작 패 중 어느 쪽이 더 강한지 직접 비교해보세요. 프리플랍 기본 강도 데이터로 그 자리에서 바로 채점됩니다.',
            }),
          ]}
        />
        <QuizPageHeader
          trail={routeBreadcrumbs('practiceStartingHand')}
          title="시작 핸드 퀴즈"
          description={`두 시작 패 중 어느 쪽이 ${STRENGTH_METRIC_LABEL} 기준으로 더 강한지 직접 맞혀보세요.`}
          facts={[
            { label: '문제 수', value: `${QUESTION_LIMIT}문제` },
            { label: '고르는 것', value: '두 시작 패 중 하나 · 동률' },
            { label: '기준', value: STRENGTH_METRIC_LABEL },
          ]}
        />
      </Section>

      <Section width="breakout" aria-label="퀴즈 풀기">
        <div className="mx-auto max-w-reading">
          <Quiz
            questions={STARTING_HAND_QUESTIONS}
            seed={STARTING_HAND_QUIZ_SEED}
            limit={QUESTION_LIMIT}
            title="시작 핸드 퀴즈"
          />
        </div>
      </Section>

      <Section width="breakout" divider="top" aria-label="이 퀴즈에 대해">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-5">
            <SectionHeading
              title='이 퀴즈는 "잘 플레이하는 법"을 알려주지 않습니다'
              className="mb-4"
            />
            <ExplanationCard>
              <p>
                여기서 비교하는 것은 상대가 무작위 아무 두 장을 들고 있을 때 프리플랍에서 올인해
                이기는 비율뿐입니다. 어떤 패가 더 강한지는 카드 두 장 자체의 사실이지만, 실전에서
                어떻게 플레이해야 하는지는 포지션, 스택, 상대에 따라 달라지는 별개의 문제이고, 이
                퀴즈는 그 답을 알려주지 않습니다.
              </p>
            </ExplanationCard>
          </div>
          <div className="lg:col-span-7">
            <QuizOnward
              lessonHeading="이 순위를 글로 차근차근 다시 읽고 싶다면"
              lesson="starting-hand-ranking"
              tool="toolStartingHand"
              toolHeading="169개 시작 패 전체 순위를 직접 살펴보고 싶다면"
              toolDescription="이 퀴즈가 쓰는 것과 같은 데이터로, 169개 시작 패 전체의 순서를 표로 볼 수 있습니다."
              toolAction="시작 핸드 탐색기 열기"
            />
          </div>
        </div>
      </Section>
    </main>
  );
}
