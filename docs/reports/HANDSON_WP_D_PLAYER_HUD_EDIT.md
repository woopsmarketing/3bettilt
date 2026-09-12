# WP-D — Player convenience UX (nickname reuse + manual HUD/notes edit)

2026-09-02. Implements item 4 of `prompt` (repo root).

## Nickname reuse (4a)

Already fully implemented before this session (`resolvePlayer` in
`apps/web/src/server/session-service.ts:88-120`, autocomplete in
`SessionSetupForm.tsx`). No changes made.

## HUD/notes write path (4b, net-new)

- `apps/web/src/lib/table/contract.ts` — added `SaveHudSnapshotInput/Result/Action` and
  `AddPlayerNoteInput/Result/Action`, plain-JSON wire types matching the existing
  `LoadPlayerProfileAction` style.
- `apps/web/src/server/players.ts` — extracted shared `buildProfileView(db, playerId)`
  (used by read and both writes); added `saveHudSnapshot`/`addPlayerNote`, which validate via
  `player-core`'s `createHudSnapshot`/`createNote` and persist via the already-existing
  `insertHudSnapshot`/`insertNote` repositories. A validation failure returns
  `{ok:false, message}`, never throws, never writes.
- `apps/web/src/server/actions/player.ts` — `saveHudSnapshotAction`/`addPlayerNoteAction`
  (`'use server'`), ids/timestamps injected the same way `session-service.ts` already does.
- `apps/web/src/components/table/PlayerProfilePanel.tsx` — new optional
  `saveHudSnapshot`/`addNote` props; a 4-field HUD form (VPIP/PFR/3BET/FOLD_TO_3BET, verbatim
  entered text preserved per CLAUDE.md rule 3) + hand-sample field, and a notes textarea.
  Read-only rendering is unchanged when the props are omitted.
- `TableRoot.tsx` / `app/table/[sessionId]/page.tsx` — minimal prop-threading only.

`PlayerModelPanel.tsx` / `analysis-contract.ts` / `packages/analysis-core` (the separate
learned-model surface, ADR-0062a) were not touched.

## Tests

- `apps/web/src/server/players.test.ts` (+7): happy paths, out-of-range percentage
  validation failure (no write), unknown stat key (no write), player-id reuse (no duplicate
  `players` row), note happy path, empty-note validation failure, missing-player failure.
- `apps/web/src/components/table/PlayerProfilePanel.test.tsx` (+4): read-only mode with
  props omitted, HUD submit re-render, HUD validation error display, note submit append.
- 11/11 new tests pass; typecheck clean on every touched file.
