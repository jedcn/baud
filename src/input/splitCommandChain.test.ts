import { describe, expect, it } from 'bun:test';
import { splitCommandChain } from './splitCommandChain.js';

describe('splitCommandChain', () => {
  it('returns single command unchanged when no &&', () => {
    expect(splitCommandChain('look')).toEqual(['look']);
  });

  it('splits two-part chain', () => {
    expect(splitCommandChain('look && inventory')).toEqual(['look', 'inventory']);
  });

  it('splits three-part chain', () => {
    expect(splitCommandChain('look && pick up diamond && south')).toEqual([
      'look',
      'pick up diamond',
      'south',
    ]);
  });

  it('trims whitespace around parts', () => {
    expect(splitCommandChain('  look  &&  south  ')).toEqual(['look', 'south']);
  });

  it('filters out empty segments', () => {
    expect(splitCommandChain('look &&  && south')).toEqual(['look', 'south']);
  });

  it('handles /lua command as first part', () => {
    expect(splitCommandChain('/lua print("hi") && south')).toEqual(['/lua print("hi")', 'south']);
  });
});
