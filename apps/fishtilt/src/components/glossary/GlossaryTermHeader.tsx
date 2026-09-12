/**
 * The head of a term page (contract AW): the category (a link back to that category's
 * section on the hub), the `<h1>` (the record's Korean-first `title`, which is also the
 * `<title>` and the breadcrumb), the NAMES line — headword first, then the Latin term and
 * every other alias, as "쓰리벳 · 3-Bet · 3벳 · 3bet" — and the one-line definition as the
 * lead. Then the optional mini visual.
 *
 * `data-glossary-headword` / `data-glossary-term` / `data-glossary-alias` /
 * `data-glossary-definition` mark the exact nodes so the `DefinedTerm` JSON-LD the page
 * emits is provably reading what is on screen, and so a search index can lift the names
 * out of the static HTML. They add nothing a screen reader announces.
 */
import type { ContentLevel } from '../../content/types.js';
import { LEVEL_LABEL } from '../../content/graph.js';

export interface GlossaryTermHeaderProps {
  readonly title: string;
  readonly headword: string;
  readonly term: string;
  readonly aliases: readonly string[];
  readonly shortDefinition: string;
  readonly level: ContentLevel;
  readonly category: { readonly label: string; readonly href: string };
  readonly visual?: React.ReactNode;
  readonly className?: string;
}

export function GlossaryTermHeader({
  title,
  headword,
  term,
  aliases,
  shortDefinition,
  level,
  category,
  visual,
  className = '',
}: GlossaryTermHeaderProps) {
  // The Latin term first, then the aliases — each once, the headword never repeated.
  const names: readonly { readonly name: string; readonly kind: 'term' | 'alias' }[] = [
    ...(term !== headword ? [{ name: term, kind: 'term' as const }] : []),
    ...aliases
      .filter((alias) => alias !== headword && alias !== term)
      .map((alias) => ({ name: alias, kind: 'alias' as const })),
  ];
  return (
    <header data-glossary="header" className={className}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="text-sm font-medium tracking-[0.06em] text-brand-500">용어</p>
        <a
          href={category.href}
          data-glossary="category"
          className="inline-flex items-center rounded-full border border-line-500 px-2.5 py-0.5 text-xs font-medium text-text-100 outline-none hover:border-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {category.label}
        </a>
        <span className="text-xs text-text-300">{LEVEL_LABEL[level]}</span>
      </div>

      <h1 className="mt-4 prose-ko text-article-h1 font-semibold tracking-[-0.01em] break-keep wrap-anywhere text-text-100">
        {title}
      </h1>

      <p
        className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-base"
        data-glossary="names"
      >
        <span className="font-semibold text-text-100" data-glossary-headword={headword}>
          {headword}
        </span>
        {names.map(({ name, kind }) => (
          <span key={name} className="inline-flex items-baseline text-text-300">
            <span aria-hidden="true" className="mr-2 text-text-500">
              ·
            </span>
            {kind === 'term' ? (
              <span data-glossary-term={name}>{name}</span>
            ) : (
              <span data-glossary-alias={name}>{name}</span>
            )}
          </span>
        ))}
      </p>

      <p
        className="mt-5 max-w-lead prose-ko text-lg leading-[1.7] text-text-100"
        data-glossary-definition
      >
        {shortDefinition}
      </p>

      {visual !== undefined ? <div className="mt-6">{visual}</div> : null}
    </header>
  );
}
