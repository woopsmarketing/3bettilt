/**
 * `SearchResultList` — already-scored results rendered as GROUPS (배우기 / 읽을거리 / 용어 /
 * 핸드 / 도구), each with a heading and a count, in the order `groupResults` decides
 * (Stage 3 contract BG).
 *
 * The flat ranked list this replaces protected one promise — "position 1 is always the
 * best match" — and grouping keeps it: `groupResults` orders the groups by their best hit,
 * so the group at the top holds the overall best result and its first row IS that result.
 * Inside a group the matcher's order is untouched. What grouping adds is the reader's
 * question the flat list could not answer at a glance: "is there a lesson about this, or
 * only a glossary line?" — the headings and counts say so before a single row is read.
 *
 * Each row: a type label is no longer needed per row (the heading carries it), so the row
 * spends its space on the title, the record's own one-line `description` (verbatim, never
 * generated) and, where the record has one, the thing a reader typed — a glossary `term`
 * or a hand key. `variants` (from `expandQuery`) drive a single `<mark>` per line so the
 * reader can see WHY the row matched: `쓰리벳` lights up `3-Bet` in a lesson title.
 *
 * Pure, controlled presentation — the caller owns the query and the matching.
 */
import {
  groupResults,
  highlightSegments,
  type SearchRecord,
  type SearchResult,
} from '../features/search/index.js';

export interface SearchResultListProps {
  readonly results: readonly SearchResult[];
  /** The expanded query spellings, for highlighting. Omit to highlight nothing. */
  readonly variants?: readonly string[];
  readonly className?: string;
}

function Highlighted({
  text,
  variants,
  markClassName,
}: {
  readonly text: string;
  readonly variants: readonly string[];
  readonly markClassName: string;
}) {
  if (variants.length === 0) return <>{text}</>;
  return (
    <>
      {/* Segments are positional slices of one string, so the position is the identity. */}
      {highlightSegments(text, variants).map((segment, index) =>
        segment.hit ? (
          <mark key={`${index}-hit`} className={markClassName}>
            {segment.text}
          </mark>
        ) : (
          <span key={`${index}-text`}>{segment.text}</span>
        ),
      )}
    </>
  );
}

/** The one extra fact a row shows beside its title: the spelling a reader searches by. */
function keyOf(record: SearchRecord): string | null {
  if (record.kind === 'glossary' && record.term !== undefined) return record.term;
  if (record.kind === 'hands' && record.handKey !== undefined) return record.handKey;
  return null;
}

const TITLE_MARK = 'rounded-sm bg-transparent text-brand-500';
const BODY_MARK = 'rounded-sm bg-brand-950 px-0.5 text-text-100';

export function SearchResultList({
  results,
  variants = [],
  className = '',
}: SearchResultListProps) {
  const groups = groupResults(results);
  if (groups.length === 0) return null;

  return (
    <div className={`space-y-10 ${className}`} data-search-results={results.length}>
      {groups.map((group) => {
        const headingId = `search-group-${group.kind}`;
        return (
          <section key={group.kind} aria-labelledby={headingId} data-search-group={group.kind}>
            <h2
              id={headingId}
              className="flex items-baseline gap-3 border-b border-line-500 pb-2 text-sm font-semibold tracking-[0.04em] text-text-100"
            >
              {group.label}
              <span className="tabular text-xs font-medium text-text-300">
                {`${group.results.length}개`}
              </span>
            </h2>
            <ol className="divide-y divide-line-500">
              {group.results.map(({ record }) => {
                const key = keyOf(record);
                return (
                  <li key={record.id}>
                    <a
                      href={record.href}
                      className="group -mx-3 flex items-start gap-4 rounded-md px-3 py-4 outline-none transition-colors hover:bg-panel-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="prose-ko block text-base font-semibold text-text-100 group-hover:text-brand-500">
                          <Highlighted
                            text={record.title}
                            variants={variants}
                            markClassName={TITLE_MARK}
                          />
                          {key !== null && key !== record.title ? (
                            <span className="ml-2 font-mono text-xs font-medium whitespace-nowrap text-text-300">
                              {key}
                            </span>
                          ) : null}
                        </span>
                        <span className="prose-ko mt-1 block text-sm leading-[1.7] text-text-300">
                          <Highlighted
                            text={record.description}
                            variants={variants}
                            markClassName={BODY_MARK}
                          />
                        </span>
                      </span>
                      <span
                        aria-hidden="true"
                        className="mt-1 shrink-0 text-text-300 group-hover:text-brand-500"
                      >
                        →
                      </span>
                    </a>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
