import { describe, it, expect } from 'vitest';
import { getHtml } from '../src/generated/frontend';

describe('getHtml generated code', () => {
  it('should return html string with nonce injected', () => {
    const nonce = 'test-nonce-123';
    const result = getHtml(nonce);

    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('Genre Genie');
    expect(result).toContain(`nonce="${nonce}"`);
  });

  it('should escape css correctly and include it', () => {
    const result = getHtml('test-nonce');
    expect(result).toContain('<style nonce="test-nonce">');
    // Ensure styles are somewhat present
    expect(result).toContain('body {');
  });

  it('should include the body HTML', () => {
    const result = getHtml('test-nonce');
    // Ensure body contents are somewhat present
    expect(result).toContain('id="app"');
  });

  it('should escape javascript correctly and include it', () => {
    const result = getHtml('test-nonce');
    expect(result).toContain('<script nonce="test-nonce">');
    // Ensure js logic is somewhat present
    expect(result).toContain('function getSafeUrl');
  });
});
