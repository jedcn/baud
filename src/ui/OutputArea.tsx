import React from 'react';
import { Box, Text } from 'ink';
import { useAppState } from '../state/StateContext.js';
import type { TextSegment } from '../state/AppState.js';

function renderSegment(segment: TextSegment, index: number) {
  return (
    <Text
      key={index}
      color={segment.color}
      backgroundColor={segment.backgroundColor}
      bold={segment.bold}
      dimColor={segment.dim}
      italic={segment.italic}
      underline={segment.underline}
    >
      {segment.text}
    </Text>
  );
}

export function OutputArea() {
  const { state } = useAppState();
  const { lines } = state.output;

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      {lines.length === 0 ? (
        <Text dimColor>No output yet...</Text>
      ) : (
        lines.map((line, lineIndex) => (
          <Box key={lineIndex}>
            {line.segments.map((segment, segmentIndex) =>
              renderSegment(segment, segmentIndex)
            )}
          </Box>
        ))
      )}
    </Box>
  );
}
