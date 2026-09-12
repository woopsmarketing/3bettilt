/**
 * `HomeStories` — "3BetTilt 스토리": the hand stories, featured + secondary, straight from
 * `publishedStories()` (`homeModel.homeStories`).
 *
 * ## Data-driven in both directions
 *
 * Stories are being written while this page ships. With one or more published stories the
 * first leads (16:9 visual, the hero's actual cards and the actual board from the record,
 * title, deck, meta) and the rest follow as rows; with zero the band keeps its place in the
 * page and states the editorial promise plainly — no invented titles, no placeholder cards,
 * one real link to the blog hub. Nothing in this file has to change when the first story
 * is published.
 *
 * ## The disclosure is never hidden
 *
 * Every story is a reconstructed scenario and the record carries the sentence that says
 * so (`HAND_STORY_DISCLOSURE`, D-S3-20). It is printed under the featured story as body
 * text, not tucked into a tooltip.
 */
import { BLOG_CONTENT_TYPE_ANCHOR, contentMeta, hrefOfContent } from '../../content/graph.js';
import { HAND_STORY_DISCLOSURE } from '../../content/stories/types.js';
import type { HandStoryRecord } from '../../content/types.js';
import { BoardCards } from '../BoardCards.js';
import { EditorialImage } from '../EditorialImage.js';
import { GuideCards } from '../tools/GuideCards.js';
import type { HomeStoriesModel } from './homeModel.js';

export interface HomeStoriesProps extends HomeStoriesModel {
  /** The blog hub, resolved; `null` hides the hub link. */
  readonly blogHref: string | null;
  readonly className?: string;
}

const TITLE_LINK =
  'inline-flex min-h-11 items-center prose-ko font-semibold text-text-100 outline-none hover:text-brand-500 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

const HUB_LINK =
  'inline-flex min-h-11 items-center gap-1.5 font-medium text-brand-500 underline underline-offset-4 outline-none ' +
  'hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

function storiesHubHref(blogHref: string | null): string | null {
  return blogHref === null ? null : `${blogHref}#${BLOG_CONTENT_TYPE_ANCHOR['hand-story']}`;
}

function Featured({ story }: { readonly story: HandStoryRecord }) {
  const href = hrefOfContent(story);
  const { hand } = story;
  return (
    <article data-featured-story={story.id} className="min-w-0">
      <EditorialImage
        alt=""
        decorative
        aspect="16/9"
        sizes="(min-width: 1024px) 720px, 100vw"
        fallback={{ kind: story.kind, topic: story.topic, variant: story.id }}
      />
      {/* The record's own cards: what the hero held, and the board as it fell. */}
      <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-3">
        <GuideCards cards={hand.heroHand} label="내 패" size="sm" />
        {hand.flop !== undefined ? (
          <BoardCards flop={hand.flop} turn={hand.turn} river={hand.river} size="sm" />
        ) : null}
      </div>
      <p className="mt-5 text-sm font-medium tracking-[0.06em] text-brand-500">
        {`${hand.heroPosition} 대 ${hand.villainPosition} · ${hand.stakes}`}
      </p>
      <h3 className="mt-1 text-h2">
        {href === null ? (
          <span className="prose-ko font-semibold text-text-300">{story.title}</span>
        ) : (
          <a href={href} className={TITLE_LINK}>
            {story.title}
          </a>
        )}
      </h3>
      <p className="mt-3 max-w-lead prose-ko text-prose text-text-300">{story.description}</p>
      <p className="mt-3 text-sm text-text-300">
        {contentMeta(story)} · {HAND_STORY_DISCLOSURE}
      </p>
    </article>
  );
}

function Secondary({
  stories,
  hubHref,
}: {
  readonly stories: readonly HandStoryRecord[];
  readonly hubHref: string | null;
}) {
  return (
    <div className="min-w-0 lg:border-l lg:border-line-500 lg:pl-10">
      <p className="text-sm font-semibold tracking-[0.06em] text-text-300">다른 핸드</p>
      {stories.length > 0 ? (
        <ol className="mt-2 divide-y divide-line-500">
          {stories.map((story, index) => {
            const href = hrefOfContent(story);
            return (
              <li key={story.id} data-story={story.id} className="py-5">
                <span className="tabular block font-mono text-xs text-text-300">
                  {String(index + 1).padStart(2, '0')} · {story.hand.heroPosition} 대{' '}
                  {story.hand.villainPosition}
                </span>
                {href === null ? (
                  <span className="mt-1 block prose-ko font-semibold text-text-300">
                    {story.title}
                  </span>
                ) : (
                  <a href={href} className={`${TITLE_LINK} mt-1`}>
                    {story.title}
                  </a>
                )}
                <span className="mt-1 block prose-ko text-sm text-text-300">
                  {story.description}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-3 prose-ko text-sm text-text-300">
          다음 핸드가 준비되는 대로 이 자리에 실립니다.
        </p>
      )}
      {hubHref !== null ? (
        <p className="mt-6">
          <a href={hubHref} className={HUB_LINK}>
            스토리 전체 보기
            <span aria-hidden="true">→</span>
          </a>
        </p>
      ) : null}
    </div>
  );
}

/** Zero stories today: the promise, in the band's own voice, with one real link. */
function ComingSoon({ blogHref }: { readonly blogHref: string | null }) {
  return (
    <div data-stories="coming-soon" className="grid gap-8 lg:grid-cols-12 lg:gap-12">
      <p className="prose-ko text-xl text-text-100 lg:col-span-7 sm:text-2xl">
        실제로 벌어질 법한 한 판을 프리플랍부터 쇼다운까지 따라갑니다. 카드와 보드, 판돈은 전부
        기록대로 그리고, 흥미로운 지점에서 멈춰 무엇을 배울 수 있는지 짚습니다.
      </p>
      <div className="lg:col-span-5 lg:border-l lg:border-line-500 lg:pl-10">
        <p className="prose-ko text-sm text-text-300">
          첫 스토리를 쓰고 있습니다. 공개되는 대로 이 자리에 실리고, 그때까지는 검색 가이드와 개념
          글을 먼저 읽을 수 있습니다.
        </p>
        {blogHref !== null ? (
          <p className="mt-4">
            <a href={blogHref} className={HUB_LINK}>
              블로그 읽을거리 보기
              <span aria-hidden="true">→</span>
            </a>
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function HomeStories({ featured, secondary, blogHref, className = '' }: HomeStoriesProps) {
  if (featured === null) {
    return (
      <div className={className}>
        <ComingSoon blogHref={blogHref} />
      </div>
    );
  }
  return (
    <div className={`grid gap-12 lg:grid-cols-12 lg:gap-14 ${className}`}>
      <div className="min-w-0 lg:col-span-7">
        <Featured story={featured} />
      </div>
      <div className="min-w-0 lg:col-span-5">
        <Secondary stories={secondary} hubHref={storiesHubHref(blogHref)} />
      </div>
    </div>
  );
}
