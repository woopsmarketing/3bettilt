/**
 * The class-vs-class equity API the app layer calls — a lookup over the FROZEN matchups
 * `scripts/generate-class-vs-class-equity.ts` computed offline, never a live recomputation.
 *
 * `classVsClassEquity` (`./classVsClass.ts`) is expensive — tens of milliseconds per combo
 * pairing, tens to low hundreds of pairings per matchup — so nothing calls it from a page.
 * This module is the cheap O(1) read of what the generator already worked out.
 */
import { err, invariant, ok, type Result } from '@gto-self/shared';
import type { ClassVsClassEquity } from './classVsClass.js';
import { CLASS_VS_CLASS_SOURCE } from './classVsClassDataset.generated.js';
import type { ClassVsClassDatasetError, ClassVsClassDatasetMeta } from './classVsClassDataset.model.js';

export { CLASS_VS_CLASS_DATASET_ERRORS } from './classVsClassDataset.model.js';
export type { ClassVsClassDatasetError, ClassVsClassDatasetMeta } from './classVsClassDataset.model.js';

const { matchups: MATCHUPS, ...METADATA } = CLASS_VS_CLASS_SOURCE;

/** `'QQ|AKs'` — order matters, `classA` is always the first key. */
const matchupKey = (classAKey: string, classBKey: string): string => `${classAKey}|${classBKey}`;

/**
 * Every frozen matchup, keyed both ways it might be asked for: `(QQ, AKs)` returns class A =
 * QQ's own perspective, and `(AKs, QQ)` is served by swapping the stored entry's wins/losses
 * and A/B keys rather than by asking the generator to store the mirror image too — the mirror
 * is arithmetic, not a new fact, and computing it here keeps the generated file at exactly the
 * matchups it actually measured.
 */
const BY_KEY: ReadonlyMap<string, ClassVsClassEquity> = (() => {
  const map = new Map<string, ClassVsClassEquity>();
  for (const entry of MATCHUPS) {
    invariant(
      !map.has(matchupKey(entry.classAKey, entry.classBKey)),
      `class-vs-class dataset repeats matchup ${entry.classAKey} vs ${entry.classBKey}`,
    );
    map.set(matchupKey(entry.classAKey, entry.classBKey), entry);

    const mirrorKey = matchupKey(entry.classBKey, entry.classAKey);
    if (!map.has(mirrorKey)) {
      map.set(mirrorKey, {
        classAKey: entry.classBKey,
        classBKey: entry.classAKey,
        board: entry.board,
        pairingCount: entry.pairingCount,
        totalPairingsConsidered: entry.totalPairingsConsidered,
        skippedPairings: entry.skippedPairings,
        runoutsPerPairing: entry.runoutsPerPairing,
        runouts: entry.runouts,
        wins: entry.losses,
        ties: entry.ties,
        losses: entry.wins,
        winProb: entry.loseProb,
        tieProb: entry.tieProb,
        loseProb: entry.winProb,
        equity: 1 - entry.equity,
        classAWinBps: entry.classBWinBps,
        tieBps: entry.tieBps,
        classBWinBps: entry.classAWinBps,
        method: entry.method,
      });
    }
  }
  return map;
})();

/** Metadata about the frozen dataset — methodology, report link, generator version. */
export const CLASS_VS_CLASS_DATASET_META: ClassVsClassDatasetMeta = METADATA;

/** Every matchup the generator actually froze, in generation order (not including mirrors). */
export const CLASS_VS_CLASS_MATCHUPS: readonly ClassVsClassEquity[] = MATCHUPS;

/**
 * Result. The frozen equity of `classAKey` against `classBKey`, from class A's perspective.
 * Either order works — `('AKs', 'QQ')` returns AKs's own equity even though the generator only
 * froze `QQ vs AKs` — but only the frozen matchups (and their mirrors) are known; a pair the
 * content plan never cited returns `UNKNOWN_MATCHUP` rather than being computed on the spot
 * (see `./classVsClass.ts`'s header for why a live call does not belong on a request path).
 */
export function classVsClassMatchupFor(
  classAKey: string,
  classBKey: string,
): Result<ClassVsClassEquity, ClassVsClassDatasetError> {
  const found = BY_KEY.get(matchupKey(classAKey, classBKey));
  if (found === undefined) return err('UNKNOWN_MATCHUP');
  return ok(found);
}
