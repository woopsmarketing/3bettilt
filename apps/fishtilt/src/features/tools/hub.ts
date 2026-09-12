/**
 * `/tools`'s content model — which tools the hub lists and what each one is for.
 *
 * The LIST comes from `src/lib/routes.ts`, never from a second array kept in this file: a
 * tool that exists is a route that exists, and the registry's own test already proves
 * `available` matches the filesystem in both directions. All this module adds is the one
 * sentence a hub card needs, which a route registry has no business carrying.
 *
 * A description is required for every tool, and `hub.test.ts` fails if one is missing —
 * so adding a seventh tool route cannot silently produce a blank card. The map is keyed by
 * route id rather than path for the same reason `ToolCTA` takes an id: a rename of
 * `/tools/outs` must not be able to orphan its description.
 *
 * The hub itself is excluded from its own list, and so is nothing else: a planned tool is
 * shown, unlinked, with a "준비 중" badge, exactly as `/learn` shows unwritten lessons. A
 * visitor deciding whether this site is worth returning to needs to see what is coming;
 * hiding two-thirds of the plan would make the site look smaller than it is, and linking it
 * would 404.
 */
import { ROUTES, type RouteEntry } from '../../lib/routes.js';

/** The registry id of the hub page itself, which never appears in its own list. */
const HUB_ROUTE_ID = 'tools';

/** One line per tool: what a beginner would get out of opening it. No numbers, no claims. */
export const TOOL_DESCRIPTION: Readonly<Record<string, string>> = {
  range: '포지션별로 어떤 시작 패를 쓰는지 13×13 표에서 눌러보고 두 자리를 비교합니다.',
  toolStartingHand: '내 시작 패가 전체에서 어느 정도 위치인지 찾아봅니다.',
  toolEquity: '내 패와 상대 패가 맞붙었을 때의 승률을 계산합니다.',
  toolPotOdds: '콜하려면 몇 퍼센트를 이겨야 본전인지, 계산 과정과 함께 보여줍니다.',
  toolHandChecker: '일곱 장 중 가장 좋은 다섯 장이 무엇인지 확인합니다.',
  toolOuts: '드로우가 완성될 확률을 정확히 계산하고, ×2 / ×4 암산 규칙과 비교합니다.',
};

/**
 * The QUESTION each tool answers — the reason a reader opens it, in their own words (Stage 3
 * keyword map, "핵심 질문" column). The hub leads with this, not with the tool's name: a
 * visitor who does not yet know what "에퀴티" means still knows they want to know who is
 * ahead. One per tool, required like `TOOL_DESCRIPTION`, no numbers, no claims.
 */
export const TOOL_QUESTION: Readonly<Record<string, string>> = {
  range: '자리별로 어떤 시작 패로 레이즈하는지 표로 보고 싶다',
  toolStartingHand: '내 시작 패가 전체에서 몇 번째로 강한지 알고 싶다',
  toolEquity: '이 두 패가 맞붙으면 승률이 얼마지?',
  toolPotOdds: '이 베팅에 콜하려면 몇 %는 이겨야 하지?',
  toolHandChecker: '지금 내 패가 무슨 족보지?',
  toolOuts: '내 드로우가 완성될 확률은?',
};

/**
 * The tool the hub leads with. The flagship: the one the header's own nav names, the one the
 * home page's primary control opens, and the one every lesson's `relatedTools` most often
 * points at (51 of the content records — Stage 3 keyword map §B-5).
 */
export const FEATURED_TOOL_ID = 'range';

/**
 * How the hub groups the tools UNDER the featured one, so six identical cards become one
 * featured block and two short lists with a heading each: the calculators (a number in, a
 * number out) and the lookups (a table you read). Every shipped tool must be in exactly one
 * group or the featured slot — `hub.test.ts` checks the partition.
 */
export const TOOL_HUB_GROUPS: readonly {
  readonly title: string;
  readonly ids: readonly string[];
}[] = [
  { title: '계산기', ids: ['toolEquity', 'toolPotOdds', 'toolOuts'] },
  { title: '표와 판정', ids: ['toolStartingHand', 'toolHandChecker'] },
];

export interface ToolHubEntry {
  readonly route: RouteEntry;
  readonly description: string;
  /** The question the tool answers, from `TOOL_QUESTION`. */
  readonly question: string;
}

/**
 * Every tool the site plans to have, in registry order, each with its description. Throws
 * for a tool route that has no description rather than rendering an empty card
 * (CLAUDE.md rule 5).
 */
export function toolHubEntries(): readonly ToolHubEntry[] {
  return ROUTES.filter((route) => route.section === 'tools' && route.id !== HUB_ROUTE_ID).map(
    (route) => {
      const description = TOOL_DESCRIPTION[route.id];
      if (description === undefined) {
        throw new Error(`Tool route "${route.id}" has no description in TOOL_DESCRIPTION`);
      }
      const question = TOOL_QUESTION[route.id];
      if (question === undefined) {
        throw new Error(`Tool route "${route.id}" has no question in TOOL_QUESTION`);
      }
      return { route, description, question };
    },
  );
}
