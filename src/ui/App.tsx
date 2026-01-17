import React, { useEffect, useMemo } from 'react';
import { Box } from 'ink';
import { StatusBar } from './StatusBar.js';
import { OutputArea } from './OutputArea.js';
import { InputArea } from './InputArea.js';
import { useAppState } from '../state/StateContext.js';
import { TelnetConnection } from '../connection/TelnetConnection.js';
import { ANSIParser } from '../connection/ANSIParser.js';
import type { ConnectionProfile } from '../state/AppState.js';

interface AppProps {
  profile?: ConnectionProfile;
}

export function App({ profile }: AppProps) {
  const { state, dispatch } = useAppState();
  const ansiParser = useMemo(() => new ANSIParser(), []);

  useEffect(() => {
    if (profile && !state.connection.currentConnection) {
      const connection = new TelnetConnection();

      connection.on('data', (data: string) => {
        // Split by newlines and emit each line separately
        const lines = data.split(/\r?\n/);
        for (const line of lines) {
          if (line.trim().length > 0) {
            const segments = ansiParser.parse(line);
            const plainText = ansiParser.strip(line);
            dispatch({ type: 'OUTPUT_LINE_RECEIVED', line: plainText, segments });
          }
        }
      });

      connection.on('status', (status: string, error?: string) => {
        dispatch({
          type: 'CONNECTION_STATUS_CHANGED',
          status: status as any,
          error
        });
      });

      connection.on('error', (error: Error) => {
        dispatch({
          type: 'CONNECTION_STATUS_CHANGED',
          status: 'error',
          error: error.message
        });
      });

      connection.connect(profile).then(() => {
        dispatch({
          type: 'CONNECTION_ESTABLISHED',
          connection,
          profile
        });
      }).catch((error) => {
        dispatch({
          type: 'CONNECTION_STATUS_CHANGED',
          status: 'error',
          error: error.message
        });
      });

      return () => {
        connection.disconnect().catch(() => {});
      };
    }
  }, [profile]);

  const handleSubmit = (text: string) => {
    if (state.connection.currentConnection) {
      state.connection.currentConnection.send(text);
    }
  };

  return (
    <Box flexDirection="column" height="100%">
      <StatusBar />
      <OutputArea />
      <InputArea onSubmit={handleSubmit} />
    </Box>
  );
}
