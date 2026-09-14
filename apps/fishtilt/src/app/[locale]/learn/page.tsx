/**
 * `/learn` — the learn hub (build spec §26; Stage 3 contract AR).
 *
 * Two ways into the same fifteen lessons, both on this one static page:
 *
 *   A. "처음부터 배우기" — the roadmap, in curriculum order, drawn as three stages on a
 *      numbered rail (`LearnRoadmap`). The order is the owner's and is never re-sorted here.
 *   B. "특정 주제 배우기" — the seven categories (`registry/learn/categories.ts`), each a
 *      section with an anchor, reached from a chip row (`LearnTopics`).
 *
 * The mode switch is two same-page anchors, so the page has no client JavaScript and both
 * modes are always in the HTML — a reader without JS, a crawler and a screen reader all get
 * the whole curriculum. Nothing about a lesson is written twice: number, level, reading
 * time, category and description all come from its record and the category mapping.
 *
 * A lesson that has no prose yet renders as visible "준비 중" text rather than as a link that
 * would 404 — the same gate `src/lib/routes.ts` applies to navigation and `RelatedContent`
 * applies to cross-links — and the `ItemList` below enumerates only what the page links.
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
import { Divider } from '../../../components/Divider.js';
import { PageHero } from '../../../components/PageHero.js';
import { PageHeroVisual } from '../../../components/visual/PageHeroVisual.js';
import { SectionHeading } from '../../../components/SectionHeading.js';
import { LearnModeNav } from '../../../components/learn/LearnModeNav.js';
import { LearnRoadmap, type RoadmapEntry } from '../../../components/learn/LearnRoadmap.js';
import { LearnTopics } from '../../../components/learn/LearnTopics.js';
import { hrefOfContent, LEARN_ROADMAP } from '../../../content/graph.js';
import {
  categoryOfLessonOrNull,
  LEARN_CATEGORIES,
  LEARN_HUB_ANCHORS,
  LEARN_STAGES,
  stageOfLessonOrNull,
} from '../../../content/registry/learn/categories.js';
import { routeById } from '../../../lib/routes.js';

/** One statement of this hub's identity: the canonical, the `<title>`/OG block and the
 *  `CollectionPage`'s `name`/`description` all read it, so the three cannot describe
 *  different pages. Same shape the six tool pages already use. */
const SEO = {
  path: routeById('learn').path,
  title: '텍사스 홀덤 배우기 | 규칙·족보·포지션·프리플랍',
  description:
    '텍사스 홀덤을 순서대로 배우는 무료 강의. 규칙과 족보부터 핸드레인지, 팟오즈까지 표와 도구를 직접 눌러보며 익힙니다.',
} as const;

export const metadata: Metadata = pageMetadata({ ...SEO, index: true });

export default function LearnHubPage() {
  /* ONE array, three renderings — the rule `Breadcrumbs` and `FaqSection` already follow.
   * The roadmap, the category browse and the `ItemList` are all built from this list with
   * the destination already resolved, so the structured data cannot enumerate a lesson the
   * page does not show or link one the page renders as "준비 중". */
  const roadmap: readonly RoadmapEntry[] = LEARN_ROADMAP.map((lesson) => ({
    lesson,
    href: hrefOfContent(lesson),
    category: categoryOfLessonOrNull(lesson),
  }));
  const published = roadmap.filter(({ lesson }) => lesson.status === 'PUBLISHED').length;
  const planned = roadmap.length - published;

  const stages = LEARN_STAGES.map((stage) => ({
    stage,
    lessons: roadmap.filter(
      ({ lesson }) => lesson.order >= stage.first && lesson.order <= stage.last,
    ),
  }));
  // A record outside every stage (or without a category) is a registry bug that
  // `categories.test.ts` catches; if one reaches this page anyway it is still shown — in the
  // roadmap, under "단계 미정" — never dropped, so the hub can never under-report the course.
  const unstaged = roadmap.filter(({ lesson }) => stageOfLessonOrNull(lesson) === null);
  const groups = LEARN_CATEGORIES.map((category) => ({
    category,
    anchor: LEARN_HUB_ANCHORS.category(category.id),
    lessons: roadmap.filter((entry) => entry.category?.id === category.id),
  }));

  // Reading time of the whole course, counted from the records; shown only when every
  // lesson has one, so the number is never a partial sum presented as a total.
  const minutes = roadmap.every(({ lesson }) => lesson.readMinutes !== null)
    ? roadmap.reduce((sum, { lesson }) => sum + (lesson.readMinutes ?? 0), 0)
    : null;

  const roadmapHref = `#${LEARN_HUB_ANCHORS.roadmap}`;
  const topicsHref = `#${LEARN_HUB_ANCHORS.topics}`;

  return (
    // `max-w-grid`: the roadmap and the category browse are both two-column splits from `lg`
    // up (stage/category text beside its lessons), which need the grid width; the hero lead
    // caps its own measure with `max-w-lead`.
    <main className="mx-auto max-w-grid px-6 py-14 sm:py-20">
      <Breadcrumbs className="mb-8" trail={routeBreadcrumbs('learn')} />
      <JsonLd
        blocks={[
          collectionPageJsonLd({
            ...SEO,
            mainEntity: itemListJsonLd(
              roadmap.flatMap(({ lesson, href }) =>
                href === null ? [] : [{ name: lesson.title, path: href }],
              ),
            ),
          }),
        ]}
      />
      <PageHero
        layout="split"
        visual={<PageHeroVisual slot="learnHub" theme="basics" />}
        eyebrow="배우기"
        title="홀덤 처음 배우기"
        description="포커를 한 번도 해본 적 없어도 괜찮습니다. 처음부터 순서대로 읽거나, 궁금한 주제만 골라 읽으세요. 각 글에는 직접 눌러볼 수 있는 표와 계산기가 들어 있습니다."
        facts={[
          { label: '레슨', value: `${roadmap.length}편` },
          { label: '주제', value: `${LEARN_CATEGORIES.length}가지` },
          ...(minutes === null ? [] : [{ label: '전부 읽으면', value: `약 ${minutes}분` }]),
        ]}
      >
        <LearnModeNav
          roadmap={{ href: roadmapHref, lessonCount: roadmap.length }}
          topics={{ href: topicsHref, categoryCount: LEARN_CATEGORIES.length }}
        />
      </PageHero>

      <section
        id={LEARN_HUB_ANCHORS.roadmap}
        className="mt-section scroll-mt-24 lg:mt-section-lg"
        aria-label="학습 순서"
      >
        <SectionHeading
          title="처음부터 배우기"
          description={`전체 ${roadmap.length}편 중 ${published}편을 읽을 수 있습니다.${
            planned > 0 ? ' 나머지는 준비 중입니다.' : ' 위에서부터 순서대로 읽으면 됩니다.'
          }`}
        />
        <LearnRoadmap className="mt-10" stages={stages} unstaged={unstaged} />
      </section>

      <Divider />

      <section id={LEARN_HUB_ANCHORS.topics} className="scroll-mt-24" aria-label="주제별로 배우기">
        <SectionHeading
          title="특정 주제 배우기"
          description="궁금한 주제만 골라 읽어도 됩니다. 주제 안의 순서는 학습 순서와 같고, 번호도 같습니다."
        />
        <LearnTopics className="mt-8" groups={groups} />
      </section>
    </main>
  );
}
