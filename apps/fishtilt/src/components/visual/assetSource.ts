/**
 * Which candidate asset of a visual actually exists — the filesystem half of
 * `content/visuals.ts`. Server only (`node:fs`): imported by server components and the OG
 * image routes, never by a `'use client'` module.
 *
 * Resolved at build time, per render. A file dropped into `public/visuals/` with a name the
 * registry lists is picked up by the next build with no code change; until then the result
 * is `null` and the caller draws `ThemeArt` in the same box.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ContentVisual, VisualAssetSpec } from '../../content/visuals.js';

export const VISUALS_URL_PREFIX = '/visuals/';

/** `public/visuals` whether the process runs from the app or from the monorepo root. */
export function resolveVisualsDir(cwd: string = process.cwd()): string | null {
  const candidates = [
    join(cwd, 'public', 'visuals'),
    join(cwd, 'apps', 'fishtilt', 'public', 'visuals'),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

export interface ResolvedAsset {
  readonly spec: VisualAssetSpec;
  /** Site-relative URL, e.g. `/visuals/poker-study-notebook-and-cards.jpg`. */
  readonly src: string;
  /** Absolute filesystem path, for the OG renderer. */
  readonly path: string;
}

export function resolveAsset(
  visual: Pick<ContentVisual, 'candidates'>,
  dir: string | null = resolveVisualsDir(),
): ResolvedAsset | null {
  if (dir === null) return null;
  for (const spec of visual.candidates) {
    const path = join(dir, spec.file);
    if (existsSync(path)) return { spec, src: `${VISUALS_URL_PREFIX}${spec.file}`, path };
  }
  return null;
}
