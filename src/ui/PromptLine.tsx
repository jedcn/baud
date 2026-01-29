import React from 'react';
import { Box, Text } from 'ink';
import { useAppState } from '../state/StateContext.js';

const POWERLINE_SEPARATOR = '\u25B6';

export function PromptLine() {
  const { state } = useAppState();
  const segments = state.promptSegments;

  if (segments.length === 0) {
    return null;
  }

  const elements: React.ReactNode[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const nextSeg = segments[i + 1];

    elements.push(
      <Text
        key={`seg-${i}`}
        color={seg.fg}
        backgroundColor={seg.bg}
        bold={seg.bold}
      >
        {seg.text}
      </Text>
    );

    // Powerline separator arrow
    elements.push(
      <Text
        key={`sep-${i}`}
        color={seg.bg}
        backgroundColor={nextSeg?.bg}
      >
        {POWERLINE_SEPARATOR}
      </Text>
    );
  }

  return (
    <Box>
      {elements}
    </Box>
  );
}
