import { test, expect, describe } from 'bun:test';

// Test the core search algorithms directly
// These are the same algorithms used in useCommandHistory

function findMatchBackward(
  history: string[],
  query: string,
  startIndex: number
): number | null {
  if (query.length === 0) return null;
  for (let i = startIndex; i >= 0; i--) {
    if (history[i].includes(query)) {
      return i;
    }
  }
  return null;
}

function findMatchForward(
  history: string[],
  query: string,
  startIndex: number
): number | null {
  if (query.length === 0) return null;
  for (let i = startIndex; i < history.length; i++) {
    if (history[i].includes(query)) {
      return i;
    }
  }
  return null;
}

describe('Command History Search', () => {
  describe('findMatchBackward (CTRL-R)', () => {
    test('finds matching command from end of history', () => {
      const history = ['connect server', 'look', 'configure settings'];
      const result = findMatchBackward(history, 'con', history.length - 1);
      expect(result).toBe(2); // 'configure settings'
    });

    test('finds most recent match first', () => {
      const history = ['connect old', 'other', 'connect new'];
      const result = findMatchBackward(history, 'connect', history.length - 1);
      expect(result).toBe(2); // 'connect new'
    });

    test('finds earlier match when starting from middle', () => {
      const history = ['connect first', 'other', 'connect second', 'more', 'connect third'];
      // Start from index 3 (before 'connect third')
      const result = findMatchBackward(history, 'connect', 3);
      expect(result).toBe(2); // 'connect second'
    });

    test('returns null when no match found', () => {
      const history = ['connect', 'look', 'north'];
      const result = findMatchBackward(history, 'xyz', history.length - 1);
      expect(result).toBeNull();
    });

    test('returns null for empty query', () => {
      const history = ['connect', 'look'];
      const result = findMatchBackward(history, '', history.length - 1);
      expect(result).toBeNull();
    });

    test('matches substring anywhere in command', () => {
      const history = ['go north', 'look around', 'head south'];
      const result = findMatchBackward(history, 'outh', history.length - 1);
      expect(result).toBe(2); // 'head south'
    });

    test('is case-sensitive', () => {
      const history = ['Connect Server', 'connect server'];
      const result = findMatchBackward(history, 'Connect', history.length - 1);
      expect(result).toBe(0); // 'Connect Server' (only match)
    });

    test('finds match at index 0', () => {
      const history = ['unique command', 'other', 'more'];
      const result = findMatchBackward(history, 'unique', history.length - 1);
      expect(result).toBe(0);
    });

    test('handles single item history', () => {
      const history = ['only command'];
      const result = findMatchBackward(history, 'only', 0);
      expect(result).toBe(0);
    });

    test('handles empty history', () => {
      const history: string[] = [];
      const result = findMatchBackward(history, 'test', -1);
      expect(result).toBeNull();
    });
  });

  describe('findMatchForward (CTRL-S)', () => {
    test('finds matching command from start of history', () => {
      const history = ['connect server', 'look', 'configure settings'];
      const result = findMatchForward(history, 'con', 0);
      expect(result).toBe(0); // 'connect server'
    });

    test('finds next match after current position', () => {
      const history = ['connect first', 'other', 'connect second', 'more', 'connect third'];
      // Start from index 1 (after 'connect first')
      const result = findMatchForward(history, 'connect', 1);
      expect(result).toBe(2); // 'connect second'
    });

    test('returns null when no match found forward', () => {
      const history = ['connect', 'look', 'north'];
      const result = findMatchForward(history, 'connect', 1);
      expect(result).toBeNull();
    });

    test('returns null for empty query', () => {
      const history = ['connect', 'look'];
      const result = findMatchForward(history, '', 0);
      expect(result).toBeNull();
    });

    test('finds match at last index', () => {
      const history = ['other', 'more', 'unique command'];
      const result = findMatchForward(history, 'unique', 0);
      expect(result).toBe(2);
    });
  });

  describe('reverse search workflow simulation', () => {
    test('full reverse search workflow (CTRL-R repeatedly)', () => {
      const history = ['connect first', 'look', 'connect second', 'north', 'connect third'];

      // User presses CTRL-R and types 'connect'
      let matchIndex = findMatchBackward(history, 'connect', history.length - 1);
      expect(matchIndex).toBe(4); // 'connect third'
      expect(history[matchIndex!]).toBe('connect third');

      // User presses CTRL-R again
      matchIndex = findMatchBackward(history, 'connect', matchIndex! - 1);
      expect(matchIndex).toBe(2); // 'connect second'
      expect(history[matchIndex!]).toBe('connect second');

      // User presses CTRL-R again
      matchIndex = findMatchBackward(history, 'connect', matchIndex! - 1);
      expect(matchIndex).toBe(0); // 'connect first'
      expect(history[matchIndex!]).toBe('connect first');

      // User presses CTRL-R again - no more matches
      const nextMatch = findMatchBackward(history, 'connect', matchIndex! - 1);
      expect(nextMatch).toBeNull();
      // Implementation should stay on current match
    });

    test('forward search after reverse search (CTRL-S after CTRL-R)', () => {
      const history = ['connect first', 'look', 'connect second', 'north', 'connect third'];

      // User does CTRL-R twice to get to 'connect second'
      let matchIndex = findMatchBackward(history, 'connect', history.length - 1);
      matchIndex = findMatchBackward(history, 'connect', matchIndex! - 1);
      expect(history[matchIndex!]).toBe('connect second');

      // User presses CTRL-S to go forward
      matchIndex = findMatchForward(history, 'connect', matchIndex! + 1);
      expect(history[matchIndex!]).toBe('connect third');
    });

    test('refining search narrows results', () => {
      const history = ['configure', 'connect', 'config'];

      // Search for 'con' - matches 'config' (most recent)
      let matchIndex = findMatchBackward(history, 'con', history.length - 1);
      expect(history[matchIndex!]).toBe('config');

      // Refine to 'conn' - matches 'connect'
      matchIndex = findMatchBackward(history, 'conn', history.length - 1);
      expect(history[matchIndex!]).toBe('connect');

      // Refine to 'configure' - matches 'configure'
      matchIndex = findMatchBackward(history, 'configure', history.length - 1);
      expect(history[matchIndex!]).toBe('configure');
    });

    test('clearing search query clears match', () => {
      const history = ['connect', 'look'];

      // Search for 'con'
      let matchIndex = findMatchBackward(history, 'con', history.length - 1);
      expect(matchIndex).toBe(0);

      // Clear query
      matchIndex = findMatchBackward(history, '', history.length - 1);
      expect(matchIndex).toBeNull();
    });

    test('search wrapping behavior (optional)', () => {
      const history = ['connect', 'look', 'north'];

      // Search starting from beginning
      const matchIndex = findMatchBackward(history, 'connect', history.length - 1);
      expect(matchIndex).toBe(0);

      // No wrap - returns null when exhausted
      const nextMatch = findMatchBackward(history, 'connect', matchIndex! - 1);
      expect(nextMatch).toBeNull();
    });
  });

  describe('edge cases', () => {
    test('special characters in search query', () => {
      const history = ['echo "hello"', 'ls -la', 'grep ^pattern'];

      expect(findMatchBackward(history, '"', history.length - 1)).toBe(0);
      expect(findMatchBackward(history, '-la', history.length - 1)).toBe(1);
      expect(findMatchBackward(history, '^', history.length - 1)).toBe(2);
    });

    test('whitespace in search', () => {
      const history = ['go north', 'look around', 'say hello world'];

      expect(findMatchBackward(history, ' north', history.length - 1)).toBe(0);
      expect(findMatchBackward(history, 'hello world', history.length - 1)).toBe(2);
    });

    test('partial word matches', () => {
      const history = ['connection', 'connected', 'connect'];

      // All contain 'connect'
      expect(findMatchBackward(history, 'connect', history.length - 1)).toBe(2);
      expect(findMatchBackward(history, 'connect', 1)).toBe(1);
      expect(findMatchBackward(history, 'connect', 0)).toBe(0);
    });
  });
});
