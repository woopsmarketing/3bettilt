/**
 * `/practice` — the quiz hub (WP-L1; Stage 3 redesign in WP-S3-15). Same job as `/tools`'s
 * hub: list every planned quiz honestly, link the ones that exist, and mark the rest
 * "준비 중" rather than hiding them or linking a page that would 404.
 *
 * `practiceHubCards` (`features/quiz/hub.ts`) is still the honesty gate — it resolves each
 * quiz id against `src/lib/routes.ts` by `find`, so a route registered later is picked up
 * with no edit here. What Stage 3 adds is the STORY per quiz: `practiceQuizDetail`
 * (`features/quiz/hubPresentation.ts`, imported directly rather than through the barrel so
 * `page.test.tsx`'s mock of `practiceHubCards` stays a mock of the gate alone) supplies what
 * each quiz trains, how a round runs and a drawing of the thing it is about. The three rows
 * therefore differ in shape — a seat diagram, a five-card showdown, two hands side by side —
 * instead of being three identical cards (contract BF).
 */
import type { Metadata } from 'next';
import {
  collectionPageJsonLd,
  itemListJsonLd,
  JsonLd,
  pageMetadata,
  routeBreadcrumbs,
} from '../../../lib/seo/index.js';
import { Breadcrumbs } from '../../../components/Breadcrumbs.js';
import { CtaBand } from '../../../components/CtaBand.js';
import { EditorialHero } from '../../../components/EditorialHero.js';
import { PokerCards } from '../../../components/PokerCards.js';
import { PositionDiagram } from '../../../components/PositionDiagram.js';
import { Section } from '../../../components/Section.js';
import { SectionHeading } from '../../../components/SectionHeading.js';
import { Timeline } from '../../../components/Timeline.js';
import { practiceHubCards, type PracticeHubCard } from '../../../features/quiz/index.js';
import {
  PRACTICE_FLOW_STEPS,
  practiceQuizDetail,
  type PracticeQuizVisual,
} from '../../../features/quiz/hubPresentation.js';
import { routeById } from '../../../lib/routes.js';

/**
 * One statement of this hub's identity — canonical, `<title>`/OG, and the `CollectionPage`'s
 * `name`/`description` all read it.
 *
 * WP-7a: THE TITLE AND THE H1 ARE DELIBERATELY DIFFERENT. The `<h1>` is
 * `배운 내용을 직접 풀어보세요` — an instruction, and the right thing to say to someone who has
 * arrived and has to decide whether to start. A search result is read by someone who has not
 * arrived, so the title has to NAME the page instead; the old `퀴즈` did that but only from
 * inside the site, where the header has already established the subject. `홀덤 퀴즈` is the
 * same name with the subject restored — WP-1 §2's primary keyword for this route — and it is
 * not keyword stuffing because it is literally what the three quizzes are about. The nav label
 * and the breadcrumb crumb stay `퀴즈` (`routes.ts`), where the subject IS already established.
 */
const SEO = {
  path: routeById('practice').path,
  title: '홀덤 퀴즈',
  description:
    '레인지, 족보, 시작 핸드까지 — 배운 내용을 바로 확인하는 연습 문제 모음입니다. 읽었으면 직접 풀어보세요.',
} as const;

export const metadata: Metadata = pageMetadata({ ...SEO, index: true });

/** The drawing beside a row — real cards and a real seat map, never a raster placeholder. */
function QuizVisual({ kind }: { readonly kind: PracticeQuizVisual }) {
  if (kind === 'position') {
    return <PositionDiagram highlight="BTN" className="max-w-figure" />;
  }
  if (kind === 'showdown') {
    return (
      <div className="flex flex-col items-start gap-1">
        <PokerCards cards="Ah Kh" size="sm" className="my-0" />
        <span className="text-xs font-semibold text-text-300">보드</span>
        <PokerCards cards="Qh Jh Th 4c 2d" size="sm" className="my-0" />
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <PokerCards hand="AKs" size="md" showReading={false} className="my-0" />
      <span className="text-sm font-semibold text-text-300">vs</span>
      <PokerCards hand="QQ" size="md" showReading={false} className="my-0" />
    </div>
  );
}

const ROW_LINK =
  'prose-ko inline-flex min-h-11 items-center gap-2 text-2xl font-semibold text-text-100 outline-none ' +
  'hover:text-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

function QuizRow({ card, order }: { readonly card: PracticeHubCard; readonly order: number }) {
  const { route } = card;
  const href = route !== null && route.available ? route.path : null;
  const detail = practiceQuizDetail(card.id);

  return (
    <li
      data-quiz={card.id}
      className="grid gap-6 py-10 first:pt-0 last:pb-0 lg:grid-cols-12 lg:gap-12"
    >
      <div className="min-w-0 lg:col-span-7">
        <p className="tabular font-mono text-xs text-brand-500">{String(order).padStart(2, '0')}</p>
        {href === null ? (
          <span className="mt-1 inline-flex min-h-11 items-center gap-2 text-2xl font-semibold text-text-300">
            {card.label}
            <span className="rounded-full border border-line-500 px-1.5 py-0.5 text-[10px] font-medium">
              준비 중
            </span>
          </span>
        ) : (
          <a href={href} className={`mt-1 ${ROW_LINK}`}>
            {card.label}
            <span aria-hidden="true" className="text-brand-500">
              →
            </span>
          </a>
        )}
        <p className="prose-ko mt-2 max-w-lead text-base text-text-300">{card.description}</p>
        {detail !== null ? (
          <>
            <p className="prose-ko mt-3 text-sm text-text-300">{detail.format}</p>
            <p className="mt-5 text-xs font-semibold tracking-[0.06em] text-text-300">
              이 퀴즈가 훈련하는 것
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {detail.trains.map((skill) => (
                <li
                  key={skill}
                  className="rounded-md border border-line-500 px-2.5 py-1 text-sm text-text-100"
                >
                  {skill}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
      {detail !== null ? (
        <div className="flex items-center rounded-xl bg-ground-800 p-5 lg:col-span-5">
          <QuizVisual kind={detail.visual} />
        </div>
      ) : null}
    </li>
  );
}

export default function PracticeHubPage() {
  const cards = practiceHubCards();
  const ready = cards.filter((card) => card.route?.available === true);
  const planned = cards.filter((card) => card.route?.available !== true);
  const learn = routeById('learn');

  return (
    <main>
      {/* Same reasoning as `/tools`: the page's subject is the list of quizzes it renders, and
          the items are the `ready` cards — the ones that are links, in the order rendered. A
          quiz whose route is not built yet has nothing to point at. */}
      <JsonLd
        blocks={[
          collectionPageJsonLd({
            ...SEO,
            mainEntity: itemListJsonLd(
              ready.flatMap((card) =>
                card.route === null ? [] : [{ name: card.label, path: card.route.path }],
              ),
            ),
          }),
        ]}
      />

      <Section
        width="shell"
        tone="recessed"
        padded="compact"
        divider="bottom"
        aria-label="퀴즈 소개"
      >
        <Breadcrumbs className="mb-6" trail={routeBreadcrumbs('practice')} />
        <EditorialHero
          eyebrow="퀴즈"
          title="배운 내용을 직접 풀어보세요"
          lead="읽었으면 직접 풀어보세요. 정답을 고르면 그 자리에서 바로 채점되고, 틀린 문제만 골라 다시 풀 수 있습니다."
          facts={[
            { label: '퀴즈', value: `${cards.length}개` },
            { label: '지금 풀 수 있는 것', value: `${ready.length}개` },
            { label: '계정', value: '필요 없음' },
          ]}
        />
      </Section>

      {ready.length > 0 ? (
        <Section width="shell" aria-label="지금 풀 수 있는 퀴즈">
          <SectionHeading
            title="지금 풀 수 있는 퀴즈"
            description={`전체 ${cards.length}개 중 ${ready.length}개를 풀 수 있습니다.`}
          />
          <ol className="mt-8 divide-y divide-line-500">
            {ready.map((card, index) => (
              <QuizRow key={card.id} card={card} order={index + 1} />
            ))}
          </ol>
        </Section>
      ) : null}

      {planned.length > 0 ? (
        <Section width="shell" divider="top" aria-label="준비 중인 퀴즈">
          <SectionHeading
            title="준비 중인 퀴즈"
            description="아직 만드는 중입니다. 완성되면 이 자리에서 바로 풀 수 있습니다."
          />
          <ol className="mt-8 divide-y divide-line-500">
            {planned.map((card, index) => (
              <QuizRow key={card.id} card={card} order={ready.length + index + 1} />
            ))}
          </ol>
        </Section>
      ) : null}

      <Section width="shell" tone="recessed" aria-label="어떻게 진행되나요">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-5">
            <SectionHeading
              title="어떻게 진행되나요"
              description="세 퀴즈 모두 같은 방식으로 돌아갑니다. 로그인도 점수판도 없습니다."
            />
          </div>
          <div className="lg:col-span-7">
            <Timeline aria-label="퀴즈 진행 순서" steps={PRACTICE_FLOW_STEPS} />
          </div>
        </div>
      </Section>

      <CtaBand
        title="아직 읽기 전이라면, 레슨부터."
        description="퀴즈는 레슨에서 배운 것을 확인하는 자리입니다. 처음이라면 배우기에서 순서대로 시작하세요."
        primary={{ href: learn.available ? learn.path : null, label: '배우기로 가기' }}
      />
    </main>
  );
}
