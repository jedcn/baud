import { useState, useCallback } from 'react';

export interface UseCommandHistoryResult {
  history: string[];
  currentCommand: string | undefined;
  historyIndex: number;
  addCommand: (command: string) => void;
  navigateUp: () => void;
  navigateDown: () => void;
  resetPosition: () => void;
}

export function useCommandHistory(): UseCommandHistoryResult {
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const addCommand = useCallback((command: string) => {
    if (command.trim().length === 0) return;

    setHistory((prev) => {
      // Don't add duplicate consecutive commands
      if (prev.length > 0 && prev[prev.length - 1] === command) {
        return prev;
      }
      return [...prev, command];
    });
    setHistoryIndex(-1);
  }, []);

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

  const currentCommand = historyIndex >= 0 ? history[historyIndex] : undefined;

  return {
    history,
    currentCommand,
    historyIndex,
    addCommand,
    navigateUp,
    navigateDown,
    resetPosition,
  };
}
