import { useCallback, useState } from 'react';

export function findCandidates(history: string[], prefix: string): string[] {
  if (prefix.length === 0) return [];
  const seen = new Set<string>();
  const candidates: string[] = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i];
    if (entry.startsWith(prefix) && !seen.has(entry)) {
      seen.add(entry);
      candidates.push(entry);
    }
  }
  return candidates; // most-recent-first, deduplicated
}

export interface UseTabCompletionResult {
  isCompleting: boolean;
  startCompletion: (prefix: string, history: string[]) => string | undefined;
  nextCompletion: () => string | undefined;
  cancelCompletion: () => void;
}

export function useTabCompletion(): UseTabCompletionResult {
  const [isCompleting, setIsCompleting] = useState(false);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [candidateIndex, setCandidateIndex] = useState(0);

  const startCompletion = useCallback((prefix: string, history: string[]): string | undefined => {
    const found = findCandidates(history, prefix);
    if (found.length === 0) return undefined;
    setIsCompleting(true);
    setCandidates(found);
    setCandidateIndex(0);
    return found[0];
  }, []);

  const nextCompletion = useCallback((): string | undefined => {
    if (!isCompleting || candidates.length === 0) return undefined;
    const newIndex = (candidateIndex + 1) % candidates.length;
    setCandidateIndex(newIndex);
    return candidates[newIndex];
  }, [isCompleting, candidates, candidateIndex]);

  const cancelCompletion = useCallback(() => {
    if (!isCompleting) return;
    setIsCompleting(false);
    setCandidates([]);
    setCandidateIndex(0);
  }, [isCompleting]);

  return {
    isCompleting,
    startCompletion,
    nextCompletion,
    cancelCompletion,
  };
}
