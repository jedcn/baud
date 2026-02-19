import { useState, useCallback } from 'react';

export interface UseCommandHistoryResult {
  history: string[];
  currentCommand: string | undefined;
  historyIndex: number;
  addCommand: (command: string) => void;
  navigateUp: () => void;
  navigateDown: () => void;
  resetPosition: () => void;
  // Search functionality
  isSearching: boolean;
  searchQuery: string;
  searchMatch: string | undefined;
  startSearch: (currentInput: string) => void;
  updateSearchQuery: (query: string) => void;
  findNextMatch: () => void;
  findPreviousMatch: () => void;
  exitSearch: (accept: boolean) => string;
}

interface UseCommandHistoryOptions {
  initialHistory?: string[];
  onHistoryChange?: (commands: string[]) => void;
}

export function useCommandHistory(options: UseCommandHistoryOptions = {}): UseCommandHistoryResult {
  const { initialHistory = [], onHistoryChange } = options;
  const [history, setHistory] = useState<string[]>(initialHistory);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Search state
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatchIndex, setSearchMatchIndex] = useState<number | null>(null);
  const [savedInput, setSavedInput] = useState('');

  const addCommand = useCallback((command: string) => {
    if (command.trim().length === 0) return;

    setHistory((prev) => {
      // Don't add duplicate consecutive commands
      if (prev.length > 0 && prev[prev.length - 1] === command) {
        return prev;
      }
      const updated = [...prev, command];
      onHistoryChange?.(updated);
      return updated;
    });
    setHistoryIndex(-1);
  }, [onHistoryChange]);

  const navigateUp = useCallback(() => {
    setHistoryIndex((current) => {
      if (history.length === 0) return -1;

      // If at -1 (not in history), go to most recent
      if (current === -1) {
        return history.length - 1;
      }

      // Don't go past the oldest command
      return Math.max(0, current - 1);
    });
  }, [history.length]);

  const navigateDown = useCallback(() => {
    setHistoryIndex((current) => {
      if (current === -1) return -1;

      // If at the most recent, go back to -1 (current input)
      if (current === history.length - 1) {
        return -1;
      }

      return current + 1;
    });
  }, [history.length]);

  const resetPosition = useCallback(() => {
    setHistoryIndex(-1);
  }, []);

  // Search backward through history for a query
  const findMatchBackward = useCallback(
    (query: string, startIndex: number): number | null => {
      if (query.length === 0) return null;
      for (let i = startIndex; i >= 0; i--) {
        if (history[i].includes(query)) {
          return i;
        }
      }
      return null;
    },
    [history]
  );

  // Search forward through history for a query
  const findMatchForward = useCallback(
    (query: string, startIndex: number): number | null => {
      if (query.length === 0) return null;
      for (let i = startIndex; i < history.length; i++) {
        if (history[i].includes(query)) {
          return i;
        }
      }
      return null;
    },
    [history]
  );

  // Start reverse search mode
  const startSearch = useCallback((currentInput: string) => {
    setSavedInput(currentInput);
    setIsSearching(true);
    setSearchQuery('');
    setSearchMatchIndex(null);
  }, []);

  // Update search query and find match
  const updateSearchQuery = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (query.length === 0) {
        setSearchMatchIndex(null);
        return;
      }
      // Search from the most recent command
      const matchIndex = findMatchBackward(query, history.length - 1);
      setSearchMatchIndex(matchIndex);
    },
    [findMatchBackward, history.length]
  );

  // Find the next older match (CTRL-R again)
  const findNextMatch = useCallback(() => {
    if (searchQuery.length === 0 || searchMatchIndex === null) return;
    // Search from one before the current match
    const nextMatchIndex = findMatchBackward(searchQuery, searchMatchIndex - 1);
    if (nextMatchIndex !== null) {
      setSearchMatchIndex(nextMatchIndex);
    }
    // If no more matches, stay on current match (could wrap around instead)
  }, [searchQuery, searchMatchIndex, findMatchBackward]);

  // Find the next newer match (CTRL-S)
  const findPreviousMatch = useCallback(() => {
    if (searchQuery.length === 0 || searchMatchIndex === null) return;
    // Search from one after the current match
    const nextMatchIndex = findMatchForward(searchQuery, searchMatchIndex + 1);
    if (nextMatchIndex !== null) {
      setSearchMatchIndex(nextMatchIndex);
    }
    // If no more matches, stay on current match
  }, [searchQuery, searchMatchIndex, findMatchForward]);

  // Exit search mode
  const exitSearch = useCallback(
    (accept: boolean): string => {
      setIsSearching(false);
      const result = accept && searchMatchIndex !== null ? history[searchMatchIndex] : savedInput;
      setSearchQuery('');
      setSearchMatchIndex(null);
      setSavedInput('');
      setHistoryIndex(-1);
      return result;
    },
    [history, searchMatchIndex, savedInput]
  );

  const currentCommand = historyIndex >= 0 ? history[historyIndex] : undefined;
  const searchMatch = searchMatchIndex !== null ? history[searchMatchIndex] : undefined;

  return {
    history,
    currentCommand,
    historyIndex,
    addCommand,
    navigateUp,
    navigateDown,
    resetPosition,
    // Search functionality
    isSearching,
    searchQuery,
    searchMatch,
    startSearch,
    updateSearchQuery,
    findNextMatch,
    findPreviousMatch,
    exitSearch,
  };
}
