import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * getSafeUrl lives in src/frontend/app.js and is shipped inside the committed
 * bundle src/generated/frontend.ts, which is what the Worker actually serves.
 * It is not importable, so this suite extracts it from the shipping bundle and
 * executes it. That matters: this guard has been silently weakened twice by
 * pull requests that replaced the control-character strip with URL parsing.
 * new URL(str, base) does not throw on an obfuscated scheme, it resolves the
 * value as relative against the base, so a catch-only fallback never runs and
 * DEL / C1 / NUL obfuscation passes straight through. Both regressions were
 * green on every existing check.
 */
function extractGetSafeUrl(): (u: unknown) => string {
  const bundle = readFileSync(
    join(__dirname, '..', 'src', 'generated', 'frontend.ts'),
    'utf-8',
  );
  const start = bundle.indexOf('function getSafeUrl');
  if (start < 0) throw new Error('getSafeUrl not found in the generated bundle');

  // brace-balance scan; a regex stops at the first inner closing brace
  let depth = 0;
  let i = bundle.indexOf('{', start);
  const open = i;
  for (; i < bundle.length; i++) {
    if (bundle[i] === '{') depth++;
    else if (bundle[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  if (depth !== 0) throw new Error('unbalanced braces extracting getSafeUrl');
  const source = bundle.slice(start, i + 1);
  if (open < 0) throw new Error('no function body found');

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

describe('getSafeUrl in the shipping frontend bundle', () => {
  const getSafeUrl = extractGetSafeUrl();

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
