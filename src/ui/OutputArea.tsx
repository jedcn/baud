import React, { useRef } from 'react';
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

interface OutputAreaProps {
  renderStats?: boolean;
}

export function OutputArea({ renderStats }: OutputAreaProps) {
  const { state } = useAppState();
  const { lines } = state.output;
  const renderCount = useRef(0);
  renderCount.current += 1;

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      {renderStats && (
        <Text dimColor>renders: {renderCount.current} | lines in state: {lines.length}</Text>
      )}
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
