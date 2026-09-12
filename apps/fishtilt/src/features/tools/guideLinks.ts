/**
 * Where each tool page sends a reader ONWARD, grouped under the Stage 3 relation labels
 * (D-S3-16): 더 배우기 (lessons), 같이 알아둘 용어 (glossary), 이런 이야기도 있어요 (blog
 * answers), 직접 확인하기 (a quiz). The next TOOL is not listed here — every page carries it
 * as its closing `ToolCTA`, the way the six tools have since WP-4.
 *
 * ## Ids in, resolved destinations out
 *
 * Content ids resolve through the graph (`contentById` throws for an unknown id,
 * `hrefOfContent` is `null` for a record that is not published), route ids through the
 * registry (`available: false` yields `null`). `ToolGuideLinks` renders `null` as the
 * site's inert "준비 중" row rather than a link that 404s, so a piece that ships later goes
 * live here with no edit. `guideLinks.test.ts` proves every id below resolves.
 *
 * The lesson group is `TOOL_LESSON_IDS` itself (`related.ts`), not a second list — the hub
 * card, the old footer and this block name the same prerequisite lessons.
 *
 * ## Hand stories (WP-S3-16)
 *
 * The six hand stories are blog records, so they sit in `articles` beside the search
 * guides under the same "이런 이야기도 있어요" label. A story is listed on a tool only when
 * the story's own `relatedTools` names that tool — the relation is declared on the story
 * side and mirrored here, never invented for a tool that has nothing to compute about it.
 * `guideLinks.test.ts` proves that mirror holds.
 */
import type { RelatedLabel } from '../../components/RelatedContent.js';
import { contentById, contentMeta, hrefOfContent, KIND_LABEL } from '../../content/graph.js';
import type { ContentId } from '../../content/types.js';
import { routeById } from '../../lib/routes.js';
import { toolLessonIds } from './related.js';

export interface ToolGuideLinkGroupIds {
  readonly glossary: readonly ContentId[];
  readonly articles: readonly ContentId[];
  /** A `practice*` route id, or `null` when no quiz drills this tool's subject. */
  readonly quiz: string | null;
}

/** Keyed by tool route id, like `TOOL_LESSON_IDS` and `TOOL_DESCRIPTION`. */
export const TOOL_GUIDE_LINK_IDS: Readonly<Record<string, ToolGuideLinkGroupIds>> = {
  range: {
    glossary: [
      'term-range',
      'term-hand-matrix',
      'term-suited',
      'term-offsuit',
      'term-open-raise',
      'term-position',
    ],
    articles: ['blog-why-use-range', 'blog-btn-why-wide'],
    quiz: 'practiceRange',
  },
  toolStartingHand: {
    glossary: ['term-pocket-pair', 'term-suited', 'term-offsuit', 'term-combo', 'term-hand-matrix'],
    articles: [
      'blog-aks-vs-ako',
      'blog-is-ak-good',
      'blog-why-suited-matters',
      'blog-small-pocket-pairs',
      'blog-why-72o-is-weak',
    ],
    quiz: 'practiceStartingHand',
  },
  toolEquity: {
    glossary: ['term-equity', 'term-showdown', 'term-split-pot', 'term-board'],
    // Stories whose own `relatedTools` names this calculator (WP-S3-16): the hero's and
    // villain's real cards are the pair a reader will type into it.
    articles: [
      'blog-qq-vs-ak',
      'blog-aks-vs-ako',
      'blog-qq-vs-72o-flop-227',
      'blog-aa-loses',
      'blog-ak-flop-miss',
    ],
    quiz: null,
  },
  toolPotOdds: {
    glossary: ['term-pot-odds', 'term-pot', 'term-call', 'term-bet'],
    // Both stories turn on a call priced against a draw and declare `toolPotOdds`.
    articles: [
      'blog-pot-odds-quick',
      'blog-river-changes-everything',
      'blog-qq-three-bet-frustration',
    ],
    quiz: null,
  },
  toolOuts: {
    glossary: ['term-outs', 'term-draw', 'term-flush', 'term-straight', 'term-turn', 'term-river'],
    // The one story that is about counting outs on the flop, and declares `toolOuts`.
    articles: ['blog-outs-nine', 'blog-river-changes-everything'],
    quiz: null,
  },
  toolHandChecker: {
    glossary: ['term-hand-ranking', 'term-kicker', 'term-split-pot', 'term-board', 'term-showdown'],
    articles: [
      'blog-what-is-kicker',
      'blog-playing-the-board',
      'blog-flush-vs-straight',
      'blog-full-house-vs-flush',
      // Showdowns the checker can replay — both stories declare `toolHandChecker`.
      'blog-full-house-loses',
      'blog-qq-vs-72o-flop-227',
    ],
    quiz: 'practiceHandRanking',
  },
};

export interface ToolGuideLink {
  readonly key: string;
  readonly href: string | null;
  readonly title: string;
  readonly meta: string | null;
}

export interface ToolGuideLinkGroup {
  readonly label: RelatedLabel;
  readonly links: readonly ToolGuideLink[];
}

function contentLink(id: ContentId): ToolGuideLink {
  const record = contentById(id);
  return {
    key: id,
    href: hrefOfContent(record),
    title: record.title,
    meta: record.kind === 'learn' ? contentMeta(record) : KIND_LABEL[record.kind],
  };
}

/**
 * The resolved groups for one tool, in reading order: lessons, glossary, articles, quiz.
 * Throws for a tool nobody mapped — a silently empty block is the "plausible stub" CLAUDE.md
 * rule 5 bans. A group with nothing to list is omitted rather than rendered empty.
 */
export function toolGuideLinkGroups(toolRouteId: string): readonly ToolGuideLinkGroup[] {
  const ids = TOOL_GUIDE_LINK_IDS[toolRouteId];
  if (ids === undefined) {
    throw new Error(`Tool route "${toolRouteId}" has no onward links in TOOL_GUIDE_LINK_IDS`);
  }
  const groups: ToolGuideLinkGroup[] = [
    { label: '더 배우기', links: toolLessonIds(toolRouteId).map(contentLink) },
    { label: '같이 알아둘 용어', links: ids.glossary.map(contentLink) },
    { label: '이런 이야기도 있어요', links: ids.articles.map(contentLink) },
  ];
  if (ids.quiz !== null) {
    const route = routeById(ids.quiz);
    groups.push({
      label: '직접 확인하기',
      links: [
        {
          key: route.id,
          href: route.available ? route.path : null,
          title: route.label,
          meta: '퀴즈',
        },
      ],
    });
  }
  return groups.filter((group) => group.links.length > 0);
}
