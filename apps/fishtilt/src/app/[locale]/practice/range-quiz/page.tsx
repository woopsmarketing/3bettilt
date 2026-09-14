/**
 * `/practice/range-quiz` — the 레인지 퀴즈 (WP-L2; Stage 3 layout in WP-S3-15). A plain
 * Server Component shell, same shape as `/tools/range/page.tsx`: no `searchParams`, nothing
 * dynamic, so this route keeps the rest of the site's statically-prerendered shape. The one
 * interactive island is `RangeQuiz` (`'use client'`); it owns the position picker, the
 * position diagram beside the round, and the quiz session itself — see that component's
 * module doc.
 *
 * The round band is the `breakout` column because the island is two columns from `lg`:
 * the question on the left, the seat and conditions on the right.
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
import { QuizOnward } from '../../../../components/QuizOnward.js';
import { QuizPageHeader } from '../../../../components/QuizPageHeader.js';
import { RangeQuiz } from '../../../../components/RangeQuiz.js';
import { Section } from '../../../../components/Section.js';
import { SectionHeading } from '../../../../components/SectionHeading.js';
import { RANGE_QUIZ_QUESTION_LIMIT } from '../../../../features/quiz/rangeQuestions.js';
import {
  josaIran,
  RANGE_LABEL,
  RANGE_PROVENANCE_SENTENCE,
} from '../../../../features/range/index.js';
import { routeById } from '../../../../lib/routes.js';

export const metadata: Metadata = pageMetadata({
  path: routeById('practiceRange').path,
  title: '레인지 퀴즈',
  description:
    '포지션을 고르고, 각 시작 패가 그 자리의 학습용 기본 레인지에 포함되는지 직접 맞혀보고 바로 확인하세요.',
  index: true,
});

export default function RangeQuizPage() {
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
            breadcrumbListJsonLd(routeBreadcrumbs('practiceRange')),
            webApplicationJsonLd({
              path: routeById('practiceRange').path,
              name: '레인지 퀴즈',
              description: `포지션을 고르고, 각 시작 패가 그 자리의 학습용 기본 레인지에 포함되는지 직접 맞혀보고 바로 확인하세요.`,
            }),
          ]}
        />
        <QuizPageHeader
          trail={routeBreadcrumbs('practiceRange')}
          title="레인지 퀴즈"
          description={`포지션을 고르고, 각 시작 패가 그 자리의 ${RANGE_LABEL}에 포함되는지 직접 맞혀보세요.`}
          facts={[
            { label: '문제 수', value: `${RANGE_QUIZ_QUESTION_LIMIT}문제` },
            { label: '고르는 것', value: '포함 · 제외' },
            { label: '기준', value: RANGE_LABEL },
          ]}
        />
      </Section>

      <Section width="breakout" aria-label="퀴즈 풀기">
        <RangeQuiz />
      </Section>

      <Section width="breakout" divider="top" aria-label="이 퀴즈에 대해">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-5">
            <SectionHeading
              title={`${RANGE_LABEL}${josaIran(RANGE_LABEL)} 무엇인가요?`}
              className="mb-4"
            />
            <ExplanationCard>
              {/* The quiz scores against this table, so the page it is scored on has to say
                  what the table is. Provenance comes from the one shared constant. */}
              <p>{RANGE_PROVENANCE_SENTENCE}</p>
            </ExplanationCard>
          </div>
          <div className="lg:col-span-7">
            <QuizOnward
              lessonHeading="표부터 차근차근 읽고 싶다면"
              lesson="poker-range"
              tool="range"
              toolHeading="표 전체를 눌러보며 확인하고 싶다면"
              toolDescription="이 퀴즈가 채점에 쓰는 바로 그 표입니다. 자리를 바꿔가며 어떤 패가 들어 있는지 볼 수 있습니다."
            />
          </div>
        </div>
      </Section>
    </main>
  );
}
