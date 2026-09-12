/**
 * Korean dictionary ordering for the glossary hub (WP-S3-11, contract AV).
 *
 * A Korean dictionary is browsed by the INITIAL CONSONANT (초성) of the headword — ㄱ ㄴ ㄷ …
 * ㅎ — with Latin-initial entries (VPIP, PFR) in a trailing A–Z group. This module turns a
 * headword into that group and orders the groups; `localeCompare(…, 'ko')` orders entries
 * INSIDE a group, exactly as the old flat list was ordered.
 *
 * Doubled consonants fold into their base letter (ㄲ→ㄱ, ㄸ→ㄷ, ㅃ→ㅂ, ㅆ→ㅅ, ㅉ→ㅈ), which is
 * how a printed 국어사전 files them: "쓰리벳" sits under ㅅ, not under a separate ㅆ tab.
 *
 * Nothing here is a poker fact — it is Unicode arithmetic on the Hangul syllable block.
 */

/** The 14 dictionary tabs plus the Latin group, in the order the hub renders them. */
export const GLOSSARY_INITIALS = [
  'ㄱ',
  'ㄴ',
  'ㄷ',
  'ㄹ',
  'ㅁ',
  'ㅂ',
  'ㅅ',
  'ㅇ',
  'ㅈ',
  'ㅊ',
  'ㅋ',
  'ㅌ',
  'ㅍ',
  'ㅎ',
  'A–Z',
] as const;

export type GlossaryInitial = (typeof GLOSSARY_INITIALS)[number];

/** The 19 choseong of the Hangul syllable block, in code-point order, folded to the 14 tabs. */
const CHOSEONG: readonly GlossaryInitial[] = [
  'ㄱ', // ㄱ
  'ㄱ', // ㄲ
  'ㄴ',
  'ㄷ', // ㄷ
  'ㄷ', // ㄸ
  'ㄹ',
  'ㅁ',
  'ㅂ', // ㅂ
  'ㅂ', // ㅃ
  'ㅅ', // ㅅ
  'ㅅ', // ㅆ
  'ㅇ',
  'ㅈ', // ㅈ
  'ㅈ', // ㅉ
  'ㅊ',
  'ㅋ',
  'ㅌ',
  'ㅍ',
  'ㅎ',
];

const HANGUL_SYLLABLE_FIRST = 0xac00;
const HANGUL_SYLLABLE_LAST = 0xd7a3;
/** 21 medial vowels × 28 final consonants — one choseong spans this many code points. */
const SYLLABLES_PER_CHOSEONG = 21 * 28;

/** DOM-safe id fragment per group, for the hub's anchors (`#initial-g` etc.). */
export const INITIAL_ANCHOR: Readonly<Record<GlossaryInitial, string>> = {
  ㄱ: 'g',
  ㄴ: 'n',
  ㄷ: 'd',
  ㄹ: 'r',
  ㅁ: 'm',
  ㅂ: 'b',
  ㅅ: 's',
  ㅇ: 'ng',
  ㅈ: 'j',
  ㅊ: 'ch',
  ㅋ: 'k',
  ㅌ: 't',
  ㅍ: 'p',
  ㅎ: 'h',
  'A–Z': 'latin',
};

/**
 * The dictionary tab a headword files under. The first character decides: a Hangul syllable
 * → its (folded) initial consonant; anything else (Latin, digits, symbols) → the A–Z group.
 * A leading digit ("3벳") would file under A–Z too, which is why `categories.ts` picks the
 * Hangul spelling as the headword for such terms.
 */
export function initialOf(headword: string): GlossaryInitial {
  const code = headword.codePointAt(0);
  if (code === undefined) return 'A–Z';
  if (code < HANGUL_SYLLABLE_FIRST || code > HANGUL_SYLLABLE_LAST) return 'A–Z';
  const index = Math.floor((code - HANGUL_SYLLABLE_FIRST) / SYLLABLES_PER_CHOSEONG);
  const initial = CHOSEONG[index];
  if (initial === undefined) throw new Error(`no choseong at index ${index} for "${headword}"`);
  return initial;
}

/** Position of a tab in `GLOSSARY_INITIALS` — the outer sort key of the index. */
export function initialRank(initial: GlossaryInitial): number {
  return GLOSSARY_INITIALS.indexOf(initial);
}

/** Korean collation for headwords inside one tab. Display order only — not a poker fact. */
export function compareHeadwords(a: string, b: string): number {
  return a.localeCompare(b, 'ko');
}
