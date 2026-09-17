/**
 * The canonical rule, asserted as a rule: a canonical is a path, absolute against one
 * origin, with no query string and no fragment — whatever the caller hands it.
 *
 * The inputs below are constructed URL shapes, not URLs harvested from the app, so these
 * stay true no matter which filters the Range Explorer grows.
 */
import { describe, expect, it } from 'vitest';
import { canonicalPath, canonicalUrl } from './canonical.js';
import { SITE_ORIGIN } from './site.js';
import { DEFAULT_LOCALE, localePath } from '../locale.js';

/** The localised form of a site path — what every href on the site carries (D-S3-02). */
const ko = (sitePath: string): string => localePath(DEFAULT_LOCALE, sitePath);

describe('canonicalPath', () => {
  it('leaves a bare path alone', () => {
    expect(canonicalPath(ko('/learn/pot-odds'))).toBe(ko('/learn/pot-odds'));
    expect(canonicalPath(ko('/'))).toBe(ko('/'));
  });

  it('drops interactive tool state — build spec §34', () => {
    expect(canonicalPath(ko('/tools/range?hero=BTN&stack=100&spot=RFI'))).toBe(ko('/tools/range'));
    expect(canonicalPath(ko('/tools/starting-hand?top=15'))).toBe(ko('/tools/starting-hand'));
    expect(canonicalPath(ko('/search?q=%ED%8C%9F+%EC%98%A4%EC%A6%88'))).toBe(ko('/search'));
  });

  it('drops a fragment', () => {
    expect(canonicalPath(ko('/learn/outs#사람들이-자주-헷갈리는-부분'))).toBe(ko('/learn/outs'));
  });

  it('drops a trailing slash, but never the root slash', () => {
    expect(canonicalPath(ko('/tools/'))).toBe(ko('/tools'));
    expect(canonicalPath(ko('/tools//'))).toBe(ko('/tools'));
    expect(canonicalPath(ko('/'))).toBe(ko('/'));
  });

  it('accepts an absolute URL on this site and reduces it to the same path', () => {
    expect(canonicalPath(`${SITE_ORIGIN}${ko('/blog/how-often-aa?utm_source=x')}`)).toBe(
      ko('/blog/how-often-aa'),
    );
  });

  it('refuses a URL on another origin rather than emitting an off-site canonical', () => {
    expect(() => canonicalPath('https://elsewhere.invalid/learn')).toThrow(/foreign origin/u);
  });

  it('collapses every query variant of one tool to a single canonical', () => {
    const variants = [
      ko('/tools/range'),
      ko('/tools/range?hero=BTN'),
      ko('/tools/range?hero=UTG&spot=RFI'),
      ko('/tools/range?stack=100&hero=CO&spot=RFI'),
      ko('/tools/range/?hero=SB'),
    ];
    expect(new Set(variants.map(canonicalUrl)).size).toBe(1);
  });
});

describe('canonicalPath — the locale gate (D-S3-23)', () => {
  it('accepts prefixless default-locale paths, the root included', () => {
    expect(canonicalPath('/learn/pot-odds')).toBe('/learn/pot-odds');
    expect(canonicalPath('/')).toBe('/');
    expect(canonicalPath('/?q=1')).toBe('/');
    expect(canonicalPath(`${SITE_ORIGIN}/`)).toBe('/');
  });

  it('refuses a legacy default-locale prefix, because that address only redirects', () => {
    expect(() => canonicalPath('/ko')).toThrow(/never a URL prefix/u);
    expect(() => canonicalPath('/ko/learn/pot-odds')).toThrow(/never a URL prefix/u);
    expect(() => canonicalPath(`${SITE_ORIGIN}/ko/learn`)).toThrow(/never a URL prefix/u);
  });
});

describe('canonicalUrl', () => {
  it('is absolute, on the configured origin, and carries no query', () => {
    const url = canonicalUrl(ko('/tools/range?hero=BTN'));
    expect(url).toBe(`${SITE_ORIGIN}${ko('/tools/range')}`);
    expect(new URL(url).search).toBe('');
    expect(new URL(url).origin).toBe(new URL(SITE_ORIGIN).origin);
  });

  it('names the root as the bare origin, exactly as Next renders a root canonical', () => {
    expect(canonicalUrl(ko('/'))).toBe(SITE_ORIGIN);
  });
});
