/**
 * `/ko` — the homepage (WP-S3-05, contract AD).
 *
 * ## Nothing on this page is typed by hand
 *
 * Every title, count, list and destination below is read from the content graph
 * (`src/content/graph.ts`), the route registry (`src/lib/routes.ts`), the learn categories
 * module or the tools hub model AT RENDER TIME, through `src/components/home/homeModel.ts`.
 * There is no literal `/blog/...` path, no transcribed lesson title, and no written-out
 * "20편". The homepage is the page most exposed to going stale, and the only version of it
 * that stays true is one that derives what it says from the same data every other page reads.
 *
 * ## Nothing on this page can link to something unfinished
 *
 * Every destination is resolved before it reaches a component: `hrefOfContent` returns `null`
 * for a `PLANNED` record, and `routeHref` returns `null` for a route the registry says is not
 * built. Every home component accepts only a resolved `string | null` and renders `null` as
 * the site's established, non-interactive "준비 중" text.
 *
 * ## What this page will not say
 *
 * It describes what a tool does and what a lesson teaches. It never says what a player should
 * do, never calls anything correct or optimal, and states no poker statistic that is not
 * computed by the packages at render time (CLAUDE.md rule 2): the featured tool's example is
 * `exactHeadsUpEquity` on the spot, the hero's accessible name is the evaluator's reading of
 * its five cards, and the chart is the `학습용 기본 레인지` under its stated conditions. It
 * claims neither popularity (no analytics) nor recency (no record carries a date).
 *
 * ## Eleven bands, each a different shape
 *
 * The page is a stack of full-width `Section` bands at the `shell` width, alternating tone
 * so no two neighbours look alike (D-S3-17: no card walls). In order:
 *
 *   01 히어로              split: headline + CTAs | the 4:5 editorial visual
 *   02 어디서 시작할까요?   four intent rows (list, not cards)
 *   03 배우는 순서          recessed band: three stage columns from `LEARN_STAGES`
 *   04 핸드레인지 미리 보기 the live 13×13 with its condition label
 *   05 무료 도구            featured tool with a computed example | the rest as rows
 *   06 3BetTilt 스토리      panel band: featured story | secondary — or the honest promise
 *   07 검색 가이드          two-column typographic index
 *   08 퀴즈                 recessed band: an invitation | three rows
 *   09 포커 용어            inline term strip + the two lookup routes
 *   10 자주 묻는 질문       the site's own FAQ (visible; FAQPage JSON-LD from the same array)
 *   11 마지막 CTA           `CtaBand`
 */
import type { Metadata } from 'next';
import { CtaBand } from '../../components/CtaBand.js';
import { EditorialHero } from '../../components/EditorialHero.js';
import { FaqSection, type FaqEntry } from '../../components/FaqSection.js';
import { HomeCallToAction } from '../../components/HomeCallToAction.js';
import { HomeHeroVisual } from '../../components/HomeHeroVisual.js';
import { HomeRangePreview } from '../../components/HomeRangePreview.js';
import { Section } from '../../components/Section.js';
import { HomeFeaturedTools } from '../../components/home/HomeFeaturedTools.js';
import { HomeGlossaryStrip } from '../../components/home/HomeGlossaryStrip.js';
import { HomeIntents, type HomeIntent } from '../../components/home/HomeIntents.js';
import { HomeQuiz } from '../../components/home/HomeQuiz.js';
import { HomeRoadmap } from '../../components/home/HomeRoadmap.js';
import { HomeSearchGuides } from '../../components/home/HomeSearchGuides.js';
import { HomeSectionHeader } from '../../components/home/HomeSectionHeader.js';
import { HomeStories } from '../../components/home/HomeStories.js';
import {
  HOME_HEADLINE,
  homeFeaturedTools,
  homeGlossaryPicks,
  homeSearchGuides,
  homeStories,
  routeHref,
  startHref,
} from '../../components/home/homeModel.js';
import { glossaryRecords, LEARN_ROADMAP, PUBLISHED_LESSONS } from '../../content/graph.js';
import {
  LEARN_CATEGORIES,
  LEARN_HUB_ANCHORS,
  LEARN_STAGES,
} from '../../content/registry/learn/categories.js';
import { describeRangeConditions, RANGE_LABEL } from '../../features/range/index.js';
import { practiceHubCards } from '../../features/quiz/index.js';
import { JsonLd, organizationJsonLd, pageMetadata, webSiteJsonLd } from '../../lib/seo/index.js';
import { routeById } from '../../lib/routes.js';

/*
 * Routed through `pageMetadata` like every other page. The title is passed WITHOUT the
 * "· 3BetTilt" suffix — `pageMetadata` appends it.
 *
 * THE TITLE AND THE H1 ARE DELIBERATELY DIFFERENT. The `<h1>` is a sentence — a visitor
 * already looking at the page needs a reason to stay, not a label. A search result is the
 * opposite situation: there the line has to say WHAT this is to someone who has never heard
 * of it. `무료 홀덤 학습` is the site in three words and the keyword map's own secondary
 * keyword for `/`; it is also the exact string `layout.tsx` carries as the site-level fallback.
 */
export const metadata: Metadata = pageMetadata({
  path: routeById('home').path,
  title: '무료 홀덤 학습',
  description:
    '핸드 순위부터 레인지와 확률까지, 텍사스 홀덤을 쉬운 한국어로. 13×13 핸드레인지 표와 승률·팟 오즈·아웃 계산기를 직접 눌러보며 배우는 무료 학습 사이트입니다.',
  index: true,
});

/** The conditions the one shipped dataset is drawn under — the same string every chart on
 *  this site prints under itself. Stated once here so the FAQ answer cannot drift from it. */
const RANGE_CONDITIONS = describeRangeConditions({
  heroPosition: 'BTN',
  spot: 'RFI',
  stackDepth: 100,
  tableSize: 6,
} as const);

/** Section heading ids — what each `<section aria-labelledby>` and its list point at. */
const ID = {
  intents: 'home-intents',
  roadmap: 'home-roadmap',
  preview: 'home-preview',
  tools: 'home-tools',
  stories: 'home-stories',
  guides: 'home-guides',
  quiz: 'home-quiz',
  glossary: 'home-glossary',
} as const;

export default function HomePage() {
  /* ---------------------------------------------------------------- content graph reads */
  const lessons = LEARN_ROADMAP;
  const readableLessons = PUBLISHED_LESSONS;
  const firstLesson = readableLessons[0];
  const glossaryAll = glossaryRecords();
  const glossaryPublished = glossaryAll.filter((entry) => entry.status === 'PUBLISHED');
  const quizzes = practiceHubCards();
  const tools = homeFeaturedTools();
  const stories = homeStories();
  const guides = homeSearchGuides();
  const terms = homeGlossaryPicks();

  const learnHref = routeHref('learn');
  const toolsHref = routeHref('tools');
  const rangeHref = routeHref('range');
  const blogHref = routeHref('blog');
  const glossaryHref = routeHref('glossary');
  const aboutHref = routeHref('about');
  const start = startHref();
  const learnAnchor = (anchor: string): string | null =>
    learnHref === null ? null : `${learnHref}#${anchor}`;

  /*
   * The four "why are you here" entry points. Every destination is a route id resolved
   * through the registry or a record resolved through the graph, never a path.
   */
  const intents: readonly HomeIntent[] = [
    {
      id: 'first-time',
      title: '포커가 완전 처음이에요',
      description: `규칙과 족보부터 순서대로. 지금 읽을 수 있는 레슨 ${readableLessons.length}편을 위에서부터 읽으면 됩니다.`,
      destination: `${routeById('learn').label} · 1편부터`,
      href: start,
    },
    {
      id: 'know-rules',
      title: '규칙은 아는데 다음이 막막해요',
      description: `${LEARN_CATEGORIES.map((category) => category.label).join(', ')} — ${LEARN_CATEGORIES.length}가지 주제 중 지금 필요한 것부터 고릅니다.`,
      destination: '주제별로 배우기',
      href: learnAnchor(LEARN_HUB_ANCHORS.topics),
    },
    {
      id: 'numbers',
      title: '숫자로 확인하고 싶어요',
      description: '승률, 팟 오즈, 아웃츠. 내 패와 상황을 넣으면 그 자리에서 계산합니다.',
      destination: routeById('tools').label,
      href: toolsHref,
    },
    {
      id: 'stories',
      title: '이야기로 읽고 싶어요',
      description:
        '한 판을 프리플랍부터 쇼다운까지 따라가는 핸드 스토리와, 검색창에 치는 질문에 답하는 가이드.',
      destination: routeById('blog').label,
      href: blogHref,
    },
  ];

  /*
   * The homepage FAQ answers questions about THE SITE, never about poker. Every poker
   * question belongs to the page that answers it properly, and a homepage that answered
   * them too would compete with its own pages for the same query. What only the homepage
   * can answer is whether this site is worth trusting. Each answer is something this
   * repository can back; the `FAQPage` JSON-LD is built from THIS ARRAY inside `FaqSection`.
   */
  const faqItems: readonly FaqEntry[] = [
    {
      question: '3BetTilt는 무료인가요?',
      answer:
        '네. 레슨과 13×13 표, 계산기, 퀴즈까지 전부 무료입니다. 회원가입도 로그인도 결제도 없고, 계정을 만들지 않아도 모든 화면을 그대로 쓸 수 있습니다.',
    },
    {
      question: '포커를 전혀 몰라도 되나요?',
      answer:
        '됩니다. 카드를 몇 장 받는지, 어떤 순서로 진행되는지 같은 규칙부터 시작합니다. 낯선 말이 처음 나올 때는 쉬운 한국어로 먼저 풀어 쓰고, 원어 표기를 함께 보여줍니다.',
      link:
        glossaryHref === null
          ? undefined
          : { href: glossaryHref, label: `${routeById('glossary').label} 보기` },
    },
    {
      question: '어디서부터 시작하면 되나요?',
      answer: `배우기 첫 편부터 위에서 아래로 읽는 순서가 가장 빠릅니다. 지금 읽을 수 있는 레슨은 ${readableLessons.length}편이고, ${LEARN_STAGES.length}단계로 묶여 있습니다. 읽은 내용은 퀴즈 ${quizzes.length}개로 바로 확인할 수 있습니다.`,
      link: start === null ? undefined : { href: start, label: '첫 레슨 열기' },
    },
    {
      question: '화면에 나오는 숫자는 어디서 나온 건가요?',
      answer:
        '조합 수, 비중, 순위, 승률 같은 숫자는 모두 그 자리에서 계산한 값입니다. 계산할 근거가 없는 값은 그럴듯하게 꾸며 보여주지 않고 준비 중이라고 그대로 말합니다.',
      link:
        aboutHref === null
          ? undefined
          : { href: aboutHref, label: '숫자가 어떻게 계산되는지 보기' },
    },
    {
      question: '어떤 포커 사이트와 제휴하나요?',
      answer:
        '어느 곳과도 제휴하지 않습니다. 실제 돈이 오가는 게임과 연결되어 있지 않고, 입금이나 가입을 유도하는 링크도 없습니다. 직접 카드와 상황을 입력해 학습하는 화면만 제공합니다.',
      link: aboutHref === null ? undefined : { href: aboutHref, label: '3BetTilt 소개 보기' },
    },
    {
      question: '핸드레인지 표는 어떤 상황을 기준으로 하나요?',
      answer: `${RANGE_CONDITIONS}, 이 한 가지 상황만 다룹니다. 다른 스택이나 다른 상황의 표는 아직 없고, 있는 척하지도 않습니다. 표에는 항상 ${RANGE_LABEL}라는 이름과 그 조건이 함께 적혀 있습니다.`,
      link:
        rangeHref === null
          ? undefined
          : { href: rangeHref, label: `${routeById('range').label} 열기` },
    },
  ];

  return (
    <main>
      {/*
        THE SITE'S OWN IDENTITY, declared once, here and nowhere else. `WebSite` and
        `Organization` are statements about the whole site; the home page is where a crawler
        expects them and the only page whose subject IS the site. No `SearchAction`: `/search`
        parses `?q=` in the browser and has no endpoint a query template could reach. No
        breadcrumb at the root (`routeBreadcrumbs('home')` is an empty trail).
      */}
      <JsonLd blocks={[webSiteJsonLd(), organizationJsonLd()]} />

      {/* 01 ------------------------------------------------------------------------ HERO */}
      <Section
        width="shell"
        padded="none"
        aria-label="3BetTilt 한 줄 소개"
        className="pt-10 pb-section lg:pt-14 lg:pb-section-lg"
      >
        <EditorialHero
          eyebrow="무료 텍사스 홀덤 학습"
          title={HOME_HEADLINE}
          lead="규칙과 족보부터 레인지와 확률까지. 표를 직접 눌러보고, 숫자를 그 자리에서 계산하고, 한 판을 끝까지 따라가면서 배웁니다."
          visual={<HomeHeroVisual />}
          facts={[
            { label: '대상', value: '처음 배우는 사람' },
            { label: '레슨', value: `${readableLessons.length}편` },
            { label: '비용', value: '전부 무료' },
            { label: '계정', value: '로그인 없음' },
          ]}
        >
          {/* A column below `sm`, a row above it — stacked buttons take the same width, so
              the hierarchy is carried by fill vs outline and never by a stagger. */}
          <div
            role="group"
            aria-label="시작하기"
            className="flex flex-col gap-3 sm:flex-row sm:flex-wrap"
          >
            <HomeCallToAction href={start} label="처음부터 배우기" />
            <HomeCallToAction href={toolsHref} label="무료 도구 보기" variant="secondary" />
          </div>
          {/* The three facts a first-time visitor is weighing, all checkable: this app has no
              authentication, no payment path and no affiliate surface, and `/about` says so at
              length. `/about` is footer-only in the header registry, so the front page carries it. */}
          <p className="mt-5 prose-ko text-sm text-text-300">
            회원가입도, 로그인도, 결제도 없습니다. 어떤 포커 사이트와도 제휴하지 않습니다.{' '}
            {aboutHref !== null ? (
              <a
                href={aboutHref}
                className="font-medium text-brand-500 underline underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              >
                {routeById('about').label}
              </a>
            ) : null}
          </p>
        </EditorialHero>
      </Section>

      {/* 02 --------------------------------------------------------------- WHERE TO START */}
      <Section width="shell" divider="top" labelledBy={ID.intents}>
        <HomeSectionHeader
          id={ID.intents}
          index={2}
          eyebrow="시작점"
          title="어디서 시작할까요?"
          lead="지금 궁금한 것 하나만 고르면 됩니다. 네 줄 중 하나는 지금의 나입니다."
        />
        <HomeIntents intents={intents} labelledBy={ID.intents} className="mt-10" />
      </Section>

      {/* 03 ---------------------------------------------------------------------- ROADMAP */}
      <Section width="shell" tone="recessed" labelledBy={ID.roadmap}>
        <HomeSectionHeader
          id={ID.roadmap}
          index={3}
          eyebrow="배우는 순서"
          title={`레슨 ${lessons.length}편, ${LEARN_STAGES.length}단계`}
          lead={`전체 ${lessons.length}편 중 ${readableLessons.length}편을 지금 읽을 수 있습니다. 판의 규칙에서 시작해 확률로 끝나는 한 줄의 순서입니다.`}
          aside={{ href: learnAnchor(LEARN_HUB_ANCHORS.roadmap), label: '전체 로드맵' }}
        />
        <HomeRoadmap labelledBy={ID.roadmap} className="mt-12" />
      </Section>

      {/* 04 ---------------------------------------------------------------- RANGE PREVIEW */}
      <Section width="shell" labelledBy={ID.preview}>
        <HomeSectionHeader
          id={ID.preview}
          index={4}
          eyebrow="직접 눌러보기"
          title="자리를 바꾸면 표가 달라집니다"
          lead="같은 패라도 어느 자리에 앉았느냐에 따라 다르게 다룹니다. 자리 버튼을 눌러 표가 어떻게 바뀌는지 직접 보세요."
          aside={{ href: rangeHref, label: `${routeById('range').label} 열기` }}
        />
        <p className="mt-6 inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-line-500 bg-panel-700 px-3 py-2 font-mono text-xs text-text-300">
          <span className="font-semibold text-text-100">{RANGE_LABEL}</span>
          <span aria-hidden="true">·</span>
          <span>{RANGE_CONDITIONS}</span>
        </p>
        <HomeRangePreview className="mt-6" />
      </Section>

      {/* 05 -------------------------------------------------------------- FEATURED TOOLS */}
      <Section width="shell" divider="top" labelledBy={ID.tools}>
        <HomeSectionHeader
          id={ID.tools}
          index={5}
          eyebrow={routeById('tools').label}
          title="궁금한 숫자를 그 자리에서"
          lead="설명을 읽기 전에 먼저 눌러보세요. 모든 값은 입력한 카드로 그 자리에서 계산하고, 계산할 근거가 없는 값은 보여주지 않습니다."
          aside={{ href: toolsHref, label: `${routeById('tools').label} 전체` }}
        />
        <HomeFeaturedTools
          featured={tools.featured}
          secondary={tools.secondary}
          className="mt-12"
        />
      </Section>

      {/* 06 --------------------------------------------------------------------- STORIES */}
      <Section width="shell" tone="panel" labelledBy={ID.stories}>
        <HomeSectionHeader
          id={ID.stories}
          index={6}
          eyebrow="핸드 스토리"
          title="3BetTilt 스토리"
          lead="실제로 벌어질 법한 한 판을 끝까지 따라갑니다. 학습과 재미를 위해 재구성한 시나리오이고, 카드와 보드는 기록대로 그립니다."
        />
        <HomeStories
          featured={stories.featured}
          secondary={stories.secondary}
          blogHref={blogHref}
          className="mt-12"
        />
      </Section>

      {/* 07 --------------------------------------------------------------- SEARCH GUIDES */}
      <Section width="shell" labelledBy={ID.guides}>
        <HomeSectionHeader
          id={ID.guides}
          index={7}
          eyebrow="검색 가이드"
          title="검색창에 치는 질문, 바로 답합니다"
          lead={`사이트에 실제로 답이 있는 질문 ${guides.length}개. 짧게 읽고, 필요한 만큼만 내려갑니다.`}
          aside={{ href: blogHref, label: `${routeById('blog').label} 전체` }}
        />
        <HomeSearchGuides guides={guides} labelledBy={ID.guides} className="mt-10" />
      </Section>

      {/* 08 ------------------------------------------------------------------------ QUIZ */}
      <Section width="shell" tone="recessed" labelledBy={ID.quiz}>
        <HomeSectionHeader
          id={ID.quiz}
          index={8}
          eyebrow={routeById('practice').label}
          title="읽었으면, 한 번 풀어보세요."
          lead={`전체 ${quizzes.length}개 퀴즈 중 ${quizzes.filter((card) => card.route?.available === true).length}개를 지금 풀 수 있습니다. 고르면 그 자리에서 바로 채점됩니다.`}
        />
        <HomeQuiz quizzes={quizzes} practiceHref={routeHref('practice')} className="mt-10" />
      </Section>

      {/* 09 -------------------------------------------------------------------- GLOSSARY */}
      <Section width="shell" labelledBy={ID.glossary}>
        <HomeSectionHeader
          id={ID.glossary}
          index={9}
          eyebrow={routeById('glossary').label}
          title="모르는 말이 나오면"
          lead={`전체 ${glossaryAll.length}개 용어 중 ${glossaryPublished.length}개를 읽을 수 있습니다. 첫 판에 바로 나오는 말부터 찾아보세요.`}
        />
        <HomeGlossaryStrip
          terms={terms}
          glossaryHref={glossaryHref}
          searchHref={routeHref('search')}
          handsHref={routeHref('hands')}
          className="mt-10"
        />
      </Section>

      {/* 10 ------------------------------------------------------------------------- FAQ
          Questions about THIS SITE — free? affiliated? where do the numbers come from? —
          never poker questions the lessons, the glossary and the blog own. */}
      <Section as="div" width="shell" divider="top">
        <FaqSection
          title="자주 묻는 질문"
          description="이 사이트가 무엇이고 무엇이 아닌지에 대한 질문입니다. 포커 자체에 대한 설명은 배우기와 용어 사전에 있습니다."
          items={faqItems}
        />
      </Section>

      {/* 11 ------------------------------------------------------------------- FINAL CTA */}
      <Section width="full" padded="none" aria-label="지금 시작하기">
        <CtaBand
          title="처음부터 차근차근, 지금 시작하세요."
          description={
            firstLesson !== undefined && firstLesson.readMinutes !== null
              ? `첫 레슨은 약 ${firstLesson.readMinutes}분이면 읽습니다. 무료이고, 계정은 없습니다.`
              : '무료이고, 계정은 없습니다.'
          }
          primary={{ href: start, label: '첫 레슨 읽기' }}
          secondary={{ href: toolsHref, label: '무료 도구 보기' }}
        />
      </Section>
    </main>
  );
}
