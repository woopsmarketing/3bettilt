/**
 * OFFLINE GENERATOR for `src/strength/dataset.generated.ts`.
 *
 *     pnpm --filter @gto-self/learn-core generate:strength           # the shipped, EXACT run
 *     pnpm --filter @gto-self/learn-core generate:strength --sampled # a two-minute preview
 *
 * It is not part of the app, not part of `pnpm test`, and not imported by anything. It runs
 * when somebody wants the dataset rebuilt, prints what it is doing, and overwrites the one
 * generated file. Nothing else on disk is touched.
 *
 * ## The three passes
 *
 * 1. MAIN — all 169 classes, EXHAUSTIVELY: every one of the 2,118,760 boards against every
 *    one of the 1225 opponent hands, measured from each class's lowest-index combo. About
 *    75 seconds of one core per class, so roughly 3.5 CPU-hours and — through the worker
 *    pool below — about twenty minutes of wall clock. These are the numbers that ship, and
 *    they are exact: `strategy-core` reports `method: 'EXACT'` and the generator refuses to
 *    write the file if it ever reports anything else.
 * 2. SYMMETRY — a spread of classes enumerated exhaustively a SECOND time, from a different
 *    combo of the same class. The suit-symmetry argument in `src/strength/measure.ts` says
 *    the two must agree; with exact enumeration that is a testable equality rather than a
 *    statistical hope, and it is the only meaningful cross-check an exact dataset admits.
 *    (Re-running an exact computation at a "second budget" proves nothing, so the two-budget
 *    stability gate the sampled dataset carried is gone.)
 * 3. SPOT — all 169 on the CHEAP sampled path, so `ranking.test.ts` can rerun a couple of
 *    classes in under a second and still exercise the real measurement code. Its worst
 *    deviation from the exact column is recorded, which now measures the sampled path's
 *    accuracy against truth rather than against another estimate.
 *
 * `--sampled` replaces pass 1 and 2 with a small board budget for a quick preview. It does
 * NOT produce a shippable dataset: the run refuses to write anything unless every class was
 * exhaustive, because `method: 'EXACT'` must never sit on top of sampled numbers.
 *
 * ## Determinism
 *
 * `strategy-core`'s sampler has no RNG and no seed, and pass 1 does not sample at all, so
 * every measurement is a pure function of (class, representative, boards). The work is
 * spread over worker threads purely for wall-clock reasons: tasks are numbered up front and
 * results are merged back in task-number order, so the number of workers — and the order
 * they happen to finish in — cannot change a single digit of the output. Re-running this
 * script on the same source produces a byte-identical file apart from `generatedAt`.
 *
 * ## Layering
 *
 * This file lives inside `learn-core`, so it obeys `learn-core`'s import rules: `shared`,
 * `strategy-core` and Node builtins, nothing else. `tests/layering.test.ts` reads `src/`
 * only, but that is not a licence — the ESLint block covers this directory too.
 */

import { writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';

import { invariant } from '@gto-self/shared';
import {
  COMBO_COUNT,
  HAND_CLASSES,
  handClassAt,
  type HandClassIndex,
} from '@gto-self/strategy-core';

import {
  HAND_STRENGTH_RANK_BASIS,
  HAND_STRENGTH_SYMMETRY_TOLERANCE,
  type HandStrengthEntry,
} from '../src/strength/model.js';
import {
  measureHandStrength,
  OPPONENT_HAND_COUNT,
  PREFLOP_RUNOUT_SPACE_SIZE,
  type HandStrengthRepresentative,
} from '../src/strength/measure.js';

// ---------------------------------------------------------------------------
// The budgets — every one of them a stated count, never a wall-clock target
// ---------------------------------------------------------------------------

/** Bump on any change that moves a shipped number. */
const GENERATOR_VERSION = '2.0.0';

/** Boards per class in the shipped pass: all of them. This is what makes it exact. */
const EXACT_BOARDS = PREFLOP_RUNOUT_SPACE_SIZE;

/** Boards per class under `--sampled`. A preview only; the run refuses to write the file. */
const PREVIEW_BOARDS = 20_000;

/** Boards per class in the cheap pass a unit test can afford to recompute. */
const SPOT_CHECK_RUNOUT_SAMPLES = 2_000;

/**
 * How many classes are enumerated a second time from the other representative combo.
 *
 * Seventeen, at evenly spaced ranks, so the check covers the whole strength range rather
 * than one corner of it — the equity of a pocket pair and the equity of offsuit rags are
 * summed over very different distributions of showdown outcomes, and a symmetry bug could
 * plausibly show up in one and not the other. It costs one extra exhaustive enumeration per
 * class, which is about two more minutes of wall clock on a dozen cores.
 */
const SYMMETRY_CLASS_COUNT = 17;

/** The combo the symmetry pass measures from. */
const SYMMETRY_REPRESENTATIVE: HandStrengthRepresentative = 'HIGHEST_COMBO';

/** How many classes the fast test recomputes on the cheap path: strongest, middle, weakest. */
const SPOT_CHECK_CLASS_COUNT = 3;

/** The repo's Prettier `printWidth`. */
const PRINT_WIDTH = 100;

const PREVIEW = process.argv.includes('--sampled');

const OUTPUT = new URL('../src/strength/dataset.generated.ts', import.meta.url);

const METHODOLOGY =
  'Heads-up all-in preflop equity against a hand drawn uniformly from every legal two-card ' +
  'holding, computed by full enumeration of all 2,118,760 boards against all 1225 opponent ' +
  'hands, on one suit-symmetric representative combo per class. Nothing is sampled.';

const METHODOLOGY_REPORT = 'docs/reports/FISHTILT_WP_R_STRENGTH_DATASET.md';

// ---------------------------------------------------------------------------
// The worker protocol
// ---------------------------------------------------------------------------

interface Task {
  /** Position in the full task list. The ONLY thing that decides where a result lands. */
  readonly id: number;
  readonly classIndex: number;
  readonly runoutSamples: number;
  readonly representative: HandStrengthRepresentative;
}

interface TaskResult {
  readonly id: number;
  readonly equity: number;
  readonly runoutSamples: number;
  readonly scoredTrials: number;
  readonly exhaustive: boolean;
}

interface WorkerInput {
  readonly tasks: readonly Task[];
}

function runTask(task: Task): TaskResult {
  const handClass = handClassAt(task.classIndex as HandClassIndex);
  const measured = measureHandStrength(handClass, {
    runoutSamples: task.runoutSamples,
    representative: task.representative,
  });
  return {
    id: task.id,
    equity: measured.equity,
    runoutSamples: measured.runoutSamples,
    scoredTrials: measured.scoredTrials,
    exhaustive: measured.exhaustive,
  };
}

if (!isMainThread) {
  const input = workerData as WorkerInput;
  for (const task of input.tasks) parentPort?.postMessage(runTask(task));
  parentPort?.close();
}

// ---------------------------------------------------------------------------
// The pool
// ---------------------------------------------------------------------------

const say = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

/**
 * Runs every task and returns the results in TASK-ID order.
 *
 * Tasks are dealt round-robin so that a slice of expensive tasks does not all land on one
 * worker. Round-robin is a fixed rule, and the results are re-sorted by id afterwards, so
 * the partition is invisible in the output.
 */
async function runTasks(tasks: readonly Task[], label: string): Promise<readonly TaskResult[]> {
  if (tasks.length === 0) return [];
  const workerCount = Math.max(1, Math.min(tasks.length, availableParallelism() - 2));
  const slices: Task[][] = Array.from({ length: workerCount }, () => []);
  tasks.forEach((task, index) => slices[index % workerCount]?.push(task));

  const started = Date.now();
  const results: TaskResult[] = [];
  let done = 0;

  await Promise.all(
    slices.map(
      (slice) =>
        new Promise<void>((resolve, reject) => {
          const worker = new Worker(fileURLToPath(import.meta.url), {
            workerData: { tasks: slice } satisfies WorkerInput,
          });
          worker.on('message', (message: TaskResult) => {
            results.push(message);
            done += 1;
            if (done % 5 === 0 || done === tasks.length) {
              const elapsed = (Date.now() - started) / 1000;
              const eta = (elapsed / done) * (tasks.length - done);
              say(
                `  ${label}: ${done}/${tasks.length}  elapsed ${elapsed.toFixed(0)}s  eta ${eta.toFixed(0)}s`,
              );
            }
          });
          worker.on('error', reject);
          worker.on('exit', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`${label}: worker exited with code ${code}`));
          });
        }),
    ),
  );

  invariant(
    results.length === tasks.length,
    `${label}: ${results.length}/${tasks.length} returned`,
  );
  results.sort((a, b) => a.id - b.id);
  return results;
}

// ---------------------------------------------------------------------------
// Emission
// ---------------------------------------------------------------------------

/** JS source for a number, at the shortest representation that round-trips exactly. */
const num = (value: number): string => `${value}`;

const quote = (value: string): string => `'${value.replace(/\\/gu, '\\\\').replace(/'/gu, "\\'")}'`;

/**
 * A string array as source. Emitted the way Prettier would print it — one line when it fits
 * inside the repo's 100-column width, expanded otherwise — so `prettier --check` stays clean
 * on a file nobody edits by hand and a regeneration never fights the formatter.
 */
const stringList = (values: readonly string[], indent: number): string => {
  if (values.length === 0) return '[]';
  const oneLine = `[${values.map(quote).join(', ')}]`;
  if (indent + oneLine.length <= PRINT_WIDTH) return oneLine;
  const pad = ' '.repeat(indent + 2);
  return `[\n${values.map((v) => `${pad}${quote(v)},`).join('\n')}\n${' '.repeat(indent)}]`;
};

interface Emission {
  readonly entries: readonly HandStrengthEntry[];
  /** Boards ACTUALLY walked per class, read back from the engine rather than requested. */
  readonly boardsPerClass: number;
  readonly scoredTrialsPerClass: number;
  readonly symmetry: {
    readonly checks: readonly {
      key: string;
      lowestComboEquity: number;
      highestComboEquity: number;
    }[];
    readonly maxAbsoluteDifference: number;
    readonly identicalCount: number;
  };
  readonly exactTies: readonly string[];
  readonly spotChecks: readonly { key: string; equity: number }[];
  readonly spotCheckMaxDeviation: number;
}

function emit(data: Emission): string {
  const rowLines = data.entries.map((e) => `    [${quote(e.key)}, ${num(e.equity)}],`).join('\n');

  const symmetryLines = data.symmetry.checks
    .map(
      (c) =>
        `      {\n        key: ${quote(c.key)},\n        lowestComboEquity: ${num(c.lowestComboEquity)},` +
        `\n        highestComboEquity: ${num(c.highestComboEquity)},` +
        `\n        absoluteDifference: ${num(Math.abs(c.lowestComboEquity - c.highestComboEquity))},\n      },`,
    )
    .join('\n');

  const spotLines = data.spotChecks
    .map((s) => `    { key: ${quote(s.key)}, equity: ${num(s.equity)} },`)
    .join('\n');

  return `/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Produced by \`scripts/generate-hand-strength.ts\` (version ${GENERATOR_VERSION}).
 * Regenerate with \`pnpm --filter @gto-self/learn-core generate:strength\`.
 *
 * Every number below is a measurement, not a judgement: the heads-up all-in preflop equity
 * of each of the 169 starting-hand classes against a uniformly random legal opponent hand.
 * It is EXACT — every board against every opponent hand, nothing sampled — so \`method\` is
 * \`'EXACT'\`, there is no error bar and no tie band, and the order between any two classes
 * with different equities is a fact rather than an estimate. See \`./model.ts\` for what each
 * field means and
 * \`${METHODOLOGY_REPORT}\` for the methodology and its one remaining caveat.
 *
 * Rows are \`[key, equity]\` in RANK ORDER, strongest first, so this file reads as the
 * ranking itself. Everything derivable from a row — the matrix index, the 6/4/12 combo
 * count, the cumulative shares the "top X%" cut uses — is rebuilt and cross-checked against
 * \`strategy-core\` by \`./ranking.ts\` rather than duplicated here.
 */

import type { HandStrengthDatasetSource } from './model.js';

export const HAND_STRENGTH_SOURCE: HandStrengthDatasetSource = {
  rankBasis: ${quote(HAND_STRENGTH_RANK_BASIS)},
  methodology:
    ${quote(METHODOLOGY)},
  methodologyReport: ${quote(METHODOLOGY_REPORT)},
  method: 'EXACT',
  trialCount: ${data.scoredTrialsPerClass * data.entries.length},
  enumeration: {
    boardsPerClass: ${data.boardsPerClass},
    boardSpaceSize: ${PREFLOP_RUNOUT_SPACE_SIZE},
    opponentHands: ${OPPONENT_HAND_COUNT},
    scoredTrialsPerClass: ${data.scoredTrialsPerClass},
    scoredTrialsTotal: ${data.scoredTrialsPerClass * data.entries.length},
  },
  symmetry: {
    checks: [
${symmetryLines}
    ],
    maxAbsoluteDifference: ${num(data.symmetry.maxAbsoluteDifference)},
    identicalCount: ${data.symmetry.identicalCount},
    passed: ${data.symmetry.maxAbsoluteDifference <= HAND_STRENGTH_SYMMETRY_TOLERANCE},
  },
  exactTies: ${stringList(data.exactTies, 13)},
  spotCheckRunoutSamples: ${SPOT_CHECK_RUNOUT_SAMPLES},
  spotChecks: [
${spotLines}
  ],
  spotCheckMaxDeviation: ${num(data.spotCheckMaxDeviation)},
  generatorVersion: ${quote(GENERATOR_VERSION)},
  generatedAt: ${quote(new Date().toISOString())},
  // [key, equity] in rank order, strongest first. Rank is the row's position.
  rows: [
${rowLines}
  ],
};
`;
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const wallStart = Date.now();
  const mainBoards = PREVIEW ? PREVIEW_BOARDS : EXACT_BOARDS;
  say(`hand-strength generator ${GENERATOR_VERSION}${PREVIEW ? '  [--sampled PREVIEW]' : ''}`);
  say(
    `  169 classes | opponent hands ${OPPONENT_HAND_COUNT} (exhaustive) | board space ${PREFLOP_RUNOUT_SPACE_SIZE}`,
  );
  say(`  main pass ${mainBoards} boards | spot ${SPOT_CHECK_RUNOUT_SAMPLES} boards`);

  // --- stage 1: the main pass and the cheap pass, interleaved into one pool -------------
  const stageOne: Task[] = [];
  const push = (
    classIndex: number,
    runoutSamples: number,
    representative: HandStrengthRepresentative,
  ): number => {
    const id = stageOne.length;
    stageOne.push({ id, classIndex, runoutSamples, representative });
    return id;
  };
  const mainId: number[] = [];
  const spotId: number[] = [];
  for (const handClass of HAND_CLASSES) {
    mainId.push(push(handClass.index, mainBoards, 'LOWEST_COMBO'));
    spotId.push(push(handClass.index, SPOT_CHECK_RUNOUT_SAMPLES, 'LOWEST_COMBO'));
  }
  const stageOneResults = await runTasks(stageOne, 'main + spot');
  const at = (id: number): TaskResult => {
    const result = stageOneResults[id];
    invariant(result !== undefined, `missing result for task ${id}`);
    return result;
  };

  const main = HAND_CLASSES.map((_, i) => at(mainId[i] ?? 0));
  const spot = HAND_CLASSES.map((_, i) => at(spotId[i] ?? 0));

  const scoredTrialsPerClass = main[0]?.scoredTrials ?? 0;
  for (const result of main) {
    invariant(
      result.scoredTrials === scoredTrialsPerClass,
      'every class must cover the same number of showdowns',
    );
  }

  // --- the ordering --------------------------------------------------------------------
  // Descending equity; the key breaks a bit-identical tie so the order is a function of the
  // measurements alone and never of `sort` stability. A tie here is a REAL tie in the
  // metric, and it is recorded below rather than silently resolved.
  const order = HAND_CLASSES.map((handClass, i) => ({
    handClass,
    equity: main[i]?.equity ?? 0,
    spotEquity: spot[i]?.equity ?? 0,
  })).sort((a, b) =>
    a.equity === b.equity ? a.handClass.key.localeCompare(b.handClass.key) : b.equity - a.equity,
  );

  const exactTies: string[] = [];
  for (let i = 1; i < order.length; i += 1) {
    const previous = order[i - 1];
    const current = order[i];
    if (previous === undefined || current === undefined) continue;
    if (previous.equity === current.equity) {
      exactTies.push(`${previous.handClass.key} = ${current.handClass.key}`);
    }
  }

  // --- stage 2: suit symmetry, exhaustively, from the other combo -----------------------
  const symmetryRanks = Array.from({ length: SYMMETRY_CLASS_COUNT }, (_, i) =>
    Math.round((i * (order.length - 1)) / (SYMMETRY_CLASS_COUNT - 1)),
  );
  say(`  symmetry: re-enumerating ranks ${symmetryRanks.map((r) => r + 1).join(', ')}`);
  const symmetryTasks: Task[] = symmetryRanks.map((rankIndex, id) => ({
    id,
    classIndex: order[rankIndex]?.handClass.index ?? 0,
    runoutSamples: mainBoards,
    representative: SYMMETRY_REPRESENTATIVE,
  }));
  const symmetryResults = await runTasks(symmetryTasks, 'symmetry');

  const symmetryChecks = symmetryRanks.map((rankIndex, i) => {
    const row = order[rankIndex];
    const result = symmetryResults[i];
    invariant(row !== undefined && result !== undefined, `missing symmetry row ${i}`);
    return {
      key: row.handClass.key,
      lowestComboEquity: row.equity,
      highestComboEquity: result.equity,
    };
  });
  const symmetryDifferences = symmetryChecks.map((c) =>
    Math.abs(c.lowestComboEquity - c.highestComboEquity),
  );
  const maxAbsoluteDifference = Math.max(...symmetryDifferences);
  const identicalCount = symmetryDifferences.filter((d) => d === 0).length;

  // --- the entries ---------------------------------------------------------------------
  let cumulativeCombos = 0;
  const entries: HandStrengthEntry[] = order.map((row, i) => {
    cumulativeCombos += row.handClass.comboCount;
    return {
      key: row.handClass.key,
      classIndex: row.handClass.index,
      equity: row.equity,
      rank: i + 1,
      comboCount: row.handClass.comboCount,
      cumulativeCombos,
      cumulativeShare: cumulativeCombos / COMBO_COUNT,
    };
  });
  invariant(cumulativeCombos === COMBO_COUNT, `combos summed to ${cumulativeCombos}, not 1326`);

  // --- the cheap pass ------------------------------------------------------------------
  const spotDeviations = order.map((row) => Math.abs(row.spotEquity - row.equity));
  const spotCheckRanks = Array.from({ length: SPOT_CHECK_CLASS_COUNT }, (_, i) =>
    Math.round((i * (order.length - 1)) / (SPOT_CHECK_CLASS_COUNT - 1)),
  );
  const spotChecks = spotCheckRanks.map((rankIndex) => {
    const row = order[rankIndex];
    invariant(row !== undefined, `missing spot-check row ${rankIndex}`);
    return { key: row.handClass.key, equity: row.spotEquity };
  });

  // --- the report to the console -------------------------------------------------------
  say('');
  say(
    `  exact ties among the 169 exact values: ${exactTies.length === 0 ? 'none' : exactTies.join(', ')}`,
  );
  say(
    `  suit symmetry: ${identicalCount}/${symmetryChecks.length} bit-identical, worst |diff| ${maxAbsoluteDifference.toExponential(3)}` +
      (PREVIEW
        ? '  (a sampled preview cannot pass this; only an exact run can)'
        : ` (tolerance ${HAND_STRENGTH_SYMMETRY_TOLERANCE.toExponential(0)})`),
  );
  say(
    `  cheap sampled path: worst deviation from exact = ${Math.max(...spotDeviations).toExponential(3)}`,
  );
  say('');
  for (const c of symmetryChecks) {
    say(
      `  symmetry ${c.key.padEnd(4)} lowest ${c.lowestComboEquity.toFixed(16)}  highest ${c.highestComboEquity.toFixed(16)}  |diff| ${Math.abs(c.lowestComboEquity - c.highestComboEquity).toExponential(2)}`,
    );
  }
  say('');
  say(
    `  top 10:    ${entries
      .slice(0, 10)
      .map((e) => `${e.key} ${e.equity.toFixed(4)}`)
      .join('  ')}`,
  );
  say(
    `  bottom 10: ${entries
      .slice(-10)
      .map((e) => `${e.key} ${e.equity.toFixed(4)}`)
      .join('  ')}`,
  );
  say('');

  // --- write, but only if every shipped number really was exact -------------------------
  // `method: 'EXACT'` is a claim about how the numbers were produced, so it is checked
  // against what the engine actually reported rather than against the budget that was asked
  // for. A preview run stops here with the console summary and leaves the file alone.
  const everyClassExhaustive = main.every((result) => result.exhaustive);
  if (!everyClassExhaustive) {
    say('  NOT WRITTEN — this run sampled, and a sampled dataset must not be labelled EXACT.');
    say(`  total runtime ${((Date.now() - wallStart) / 1000).toFixed(1)}s`);
    process.exitCode = PREVIEW ? 0 : 1;
    return;
  }
  if (maxAbsoluteDifference > HAND_STRENGTH_SYMMETRY_TOLERANCE) {
    say('  NOT WRITTEN — suit symmetry failed; the 169-instead-of-1326 shortcut is unsound.');
    process.exitCode = 1;
    return;
  }

  writeFileSync(
    OUTPUT,
    emit({
      entries,
      boardsPerClass: main[0]?.runoutSamples ?? 0,
      scoredTrialsPerClass,
      symmetry: { checks: symmetryChecks, maxAbsoluteDifference, identicalCount },
      exactTies,
      spotChecks,
      spotCheckMaxDeviation: Math.max(...spotDeviations),
    }),
    'utf8',
  );
  say(`  wrote ${fileURLToPath(OUTPUT)}`);
  say(`  total runtime ${((Date.now() - wallStart) / 1000).toFixed(1)}s`);
}

if (isMainThread) {
  await main();
}
