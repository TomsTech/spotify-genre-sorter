import { describe, it, expect } from 'vitest';
import { getHtml } from '../src/generated/frontend';

/**
 * getSafeUrl lives in src/frontend/app.js and ships inside the bundle that
 * src/index.ts serves. Two independent defects have hidden in that path, and
 * both were green on every existing check:
 *
 *  1. The guard was twice rewritten to use URL parsing, moving the
 *     control-character strip into an unreachable catch. new URL(str, base)
 *     does not throw on an obfuscated scheme, it resolves the value as
 *     relative against the base, so DEL / C1 / NUL obfuscation passed through.
 *
 *  2. The bundle is a template literal, so rendering it consumed one level of
 *     backslash escaping. The generator did not preserve \s or \x, so the
 *     served class was /[\x00- \x7f-\x9fs]/ and stripped the letter "s"
 *     instead of whitespace, meaning "javascript:" never matched the prefix.
 *
 * Reading app.js would have missed the second defect, and reading the
 * generated bundle would have missed it too, because both hold the correct
 * text. Only the rendered output is wrong. So these tests render the page and
 * execute the function exactly as a browser receives it.
 */
function getSafeUrlAsServed(): (u: unknown) => string {
  const html = getHtml('test-nonce');
  const start = html.indexOf('function getSafeUrl');
  if (start < 0) throw new Error('getSafeUrl not present in the rendered page');

  // brace-balance scan; a regex stops at the first inner closing brace
  let depth = 0;
  let i = html.indexOf('{', start);
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  if (depth !== 0) throw new Error('unbalanced braces extracting getSafeUrl');

  const source = html.slice(start, i + 1);
  const escapeHtml = (s: unknown) =>
    String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
    );
  const win = { location: { origin: 'https://spotify.houstons.tech' } };
  return new Function('escapeHtml', 'window', `${source}; return getSafeUrl;`)(escapeHtml, win);
}

const C = (n: number) => String.fromCharCode(n);

const MUST_BLOCK: Array<[string, string]> = [
  ['plain javascript:', 'javascript:alert(1)'],
  ['mixed case', 'JaVaScRiPt:alert(1)'],
  ['leading whitespace', '  javascript:alert(1)'],
  ['tab inside scheme', `java${C(9)}script:alert(1)`],
  ['newline inside scheme', `java${C(10)}script:alert(1)`],
  ['carriage return inside scheme', `java${C(13)}script:alert(1)`],
  ['NUL inside scheme', `java${C(0)}script:alert(1)`],
  ['leading NUL', `${C(0)}javascript:alert(1)`],
  ['leading DEL', `${C(127)}javascript:alert(1)`],
  ['DEL inside scheme', `java${C(127)}script:alert(1)`],
  ['C1 0x80 inside scheme', `java${C(128)}script:alert(1)`],
  ['C1 0x9F leading', `${C(159)}javascript:alert(1)`],
  ['vbscript', 'vbscript:msgbox(1)'],
  ['vbscript with tab', `vb${C(9)}script:msgbox(1)`],
  ['vbscript with DEL', `vb${C(127)}script:msgbox(1)`],
  ['data text/html', 'data:text/html,<script>alert(1)</script>'],
  ['data uppercase', 'DATA:TEXT/HTML,x'],
  ['data with leading space', ' data:text/html,x'],
  ['data with DEL', `da${C(127)}ta:text/html,x`],
];

const MUST_PASS: Array<[string, string]> = [
  ['https url', 'https://example.com/a.png'],
  ['http url', 'http://example.com/a.png'],
  ['relative path', '/images/a.png'],
  ['data image/png', 'data:image/png;base64,iVBORw0KGgo='],
  ['data image/jpeg', 'data:image/jpeg;base64,/9j/4AAQ'],
];

describe('getSafeUrl as the browser receives it', () => {
  const getSafeUrl = getSafeUrlAsServed();

  it.each(MUST_BLOCK)('blocks %s', (_label, vector) => {
    expect(getSafeUrl(vector)).toBe('#');
  });

  it.each(MUST_PASS)('allows %s', (_label, vector) => {
    expect(getSafeUrl(vector)).not.toBe('#');
  });

  it('returns an empty string for empty input', () => {
    expect(getSafeUrl('')).toBe('');
    expect(getSafeUrl(null)).toBe('');
    expect(getSafeUrl(undefined)).toBe('');
  });
});

describe('the rendered page preserves regex escapes', () => {
  const html = getHtml('test-nonce');

  it('still parses as JavaScript', () => {
    const marker = '<script nonce="test-nonce">';
    const open = html.indexOf(marker) + marker.length + 1;
    const close = html.lastIndexOf('\n  </script>');
    // over-escaping is as damaging as under-escaping: doubling the backslash in
    // an already-escaped \' closes a string early and breaks the whole page
    expect(() => new Function(html.slice(open, close))).not.toThrow();
  });

  // each of these reached production with its backslashes stripped
  it.each([
    ['getSafeUrl control-character class', String.raw`/[\x00-\x20\x7F-\x9F\s]/g`],
    ['onclick argument parser', String.raw`/^(\w+)\s*\(([^)]*)\)$/`],
    ['location.href extractor', String.raw`location\.href\s*=\s*`],
    ['closest selector extractor', String.raw`/\.closest\s*\(\s*`],
    ['trailing function-call parser', String.raw`/;\s*(\w+)\s*\(([^)]*)\)/`],
  ])('keeps %s intact', (_label, pattern) => {
    expect(html).toContain(pattern);
  });
});
