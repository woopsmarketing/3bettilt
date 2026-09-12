/**
 * `ArticleMeta` — the meta row under an article title: level · read time · category, and
 * when the piece needs one, a visible disclosure (D-S3-13).
 *
 * ## What it says and what it never hides
 *
 * The content audit found the existing meta line (`contentMeta(record)` → "입문 · 약 4분")
 * PARTIAL: no author, no date, no disclosure. All three are optional here because most of
 * the site's pieces have none — the site has no bylines today and a lesson does not carry a
 * date — but `disclosure` has one hard rule: when it is given it is RENDERED, as a badge
 * plus a full sentence, in the meta row itself. A fictional hand story (prompt §AL) says so
 * where the title is, not in a footnote a reader has to find. Nothing here is `sr-only`.
 *
 * ## Labels are the graph's
 *
 * `level` is the record's own `ContentLevel` and is rendered through `LEVEL_LABEL`, the
 * same table `contentMeta` uses, so a card on `/blog` and the head of the article it opens
 * cannot call the same level two different things. `readMinutes` is the record's measured
 * value, formatted the way `contentMeta` formats it. Dates are `YYYY-MM-DD` strings and are
 * rendered as `<time dateTime>` with a Korean reading — no `Intl`, so the server, the test
 * and the browser produce the same characters.
 */
import { LEVEL_LABEL } from '../content/graph.js';
import type { ContentLevel } from '../content/types.js';

export interface ArticleDisclosure {
  /** The short badge: "가상의 핸드", "학습용 예시". */
  readonly badge: string;
  /** The full sentence beside it. Always visible. */
  readonly sentence: string;
}

export interface ArticleMetaProps {
  readonly level?: ContentLevel;
  readonly readMinutes?: number | null;
  readonly category?: string;
  readonly author?: string;
  /** `YYYY-MM-DD`. */
  readonly date?: string;
  /** `YYYY-MM-DD`, shown as "업데이트" when it differs from `date`. */
  readonly updated?: string;
  /** Extra items appended verbatim. */
  readonly items?: readonly string[];
  readonly disclosure?: ArticleDisclosure;
  readonly className?: string;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/u;

/** `2026-09-09` → `2026년 9월 9일`. Anything else is returned as given rather than guessed. */
export function koreanDate(iso: string): string {
  const match = ISO_DATE.exec(iso);
  if (match === null) return iso;
  const [, year, month, day] = match;
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}

export function ArticleMeta({
  level,
  readMinutes,
  category,
  author,
  date,
  updated,
  items = [],
  disclosure,
  className = '',
}: ArticleMetaProps) {
  const parts: React.ReactNode[] = [];
  if (category !== undefined) parts.push(category);
  if (level !== undefined) parts.push(LEVEL_LABEL[level]);
  if (readMinutes !== undefined && readMinutes !== null) parts.push(`약 ${readMinutes}분`);
  if (author !== undefined) parts.push(author);
  if (date !== undefined) {
    parts.push(<time dateTime={date}>{koreanDate(date)}</time>);
  }
  if (updated !== undefined && updated !== date) {
    parts.push(
      <>
        업데이트 <time dateTime={updated}>{koreanDate(updated)}</time>
      </>,
    );
  }
  parts.push(...items);

  if (parts.length === 0 && disclosure === undefined) return null;

  return (
    <div className={className}>
      {parts.length > 0 ? (
        <ul className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-300">
          {parts.map((part, index) => (
            // Index keys are safe here: the list is static per render and never reordered.
            <li key={index} className="flex items-center gap-x-2">
              {index > 0 ? (
                <span aria-hidden="true" className="text-text-500">
                  ·
                </span>
              ) : null}
              <span>{part}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {disclosure !== undefined ? (
        <p className="mt-3 flex flex-wrap items-start gap-x-2 gap-y-1 prose-ko text-sm text-text-300">
          <span className="inline-flex shrink-0 items-center rounded-sm border border-line-500 bg-panel-600 px-2 py-0.5 text-xs font-medium text-text-100">
            {disclosure.badge}
          </span>
          <span>{disclosure.sentence}</span>
        </p>
      ) : null}
    </div>
  );
}
