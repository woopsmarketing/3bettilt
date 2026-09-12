# Stage 3 — INTERRUPTION CHECKPOINT (updated 2026-09-12, after WP-13b)

Resume = read `docs/3BETTILT_STAGE3_STATE.md` CURRENT STATUS + this file + `handoff/*`. Do NOT redo finished WPs.
Rule: a WP without a handoff was cut off mid-work. Its partial edits are ON DISK (untracked). Relaunch a fresh agent
with the SAME brief plus: "A previous agent was interrupted mid-work; inspect the current state of your files
(compare with `.data/stage3-baseline/fishtilt/...` for the original), keep good work, finish the brief, run its gates,
write the handoff." Never restore from the baseline blindly.

## CURRENT WP — agents running at checkpoint time (2026-09-12 21:0x)
| WP | brief / boundary | how to tell if it finished |
| --- | --- | --- |
| S3-12 g1+g2 | `briefs/WP_S3_12_GLOSSARY_CONTENT_BRIEF.md` — game 14 terms | `handoff/WP_S3_12_G1G2_HANDOFF.md` |
| S3-12 g3+g4 | same brief — betting 15 terms | `handoff/WP_S3_12_G3G4_HANDOFF.md` |
| S3-12 g5+g8 | same brief — position+math, new 인포지션/아웃오브포지션·거트샷·오픈엔디드, owns `categories.ts` | `handoff/WP_S3_12_G5G8_HANDOFF.md` |
| S3-12 g6+g7 | same brief — 족보 13 terms, new 셋/트립스(alias 이동) | `handoff/WP_S3_12_G6G7_HANDOFF.md` |
| S3-12 g9 | same brief — starting-hands, new 브로드웨이·커넥터/갭 | `handoff/WP_S3_12_G9_HANDOFF.md` |
| S3-15 UX | `briefs/WP_S3_15_UX_BRIEF.md` (RESUMED after 429; partial edits on disk) | `handoff/WP_S3_15_HANDOFF.md` |

DEFERRED VERIFICATION (orchestrator, after 12 + 15 land): one `rm -rf .next && pnpm build` via build-lock (MDX compile
proof), full `pnpm vitest run --project fishtilt --project learn-core`, glossary + search e2e. Do not run these per batch.

## COMPLETED WPs (master-verified unless noted)
S3-00, 01a, 01b, 02, 03, 04, 05 HOME, 11 GLOSSARY TEMPLATE, DOCS(deploy+playbook), 06 BLOG HUB, 07 i1–i4, 08 S1–S3 (6 stories), 09 LEARN HUB, 10 L1–L3,
13a HANDS TEMPLATE (+ ItemList follow-up), 13b K1–K4, 14 TOOLS. Details: STATE CURRENT STATUS.

## NEXT (per D-S3-21)
1. Verify 11 + 15 (typecheck, `pnpm vitest run --project fishtilt --project learn-core`, targeted e2e via build-lock,
   screenshots).
2. WP-S3-12 GLOSSARY CONTENT — Sonnet agents, one per batch file created by WP-11 (8–10 terms each; new terms
   브로드웨이, 커넥터/갭, 거트샷/오픈엔디드, 셋/트립스, IP/OOP). Brief to be written from `handoff/WP_S3_11_HANDOFF.md`.
3. WP-S3-16 SEO — brief ready: `briefs/WP_S3_16_SEO_BRIEF.md` (Fable).
4. WP-17 perf/a11y/visual QA (Fable) → 18 reviews (Opus A poker/math, Opus B UX, Fable C SEO, Sonnet D eng) → 19
   remediation → 20 final gate + `docs/reports/3BETTILT_STAGE3_FINAL.md`.

## CURRENT MODIFIED FILES
All of `apps/fishtilt/**` is git-untracked. Changed-since-checkpoint:
`find apps/fishtilt/src apps/fishtilt/content apps/fishtilt/tests -newer docs/reports/stage3/INTERRUPTION_CHECKPOINT.md -type f`.
Full diff vs Stage-3 start: `diff -rq -x next-env.d.ts -x node_modules -x .next -x .data .data/stage3-baseline/fishtilt apps/fishtilt`.

## UNCOMMITTED CHANGES
Everything Stage 3 (+ all of apps/fishtilt, packages/learn-core). apps/web belongs to another session — never touch.
Recommended owner action: commit apps/fishtilt + packages/learn-core + docs.

## LAST VERIFIED TESTS
2026-09-12 after 13b: `src/content` + hands + copy-guards 27 files 622/622; typecheck 0.
Last full suite: 2396/2400 (3 of 4 since fixed; remaining: WP-15 aliases.ts spelling, in-flight).

## TOOLS
Build mutex: `apps/fishtilt/.data/tools/build-lock.sh '<cmd>'` (FOREGROUND, watchdog 1200 s, frees :3221).
Screenshots: `node apps/fishtilt/.data/tools/shoot.mjs --out … --paths … --viewports … --themes … --fold`.
