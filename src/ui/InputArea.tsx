import React, { useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { useLineEditor } from './hooks/useLineEditor.js';
import { useCommandHistory } from './hooks/useCommandHistory.js';

interface InputAreaProps {
  onSubmit: (text: string) => void | Promise<void>;
}

export function InputArea({ onSubmit }: InputAreaProps) {
  const editor = useLineEditor();
  const history = useCommandHistory();

  useInput((inputChar, key) => {
    // Enter key - submit command
    if (key.return) {
      if (editor.text.length > 0) {
        onSubmit(editor.text);
        history.addCommand(editor.text);
        editor.clear();
      }
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

  // When navigating history, update the editor text
  useEffect(() => {
    if (history.currentCommand !== undefined) {
      editor.setText(history.currentCommand);
      editor.setCursor(history.currentCommand.length);
    }
  }, [history.currentCommand]);

  // Render text with cursor at the correct position
  const textBefore = editor.text.slice(0, editor.cursor);
  const cursorChar = editor.cursor < editor.text.length ? editor.text[editor.cursor] : ' ';
  const textAfter = editor.text.slice(editor.cursor + 1);

  return (
    <Box borderStyle="single" borderColor="cyan" paddingX={1}>
      <Text color="cyan">&gt; </Text>
      <Text>{textBefore}</Text>
      <Text inverse>{cursorChar}</Text>
      <Text>{textAfter}</Text>
    </Box>
  );
}
