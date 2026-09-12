/**
 * OFFLINE GENERATOR for `src/equity/classVsClassDataset.generated.ts`.
 *
 *     pnpm --filter @gto-self/learn-core generate:classVsClass
 *
 * Not part of the app, not part of `pnpm test`, and not imported by anything. It runs when
 * somebody wants the frozen class-vs-class matchups rebuilt, prints what it is doing, and
 * overwrites the one generated file.
 *
 * ## Which matchups, and why only these
 *
 * `docs/FISHTILT_CONTENT_PLAN.md` §2.2 row 5 (`blog-qq-vs-ak`) and §4's "Article #5 special
 * rule" are the only places in the content plan that cite a class-vs-class comparison, and
 * they ask for BOTH the suited and offsuit AK case ("Show both a suited and an offsuit AK
 * case; they differ."). That is exactly two matchups: `QQ vs AKs` and `QQ vs AKo`. Nothing
 * else in the plan needs one (`docs/FISHTILT_STATE.md` ruling 14). Generating all 169x169
 * class pairs speculatively would be scope expansion (CLAUDE.md rule 8) and, at the measured
 * per-pairing cost below, would take days — see `docs/reports/WP_G3_DOMAIN_FACTS.md` §7 for
 * the arithmetic.
 *
 * ## Cost and why this stays single-threaded
 *
 * QQ has 6 combos; AKs has 4, AKo has 12; no combo of QQ ever shares a card with a combo of
 * AK, so every raw pairing is legal: 6*4 = 24 pairings for `QQ vs AKs`, 6*12 = 72 for
 * `QQ vs AKo`, 96 total — matching `docs/FISHTILT_STATE.md` ruling 14's estimate. Each
 * pairing is a full preflop enumeration, `C(48,5) = 1,712,304` runouts. Measured on this
 * machine (see the report for the raw numbers): tens of seconds total for both matchups
 * combined, nowhere near the ~20 minutes of wall clock `generate-hand-strength.ts` needed for
 * 169 classes x 2.1M boards each, so the worker-thread pool that script uses is not needed
 * here — a single synchronous pass finishes in well under a minute.
 *
 * ## Determinism
 *
 * `classVsClassEquity` has no RNG, no seed and no sampling anywhere on this path — every
 * runout of every legal pairing is walked. Re-running this script on the same source produces
 * a byte-identical file apart from `generatedAt`.
 *
 * ## Layering
 *
 * Lives inside `learn-core`, so it obeys `learn-core`'s import rules: `shared`,
 * `strategy-core` and Node builtins, nothing else. `tests/layering.test.ts` reads `src/` only,
 * but the same rule applies here by convention (see `generate-hand-strength.ts`'s header).
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { invariant, unwrap } from '@gto-self/shared';
import { handClassByKey } from '@gto-self/strategy-core';

import { classVsClassEquity, type ClassVsClassEquity } from '../src/equity/classVsClass.js';

/** Bump on any change that moves a shipped number. */
const GENERATOR_VERSION = '1.0.0';

const METHODOLOGY =
  'Exact, combo-weighted heads-up preflop equity between two starting-hand classes: every ' +
  'legal pairing of one class\'s combos against the other\'s, each pairing enumerated over ' +
  'all C(48,5) = 1,712,304 boards (exactHeadsUpEquity), weighted equally and summed. Nothing ' +
  'is sampled and no pairing is estimated.';

const METHODOLOGY_REPORT = 'docs/reports/WP_G3_DOMAIN_FACTS.md';

/** The exact matchups content cites. See the file header for why only these two. */
const FROZEN_MATCHUPS: readonly (readonly [classAKey: string, classBKey: string])[] = [
  ['QQ', 'AKs'],
  ['QQ', 'AKo'],
];

const OUTPUT = new URL('../src/equity/classVsClassDataset.generated.ts', import.meta.url);

const say = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

/** JS source for a number, at the shortest representation that round-trips exactly. */
const num = (value: number): string => `${value}`;

const quote = (value: string): string => `'${value.replace(/\\/gu, '\\\\').replace(/'/gu, "\\'")}'`;

function emitMatchup(entry: ClassVsClassEquity): string {
  const boardLine = `[${entry.board.map((c) => num(c)).join(', ')}]`;
  return `    {
      classAKey: ${quote(entry.classAKey)},
      classBKey: ${quote(entry.classBKey)},
      board: ${boardLine},
      pairingCount: ${num(entry.pairingCount)},
      totalPairingsConsidered: ${num(entry.totalPairingsConsidered)},
      skippedPairings: ${num(entry.skippedPairings)},
      runoutsPerPairing: ${num(entry.runoutsPerPairing)},
      runouts: ${num(entry.runouts)},
      wins: ${num(entry.wins)},
      ties: ${num(entry.ties)},
      losses: ${num(entry.losses)},
      winProb: ${num(entry.winProb)},
      tieProb: ${num(entry.tieProb)},
      loseProb: ${num(entry.loseProb)},
      equity: ${num(entry.equity)},
      classAWinBps: ${num(entry.classAWinBps)},
      tieBps: ${num(entry.tieBps)},
      classBWinBps: ${num(entry.classBWinBps)},
      method: 'EXACT',
    },`;
}

function emit(matchups: readonly ClassVsClassEquity[]): string {
  const rows = matchups.map(emitMatchup).join('\n');
  return `/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Produced by \`scripts/generate-class-vs-class-equity.ts\` (version ${GENERATOR_VERSION}).
 * Regenerate with \`pnpm --filter @gto-self/learn-core generate:classVsClass\`.
 *
 * Exact, combo-weighted heads-up preflop equity between the class-vs-class matchups
 * FishTilt's content actually cites. See \`./classVsClass.ts\` for the method and
 * \`${METHODOLOGY_REPORT}\` for the measured cost that is the reason this is frozen rather
 * than computed at request time.
 */
import type { ClassVsClassDatasetSource } from './classVsClassDataset.model.js';

export const CLASS_VS_CLASS_SOURCE: ClassVsClassDatasetSource = {
  methodology: ${quote(METHODOLOGY)},
  methodologyReport: ${quote(METHODOLOGY_REPORT)},
  generatorVersion: ${quote(GENERATOR_VERSION)},
  generatedAt: ${quote(new Date().toISOString())},
  matchups: [
${rows}
  ],
};
`;
}

function main(): void {
  const wallStart = Date.now();
  say(`class-vs-class generator ${GENERATOR_VERSION}`);
  say(`  freezing ${FROZEN_MATCHUPS.length} matchup(s): ${FROZEN_MATCHUPS.map(([a, b]) => `${a} vs ${b}`).join(', ')}`);

  const matchups: ClassVsClassEquity[] = [];
  for (const [aKey, bKey] of FROZEN_MATCHUPS) {
    const classA = handClassByKey(aKey);
    const classB = handClassByKey(bKey);
    invariant(classA !== undefined, `unknown hand class key: ${aKey}`);
    invariant(classB !== undefined, `unknown hand class key: ${bKey}`);

    const started = Date.now();
    const result = unwrap(classVsClassEquity(classA, classB, []));
    const elapsedMs = Date.now() - started;
    const msPerPairing = elapsedMs / result.pairingCount;

    say(
      `  ${aKey} vs ${bKey}: ${result.pairingCount}/${result.totalPairingsConsidered} pairings, ` +
        `${result.runouts.toLocaleString('en-US')} runouts, ${elapsedMs}ms ` +
        `(${msPerPairing.toFixed(1)}ms/pairing) — equity ${(result.equity * 100).toFixed(2)}%`,
    );
    matchups.push(result);
  }

  writeFileSync(OUTPUT, emit(matchups), 'utf8');
  say(`  wrote ${fileURLToPath(OUTPUT)}`);
  say(`  total runtime ${((Date.now() - wallStart) / 1000).toFixed(1)}s`);
}

main();
