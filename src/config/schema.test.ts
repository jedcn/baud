import { describe, expect, it } from 'bun:test';
import { MainConfigSchema } from './schema.js';

describe('MainConfigSchema ui.palette', () => {
  it('defaults to modern when omitted', () => {
    expect(MainConfigSchema.parse({}).ui.palette).toBe('modern');
  });

  it('accepts the classic palette', () => {
    expect(MainConfigSchema.parse({ ui: { palette: 'classic' } }).ui.palette).toBe('classic');
  });

  it('rejects an unknown palette value', () => {
    expect(() => MainConfigSchema.parse({ ui: { palette: 'vga' } })).toThrow();
  });
});
