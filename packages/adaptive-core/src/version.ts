/**
 * The version stamp every ADAPTIVE output is recorded under.
 *
 * An adaptive trace row is INSERT-ONLY: it is the evidence for a recommendation that was
 * shown at a moment in time, and it is never rewritten when the model changes. So a stored
 * row is only interpretable if it says which model produced it — otherwise a later reader
 * cannot tell whether a 2,000 bps shift was the same judgement they would get today.
 *
 * BUMP THIS whenever a stored trace's numbers would no longer reproduce from the same
 * inputs. Concretely, bump on ANY of:
 *
 * - a value in `ADAPTIVE_PRIORS` or `ADAPTIVE_STAT_K` changes;
 * - a member is added to, removed from, or renamed in `AdaptiveStatKey`;
 * - the shrinkage or pooling arithmetic in `profile.ts` changes, including a rounding point;
 * - (from WP J-C onward) a rule's gain, cap, direction or gate changes, or the rule table
 *   gains or loses a rule.
 *
 * Do NOT bump for a comment, a test, a type-only refactor, or a UI copy change: those leave
 * every stored number reproducible, and a version that churns stops meaning anything.
 *
 * The format is `adaptive-<year>-<month>-<milestone>-v<n>`. It is an OPAQUE token: nothing
 * parses it, compares it for ordering, or derives behaviour from it. It is written to
 * `adaptive_strategy_traces.adaptive_policy_version` and read by humans.
 */
export const ADAPTIVE_POLICY_VERSION = 'adaptive-2026-09-c2-v1';
