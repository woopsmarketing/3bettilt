import { describe, expect, it } from 'vitest';
import { routeById } from '../../lib/routes.js';
import { buildSearchUrl, parseSearchUrlQuery } from './url.js';

/** The search route's own (localised) path — the URL is built on it, never on a literal. */
const SEARCH = routeById('search').path;

describe('parseSearchUrlQuery', () => {
  it('reads a simple query', () => {
    expect(parseSearchUrlQuery('?q=%ED%8C%9F%20%EC%98%A4%EC%A6%88')).toBe('팟 오즈');
  });

  it('accepts a leading "?" or a bare query string', () => {
    expect(parseSearchUrlQuery('q=AKs')).toBe(parseSearchUrlQuery('?q=AKs'));
  });

  it('returns "" for an empty query string', () => {
    expect(parseSearchUrlQuery('')).toBe('');
  });

  it('returns "" when the parameter is absent, never null/undefined', () => {
    expect(parseSearchUrlQuery('?utm_source=x')).toBe('');
  });

  it('ignores unrelated query parameters', () => {
    expect(parseSearchUrlQuery('?utm_source=x&q=range')).toBe('range');
  });
});

describe('buildSearchUrl', () => {
  it('omits the query parameter entirely for an empty query', () => {
    expect(buildSearchUrl('')).toBe(SEARCH);
  });

  it('encodes a Korean query', () => {
    const url = buildSearchUrl('팟 오즈');
    expect(url.startsWith(`${SEARCH}?q=`)).toBe(true);
    expect(parseSearchUrlQuery(url.split('?')[1] ?? '')).toBe('팟 오즈');
  });

  it('round-trips through parseSearchUrlQuery', () => {
    for (const query of ['AKs', '레인지', '3벳', 'pot odds']) {
      const url = buildSearchUrl(query);
      const [, search] = url.split('?');
      expect(parseSearchUrlQuery(`?${search}`)).toBe(query);
    }
  });
});
