/**
 * The one element that puts a JSON-LD block on a page.
 *
 * Named `JsonLdScript.tsx` rather than `JsonLd.tsx` only because `jsonLd.ts` beside it
 * already holds the builders, and the two would collide on a case-insensitive filesystem.
 *
 * It lives beside the builders rather than in `src/components/` because it is not a piece
 * of the site's design system — it renders nothing a reader sees, has no props a designer
 * would set, and exists only so that ~40 pages do not each hand-write a `<script>` with
 * `dangerouslySetInnerHTML` and its escaping. `serializeJsonLd` owns the escaping; this
 * owns the element.
 *
 * `dangerouslySetInnerHTML` is required and is not a shortcut: React escapes `<` and `&`
 * inside a text child, which would corrupt the JSON a crawler parses. The safety property
 * comes from `serializeJsonLd`, which escapes `<` so the string cannot close the element.
 */
import { serializeJsonLd, type JsonLdObject } from './jsonLd.js';

export interface JsonLdProps {
  /** The page's blocks, in source order. `null` entries are dropped, so a caller can pass
   *  a builder that legitimately declined to emit anything (see `faqPageJsonLd`) without
   *  branching at the call site. */
  readonly blocks: readonly (JsonLdObject | null)[];
}

export function JsonLd({ blocks: input }: JsonLdProps) {
  const blocks = input.filter((block): block is JsonLdObject => block !== null);
  if (blocks.length === 0) return null;
  return (
    <>
      {blocks.map((block, index) => (
        <script
          // Stable within one page: the blocks are a fixed list per route, in source order.
          key={`${String(block['@type'])}-${String(index)}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(block) }}
        />
      ))}
    </>
  );
}
