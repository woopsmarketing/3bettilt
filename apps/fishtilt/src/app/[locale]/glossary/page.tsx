/**
 * `/glossary` — the dictionary hub (WP-S3-11, contracts AU/AV).
 *
 * A fast dictionary, not long-form. Four ways into the same 58 terms, all on one static
 * page and all in the HTML:
 *
 *   1. the search field (`GlossarySearch`, the page's one client island) narrows the index
 *      in place; without JavaScript it submits to the site search instead;
 *   2. "가장 많이 연결된 용어" — the terms the rest of the site references most, counted
 *      from the content graph, never from traffic the site does not have;
 *   3. "주제별로 보기" — six categories (`registry/glossary/categories.ts`), headwords only;
 *   4. the index itself — every term as one dense row, filed under its ㄱ ㄴ ㄷ … A–Z tab
 *      by the Korean headword, the Latin names beside it, the one-line definition after.
 *
 * Same honesty gate as `/learn` and `/blog`: a `PLANNED` term is visible, named text,
 * never a link. Everything is built from ONE resolved list (`hubEntries`), so the
 * `DefinedTermSet` below enumerates exactly the rows on screen, with the headword the row
 * prints as `name` and the definition the row prints as `description`.
 */
import type { Metadata } from 'next';
import {
  collectionPageJsonLd,
  definedTermSetJsonLd,
  JsonLd,
  pageMetadata,
  routeBreadcrumbs,
} from '../../../lib/seo/index.js';
import { Breadcrumbs } from '../../../components/Breadcrumbs.js';
import { Divider } from '../../../components/Divider.js';
import { PageHero } from '../../../components/PageHero.js';
import { SectionHeading } from '../../../components/SectionHeading.js';
import { GlossaryCategoryMap } from '../../../components/glossary/GlossaryCategoryMap.js';
import { GlossaryIndex } from '../../../components/glossary/GlossaryIndex.js';
import { GlossaryNav } from '../../../components/glossary/GlossaryNav.js';
import { GlossaryPopular } from '../../../components/glossary/GlossaryPopular.js';
import { GlossarySearch } from '../../../components/glossary/GlossarySearch.js';
import {
  categoryGroups,
  hubEntries,
  initialGroups,
} from '../../../components/glossary/hubModel.js';
import { glossaryRecords } from '../../../content/graph.js';
import {
  GLOSSARY_CATEGORIES,
  GLOSSARY_HUB_ANCHORS,
} from '../../../content/registry/glossary/categories.js';
import { mostReferencedTerms } from '../../../content/registry/glossary/popular.js';
import { routeById } from '../../../lib/routes.js';

/** One statement of this hub's identity — canonical, `<title>`/OG, and the `CollectionPage`'s
 *  `name`/`description` all read it. */
const SEO = {
  path: routeById('glossary').path,
  title: '포커 용어 사전',
  description:
    '홀덤에서 쓰는 말을 쉬운 한국어 한 줄로 먼저 설명하고, 영어 이름과 줄임말을 함께 보여줍니다. ㄱㄴㄷ순, 주제별, 검색으로 찾을 수 있습니다.',
} as const;

export const metadata: Metadata = pageMetadata({ ...SEO, index: true });

/** How many "most connected" chips the hub shows. */
const POPULAR_COUNT = 8;

export default function GlossaryIndexPage() {
  const entries = hubEntries(glossaryRecords());
  const published = entries.filter(({ record }) => record.status === 'PUBLISHED').length;
  const planned = entries.length - published;
  const initials = initialGroups(entries);
  const categories = categoryGroups(entries);
  const popular = mostReferencedTerms(POPULAR_COUNT);

  // The set's rows in the order the page FIRST links them — popular strip, then the category
  // map, then the index — deduplicated by first occurrence. `hubCollectionPage.test.tsx`
  // holds every hub to that rule, so the structured data and the page cannot disagree
  // about what is listed or in what order.
  const byId = new Map(entries.map((entry) => [entry.record.id, entry]));
  const declared = [
    ...popular.map(({ term }) => term.id),
    ...categories.flatMap((group) => group.entries.map((entry) => entry.record.id)),
    ...entries.map((entry) => entry.record.id),
  ]
    .filter((id, index, ids) => ids.indexOf(id) === index)
    .flatMap((id) => {
      const entry = byId.get(id);
      return entry === undefined || entry.href === null
        ? []
        : [{ name: entry.headword, description: entry.record.shortDefinition, path: entry.href }];
    });

  return (
    <main className="mx-auto max-w-grid px-6 py-14 sm:py-20">
      <Breadcrumbs className="mb-8" trail={routeBreadcrumbs('glossary')} />
      {/*
        THE ONE HUB WHOSE LIST IS NOT AN `ItemList`: a glossary is a `DefinedTermSet`, and the
        set is declared where its rows are rendered — from the same `entries` array, so
        `name` (the headword) and `description` (the one-line definition) are literally the
        two things each index row prints, and a planned term (no href) is not in the set.
      */}
      <JsonLd
        blocks={[
          collectionPageJsonLd({
            ...SEO,
            mainEntity: definedTermSetJsonLd(SEO.title, SEO.path, declared),
          }),
        ]}
      />
      <PageHero
        eyebrow="용어"
        title="포커 용어 사전"
        description="모르는 말이 나오면 여기서 찾아보세요. 한국어 이름을 먼저 쓰고, 영어 이름과 줄임말을 옆에 둡니다. 한 줄 정의로 충분하지 않으면 용어를 눌러 쉬운 설명과 예를 봅니다."
        facts={[
          { label: '용어', value: `${entries.length}개` },
          { label: '분류', value: `${GLOSSARY_CATEGORIES.length}가지` },
        ]}
      >
        <GlossarySearch total={entries.length} />
      </PageHero>

      <GlossaryNav className="mt-10" categories={categories} initials={initials} />

      {popular.length > 0 ? (
        <section
          id={GLOSSARY_HUB_ANCHORS.popular}
          data-glossary-hide-on-search
          className="mt-section scroll-mt-24"
          aria-label="가장 많이 연결된 용어"
        >
          <SectionHeading
            title="가장 많이 연결된 용어"
            description="이 사이트의 레슨·글·핸드 페이지가 가장 자주 가리키는 용어입니다. 숫자는 연결된 페이지 수이고, 검색량이 아닙니다."
          />
          <GlossaryPopular className="mt-5" terms={popular} />
        </section>
      ) : null}

      <section
        id={GLOSSARY_HUB_ANCHORS.categories}
        data-glossary-hide-on-search
        className="mt-section scroll-mt-24"
        aria-label="주제별로 보기"
      >
        <SectionHeading
          title="주제별로 보기"
          description="말은 모르지만 어느 주제인지는 알 때. 용어를 누르면 바로 그 항목으로 갑니다."
        />
        <GlossaryCategoryMap className="mt-6" groups={categories} />
      </section>

      <Divider />

      <section id={GLOSSARY_HUB_ANCHORS.index} className="scroll-mt-24" aria-label="전체 용어">
        <SectionHeading
          title="전체 용어"
          description={`ㄱㄴㄷ순. 전체 ${entries.length}개 중 ${published}개를 읽을 수 있습니다.${
            planned > 0 ? ' 나머지는 준비 중입니다.' : ''
          }`}
        />
        <GlossaryIndex className="mt-6" groups={initials} />
      </section>
    </main>
  );
}
