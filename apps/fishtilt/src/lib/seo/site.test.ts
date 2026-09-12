/**
 * The origin contract. Every canonical, every sitemap URL and every `og:url` on the site is
 * built from `SITE_ORIGIN`, so the properties asserted here are the ones that keep those
 * three consistent — never the literal host, which is an environment setting.
 */
import { describe, expect, it } from 'vitest';
import {
  absoluteUrl,
  normaliseOrigin,
  OG_IMAGE_PATH,
  PRODUCTION_ORIGIN,
  SITE_ORIGIN,
  SITE_ORIGIN_IS_DEFAULT,
} from './site.js';

describe('normaliseOrigin', () => {
  it('keeps scheme, host and port, and tolerates only a lone trailing slash', () => {
    expect(normaliseOrigin('https://fishtilt.test')).toBe('https://fishtilt.test');
    expect(normaliseOrigin('https://fishtilt.test/')).toBe('https://fishtilt.test');
    expect(normaliseOrigin('http://127.0.0.1:3221')).toBe('http://127.0.0.1:3221');
    expect(normaliseOrigin('  https://fishtilt.test  ')).toBe('https://fishtilt.test');
  });

  it('is null for an unset or blank value — the production default applies', () => {
    expect(normaliseOrigin(undefined)).toBeNull();
    expect(normaliseOrigin('')).toBeNull();
    expect(normaliseOrigin('   ')).toBeNull();
  });

  it('throws for a value that carries a path — the locale prefix is the app`s to add (D-S3-05)', () => {
    expect(() => normaliseOrigin('https://3bettilt.com/ko')).toThrow(/no path/u);
    expect(() => normaliseOrigin('https://3bettilt.com/ko/')).toThrow(/no path/u);
    expect(() => normaliseOrigin('https://fishtilt.test/base/path?a=1#b')).toThrow(/no path/u);
    expect(() => normaliseOrigin('https://fishtilt.test/?a=1')).toThrow(/no path/u);
  });

  it('throws for anything that is not an http(s) URL rather than repairing it', () => {
    expect(() => normaliseOrigin('fishtilt.test')).toThrow(/not a URL/u);
    expect(() => normaliseOrigin('ftp://fishtilt.test')).toThrow(/http\(s\)/u);
    expect(() => normaliseOrigin('javascript:alert(1)')).toThrow(/http\(s\)/u);
  });
});

describe('SITE_ORIGIN', () => {
  it('is a usable absolute origin with no trailing slash', () => {
    expect(SITE_ORIGIN).toMatch(/^https?:\/\/[^/]+$/u);
    expect(new URL(SITE_ORIGIN).origin).toBe(SITE_ORIGIN);
  });

  it('is the production origin when nothing is configured, and says so', () => {
    expect(PRODUCTION_ORIGIN).toBe('https://3bettilt.com');
    const configured = normaliseOrigin(process.env['NEXT_PUBLIC_SITE_URL']);
    expect(SITE_ORIGIN).toBe(configured ?? PRODUCTION_ORIGIN);
    expect(SITE_ORIGIN_IS_DEFAULT).toBe(configured === null);
  });
});

describe('absoluteUrl', () => {
  it('joins the origin and a root-relative path without doubling the slash', () => {
    expect(absoluteUrl('/learn')).toBe(`${SITE_ORIGIN}/learn`);
    expect(absoluteUrl('/')).toBe(SITE_ORIGIN);
    expect(absoluteUrl(OG_IMAGE_PATH)).toBe(`${SITE_ORIGIN}${OG_IMAGE_PATH}`);
  });

  it('accepts an explicit origin, so a caller can build a URL for another host', () => {
    expect(absoluteUrl('/learn', 'https://other.test')).toBe('https://other.test/learn');
  });

  it('refuses a path that is not root-relative rather than producing a broken URL', () => {
    expect(() => absoluteUrl('learn')).toThrow(/root-relative/u);
    expect(() => absoluteUrl('https://elsewhere.invalid/learn')).toThrow(/root-relative/u);
  });
});
