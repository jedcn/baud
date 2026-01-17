import React from 'react';
import { Box, Text } from 'ink';
import { useAppState } from '../state/StateContext.js';

export function StatusBar() {
  const { state } = useAppState();
  const { status, profile, error } = state.connection;

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

  return (
    <Box borderStyle="single" paddingX={1}>
      <Text color={getStatusColor()}>{getStatusText()}</Text>
    </Box>
  );
}
