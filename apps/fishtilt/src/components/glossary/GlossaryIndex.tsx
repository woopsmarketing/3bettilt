/**
 * The dictionary itself (contract AV): every term as one dense row, filed under its ㄱ ㄴ ㄷ
 * tab. Not cards — a two-column index line: the headword with its Latin names on the left,
 * the one-line definition on the right, a hairline between rows.
 *
 * Every row is exactly one of: a link (published) or inert text with a 준비 중 badge
 * (planned) — the honesty gate every hub on the site applies. The `data-*` attributes are
 * what `GlossarySearch` filters on; they are plain attributes, never announced.
 */
import type { GlossaryHubEntry, InitialGroup } from './hubModel.js';

export interface GlossaryIndexProps {
  readonly groups: readonly InitialGroup[];
  readonly className?: string;
}

const LINK =
  'inline-block py-3 -my-3 font-semibold text-text-100 outline-none hover:text-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

const BADGE =
  'inline-block rounded-full border border-line-500 px-1.5 py-0.5 align-middle text-[10px] font-medium text-text-300';

export function GlossaryRow({ entry }: { readonly entry: GlossaryHubEntry }) {
  const { record, href, headword, latinNames } = entry;
  return (
    <li
      data-glossary-row
      data-slug={record.slug}
      data-search={entry.searchKey}
      className="grid gap-x-6 gap-y-1 py-3 sm:grid-cols-[minmax(11rem,2fr)_5fr]"
    >
      <p className="min-w-0 prose-ko">
        {href === null ? (
          <span className="font-semibold text-text-100">
            {headword} <span className={BADGE}>준비 중</span>
          </span>
        ) : (
          <a href={href} className={LINK}>
            {headword}
          </a>
        )}
        {latinNames.length > 0 ? (
          <span className="ml-2 text-sm text-text-300" data-glossary-names>
            {latinNames.join(' · ')}
          </span>
        ) : null}
      </p>
      <p className="min-w-0 prose-ko text-[0.9375rem] text-text-300">{record.shortDefinition}</p>
    </li>
  );
}

export function GlossaryIndex({ groups, className = '' }: GlossaryIndexProps) {
  return (
    <div data-glossary="index" className={className}>
      {groups
        .filter((group) => group.entries.length > 0)
        .map(({ initial, anchor, entries }) => {
          const headingId = `${anchor}-heading`;
          return (
            <section
              key={initial}
              id={anchor}
              data-glossary-group
              aria-labelledby={headingId}
              className="grid scroll-mt-24 gap-x-8 border-t border-line-500 py-6 lg:grid-cols-12"
            >
              <h3 id={headingId} className="text-xl font-semibold text-brand-500 lg:col-span-1">
                {initial}
              </h3>
              <ol className="mt-2 divide-y divide-line-500 lg:col-span-11 lg:mt-0">
                {entries.map((entry) => (
                  <GlossaryRow key={entry.record.id} entry={entry} />
                ))}
              </ol>
            </section>
          );
        })}
    </div>
  );
}
