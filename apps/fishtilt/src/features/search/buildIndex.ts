/**
 * Turns live product data (the content graph + the route registry) into the flat
 * `SearchRecord[]` `match.ts` searches over. This is the ONLY module in this feature allowed
 * to look at a `ContentRecord`'s `status` or a `RouteEntry`'s `available` — everywhere else,
 * a `SearchRecord` already exists, which by construction means it is safe to link to.
 *
 * ## Why nothing unfinished can ever appear in the index
 *
 * A content record is included only if `hrefOfContent(record)` (`content/graph.ts`) returns
 * non-`null`. That function returns `null` for exactly one reason — `status !== 'PUBLISHED'`
 * — so a `PLANNED` record can never produce a `SearchRecord`. This is deliberately NOT
 * reimplemented as `record.status === 'PUBLISHED'` here: `hrefOfContent` is the graph's own
 * single source of truth for "may this be linked yet" (its module doc calls this "the same
 * gate `src/lib/routes.ts` applies to nav"), and calling it — rather than re-deriving the
 * same answer from `status` — means this file cannot drift from that gate even if a future
 * status value or a new kind of "published but unlinkable" record is ever added.
 *
 * A tool is included only if its `RouteEntry.available` is `true`, the exact same gate
 * `features/tools/hub.ts` applies before it lets a tool render as a link on `/tools`.
 *
 * ## The `indexable` decision
 *
 * `ContentRecord.indexable` is DELIBERATELY NOT consulted here. Every current consumer of
 * `indexable` (`src/app/{learn,blog,glossary,hands}/[slug]/page.tsx`) wires it straight to
 * Next's `robots: { index }` metadata — i.e. its one settled meaning in this codebase is
 * "should an external search engine crawl and rank this page", not "should 3BetTilt's own
 * search surface it". Those are different questions with different failure modes: a page
 * `indexable: false` marks is still `PUBLISHED` — the module doc for `ContentRecord.indexable`
 * says outright "a published page can be legitimately thin" — with a real MDX file, a real
 * URL, and a real row on `/learn`, `/blog`, `/glossary` or `/hands` (those hub pages list
 * every `PUBLISHED` record regardless of `indexable`). If this site's own search additionally
 * hid it, a visitor could find the page by clicking through its hub list but not by typing
 * its exact title into search — worse than either "always findable" or "not published yet",
 * and dishonest in a new way none of this feature's other rules already cover. So: `status`
 * (via `hrefOfContent`) gates this index; `indexable` does not.
 */
import { contentOfKind, hrefOfContent } from '../../content/graph.js';
import { CONTENT_KINDS, type AnyContentRecord } from '../../content/types.js';
import { ROUTES, type RouteEntry } from '../../lib/routes.js';
import { TOOL_DESCRIPTION } from '../tools/hub.js';
import type { SearchRecord } from './types.js';

/** The route id of the tools hub itself — never a search target of its own (it is not a
 *  tool, and `/tools` is already the honest "browse everything" page this feature's empty
 *  state links to). */
const TOOLS_HUB_ROUTE_ID = 'tools';

function searchRecordOfContent(record: AnyContentRecord): SearchRecord | null {
  const href = hrefOfContent(record);
  if (href === null) return null;

  const base = {
    id: record.id,
    kind: record.kind,
    title: record.title,
    description: record.description,
    href,
    concepts: record.concepts,
  };

  if (record.kind === 'glossary') {
    return {
      ...base,
      term: record.term,
      aliases: record.aliases,
      shortDefinition: record.shortDefinition,
    };
  }
  if (record.kind === 'hands') {
    return { ...base, handKey: record.handKey };
  }
  return base;
}

function searchRecordOfTool(
  route: RouteEntry,
  descriptions: Readonly<Record<string, string>>,
): SearchRecord | null {
  if (!route.available) return null;
  const description = descriptions[route.id];
  if (description === undefined) {
    // Mirrors `toolHubEntries`'s own discipline (`features/tools/hub.ts`): a tool route with
    // no description is a bug to surface loudly, not a blank search result (CLAUDE.md rule 5).
    throw new Error(`Tool route "${route.id}" has no description in TOOL_DESCRIPTION`);
  }
  return {
    id: `tool:${route.id}`,
    kind: 'tool',
    title: route.label,
    description,
    href: route.path,
    concepts: [],
  };
}

/**
 * Pure. Callers supply the content, the routes AND the tool-description map so this stays
 * testable against small fixtures (`buildIndex.test.ts`) without depending on the live
 * registry OR on `features/tools/hub.ts`'s real `TOOL_DESCRIPTION` — `SEARCH_INDEX` below is
 * the one call site that wires in all three real sources.
 */
export function buildSearchIndex(
  content: readonly AnyContentRecord[],
  routes: readonly RouteEntry[],
  toolDescriptions: Readonly<Record<string, string>> = TOOL_DESCRIPTION,
): readonly SearchRecord[] {
  const contentRecords = content
    .map(searchRecordOfContent)
    .filter((record): record is SearchRecord => record !== null);

  const toolRecords = routes
    .filter((route) => route.section === 'tools' && route.id !== TOOLS_HUB_ROUTE_ID)
    .map((route) => searchRecordOfTool(route, toolDescriptions))
    .filter((record): record is SearchRecord => record !== null);

  return [...contentRecords, ...toolRecords];
}

/** Every kind of content the registry has, gathered through `content/graph.ts`'s own
 *  `contentOfKind` — this feature's only source of content truth — rather than reaching into
 *  `content/registry/` directly. */
function allContent(): readonly AnyContentRecord[] {
  return CONTENT_KINDS.flatMap((kind) => contentOfKind(kind));
}

/** The live index the shipped page searches — built once, at module scope, from the real
 *  content graph and route registry. */
export const SEARCH_INDEX: readonly SearchRecord[] = buildSearchIndex(allContent(), ROUTES);
