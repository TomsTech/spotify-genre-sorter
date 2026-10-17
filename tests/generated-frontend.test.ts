import { describe, it, expect } from 'vitest';
import { getHtml } from '../src/generated/frontend';

describe('getHtml', () => {
  it('should return a string containing the DOCTYPE and html tags', () => {
    const html = getHtml('test-nonce');
    expect(typeof html).toBe('string');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en">');
  });

  it('should inject the nonce into style and script tags', () => {
    const nonce = 'unique-test-nonce-12345';
    const html = getHtml(nonce);

    // Check style tag
    expect(html).toContain(`<style nonce="${nonce}">`);

    // Check script tag
    expect(html).toContain(`<script nonce="${nonce}">`);
  });

  it('should include the basic document structure', () => {
    const html = getHtml('test-nonce');
    expect(html).toContain('<head>');
    expect(html).toContain('<title>Genre Genie - Organise Your Spotify by Genre</title>');
  });
});
