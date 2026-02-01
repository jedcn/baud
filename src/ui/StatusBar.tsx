import React from 'react';
import { Box, Text } from 'ink';
import { useAppState } from '../state/StateContext.js';

export function StatusBar() {
  const { state } = useAppState();
  const { status, profile, error } = state.connection;
  const segments = state.statusSegments;

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'green';
      case 'connecting':
        return 'yellow';
      case 'error':
        return 'red';
      default:
        return 'gray';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return `Connected to ${profile?.host}:${profile?.port}`;
      case 'connecting':
        return `Connecting to ${profile?.host}:${profile?.port}...`;
      case 'error':
        return `Error: ${error || 'Unknown error'}`;
      default:
        return 'Disconnected';
    }
  };

  // If custom segments are set via Lua, render those
  if (segments.length > 0) {
    const elements: React.ReactNode[] = [];

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      elements.push(
        <Text
          key={`seg-${i}`}
          color={seg.fg ?? 'green'}
          backgroundColor={seg.bg}
          bold={seg.bold ?? false}
        >
          {` ${seg.text} `}
        </Text>
      );

    }

    return (
      <Box borderStyle="round" borderColor="cyan" paddingX={1} flexShrink={0}>
        {elements}
      </Box>
    );
  }

  // Default: show connection status
  return (
    <Box borderStyle="round" borderColor="cyan" paddingX={1} flexShrink={0}>
      <Text color={getStatusColor()}>{getStatusText()}</Text>
    </Box>
  );
}
