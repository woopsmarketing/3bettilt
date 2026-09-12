/**
 * Match highlighting for a result's title/description — the "if cheap" half of contract BG.
 *
 * Cheap means: no re-scoring, no tokeniser. For each variant `expandQuery` produced, the
 * text is scanned once for that spelling, case-insensitively and with any run of whitespace
 * allowed between its characters (so the variant `팟오즈` still lights up `팟 오즈` in a title,
 * the same tolerance `normalize.ts` gives the matcher). The FIRST hit found — earliest in
 * the text, longest variant on a tie — is the one highlighted; a second occurrence is not,
 * because one `<mark>` tells the reader why this row is here and three make it noise.
 *
 * Pure string → segments. The component decides what a `hit` segment looks like.
 */

export interface HighlightSegment {
  readonly text: string;
  /** `true` for the one segment that matched a query variant. */
  readonly hit: boolean;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/** A pattern for `variant` that ignores whitespace on both sides, like `compact` does. */
function patternOf(variant: string): RegExp | null {
  const chars = [...variant.normalize('NFC').replace(/\s+/gu, '')];
  if (chars.length === 0) return null;
  return new RegExp(chars.map(escapeRegExp).join('\\s*'), 'iu');
}

export function highlightSegments(
  text: string,
  variants: readonly string[],
): readonly HighlightSegment[] {
  if (text === '') return [];
  const normalizedText = text.normalize('NFC');

  let best: { readonly start: number; readonly end: number } | null = null;
  for (const variant of variants) {
    const pattern = patternOf(variant);
    if (pattern === null) continue;
    const match = pattern.exec(normalizedText);
    if (match === null) continue;
    const start = match.index;
    const end = start + match[0].length;
    if (best === null || start < best.start || (start === best.start && end > best.end)) {
      best = { start, end };
    }
  }

  if (best === null) return [{ text: normalizedText, hit: false }];
  const segments: HighlightSegment[] = [];
  if (best.start > 0) segments.push({ text: normalizedText.slice(0, best.start), hit: false });
  segments.push({ text: normalizedText.slice(best.start, best.end), hit: true });
  if (best.end < normalizedText.length) {
    segments.push({ text: normalizedText.slice(best.end), hit: false });
  }
  return segments;
}
