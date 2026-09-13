/**
 * Draws a content page's social card (1200×630 PNG) with `next/og` at build time.
 *
 * Composition: the featured visual (the page's photo when `public/visuals/` has it, else a
 * gradient rendering of its `ThemeArt` light), a dark gradient from the bottom-left, the
 * category in brand red, the title, and the `3BETTILT` wordmark. No number, card or range is
 * drawn — the card carries the page's words, not its facts.
 *
 * The Korean face is a subset of Pretendard Bold (SIL OFL 1.1, `fonts/Pretendard-OFL.txt`):
 * ASCII, KS X 1001's 2,350 common syllables, and every syllable the content uses
 * (`fonts/glyphs.txt`). `renderOg.test.ts` fails when a title needs a glyph the subset lacks,
 * so a new title cannot silently render with missing characters — regenerate the subset.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ImageResponse } from 'next/og.js';
import { visualOf, type VisualThemeId } from '../../content/visuals.js';
import type { AnyContentRecord } from '../../content/types.js';
import { resolveAsset } from '../../components/visual/assetSource.js';
import { artLight } from '../../components/visual/ThemeArt.js';
import { OG_CARD_HEIGHT, OG_CARD_WIDTH, ogCardCategory } from './ogCard.js';

const FONT_FILE = 'Pretendard-Bold-subset.otf';

function fontsDir(cwd: string = process.cwd()): string {
  const candidates = [
    join(cwd, 'src', 'lib', 'og', 'fonts'),
    join(cwd, 'apps', 'fishtilt', 'src', 'lib', 'og', 'fonts'),
  ];
  for (const candidate of candidates) {
    try {
      readFileSync(join(candidate, 'glyphs.txt'));
      return candidate;
    } catch {
      /* try the next root */
    }
  }
  throw new Error('OG font directory not found (src/lib/og/fonts)');
}

let fontCache: ArrayBuffer | null = null;
function ogFont(): ArrayBuffer {
  if (fontCache === null) {
    const bytes = readFileSync(join(fontsDir(), FONT_FILE));
    fontCache = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  }
  return fontCache;
}

/** Every character the embedded subset can draw. */
export function ogGlyphs(): ReadonlySet<string> {
  return new Set(readFileSync(join(fontsDir(), 'glyphs.txt'), 'utf8'));
}

const LIGHT_X = { left: '22%', center: '50%', right: '78%' } as const;

function artBackground(theme: VisualThemeId, variant: string): string {
  const x = LIGHT_X[artLight(theme, variant)];
  return [
    `radial-gradient(circle at ${x} 0%, rgba(150,26,44,0.75) 0%, rgba(70,14,24,0.35) 30%, rgba(0,0,0,0) 60%)`,
    'linear-gradient(180deg, #1b1d22 0%, #0e0f12 60%, #08090b 100%)',
  ].join(', ');
}

/** Title size steps down for long titles so every card fits in three lines. */
function titleSize(title: string): number {
  if (title.length <= 18) return 68;
  if (title.length <= 30) return 58;
  if (title.length <= 44) return 50;
  return 44;
}

export function renderContentOg(record: AnyContentRecord): ImageResponse {
  const visual = visualOf(record);
  const asset = resolveAsset(visual);
  const photo =
    asset === null ? null : `data:image/jpeg;base64,${readFileSync(asset.path).toString('base64')}`;
  const category = ogCardCategory(record);

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        backgroundColor: '#090a0d',
        // Satori reads every key, and an `undefined` value throws — omit the key for a photo.
        ...(photo === null ? { backgroundImage: artBackground(visual.theme, visual.variant) } : {}),
        fontFamily: 'Pretendard',
        color: '#ffffff',
      }}
    >
      {photo !== null ? (
        <img
          src={photo}
          width={OG_CARD_WIDTH}
          height={OG_CARD_HEIGHT}
          style={{ position: 'absolute', inset: 0, objectFit: 'cover' }}
          alt=""
        />
      ) : null}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          backgroundImage:
            'linear-gradient(90deg, rgba(8,9,12,0.92) 0%, rgba(8,9,12,0.7) 55%, rgba(8,9,12,0.25) 100%)',
        }}
      />
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          padding: '64px 72px',
        }}
      >
        <div
          style={{ display: 'flex', alignItems: 'center', fontSize: 28, letterSpacing: '0.18em' }}
        >
          <div
            style={{
              display: 'flex',
              width: 18,
              height: 18,
              backgroundColor: '#ff334d',
              marginRight: 16,
            }}
          />
          3BETTILT
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', width: 56, height: 5, backgroundColor: '#ff334d' }} />
          <div style={{ display: 'flex', marginTop: 26, fontSize: 30, color: '#ff6b7d' }}>
            {category}
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 18,
              maxWidth: 940,
              fontSize: titleSize(record.title),
              lineHeight: 1.22,
              letterSpacing: '-0.02em',
              wordBreak: 'keep-all',
            }}
          >
            {record.title}
          </div>
        </div>
      </div>
    </div>,
    {
      width: OG_CARD_WIDTH,
      height: OG_CARD_HEIGHT,
      fonts: [{ name: 'Pretendard', data: ogFont(), weight: 700, style: 'normal' }],
    },
  );
}
