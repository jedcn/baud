import { Box, Static, Text } from 'ink';
import React from 'react';
import type { OutputLine, TextSegment } from '../state/AppState.js';

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
  lines: OutputLine[];
  generation: number;
}

export function OutputArea({ lines, generation }: OutputAreaProps) {
  return (
    <Static key={generation} items={lines}>
      {(line) => (
        <Box key={line.id} paddingX={1}>
          {line.segments.map((segment, segmentIndex) => renderSegment(segment, segmentIndex))}
        </Box>
      )}
    </Static>
  );
}
