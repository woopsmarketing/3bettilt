/**
 * The algorithm version stamped onto every snapshot.
 *
 * BUMP THIS whenever the meaning of any opportunity denominator, spot key, stat key or
 * bucket boundary changes — anything that would make two snapshots computed from the same
 * raw hands disagree. The version is half of a snapshot's identity: a run reports
 * `NO_CHANGES` only when BOTH the input hash and this version match the player's latest
 * snapshot (ADR-0062c). Leaving it unchanged after a behaviour change would make a stale
 * snapshot look current.
 *
 * Raw history is never touched by an algorithm change: every derived row can be deleted
 * and rebuilt from the event log (prompt §4).
 *
 * 1 — initial C1 algorithm.
 */
export const ANALYSIS_ALGORITHM_VERSION = 1;
