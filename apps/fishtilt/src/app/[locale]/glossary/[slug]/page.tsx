/**
 * `/glossary/[slug]` — the term template (WP-S3-11, contract AW). Same static-generation
 * strategy and metadata shape as `/learn/[slug]` and `/blog/[slug]`: the whole `<head>` is
 * `contentMetadata(record)`.
 *
 * ## Slots, in order
 *
 *   1. `GlossaryTermHeader` — category (a link back to the hub's section), the `<h1>`
 *      (`title`), the names line (headword · Latin term · every alias), the one-line
 *      `shortDefinition` as the lead, and the optional deterministic visual
 *      (`components/glossary/visuals.ts`) for a term whose subject is cards.
 *   2. The MDX body — "쉽게 설명하면", "예로 보면" and whatever else the entry writes.
 *      Content agents (WP-S3-12) fill those sections per term; the template does not
 *      generate prose.
 *   3. 같이 알아둘 용어 — `relatedConcepts` as an inline run (`GlossaryRelatedTerms`).
 *   4. 더 배우기 (`nextLessons`), 직접 확인하기 (`relatedTools`), 이런 이야기도 있어요
 *      (`relatedArticles`), 비슷한 핸드 (`relatedHands`) — `RelatedContent` under the
 *      D-S3-16 labels, each rendered only when the record has entries.
 *
 * ## Structured data
 *
 * `BreadcrumbList` (via the layout's trail), a `DefinedTerm` (`lib/seo/jsonLd.ts`, beside
 * the hub's `DefinedTermSet` builder) pointing back at that set — every field of which the
 * header prints — and `FAQPage` only when the
 * entry's own MDX carries a real question list (none does today; the hook stays for
 * uniformity across the four content templates). No `Article`: a definition is not one.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation.js';
import { Breadcrumbs } from '../../../../components/Breadcrumbs.js';
import { GlossaryRelatedTerms } from '../../../../components/glossary/GlossaryRelatedTerms.js';
import { GlossaryTermHeader } from '../../../../components/glossary/GlossaryTermHeader.js';
import { GlossaryVisual } from '../../../../components/glossary/GlossaryVisual.js';
import { visualOf } from '../../../../components/glossary/visuals.js';
import { RelatedContent } from '../../../../components/RelatedContent.js';
import { EditorialVisual } from '../../../../components/visual/EditorialVisual.js';
import { VisualBackdrop } from '../../../../components/visual/VisualBackdrop.js';
import { visualOf as featuredVisualOf } from '../../../../content/visuals.js';
import { glossaryComponent } from '../../../../content/glossary/index.js';
import {
  contentBySlug,
  contentPath,
  glossaryRecords,
  publishedOfKind,
} from '../../../../content/graph.js';
import {
  categoryOfTerm,
  GLOSSARY_HUB_ANCHORS,
  headwordOf,
} from '../../../../content/registry/glossary/categories.js';
import {
  contentBreadcrumbs,
  contentMetadata,
  definedTermJsonLd,
  faqPageJsonLd,
  GLOSSARY_TERM_SET_NAME,
  JsonLd,
} from '../../../../lib/seo/index.js';
import { readFaqItems } from '../../../../lib/seo/faqSource.js';
import { routeById } from '../../../../lib/routes.js';

export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return publishedOfKind('glossary').map((entry) => ({ slug: entry.slug }));
}

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ readonly slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entry = contentBySlug('glossary', slug);
  if (entry === undefined) return {};
  return contentMetadata(entry);
}

export default async function GlossaryEntryPage({
  params,
}: {
  readonly params: Promise<{ readonly slug: string }>;
}) {
  const { slug } = await params;
  const entry = glossaryRecords().find((candidate) => candidate.slug === slug);
  const Content = glossaryComponent(slug);
  if (entry === undefined || entry.status !== 'PUBLISHED' || Content === undefined) {
    notFound();
  }

  const trail = contentBreadcrumbs(entry);
  const category = categoryOfTerm(entry);
  const hub = routeById('glossary').path;
  const headword = headwordOf(entry);
  const aliases = entry.aliases.filter((alias) => alias !== headword);
  const visual = visualOf(entry.slug);
  const path = contentPath(entry);
  const featured = featuredVisualOf(entry);

  return (
    <main className="mx-auto max-w-reading px-6 py-16">
      <Breadcrumbs className="mb-8" trail={trail} />
      <JsonLd
        blocks={[
          definedTermJsonLd({
            name: headword,
            description: entry.shortDefinition,
            alternateNames: [entry.term, ...aliases].filter((name) => name !== headword),
            path,
            set: { name: GLOSSARY_TERM_SET_NAME, path: hub },
          }),
          faqPageJsonLd(readFaqItems('glossary', entry.slug)),
        ]}
      />

      <GlossaryTermHeader
        title={entry.title}
        headword={headword}
        term={entry.term}
        aliases={aliases}
        shortDefinition={entry.shortDefinition}
        level={entry.level}
        category={{
          label: category.label,
          href: `${hub}#${GLOSSARY_HUB_ANCHORS.category(category.id)}`,
        }}
        visual={
          visual === undefined ? undefined : (
            // The term's own cards, drawn from data, on the category's atmosphere.
            <VisualBackdrop visual={featured} sizes="736px" className="px-5 py-6 sm:px-7">
              <GlossaryVisual visual={visual} />
            </VisualBackdrop>
          )
        }
      />

      {/* A term with nothing to draw gets its category's shared picture as a quiet band. */}
      {visual === undefined ? (
        <EditorialVisual
          describe
          className="mt-8"
          visual={featured}
          aspect="3/1"
          scrim="soft"
          sizes="(min-width: 800px) 736px, 100vw"
        />
      ) : null}

      {/*
        The first MDX paragraph restates the definition in the entry's own words; the lead
        above already said it in one line, so the body reads at prose size from its first
        line rather than repeating the lead at display size.
      */}
      <article className="editorial-body mt-10">
        <Content />
      </article>

      <GlossaryRelatedTerms className="mt-14" ids={entry.relatedConcepts} />

      {/* One call per group so the order is the reader's (learn → tool → stories → hands),
          not `RELATION_KINDS`' — `RelatedContent` renders whatever `only` names in the
          graph's fixed order. Each renders nothing when the relation is empty. */}
      <RelatedContent className="mt-12" record={entry} only={['nextLessons']} label="더 배우기" />
      <RelatedContent
        className="mt-12"
        record={entry}
        only={['relatedTools']}
        label="직접 확인하기"
      />
      <RelatedContent
        className="mt-12"
        record={entry}
        only={['relatedArticles']}
        label="이런 이야기도 있어요"
      />
      <RelatedContent
        className="mt-12"
        record={entry}
        only={['relatedHands']}
        label="비슷한 핸드"
      />
    </main>
  );
}
