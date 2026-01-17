import React from 'react';
import { Box, Text } from 'ink';
import { useAppState } from '../state/StateContext.js';

export function OutputArea() {
  const { state } = useAppState();
  const { lines } = state.output;

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      {lines.length === 0 ? (
        <Text dimColor>No output yet...</Text>
      ) : (
        lines.map((line, index) => (
          <Text key={index}>{line.text}</Text>
        ))
      )}
    </Box>
  );
}
