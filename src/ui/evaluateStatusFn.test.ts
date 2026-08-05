import { describe, expect, it } from 'bun:test';
import { evaluateStatusFn } from './evaluateStatusFn.js';

describe('evaluateStatusFn', () => {
  it('carries text and colour through', () => {
    const segments = evaluateStatusFn(() => [{ text: 'HP:', fg: 'green' }]);
    expect(segments).toEqual([{ text: 'HP:', fg: 'green', glue: undefined, bold: undefined }]);
  });

  it('normalises glue and bold to true or undefined', () => {
    const segments = evaluateStatusFn(() => [
      { text: 'a', glue: true, bold: true },
      { text: 'b', glue: false, bold: false },
    ]);
    expect(segments[0].glue).toBe(true);
    expect(segments[0].bold).toBe(true);
    expect(segments[1].glue).toBeUndefined();
    expect(segments[1].bold).toBeUndefined();
  });

  it('reports a throwing status function as a red segment rather than crashing', () => {
    const segments = evaluateStatusFn(() => {
      throw new Error('boom');
    });
    expect(segments).toEqual([{ text: 'boom', fg: 'red' }]);
  });

  it('returns nothing when the status function does not return a list', () => {
    expect(evaluateStatusFn(() => 'not a list')).toEqual([]);
  });
});
