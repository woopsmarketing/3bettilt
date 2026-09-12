/**
 * `/hands` — the starting-hand hub (WP-S3-13a, contract AY). Same honesty gate as `/learn`,
 * `/blog` and `/glossary`: every hand record is visible, only the written ones are links.
 *
 * Not a wall of twenty cards. The page is three bands: a hero that says what a hand page
 * is and links the two lessons and the tool that own the neighbouring queries (keyword map
 * C9 — the hub lists, the lessons explain, the tool ranks all 169); a recessed band with a
 * STATIC 13×13 index (`HandIndexMatrix`) that draws the covered classes on the site's
 * signature grid; and the grouped list (`HandHubGroups`: 페어 · 에이스 · 브로드웨이/커넥터)
 * where every row carries the key, the rank and the record's one-line hook.
 *
 * Order inside a group is `learn-core`'s own 169-class strength rank (strongest first) —
 * `handStrengthOf` already computes that; nothing here re-derives it. The `ItemList` in the
 * `CollectionPage` markup lists the published pages in the order the grouped list renders
 * them, so the markup describes the page rather than a second sort.
 *
 * The e2e contract (`tests/e2e/hands.spec.ts`): the region named `전체 핸드` holds one
 * `<li>` per record, each exactly one of "link" or "준비 중", and the count sentence over it
 * is derived from the same list.
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
import { HandHubGroups } from '../../../components/hands/HandHubGroups.js';
import { HandIndexMatrix } from '../../../components/hands/HandIndexMatrix.js';
import { hubListedHands } from '../../../components/hands/handGraph.js';
import { Section } from '../../../components/Section.js';
import { SectionHeading } from '../../../components/SectionHeading.js';
import { contentById, contentOfKind, hrefOfContent } from '../../../content/graph.js';
import type { HandRecord } from '../../../content/types.js';
import { routeById } from '../../../lib/routes.js';

/** One statement of this hub's identity — canonical, `<title>`/OG, and the `CollectionPage`'s
 *  `name`/`description` all read it. */
const SEO = {
  path: routeById('hands').path,
  title: '홀덤 시작 핸드 목록 — 패별 순위·조합 수·기대 몫',
  description:
    '홀덤 시작 패를 하나씩 살펴보는 페이지 모음. 패마다 169개 중 순위, 조합 수, 13×13 표에서의 위치, 무작위 상대와 끝까지 갔을 때 팟에서 기대되는 몫을 계산된 값으로 보여줍니다.',
} as const;

export const metadata: Metadata = pageMetadata({ ...SEO, index: true });

const ACTION =
  'inline-flex min-h-11 items-center rounded-md px-4 py-2 text-sm font-medium outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

/** A hero action that is a link when its destination exists and inert text otherwise. */
function HeroAction({
  href,
  label,
  primary = false,
}: {
  readonly href: string | null;
  readonly label: string;
  readonly primary?: boolean;
}) {
  if (href === null) {
    return (
      <span className={`${ACTION} gap-2 border border-line-500 text-text-300`}>
        {label}
        <span className="rounded-full border border-line-500 px-1.5 py-0.5 text-[10px]">
          준비 중
        </span>
      </span>
    );
  }
  return (
    <a
      href={href}
      className={`${ACTION} ${
        primary
          ? 'bg-brand-600 text-ink-on-brand hover:bg-brand-hover'
          : 'border border-line-500 text-text-100 hover:border-brand-500'
      }`}
    >
      {label}
    </a>
  );
}

export default function HandsIndexPage() {
  const records = contentOfKind('hands') as readonly HandRecord[];
  const listed = hubListedHands(records);
  const published = records.filter((record) => record.status === 'PUBLISHED').length;

  const rankingLesson = contentById('starting-hand-ranking');
  const startingHandsLesson = contentById('starting-hands');
  const explorer = routeById('toolStartingHand');

  return (
    <main>
      {/* `listed` is the order the page FIRST links each hand — the 13×13 index above the
          grouped list — so the `ItemList` positions are the page's own order, not a second
          sort (`hubCollectionPage.test.tsx` dedupes rendered links by first occurrence). */}
      <JsonLd
        blocks={[
          collectionPageJsonLd({
            ...SEO,
            mainEntity: itemListJsonLd(
              listed.flatMap((record) => {
                const href = hrefOfContent(record);
                return href === null ? [] : [{ name: record.title, path: href }];
              }),
            ),
          }),
        ]}
      />

      <Section width="shell" padded="none" className="pt-10 sm:pt-14">
        <Breadcrumbs className="mb-8" trail={routeBreadcrumbs('hands')} />
        <EditorialHero
          eyebrow="핸드"
          title="홀덤 시작 핸드 목록"
          lead="시작 패 하나에 페이지 하나. 그 패가 169개 중 몇 위인지, 조합이 몇 가지인지, 13×13 표의 어디에 있는지, 무작위 상대와 끝까지 갔을 때 얼마를 기대할 수 있는지를 계산된 값으로 보여줍니다. 왜 그런 순서가 되는지는 레슨이, 169개 전부는 순위표 도구가 맡습니다."
          facts={[
            { label: '페이지가 있는 패', value: `${published}개` },
            { label: '전체 시작 패', value: '169개' },
            { label: '레인지 기준', value: '6인 · 100BB · First In' },
          ]}
        >
          <HeroAction
            href={explorer.available ? explorer.path : null}
            label="169개 순위표 열기"
            primary
          />
          <HeroAction href={hrefOfContent(rankingLesson)} label={rankingLesson.title} />
          <HeroAction href={hrefOfContent(startingHandsLesson)} label={startingHandsLesson.title} />
        </EditorialHero>
      </Section>

      <Section width="breakout" tone="recessed" padded="section" aria-label="13×13 표에서 고르기">
        <SectionHeading
          title="13×13 표에서 고르기"
          description="칠해진 칸이 페이지가 있는 패입니다. 칸을 누르면 그 패의 페이지로 갑니다."
        />
        <HandIndexMatrix className="mt-6" records={records} />
      </Section>

      <Section width="grid" padded="section" aria-label="전체 핸드">
        <SectionHeading
          title="전체 핸드"
          description={`전체 ${records.length}개 중 ${published}개를 읽을 수 있습니다. 나머지는 준비 중입니다. 각 묶음 안에서는 강한 패부터 순서대로입니다.`}
        />
        <HandHubGroups className="mt-8" records={records} />
      </Section>

      <Section width="shell" padded="none" as="div" className="pb-section lg:pb-section-lg">
        <CtaBand
          rounded
          title="여기 없는 패가 궁금하다면"
          description="169개 시작 패 전부를 강한 순서로 늘어놓은 순위표에서 찾을 수 있습니다. 상위 몇 %까지 고를지 직접 정할 수 있어요."
          primary={{ href: explorer.available ? explorer.path : null, label: '시작 핸드 순위표' }}
          secondary={{ href: hrefOfContent(rankingLesson), label: '순서가 정해지는 기준' }}
        />
      </Section>
    </main>
  );
}
