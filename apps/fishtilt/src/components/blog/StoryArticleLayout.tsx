/**
 * Layout (b): a Hand Story. Contract AN, D-S3-20.
 *
 * Everything that is a fact about the hand is drawn from the record through
 * `resolveStory` — the boards, the timelines, the pots, the hero's class, the showdown —
 * and the prose only narrates. The two meet in the MDX's `<StreetSection street="…">` tags:
 * this layout binds a record-aware `StreetSection` and hands it to the compiled MDX as a
 * component override, so the tag in the prose becomes the street's board + timeline + pot
 * with the narrative under it. `stories/mdx.ts` checks the tags match the record.
 *
 * Order: breadcrumb · category · H1 · deck · meta with the VISIBLE disclosure · hero visual
 * (16:9, breakout) · game info strip · hero hand · the MDX (streets, showdown, 흥미로운 지점,
 * 무엇을 배울 수 있나) · related concepts · tool band · related stories · prev/next.
 *
 * "무엇을 배울 수 있나" is learning context — what the hand shows about a rule or a number —
 * never advice for a hand in progress (AGENT_COMMON_RULES rule 8).
 */
import type { MDXComponents } from 'mdx/types';
import type { ReactNode } from 'react';
import type { ArticleComponent } from '../../content/blog/index.js';
import { BLOG_CONTENT_TYPE_LABEL } from '../../content/graph.js';
import type { HandStoryRecord } from '../../content/types.js';
import {
  formatStoryAmount,
  formatStoryPot,
  resolveStory,
  type ResolvedPlayerHand,
  type ResolvedStory,
  type StoryStreet,
} from '../../content/stories/resolve.js';
import { HAND_STORY_DISCLOSURE_BADGE } from '../../content/stories/types.js';
import { TOPIC_LABEL } from '../../features/content/index.js';
import { HAND_CATEGORY_LABEL, handReading } from '../../features/tools/handRank.js';
import type { BreadcrumbItem } from '../../lib/seo/index.js';
import { ArticleHero } from '../ArticleHero.js';
import { ArticleMeta } from '../ArticleMeta.js';
import { Breadcrumbs } from '../Breadcrumbs.js';
import { EditorialImage } from '../EditorialImage.js';
import type { BetAction } from '../HandTimeline.js';
import { PokerCards } from '../PokerCards.js';
import { Section } from '../Section.js';
import { StatStrip } from '../StatStrip.js';
import { StreetSection, STREET_HEADING, type Street } from '../StreetSection.js';
import {
  ARTICLE_BREAKOUT,
  BREAKOUT,
  BlogArticleShell,
  mdxComponentsFor,
  HERO_TITLE_BREAK,
} from './BlogArticleShell.js';
import { BlogArticleFooter } from './BlogArticleFooter.js';

/* ------------------------------------------------------------------------------------- */
/* Pieces                                                                                  */
/* ------------------------------------------------------------------------------------- */

function StoryGameInfo({ record }: { readonly record: HandStoryRecord }) {
  const { hand } = record;
  return (
    <StatStrip
      aria-label="게임 정보"
      className="mt-10 border-y border-line-500 py-6"
      items={[
        { label: '게임', value: `${hand.gameType} ${hand.tableSize}인`, note: hand.stakes },
        { label: '유효 스택', value: formatStoryAmount(hand.effectiveStack) },
        { label: '히어로 자리', value: hand.heroPosition },
        { label: '상대 자리', value: hand.villainPosition },
      ]}
    />
  );
}

function StoryHeroHand({
  record,
  resolved,
}: {
  readonly record: HandStoryRecord;
  readonly resolved: ResolvedStory;
}) {
  return (
    <section aria-label="히어로 핸드" className="mt-10">
      <p className="text-sm font-semibold tracking-[0.06em] text-brand-500">히어로 핸드</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-3">
        <PokerCards cards={record.hand.heroHand} size="lg" showReading={false} className="my-0" />
        <p className="text-text-300">
          <span className="block font-mono text-lg font-semibold text-text-100">
            {resolved.heroClassKey}
          </span>
          <span className="block text-sm">
            {record.hand.heroPosition}에서, {formatStoryAmount(record.hand.effectiveStack)} 스택으로
          </span>
        </p>
      </div>
      {resolved.unmentioned.length > 0 ? (
        <p className="mt-3 text-sm text-text-300">
          프리플랍에 언급되지 않은 자리({resolved.unmentioned.join(', ')})는 행동 전에 폴드한 것으로
          봅니다.
        </p>
      ) : null}
    </section>
  );
}

function PlayerResult({
  who,
  player,
}: {
  readonly who: string;
  readonly player: ResolvedPlayerHand;
}) {
  return (
    <div data-player={who} className="min-w-0">
      <p className="text-xs font-medium tracking-[0.06em] text-text-300">
        {who} · {player.position}
      </p>
      <PokerCards cards={player.cardsText} size="md" showReading={false} className="my-3" />
      <p className="prose-ko font-semibold text-text-100">{HAND_CATEGORY_LABEL[player.category]}</p>
      <p className="prose-ko text-sm text-text-300">{handReading(player.value)}</p>
    </div>
  );
}

function StoryShowdown({
  resolved,
  children,
}: {
  readonly resolved: ResolvedStory;
  readonly children?: ReactNode;
}) {
  const { ending } = resolved;
  if (ending.kind !== 'showdown') {
    throw new Error('story MDX has a showdown section, but the hand ends by a fold');
  }
  const verdict =
    ending.winner === 'split'
      ? `무승부 — 팟 ${formatStoryAmount(resolved.pot)}를 나눕니다.`
      : `${ending.winner === 'hero' ? '히어로' : '상대'}가 팟 ${formatStoryAmount(resolved.pot)}를 가져갑니다.`;
  return (
    <section aria-labelledby="street-showdown" data-street="showdown" className="my-12">
      <h2 id="street-showdown" className="scroll-mt-24 text-h2 font-semibold text-text-100">
        {STREET_HEADING.showdown}
      </h2>
      <div className="mt-6 grid gap-8 rounded-lg bg-ground-800 p-6 sm:grid-cols-2 sm:p-8">
        <PlayerResult who="히어로" player={ending.hero} />
        <PlayerResult who="상대" player={ending.villain} />
        <p
          data-winner={ending.winner}
          className="prose-ko text-prose font-semibold text-text-100 sm:col-span-2"
        >
          {verdict}
        </p>
        <p className="text-xs text-text-300 sm:col-span-2">
          족보와 승자는 이 사이트의 핸드 평가기가 카드에서 직접 계산한 결과입니다.
        </p>
      </div>
      {children ? <div className="mt-6">{children}</div> : null}
    </section>
  );
}

/**
 * The record-bound `StreetSection`. The MDX writes `<StreetSection street="flop">` and
 * nothing else; this fills in the board as of that street, the timeline and the pot.
 */
function boundStreetSection(resolved: ResolvedStory) {
  return function StoryStreetSection({
    street,
    children,
  }: {
    readonly street: Street;
    readonly children?: ReactNode;
  }) {
    if (street === 'showdown') return <StoryShowdown resolved={resolved}>{children}</StoryShowdown>;
    const data = resolved.streets.find((entry) => entry.street === (street as StoryStreet));
    if (data === undefined) {
      throw new Error(`story MDX names street "${street}", which the record does not play`);
    }
    const actions: BetAction[] = data.rows.map((row) => ({
      position: row.position,
      action: row.action,
      hero: row.hero,
      ...(row.amount === undefined ? {} : { amount: row.amount }),
      ...(row.note === undefined ? {} : { note: row.note }),
    }));
    const fold =
      resolved.ending.kind === 'fold' && resolved.ending.street === street ? resolved.ending : null;
    return (
      <StreetSection
        street={street}
        {...(data.board === undefined ? {} : { board: data.board })}
        actions={actions}
        pot={formatStoryPot(data.potAfter)}
      >
        {fold !== null ? (
          <p data-winner={fold.winner} className="prose-ko font-semibold text-text-100">
            {fold.folded} 폴드 — 쇼다운 없이 {fold.winner}가 팟 {formatStoryAmount(resolved.pot)}를
            가져갑니다.
          </p>
        ) : null}
        {children}
      </StreetSection>
    );
  };
}

/* ------------------------------------------------------------------------------------- */
/* Layout                                                                                  */
/* ------------------------------------------------------------------------------------- */

export interface StoryArticleLayoutProps {
  readonly record: HandStoryRecord;
  readonly trail: readonly BreadcrumbItem[];
  readonly Content: ArticleComponent;
}

export function StoryArticleLayout({ record, trail, Content }: StoryArticleLayoutProps) {
  const resolved = resolveStory(record.hand);
  const components: MDXComponents = mdxComponentsFor({
    StreetSection: boundStreetSection(resolved),
  });

  return (
    <>
      <Section width="breakout" padded="none" className="pt-10 sm:pt-14">
        <BlogArticleShell>
          <Breadcrumbs className="mb-8" trail={trail} />
          <ArticleHero
            className={HERO_TITLE_BREAK}
            category={BLOG_CONTENT_TYPE_LABEL[record.contentType]}
            title={record.title}
            deck={record.description}
            meta={
              <ArticleMeta
                category={TOPIC_LABEL[record.topic]}
                readMinutes={record.readMinutes}
                disclosure={{
                  badge: HAND_STORY_DISCLOSURE_BADGE,
                  sentence: record.hand.disclosure,
                }}
              />
            }
          />
          {/* The story's editorial visual (VA-09..14) at 16:9. It carries the moment's feeling,
              never the cards: those are drawn below from the record. */}
          <EditorialImage
            className={`mt-10 ${BREAKOUT}`}
            alt=""
            decorative
            aspect="16/9"
            sizes="(min-width: 1024px) 960px, 100vw"
            fallback={{ kind: record.kind, topic: record.topic, variant: record.id }}
          />
          <StoryGameInfo record={record} />
          <StoryHeroHand record={record} resolved={resolved} />
        </BlogArticleShell>
      </Section>

      <Section width="breakout" padded="none" className="pb-section lg:pb-section-lg">
        <article
          data-story
          className={`mt-4 ${ARTICLE_BREAKOUT} grid grid-cols-[1fr_min(var(--container-reading),100%)_1fr] [&>*]:col-start-2 [&>*]:min-w-0 [&>p:first-child]:text-xl [&>p:first-child]:leading-[1.75] [&>p:first-child]:text-text-100`}
        >
          <Content components={components} />
        </article>
        <BlogArticleShell className="mt-16">
          <BlogArticleFooter
            record={record}
            title="이 핸드 다음에"
            description="이 이야기에 나온 개념, 직접 눌러볼 도구, 그리고 비슷한 다른 핸드입니다."
          />
        </BlogArticleShell>
      </Section>
    </>
  );
}
