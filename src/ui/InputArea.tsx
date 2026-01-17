import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface InputAreaProps {
  onSubmit: (text: string) => void;
}

export function InputArea({ onSubmit }: InputAreaProps) {
  const [input, setInput] = useState('');

  useInput((inputChar, key) => {
    if (key.return) {
      if (input.length > 0) {
        onSubmit(input);
        setInput('');
      }
    } else if (key.backspace || key.delete) {
      setInput(prev => prev.slice(0, -1));
    } else if (!key.ctrl && !key.meta && inputChar) {
      setInput(prev => prev + inputChar);
    }
  });

  return (
    <Box borderStyle="single" borderColor="cyan" paddingX={1}>
      <Text color="cyan">&gt; </Text>
      <Text>{input}</Text>
      <Text color="cyan">_</Text>
    </Box>
  );
}
