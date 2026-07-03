import { useCallback, useState } from 'react';

export interface UseLineEditorResult {
  text: string;
  cursor: number;
  setText: (text: string) => void;
  setCursor: (position: number) => void;
  insertChar: (char: string) => void;
  deleteChar: () => void;
  deleteCharBefore: () => void;
  moveLeft: () => void;
  moveRight: () => void;
  moveHome: () => void;
  moveEnd: () => void;
  clear: () => void;
  killToEnd: () => void;
}

export function useLineEditor(initialValue = ''): UseLineEditorResult {
  const [text, setText] = useState(initialValue);
  const [cursor, setCursor] = useState(initialValue.length);

  const insertChar = useCallback(
    (char: string) => {
      setText((prev) => {
        const before = prev.slice(0, cursor);
        const after = prev.slice(cursor);
        return before + char + after;
      });
      setCursor((prev) => prev + char.length);
    },
    [cursor],
  );

  const deleteChar = useCallback(() => {
    if (cursor >= text.length) return;

    setText((prev) => {
      const before = prev.slice(0, cursor);
      const after = prev.slice(cursor + 1);
      return before + after;
    });
  }, [cursor, text.length]);

  const deleteCharBefore = useCallback(() => {
    if (cursor === 0) return;

    setText((prev) => {
      const before = prev.slice(0, cursor - 1);
      const after = prev.slice(cursor);
      return before + after;
    });
    setCursor((prev) => prev - 1);
  }, [cursor]);

  const moveLeft = useCallback(() => {
    setCursor((prev) => Math.max(0, prev - 1));
  }, []);

  const moveRight = useCallback(() => {
    setCursor((prev) => Math.min(text.length, prev + 1));
  }, [text.length]);

  const moveHome = useCallback(() => {
    setCursor(0);
  }, []);

  const moveEnd = useCallback(() => {
    setCursor(text.length);
  }, [text.length]);

  const clear = useCallback(() => {
    setText('');
    setCursor(0);
  }, []);

  const killToEnd = useCallback(() => {
    setText((prev) => prev.slice(0, cursor));
  }, [cursor]);

  return {
    text,
    cursor,
    setText,
    setCursor,
    insertChar,
    deleteChar,
    deleteCharBefore,
    moveLeft,
    moveRight,
    moveHome,
    moveEnd,
    clear,
    killToEnd,
  };
}
