/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Produced by `scripts/generate-class-vs-class-equity.ts` (version 1.0.0).
 * Regenerate with `pnpm --filter @gto-self/learn-core generate:classVsClass`.
 *
 * Exact, combo-weighted heads-up preflop equity between the class-vs-class matchups
 * FishTilt's content actually cites. See `./classVsClass.ts` for the method and
 * `docs/reports/WP_G3_DOMAIN_FACTS.md` for the measured cost that is the reason this is frozen rather
 * than computed at request time.
 */
import type { ClassVsClassDatasetSource } from './classVsClassDataset.model.js';

export const CLASS_VS_CLASS_SOURCE: ClassVsClassDatasetSource = {
  methodology: 'Exact, combo-weighted heads-up preflop equity between two starting-hand classes: every legal pairing of one class\'s combos against the other\'s, each pairing enumerated over all C(48,5) = 1,712,304 boards (exactHeadsUpEquity), weighted equally and summed. Nothing is sampled and no pairing is estimated.',
  methodologyReport: 'docs/reports/WP_G3_DOMAIN_FACTS.md',
  generatorVersion: '1.0.0',
  generatedAt: '2026-09-04T22:19:31.162Z',
  matchups: [
    {
      classAKey: 'QQ',
      classBKey: 'AKs',
      board: [],
      pairingCount: 24,
      totalPairingsConsidered: 24,
      skippedPairings: 0,
      runoutsPerPairing: 1712304,
      runouts: 41095296,
      wins: 22082460,
      ties: 178116,
      losses: 18834720,
      winProb: 0.5373476321961521,
      tieProb: 0.004334218690139134,
      loseProb: 0.4583181491137088,
      equity: 0.5395147415412217,
      classAWinBps: 5374,
      tieBps: 43,
      classBWinBps: 4583,
      method: 'EXACT',
    },
    {
      classAKey: 'QQ',
      classBKey: 'AKo',
      board: [],
      pairingCount: 72,
      totalPairingsConsidered: 72,
      skippedPairings: 0,
      runoutsPerPairing: 1712304,
      runouts: 123285888,
      wins: 69714036,
      ties: 520308,
      losses: 53051544,
      winProb: 0.5654664709070352,
      tieProb: 0.00422033704295499,
      loseProb: 0.4303131920500098,
      equity: 0.5675766394285127,
      classAWinBps: 5655,
      tieBps: 42,
      classBWinBps: 4303,
      method: 'EXACT',
    },
  ],
};
