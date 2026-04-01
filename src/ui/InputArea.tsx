import React, { useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { useLineEditor } from './hooks/useLineEditor.js';
import { useCommandHistory } from './hooks/useCommandHistory.js';
import { useTabCompletion } from './hooks/useTabCompletion.js';
import { useAppState } from '../state/StateContext.js';

interface InputAreaProps {
  onSubmit: (text: string) => void | Promise<void>;
  initialHistory?: string[];
  onHistoryChange?: (commands: string[]) => void;
}

export function InputArea({ onSubmit, initialHistory, onHistoryChange }: InputAreaProps) {
  const editor = useLineEditor();
  const history = useCommandHistory({ initialHistory, onHistoryChange });
  const completion = useTabCompletion();
  const { dispatch } = useAppState();

  useInput((inputChar, key) => {
    // Search mode handling
    if (history.isSearching) {
      // ESC or CTRL-G - cancel search
      if (key.escape || (key.ctrl && inputChar === 'g')) {
        const restored = history.exitSearch(false);
        editor.setText(restored);
        editor.setCursor(restored.length);
        return;
      }

      // Enter - accept match and execute
      if (key.return) {
        const match = history.exitSearch(true);
        if (match.length > 0) {
          history.addCommand(match);
          onSubmit(match);
        }
        editor.clear();
        return;
      }

      // CTRL-R again - find next older match
      if (key.ctrl && inputChar === 'r') {
        history.findNextMatch();
        return;
      }

      // CTRL-S - find next newer match (forward search)
      if (key.ctrl && inputChar === 's') {
        history.findPreviousMatch();
        return;
      }

      // Arrow keys - exit search but keep match
      if (key.upArrow || key.downArrow || key.leftArrow || key.rightArrow) {
        const match = history.exitSearch(true);
        editor.setText(match);
        editor.setCursor(match.length);
        // Don't return - let arrow keys do their normal behavior after
        if (key.upArrow) {
          history.navigateUp();
          return;
        }
        if (key.downArrow) {
          history.navigateDown();
          return;
        }
        return;
      }

      // Backspace - remove last character from search query
      if (key.backspace || key.delete) {
        history.updateSearchQuery(history.searchQuery.slice(0, -1));
        return;
      }

      // TAB during search - intentionally ignored
      if (key.tab) return;

      // Regular character - add to search query
      if (!key.ctrl && !key.meta && inputChar) {
        history.updateSearchQuery(history.searchQuery + inputChar);
        return;
      }

      return;
    }

    // Normal mode handling

    // Cancel TAB completion on any non-TAB key
    if (!key.tab && completion.isCompleting) {
      completion.cancelCompletion();
      // Do NOT return — let the key perform its normal action
    }

    // TAB - prefix-based autocomplete from history
    if (key.tab) {
      if (!completion.isCompleting) {
        const first = completion.startCompletion(editor.text, history.history);
        if (first !== undefined) {
          editor.setText(first);
          editor.setCursor(first.length);
        }
      } else {
        const next = completion.nextCompletion();
        if (next !== undefined) {
          editor.setText(next);
          editor.setCursor(next.length);
        }
      }
      return;
    }

    // CTRL-R - start reverse search
    if (key.ctrl && inputChar === 'r') {
      history.startSearch(editor.text);
      return;
    }

    // CTRL-S - start forward search
    if (key.ctrl && inputChar === 's') {
      history.startSearch(editor.text, 'forward');
      return;
    }

    // Enter key - submit command
    if (key.return) {
      onSubmit(editor.text);
      if (editor.text.length > 0) {
        history.addCommand(editor.text);
      }
      editor.clear();
      return;
    }

    // Up arrow - navigate history backward (to older commands)
    if (key.upArrow) {
      history.navigateUp();
      return;
    }

    // Down arrow - navigate history forward (to newer commands)
    if (key.downArrow) {
      history.navigateDown();
      return;
    }

    // CTRL-P - navigate history backward (same as Up arrow)
    if (key.ctrl && inputChar === 'p') {
      history.navigateUp();
      return;
    }

    // CTRL-N - navigate history forward (same as Down arrow)
    if (key.ctrl && inputChar === 'n') {
      history.navigateDown();
      return;
    }

    // Left arrow - move cursor left
    if (key.leftArrow) {
      editor.moveLeft();
      return;
    }

    // Right arrow - move cursor right
    if (key.rightArrow) {
      editor.moveRight();
      return;
    }

    // CTRL-B - move cursor left (same as Left arrow)
    if (key.ctrl && inputChar === 'b') {
      editor.moveLeft();
      return;
    }

    // CTRL-F - move cursor right (same as Right arrow)
    if (key.ctrl && inputChar === 'f') {
      editor.moveRight();
      return;
    }

    // CTRL-A - move to beginning of line
    if (key.ctrl && inputChar === 'a') {
      editor.moveHome();
      return;
    }

    // CTRL-E - move to end of line
    if (key.ctrl && inputChar === 'e') {
      editor.moveEnd();
      return;
    }

    // CTRL-K - kill from cursor to end of line
    if (key.ctrl && inputChar === 'k') {
      editor.killToEnd();
      return;
    }

    // CTRL-D - delete character at cursor (forward delete)
    if (key.ctrl && inputChar === 'd') {
      editor.deleteChar();
      return;
    }

    // CTRL-L - clear screen
    if (key.ctrl && inputChar === 'l') {
      dispatch({ type: 'CLEAR_OUTPUT' });
      return;
    }

    // Backspace - delete character before cursor
    if (key.backspace || key.delete) {
      editor.deleteCharBefore();
      return;
    }

    // Regular character input
    if (!key.ctrl && !key.meta && inputChar) {
      editor.insertChar(inputChar);
    }
  });

  // When navigating history, update the editor text and cancel any active completion
  useEffect(() => {
    if (history.currentCommand !== undefined) {
      editor.setText(history.currentCommand);
      editor.setCursor(history.currentCommand.length);
      completion.cancelCompletion();
    }
  }, [history.currentCommand]);

  // Search mode rendering
  if (history.isSearching) {
    const match = history.searchMatch ?? '';
    const label = history.searchDirection === 'backward' ? 'reverse-i-search' : 'forward-i-search';
    return (
      <Box paddingX={1}>
        <Text color="yellow">({label})`</Text>
        <Text color="cyan">{history.searchQuery}</Text>
        <Text color="yellow">':</Text>
        <Text> {match}</Text>
      </Box>
    );
  }

  // Normal mode rendering
  const textBefore = editor.text.slice(0, editor.cursor);
  const cursorChar = editor.cursor < editor.text.length ? editor.text[editor.cursor] : ' ';
  const textAfter = editor.text.slice(editor.cursor + 1);

  return (
    <Box paddingX={1}>
      {process.env.BAUD_DISPLAY_ON_PROMPT && (
        <Text color="gray">{process.env.BAUD_DISPLAY_ON_PROMPT} </Text>
      )}
      <Text color="cyan">&gt; </Text>
      <Text>{textBefore}</Text>
      <Text inverse>{cursorChar}</Text>
      <Text>{textAfter}</Text>
    </Box>
  );
}
