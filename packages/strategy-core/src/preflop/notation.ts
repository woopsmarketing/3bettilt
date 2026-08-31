/**
 * 13x13 hand-class range notation — the text form every public preflop chart is published
 * in, parsed into the 169-class machinery of `../range/handClass.ts`.
 *
 * This lives under `src/preflop/` and NOT under `src/range/` on purpose: it is a notation
 * for TABLE AUTHORING, not a range operation. Nothing in it knows a strategy number; it only
 * turns `"66+,A3s+,KJo+"` into the set of hand classes that text denotes, so the anchor
 * doc's published lists can be transcribed VERBATIM into `tables.ts` and audited by eye
 * against the source.
 *
 * TOKEN GRAMMAR (comma-separated, all whitespace ignored, case-insensitive on the rank
 * letters but suit markers must be lower-case `s`/`o` as every chart prints them):
 *
 *   `AA`      a single pocket pair
 *   `AKs`     a single suited class            `AKo`  a single offsuit class
 *   `66+`     pairs from 66 up to AA
 *   `A3s+`    A3s..AKs — same high card, kicker walking UP to one below the high card
 *   `KJo+`    KJo..KQo
 *   `A5s-A2s` an explicit DOWNWARD run between two classes of the same shape and high card
 *   `TT-88`   pairs from TT down to 88
 *
 * Nothing else parses. A malformed token THROWS (`invariant`) rather than returning a
 * `Result`: every caller is a constant table inside this package, so a bad token is a
 * programmer error, not user input — the same rule `../range/combo.ts` follows.
 */
import { invariant, RANKS_DESC, type Rank } from '@gto-self/shared';
import { BPS_FULL, type Bps } from '../bps.js';
import { COMBO_COUNT, type ComboIndex } from '../range/combo.js';
import {
  handClassByKey,
  handClassIndexOfCombo,
  RANK_GRID_SIZE,
  type HandClass,
  type HandClassIndex,
} from '../range/handClass.js';
import { rangeFrom, type RangeWeights } from '../range/weights.js';

/** A set of the 169 classes. Membership is the only question tables ever ask of it. */
export interface HandClassSet {
  readonly kind: 'HandClassSet';
  /** Length 169, indexed by `HandClassIndex`. 1 = member. */
  readonly members: Uint8Array;
  /** The source text this set was parsed from, kept for auditability against the anchor. */
  readonly notation: string;
}

const HAND_CLASS_COUNT = RANK_GRID_SIZE * RANK_GRID_SIZE;

/** Descending-rank index: A = 0 ... 2 = 12. */
function descIndexOf(letter: string): number {
  const index = RANKS_DESC.indexOf(letter as Rank);
  invariant(index >= 0, `unknown rank letter "${letter}"`);
  return index;
}

function rankAtDesc(index: number): Rank {
  const rank = RANKS_DESC[index];
  invariant(rank !== undefined, `rank index out of range: ${index}`);
  return rank;
}

function classByKey(key: string): HandClass {
  const found = handClassByKey(key);
  invariant(found !== undefined, `"${key}" is not one of the 169 hand classes`);
  return found;
}

interface ParsedAtom {
  readonly kind: 'PAIR' | 'SUITED' | 'OFFSUIT';
  /** Descending-rank index of the higher card (0 = A). For a pair, both cards. */
  readonly high: number;
  /** Descending-rank index of the lower card. For a pair, equal to `high`. */
  readonly low: number;
}

/** Parses one bare class such as `AA`, `A3s`, `KJo`. Throws on anything else. */
function parseAtom(token: string): ParsedAtom {
  if (token.length === 2) {
    const a = descIndexOf(token[0] ?? '');
    const b = descIndexOf(token[1] ?? '');
    invariant(a === b, `"${token}" has no suit marker but is not a pair`);
    return { kind: 'PAIR', high: a, low: b };
  }
  invariant(token.length === 3, `"${token}" is not a hand class`);
  const suffix = token[2];
  invariant(suffix === 's' || suffix === 'o', `"${token}" must end in s or o`);
  const a = descIndexOf(token[0] ?? '');
  const b = descIndexOf(token[1] ?? '');
  invariant(a !== b, `"${token}" is a pair and cannot be suited or offsuit`);
  const high = Math.min(a, b);
  const low = Math.max(a, b);
  return { kind: suffix === 's' ? 'SUITED' : 'OFFSUIT', high, low };
}

function keyOf(atom: ParsedAtom, low: number): string {
  const highRank = rankAtDesc(atom.high);
  const lowRank = rankAtDesc(low);
  if (atom.kind === 'PAIR') return `${highRank}${lowRank}`;
  return `${highRank}${lowRank}${atom.kind === 'SUITED' ? 's' : 'o'}`;
}

/**
 * `66+` / `A3s+`: everything from the named class UP to the top of its run. Emitted in the
 * order it is walked — the NAMED class first, then upward — so `QQ+` reads `QQ, KK, AA`.
 * Order is irrelevant to membership; it is fixed only so the parser is deterministic.
 */
function expandPlus(atom: ParsedAtom): readonly HandClass[] {
  const out: HandClass[] = [];
  if (atom.kind === 'PAIR') {
    for (let i = atom.high; i >= 0; i -= 1)
      out.push(classByKey(`${rankAtDesc(i)}${rankAtDesc(i)}`));
    return out;
  }
  // Kickers walk up to (but never reach) the high card.
  for (let low = atom.low; low > atom.high; low -= 1) out.push(classByKey(keyOf(atom, low)));
  return out;
}

/** `A5s-A2s` / `TT-88`: an explicit run between two classes of the same shape. */
function expandDash(from: ParsedAtom, to: ParsedAtom): readonly HandClass[] {
  invariant(from.kind === to.kind, 'a dashed run must keep the same shape on both sides');
  const out: HandClass[] = [];
  if (from.kind === 'PAIR') {
    invariant(from.high <= to.high, 'a dashed pair run must be written strongest-first');
    for (let i = from.high; i <= to.high; i += 1) {
      out.push(classByKey(`${rankAtDesc(i)}${rankAtDesc(i)}`));
    }
    return out;
  }
  invariant(from.high === to.high, 'a dashed run must keep the same high card');
  invariant(from.low <= to.low, 'a dashed run must be written strongest-first');
  for (let low = from.low; low <= to.low; low += 1) out.push(classByKey(keyOf(from, low)));
  return out;
}

/**
 * Throws on a malformed token. Parses chart notation into the classes it denotes.
 *
 * Duplicates across tokens are harmless — membership is a set.
 */
export function parseHandClasses(notation: string): readonly HandClass[] {
  const out: HandClass[] = [];
  for (const raw of notation.split(',')) {
    const token = raw.replace(/\s+/g, '');
    if (token.length === 0) continue;
    const dash = token.indexOf('-');
    if (dash > 0) {
      const left = token.slice(0, dash);
      const right = token.slice(dash + 1);
      out.push(...expandDash(parseAtom(left), parseAtom(right)));
      continue;
    }
    if (token.endsWith('+')) {
      out.push(...expandPlus(parseAtom(token.slice(0, -1))));
      continue;
    }
    const atom = parseAtom(token);
    out.push(classByKey(keyOf(atom, atom.low)));
  }
  return out;
}

/** Throws on a malformed token. The membership set for a notation string. */
export function handClassSet(notation: string): HandClassSet {
  const members = new Uint8Array(HAND_CLASS_COUNT);
  for (const handClass of parseHandClasses(notation)) members[handClass.index] = 1;
  return { kind: 'HandClassSet', members, notation };
}

/** Total. Union of several sets. `notation` becomes the joined source text. */
export function unionHandClassSets(sets: readonly HandClassSet[]): HandClassSet {
  const members = new Uint8Array(HAND_CLASS_COUNT);
  for (const set of sets) {
    for (let i = 0; i < HAND_CLASS_COUNT; i += 1) if (set.members[i] === 1) members[i] = 1;
  }
  return { kind: 'HandClassSet', members, notation: sets.map((s) => s.notation).join(',') };
}

/** Total. `a` minus `b`. `notation` records the subtraction so the audit trail survives. */
export function differenceHandClassSets(a: HandClassSet, b: HandClassSet): HandClassSet {
  const members = new Uint8Array(HAND_CLASS_COUNT);
  for (let i = 0; i < HAND_CLASS_COUNT; i += 1) {
    if (a.members[i] === 1 && b.members[i] !== 1) members[i] = 1;
  }
  return { kind: 'HandClassSet', members, notation: `(${a.notation}) minus (${b.notation})` };
}

/** Total. Membership. */
export function hasHandClass(set: HandClassSet, index: HandClassIndex): boolean {
  return set.members[index] === 1;
}

/** Total. Every class in the set, ascending by matrix index. */
export function handClassesOf(set: HandClassSet): readonly HandClassIndex[] {
  const out: HandClassIndex[] = [];
  for (let i = 0; i < HAND_CLASS_COUNT; i += 1)
    if (set.members[i] === 1) out.push(i as HandClassIndex);
  return out;
}

/** Total. How many of the 1326 concrete combos the set covers (6 / 4 / 12 per class). */
export function comboCountOf(set: HandClassSet): number {
  let total = 0;
  for (const index of handClassesOf(set)) {
    const handClass = classByIndex(index);
    total += handClass.comboCount;
  }
  return total;
}

function classByIndex(index: HandClassIndex): HandClass {
  const row = Math.floor(index / RANK_GRID_SIZE);
  const col = index % RANK_GRID_SIZE;
  const high = rankAtDesc(Math.min(row, col));
  const low = rankAtDesc(Math.max(row, col));
  if (row === col) return classByKey(`${high}${low}`);
  return classByKey(`${high}${low}${row < col ? 's' : 'o'}`);
}

/**
 * Total. The set's share of the 1326-combo universe, 0..1 — a ratio, never money. This is
 * the number that gets checked against the anchor doc's published percentage bands.
 */
export function percentageOf(set: HandClassSet): number {
  return comboCountOf(set) / COMBO_COUNT;
}

/**
 * Total. The set expanded to a concrete `RangeWeights`: every combo of a member class at
 * `weight`, everything else at 0.
 */
export function rangeOf(set: HandClassSet, weight: Bps = BPS_FULL): RangeWeights {
  return rangeFrom((combo: ComboIndex) =>
    set.members[handClassIndexOfCombo(combo)] === 1 ? weight : 0,
  );
}
