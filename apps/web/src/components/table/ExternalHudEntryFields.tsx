'use client';

/**
 * The ten `EXTERNAL_HUD` numbers, as a form.
 *
 * ONE component, used by both places WP-2/WP-3 lets the user type them: the seat's player
 * swap (a brand-new opponent, typed at the table) and the profile panel's quick fix. A second
 * copy of this form would be a second answer to "what is a blank field", which is exactly the
 * question ADR-0076 settles:
 *
 * **A BLANK IS AN ABSENT ROW, NEVER A ZERO.** `externalHudEntryStats` drops every blank rather
 * than sending `""` or `"0"`, and `EXTERNAL_HUD_EMPTY_MEANS_UNKNOWN_HINT` says so ON the form
 * rather than leaving the user to discover it. "We have never seen this stat" and "this player
 * never does this" are opposite claims about a person and must not be confused.
 *
 * The entered text travels verbatim (`CLAUDE.md` rule 3): nothing here parses a percentage and
 * sends the number back. `player-core`'s own validating constructor is the authority, on the
 * server, on the untrusted input.
 */
import { EXTERNAL_HUD_STAT_KEYS } from '@gto-self/player-core';
import type { ExternalHudStatKey } from '@gto-self/player-core';
import type { ExternalHudEntryStats } from '../../lib/table/contract.js';
import {
  EXTERNAL_HUD_EMPTY_MEANS_UNKNOWN_HINT,
  EXTERNAL_HUD_GLOSSARY,
  EXTERNAL_HUD_STAT_LABEL,
} from '../../lib/table/copy.js';

/** What the form holds while it is being typed: every key, possibly blank. */
export type ExternalHudFormText = Readonly<Partial<Record<ExternalHudStatKey, string>>>;

/**
 * Total, pure. The form's text as the wire shape — trimmed, and with every blank field
 * OMITTED. It is the one place a blank becomes an absence, so there is one place to read to
 * know that a blank never becomes a `0`.
 */
export function externalHudEntryStats(text: ExternalHudFormText): ExternalHudEntryStats {
  const stats: Partial<Record<ExternalHudStatKey, string>> = {};
  for (const key of EXTERNAL_HUD_STAT_KEYS) {
    const trimmed = (text[key] ?? '').trim();
    if (trimmed === '') continue;
    stats[key] = trimmed;
  }
  return stats;
}

export interface ExternalHudEntryFieldsProps {
  /** Prefixes every field's `data-testid`, so two of these forms can be on screen at once. */
  readonly idPrefix: string;
  readonly values: ExternalHudFormText;
  readonly onChange: (key: ExternalHudStatKey, text: string) => void;
  readonly disabled?: boolean;
}

export function ExternalHudEntryFields({
  idPrefix,
  values,
  onChange,
  disabled = false,
}: ExternalHudEntryFieldsProps) {
  return (
    <div className="flex flex-col gap-1">
      {EXTERNAL_HUD_STAT_KEYS.map((key) => (
        <label
          key={key}
          className="flex items-baseline justify-between gap-2 text-xs"
          title={EXTERNAL_HUD_GLOSSARY[key]}
        >
          <span className="text-ink-500">{EXTERNAL_HUD_STAT_LABEL[key]}</span>
          <input
            type="text"
            inputMode="decimal"
            data-testid={`${idPrefix}-${key}`}
            value={values[key] ?? ''}
            disabled={disabled}
            onChange={(event) => onChange(key, event.target.value)}
            className="tabular w-20 rounded border border-surface-600 bg-surface-800 px-1 text-right text-ink-100 disabled:opacity-50"
          />
        </label>
      ))}
      <p data-testid={`${idPrefix}-unknown-hint`} className="text-[0.6rem] leading-snug text-ink-700">
        {EXTERNAL_HUD_EMPTY_MEANS_UNKNOWN_HINT}
      </p>
    </div>
  );
}
