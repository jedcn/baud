import { describe, expect, it } from 'bun:test';
import { ANSIParser } from './ANSIParser.js';

// Helper: parse a single-color run and return the color of its first segment.
function colorOf(parser: ANSIParser, code: string): string | undefined {
  return parser.parse(`\x1b[${code}mX\x1b[0m`)[0]?.color;
}

function bgOf(parser: ANSIParser, code: string): string | undefined {
  return parser.parse(`\x1b[${code}mX\x1b[0m`)[0]?.backgroundColor;
}

describe('ANSIParser palettes', () => {
  describe('classic (DOS/VGA) palette', () => {
    const parser = new ANSIParser('classic');

    it('renders yellow (33) as brown, not olive', () => {
      expect(colorOf(parser, '33')).toBe('#a85400');
    });

    it('softens bright yellow (93) to the 84-floor value', () => {
      expect(colorOf(parser, '93')).toBe('#fcfc54');
    });

    it('uses the VGA value for background red (41)', () => {
      expect(bgOf(parser, '41')).toBe('#a80000');
    });

    it('applies the palette to 256-color base indices (38;5;3)', () => {
      expect(colorOf(parser, '38;5;3')).toBe('#a85400');
    });
  });

  describe('modern (xterm) palette', () => {
    const parser = new ANSIParser('modern');

    it('renders yellow (33) as olive', () => {
      expect(colorOf(parser, '33')).toBe('#cdcd00');
    });

    it('renders bright yellow (93) as pure yellow', () => {
      expect(colorOf(parser, '93')).toBe('#ffff00');
    });

    it('uses the xterm value for background red (41)', () => {
      expect(bgOf(parser, '41')).toBe('#cd0000');
    });
  });

  describe('default and fallback', () => {
    it('defaults to the modern palette', () => {
      expect(colorOf(new ANSIParser(), '33')).toBe('#cdcd00');
    });

    it('falls back to modern for an unknown palette name', () => {
      // @ts-expect-error intentionally passing an invalid palette name
      expect(colorOf(new ANSIParser('vga'), '33')).toBe('#cdcd00');
    });
  });
});
