/**
 * `/hands/[hand]` — the hand template, one page per starting-hand class
 * (`docs/FISHTILT_CONTENT_PLAN.md` §4.2's fixed section order; Stage 3 WP-S3-13a, contract
 * AY). Same static-generation strategy and metadata shape as `/learn/[slug]` and
 * `/blog/[slug]`; the dynamic segment is named `[hand]`, matching `content/graph.ts`'s
 * `CONTENT_ROUTE_TEMPLATE.hands` exactly.
 *
 * Structured data: `BreadcrumbList`, plus `FAQPage` ONLY when the hand's own MDX carries a
 * real question list (`## 자주 묻는 것` with at least two `### 질문` sub-headings, rendered
 * on the page by MDX itself — `src/lib/seo/faq.ts`). A hand page is a reference page, not
 * an article, so it emits no `Article` markup.
 *
 * ## Why most of this page is TSX, not MDX
 *
 * §4.1: "The template is TypeScript, so it calls `learn-core` directly; it needs no new
 * `Fact` names." Sections 3–6 are rendered by THIS shared template for all twenty hand
 * pages — the fact strip, the 13×13 highlight, the rank/equity sentence, the COMPARISON
 * TABLE of rank neighbours and the suited/offsuit twin (`HandComparisonTable`), and the
 * supported-range seats on the 6-max diagram (`HandRfiSeats`) — so every hand page states
 * its numbers identically and no per-hand MDX file has to re-derive or repeat them. The
 * MDX's job is the lead sentence, the context ("why" and "what it does not mean") and the
 * FAQ. The onward groups (`HandOnward`: 관련 가이드 · 이런 이야기도 있어요) are derived from
 * the content graph and the stories' real cards, not authored per page.
 *
 * Section 4's 13×13 highlight specifically CANNOT be authored in MDX at all:
 * `docs/FISHTILT_STATE.md` ruling 17 requires `RangeMatrix`'s own `selectedKey`, and
 * `RangeMatrix` (unlike `RangeMatrixMini`) is not on the MDX allow-list
 * (`src/content/allowList.ts`) — see `HandRangeHighlight`'s doc comment for the full
 * reasoning.
 *
 * ## The MDX is split in two, and why
 *
 * §4.2's order only works if the article's ONE-LINE ANSWER (position 2) and the discussion
 * the author writes after it can sit on opposite sides of the computed sections.
 * `leadSplit.ts` splits the compiled article after its first block — no MDX file changes,
 * no marker component — and the two halves are placed at §4.2's positions 2 and (for the
 * discussion and FAQ) after section 6.
 *
 * ## Column
 *
 * `<main>` keeps the site's reading column (`max-w-reading`, `theme-tokens.test.ts` pins it
 * for every long-form template). What makes a hand page look like a REFERENCE SHEET rather
 * than a lesson is that its data blocks — the fact strip, the comparison table, the range
 * seats — break out of that column by 7rem a side from `lg` (46rem + 14rem = the 60rem
 * breakout token, D-S3-10), the same idiom a lesson's figures use, while every sentence
 * keeps the prose measure.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation.js';
import { handClassByKey } from '@gto-self/strategy-core';
import { Breadcrumbs } from '../../../../components/Breadcrumbs.js';
import { Callout } from '../../../../components/Callout.js';
import { Fact } from '../../../../components/Fact.js';
import { HandComparisonTable } from '../../../../components/hands/HandComparisonTable.js';
import { HandFactStrip } from '../../../../components/hands/HandFactStrip.js';
import { HandOnward } from '../../../../components/hands/HandOnward.js';
import { HandRfiSeats } from '../../../../components/hands/HandRfiSeats.js';
import { HandRangeHighlight } from '../../../../components/HandRangeHighlight.js';
import { PageHero } from '../../../../components/PageHero.js';
import { PokerCards } from '../../../../components/PokerCards.js';
import { RelatedContent } from '../../../../components/RelatedContent.js';
import { SectionHeading } from '../../../../components/SectionHeading.js';
import { ToolCTA } from '../../../../components/ToolCTA.js';
import { handComponent } from '../../../../content/hands/index.js';
import {
  contentById,
  contentBySlug,
  contentMeta,
  hrefOfContent,
  publishedOfKind,
} from '../../../../content/graph.js';
import { describeHandClassKorean } from '../../../../features/range/index.js';
import {
  contentBreadcrumbs,
  contentMetadata,
  faqPageJsonLd,
  JsonLd,
} from '../../../../lib/seo/index.js';
import { readFaqItems } from '../../../../lib/seo/faqSource.js';
import { splitAfterLead } from './leadSplit.js';

export const dynamicParams = false;

export function generateStaticParams(): { hand: string }[] {
  return publishedOfKind('hands').map((record) => ({ hand: record.slug }));
}

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ readonly hand: string }>;
}): Promise<Metadata> {
  const { hand } = await params;
  const record = contentBySlug('hands', hand);
  if (record === undefined) return {};
  return contentMetadata(record);
}

/** A methodology/curriculum link that degrades to plain "준비 중" text, like every other
 *  internal link on the site, when the lesson it points to is not published yet. */
function LessonLink({ id, children }: { readonly id: string; readonly children: React.ReactNode }) {
  const lesson = contentById(id);
  const href = hrefOfContent(lesson);
  if (href === null) {
    return (
      <span className="text-text-300">
        {children}
        <span className="ml-1 rounded-full border border-line-500 px-1.5 py-0.5 text-[10px] font-medium">
          준비 중
        </span>
      </span>
    );
  }
  return (
    <a
      href={href}
      className="text-brand-500 underline underline-offset-4 outline-none hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
    >
      {children}
    </a>
  );
}

/** A data block that leaves the reading column from `lg` (see the module doc). */
const BREAKOUT = 'lg:-mx-28';

const PROSE = 'mt-4 prose-ko text-prose text-text-100/90';

export default async function HandPage({
  params,
}: {
  readonly params: Promise<{ readonly hand: string }>;
}) {
  const { hand } = await params;
  const record = contentBySlug('hands', hand);
  const Content = handComponent(hand);
  if (record === undefined || record.status !== 'PUBLISHED' || Content === undefined) {
    notFound();
  }
  if (record.kind !== 'hands') notFound();

  const handClass = handClassByKey(record.handKey);
  if (handClass === undefined) {
    throw new Error(`hand record ${record.id} names an unknown hand class: ${record.handKey}`);
  }

  const trail = contentBreadcrumbs(record);
  // Called, not rendered as `<Content />`: `splitAfterLead` needs the article's own block
  // children, which only exist once the component has produced them. See `leadSplit.ts`.
  const article = splitAfterLead(Content({}));
  const faq = faqPageJsonLd(readFaqItems('hands', record.slug));

  return (
    <main className="mx-auto max-w-reading px-6 py-16" data-hand={record.handKey}>
      <Breadcrumbs className="mb-8" trail={trail} />
      <JsonLd blocks={[faq]} />

      <PageHero
        eyebrow="시작 핸드"
        title={record.title}
        meta={<p className="text-sm text-text-300">{contentMeta(record)}</p>}
      />

      {/* Section 1 — the reference-sheet header: real cards resolved from the hand-class
          model, and the four numbers the page is for. A recessed well, breaking out of the
          column, so the sheet reads as a sheet before the first sentence. */}
      <section
        aria-label={`${record.handKey} 핵심 숫자`}
        data-breakout
        className={`mt-10 rounded-xl bg-ground-800 px-6 py-7 sm:px-8 ${BREAKOUT}`}
      >
        <PokerCards className="my-0" hand={record.handKey} size="lg" />
        <HandFactStrip className="mt-7" handKey={record.handKey} />
      </section>

      {/* Section 2 — the MDX file's own lead paragraph, and nothing else: the rest of the
          author's prose is section 6.5 below, after the computed sections. */}
      <div className="mt-10 [&>p:first-child]:prose-ko [&>p:first-child]:text-xl [&>p:first-child]:leading-[1.75] [&>p:first-child]:text-text-100">
        {article.lead}
      </div>

      {/* Section 3 — what this class of hand is. */}
      <section className="mt-14">
        <SectionHeading title="이 패는 어떤 패인가요" />
        <p className={PROSE}>
          {describeHandClassKorean(handClass)}입니다. 무늬까지 구별한 조합은{' '}
          <Fact name="HAND_COMBOS" arg={record.handKey} />
          가지이고, 두 장을 받는 전체 <Fact name="COMBO_COUNT" />
          가지 중 <Fact name="HAND_SHARE" arg={record.handKey} />를 차지합니다. 대략{' '}
          <Fact name="HAND_ONE_IN_N" arg={record.handKey} />
          번에 한 번꼴로 손에 들어옵니다.
        </p>
      </section>

      {/* Section 4 — 13x13 position (ruling 17: `RangeMatrix`'s own `selectedKey`, not a
          `RangeMatrixMini` highlight prop). */}
      <section className="mt-14">
        <SectionHeading title="13×13 표에서는 여기입니다" />
        <p className={PROSE}>
          아래 표에서 칠해진 칸이 <span className="font-mono font-semibold">{record.handKey}</span>
          의 자리입니다. 대각선·위쪽·아래쪽이 각각 무엇을 뜻하는지는{' '}
          <LessonLink id="hand-matrix">13×13 표 읽는 법</LessonLink> 레슨에서 설명합니다.
        </p>
        <HandRangeHighlight
          className="mt-5"
          handKey={record.handKey}
          label={`13×13 표에서 ${record.handKey}의 위치`}
        />
      </section>

      {/* Section 5 — strength ranking, with the methodology basis and the 0.10 caveat.
          `HAND_EQUITY_VS_RANDOM` is hero's EXPECTED SHARE OF THE POT WITH TIES SPLIT
          (`packages/learn-core/src/strength/model.ts`), not the proportion of the time hero
          wins — the two differ by up to 2.87pp on a number printed to two decimals
          (`docs/reports/WP_P1_POKER_CORRECTNESS_REVIEW.md` F4). 승률 stays as the friendly
          label per the fix round's D1, but this surface states the pot-share meaning outright
          and links the lesson that defines it, so the ties-split rule is reachable here.
          The comparison table that follows is the same dataset, for the neighbours. */}
      <section className="mt-14">
        <SectionHeading title="얼마나 강한가요" />
        <p className={PROSE}>
          전체 <Fact name="HAND_CLASS_COUNT" />개 시작 패 중{' '}
          <Fact name="HAND_RANK" arg={record.handKey} />
          위이며, 이보다 강한 패들과 합쳐 전체 조합의 상위{' '}
          <Fact name="HAND_TOP_SHARE" arg={record.handKey} />
          안에 듭니다. 아무도 참여하지 않은 상태에서 무작위 상대와 끝까지 갔을 때, 팟에서 가져갈
          것으로 기대되는 몫은 <Fact name="HAND_EQUITY_VS_RANDOM" arg={record.handKey} />
          입니다. 정확히 비기는 경우는 절반만 이긴 것으로 계산에 들어갑니다. 이 숫자가 무엇인지는{' '}
          <LessonLink id="equity">승률(Equity)</LessonLink> 레슨에서 처음부터 설명합니다.
        </p>
        <Callout title="이 순위가 뜻하지 않는 것">
          <p>
            이 순위는 &ldquo;아무도 참여하지 않은 상태에서 끝까지 갔을 때 팟에서 기대되는 몫&rdquo;
            하나만을 기준으로 측정한 것입니다. 측정 기준은{' '}
            <LessonLink id="starting-hand-ranking">시작 패 순서 레슨</LessonLink>에서 설명합니다. 이
            순위가 높다고 해서 이 패로 항상 레이즈해야 한다거나, 이 패가 수익성이 있다는 뜻은
            아닙니다.
          </p>
        </Callout>

        <div className={`mt-10 ${BREAKOUT}`} data-breakout>
          <SectionHeading
            as="h3"
            title="이웃한 패와 나란히 보면"
            description={`${record.handKey}의 순위 바로 위아래 두 패씩, 그리고 숫자는 같고 무늬만 다른 패입니다. 페이지가 있는 패는 눌러서 이동할 수 있습니다.`}
          />
          <HandComparisonTable handClass={handClass} className="mt-2" />
        </div>
      </section>

      {/* Section 6 — where this class is used in the one shipped range dataset, on the
          6-max diagram, with the unsupported situations named as unsupported. */}
      <section className="mt-14">
        <SectionHeading title="어느 자리에서 처음 레이즈에 쓰이나요" />
        <HandRfiSeats className={`mt-6 ${BREAKOUT}`} handClass={handClass} />
      </section>

      {/* Section 6.5 — the author's own discussion and FAQ. It follows the computed
          sections rather than preceding them, so this hand's own combo count and rank are
          stated before any paragraph that compares it to another hand. A `## 자주 묻는 것`
          with `### 질문` sub-headings renders here, by MDX, and is what the `FAQPage` block
          above describes. */}
      {article.rest.length > 0 ? <article className="mt-14">{article.rest}</article> : null}

      {/* Section 7 — the tool CTA §37 requires. */}
      <ToolCTA tool="range" title="13×13 표에서 다른 패와 나란히 비교해보세요">
        직접 칸을 눌러 조합 수와 비중을 확인할 수 있습니다.
      </ToolCTA>

      {/* Section 8 — onward, in the D-S3-16 order: guides and stories derived from the
          graph, then the record's own relations under the Stage 3 labels. */}
      <HandOnward className="mt-16" record={record} />
      <RelatedContent
        className="mt-14"
        record={record}
        only={['relatedHands']}
        label="비슷한 핸드"
      />
      <RelatedContent
        className="mt-14"
        record={record}
        only={['relatedTools']}
        label="직접 확인하기"
      />
      <RelatedContent className="mt-14" record={record} only={['nextLessons']} label="더 배우기" />
      <RelatedContent
        className="mt-14"
        record={record}
        only={['relatedConcepts']}
        label="같이 알아둘 용어"
      />
    </main>
  );
}
