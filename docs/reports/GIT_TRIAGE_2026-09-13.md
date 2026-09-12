# Git Checkpoint Triage — 2026-09-13

Read-only classification of the current worktree, done to prepare a safe commit/push
without modifying feature code, running tests/build/e2e, or restoring/resetting anything.

## Method

`git status --porcelain`, `git diff --stat`, `git check-ignore -v`, targeted `tail`/`ls` on
new directories and docs. No test/build/lint/e2e run. No files deleted or reset.

## Sensitive-data check

- No `.env`/`.env.*` files present anywhere outside `.gitignore`'s own `!.env.example` rule.
- No matches for API-key-shaped strings (`sk-…`, `AKIA…`, `AIza…`, PEM private keys) in any
  tracked or untracked source/doc/json file.
- `packages/db/gto-self.db*` (live local SQLite db) is untracked and already ignored.

## Artifacts / generated files

Already fully covered by the existing (root-pattern, depth-independent) `.gitignore` —
verified with `git check-ignore -v` and `git status --ignored=matching`, nothing extra
needed:

- `node_modules/`, `.next/`, `test-results/`, `*.tsbuildinfo`, `.data/` under both
  `apps/web/**` and `apps/fishtilt/**`, all `packages/*/node_modules`.
- Root `.DS_Store`.
- `.claude/scheduled_tasks.lock` — tracked in HEAD, deleted in the working tree, and the
  pattern was just added to `.gitignore`. Since it's already tracked, `.gitignore` alone
  won't stop it; the existing `D` status must be staged (`git add .claude/scheduled_tasks.lock`
  or `git add -u`) together with the `.gitignore` change so it actually stops being tracked.
- `.gitignore`/`.prettierignore` diffs themselves are the only pending "artifact policy"
  changes and are safe, additive, no-op for anything else.

No other stray artifacts found.

## Classification

### 1. 3BetTilt (apps/fishtilt) — appears feature-complete per its own checkpoint, but its status doc is internally inconsistent

- `apps/fishtilt/**` (untracked, ~750+ files: src, content MDX, tests, config) +
  `packages/learn-core/**` (untracked: `@gto-self/learn-core`, FishTilt's beginner-education
  domain) + `docs/FISHTILT_*.md`, `docs/3BETTILT_*.md`, `docs/DEPLOY_3BETTILT.md`,
  `docs/reports/FISHTILT_*.md`, `docs/reports/stage3/**` (briefs/handoff/review notes for
  the Stage 3 rewrite).
- `docs/reports/stage3/INTERRUPTION_CHECKPOINT.md` explicitly says: *"Everything Stage 3 (+
  all of apps/fishtilt, packages/learn-core). apps/web belongs to another session — never
  touch. Recommended owner action: commit apps/fishtilt + packages/learn-core + docs."*
- **Caution:** `docs/3BETTILT_STAGE3_STATE.md`'s own status table lists S3-17 (QA), S3-18
  (independent review), S3-19 (remediation) and S3-20 (final release gate) as `대기`
  (pending) — but `docs/reports/stage3/WP_S3_17_QA_REPORT.md`, `WP_S3_16_SEO_AUDIT.md`, and
  four `review/WP_S3_18_REVIEW_{A,B,C,D}.md` files already exist on disk. The status table
  was not kept in sync with what was actually produced. Not resolved here (would require
  reading those reports and re-running QA, which is out of scope for this triage).
  Also flagged by the checkpoint itself: `WP-15 aliases.ts spelling` was "in-flight" as of
  last verified test run.
- Net: safe to commit as a body of work, but the owner should treat S3-17→20 as
  **unverified against the current STATE.md**, not as "done."

### 2. GTO-SELF core (apps/web, packages/*) — adaptive player-strategy hardening, reviewed

- `apps/web/src/components/table/{ExternalHudEntryFields,SeatCorrectionPanel,SeatPlayerSwapPanel,PlayerProfilePanel}*`,
  `apps/web/src/lib/table/{adaptive,adaptiveStore,externalHudLine,skip-hand-contract}*`,
  `apps/web/src/server/{adaptive-service,adaptive-trace-service,external-hud-*,seat-state-service,skip-hand-service,strategy-trace-service,players}*`,
  `apps/web/src/server/actions/{adaptive,external-hud,seat-state,skip-hand}.ts`,
  `packages/adaptive-core/**` (new package `@gto-self/adaptive-core` — opponent-adjustment
  composition layer), `packages/player-core/src/externalHud.*`, new drizzle migrations
  `0006`–`0010` + matching `packages/db/src/repositories/{adaptive-traces,external-hud,skipped-hands,strategy-traces}.ts`,
  plus modifications across `packages/db`, `packages/poker-core`, `packages/strategy-core`,
  `eslint.config.js`, `tsconfig.base.json`, `vitest.config.ts`, `CLAUDE.md`,
  `docs/DECISIONS.md`, `docs/STATE.md` (all pure additions — verified with `git diff`, no
  deletions in these three).
- This matches `docs/reports/HARDENING_WP_J_*.md`, ending in
  `HARDENING_WP_J_REVIEW_R1_RESOLUTION.md`, which documents an independent review pass,
  concrete mutation-testing evidence, and real-DB migration verification (0002/0003) — the
  strongest evidence in the repo that a body of work was actually reviewed, not just
  self-reported.
- Net: this looks complete and independently reviewed. Lower risk than category 1.

### 3. Needs owner attention before treating as done

- 3BetTilt Stage-3 status-table vs. report-files mismatch (S3-17/18/19/20), above.
- `WP-15 aliases.ts spelling` — noted "in-flight" in the checkpoint's last-verified-tests
  line.
- `prompt` (tracked, root) — the live instruction scratchpad (this very task came from it).
  `.gitignore` already excludes its siblings `prompt2`/`prompt3` as "ephemeral instruction
  scratchpad, not project state," but `prompt` itself remains tracked and has a large diff
  (mostly deletions — old instructions cleared). Left untouched here; whether to keep
  tracking it, stop tracking it, or gitignore it going forward is an owner call, not made
  by this triage.

### 4. Should not be committed as-is

- Nothing found in the working tree that isn't already gitignored. No `.env`, no secrets,
  no leftover build output outside ignored paths.

## Shared / entangled files — read before staging

- `pnpm-lock.yaml`: diff is **1096 insertions, 0 deletions** — purely additive (new
  `@gto-self/fishtilt`, `@gto-self/learn-core`, `@gto-self/adaptive-core` workspace deps
  registered). Cannot be cleanly split between category 1 and category 2 commits without
  regenerating it per subset (not attempted — out of scope, and risky). It will have to
  ride along with whichever commit lands, or its own small `chore:` commit.
- Root `package.json`: diff mixes both streams in the same `scripts` block — adds
  `dev:fishtilt`/`build:fishtilt`/`e2e:fishtilt` (category 1) **and**
  `strategy:backfill`/`adaptive:backfill`/`players:import-external` (category 2) in one
  hunk. Splitting requires a manual `git add -p`; committing as one file is simpler and low
  risk (additive only, `verify` script itself unchanged).
- `CLAUDE.md`, `docs/DECISIONS.md`, `docs/STATE.md`: confirmed pure appends (no lines
  removed), so no data loss risk either way, but they likely also contain narrative from
  both work streams — read before assuming either commit "belongs" cleanly to one category.

## Recommended commit strategy (not executed — awaiting approval)

Two (or three, if the lockfile/root-package.json entanglement is unacceptable) commits, in
this order:

1. **`chore(git): ignore generated artifacts and stop tracking the stale task lock`**
   - Stage: `.gitignore`, `.prettierignore`, and the deletion of
     `.claude/scheduled_tasks.lock` (`git add .gitignore .prettierignore .claude/scheduled_tasks.lock`
     — the last one stages a deletion since it's already gone from the working tree).
   - This lands first so nothing generated can accidentally get swept into the next two.

2. **GTO-SELF core — adaptive player-strategy hardening (category 2)**
   - Stage exactly: the `apps/web/**` files listed in category 2 above, `packages/db/**`,
     `packages/player-core/**`, `packages/poker-core/**`, `packages/strategy-core/**`,
     `packages/adaptive-core/**` (new), `packages/shared/package.json`, `eslint.config.js`,
     `tsconfig.base.json`, `vitest.config.ts`, `CLAUDE.md`, `docs/DECISIONS.md`,
     `docs/STATE.md`, and `docs/reports/HARDENING_WP_J_*.md`.
   - `pnpm-lock.yaml` and root `package.json` can ride here since they're additive.

3. **3BetTilt — Stage 3 rewrite (category 1)**
   - Stage: `apps/fishtilt/`, `packages/learn-core/`, `docs/FISHTILT_*.md`,
     `docs/3BETTILT_*.md`, `docs/DEPLOY_3BETTILT.md`, `docs/reports/FISHTILT_*.md`,
     `docs/reports/stage3/`.
   - Commit message should note S3-17→20 status is unverified against `STATE.md`, per
     above, so the owner doesn't read the commit as "fully shipped."

`git add .` is **not recommended** — the tree mixes two independent projects' worktrees
plus a repo-hygiene fix, and a single flat commit would bury that separation. `git add -A`
on a **scoped path** (e.g. `git add -A apps/fishtilt packages/learn-core`) is fine for
commits 2 and 3 individually, since `-A`'s deletion-tracking is irrelevant here (nothing in
those trees is being deleted) and everything under those paths not already ignored is meant
to be added.

If a single combined checkpoint commit is preferred instead (least effort, still safe): all
three groups above in one commit is not dangerous — no secrets, no stray artifacts, no
destructive changes — it just loses the category separation for future `git log`/`bisect`
use. That tradeoff is the owner's call.

## Explicitly not done (per task scope)

No tests, typecheck, lint, build, or e2e were run. No files were staged, committed, or
pushed. No existing work was deleted, reset, or restored.
