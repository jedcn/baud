import { test, expect, describe } from 'bun:test';
import { findCandidates } from '../src/ui/hooks/useTabCompletion.js';

describe('findCandidates', () => {
  test('empty prefix returns []', () => {
    const history = ['connect', 'look', 'north'];
    expect(findCandidates(history, '')).toEqual([]);
  });

  test('no matches returns []', () => {
    const history = ['connect', 'look', 'north'];
    expect(findCandidates(history, 'xyz')).toEqual([]);
  });

  test('single match returned', () => {
    const history = ['look', 'north', 'connect server'];
    expect(findCandidates(history, 'con')).toEqual(['connect server']);
  });

  test('multiple matches in most-recent-first order', () => {
    const history = ['connect first', 'look', 'connect second', 'north', 'connect third'];
    expect(findCandidates(history, 'connect')).toEqual([
      'connect third',
      'connect second',
      'connect first',
    ]);
  });

  test('deduplication — duplicate entries collapse to one', () => {
    const history = ['connect', 'look', 'connect', 'north', 'connect'];
    expect(findCandidates(history, 'connect')).toEqual(['connect']);
  });

  test('prefix match only — mid-string occurrences excluded', () => {
    const history = ['do connect', 'reconnect', 'connect here'];
    expect(findCandidates(history, 'connect')).toEqual(['connect here']);
  });

  test('case-sensitive matching', () => {
    const history = ['Connect Server', 'connect server'];
    expect(findCandidates(history, 'Connect')).toEqual(['Connect Server']);
    expect(findCandidates(history, 'connect')).toEqual(['connect server']);
  });

  test('prefix that exactly equals a history entry still matches', () => {
    const history = ['look', 'connect'];
    expect(findCandidates(history, 'connect')).toEqual(['connect']);
  });
});

describe('cycling workflow simulation', () => {
  test('first match is most recent', () => {
    const history = ['connect first', 'look', 'connect second'];
    const candidates = findCandidates(history, 'connect');
    expect(candidates[0]).toBe('connect second');
  });

  test('repeated TABs cycle through all matches then wrap back to first', () => {
    const history = ['connect first', 'look', 'connect second', 'north', 'connect third'];
    const candidates = findCandidates(history, 'connect');
    expect(candidates).toEqual(['connect third', 'connect second', 'connect first']);

    // Simulate cycling with wrap-around
    let idx = 0;
    expect(candidates[idx]).toBe('connect third');

    idx = (idx + 1) % candidates.length;
    expect(candidates[idx]).toBe('connect second');

    idx = (idx + 1) % candidates.length;
    expect(candidates[idx]).toBe('connect first');

    // Wrap back to first
    idx = (idx + 1) % candidates.length;
    expect(candidates[idx]).toBe('connect third');
  });

  test('single candidate wraps to itself', () => {
    const history = ['look', 'connect server'];
    const candidates = findCandidates(history, 'connect');
    expect(candidates).toEqual(['connect server']);

    let idx = 0;
    expect(candidates[idx]).toBe('connect server');

    // Wrap
    idx = (idx + 1) % candidates.length;
    expect(candidates[idx]).toBe('connect server');
  });
});
