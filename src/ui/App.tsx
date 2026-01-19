import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box } from 'ink';
import { StatusBar } from './StatusBar.js';
import { OutputArea } from './OutputArea.js';
import { InputArea } from './InputArea.js';
import { useAppState } from '../state/StateContext.js';
import { TelnetConnection } from '../connection/TelnetConnection.js';
import { ANSIParser } from '../connection/ANSIParser.js';
import { LuaEngine } from '../scripting/LuaEngine.js';
import { ScriptLoader } from '../scripting/ScriptLoader.js';
import { TriggerManager } from '../triggers/TriggerManager.js';
import { AliasManager } from '../aliases/AliasManager.js';
import { TimerManager } from '../timers/TimerManager.js';
import type { ConnectionProfile } from '../state/AppState.js';

interface AppProps {
  profile?: ConnectionProfile;
  scripts?: string[];
}

export function App({ profile, scripts = [] }: AppProps) {
  const { state, dispatch } = useAppState();
  const ansiParser = useMemo(() => new ANSIParser(), []);
  const [luaEngine, setLuaEngine] = useState<LuaEngine | null>(null);
  const connectionRef = useRef(state.connection.currentConnection);
  const triggerManager = useMemo(() => new TriggerManager(), []);
  const aliasManager = useMemo(() => new AliasManager(), []);
  const timerManager = useMemo(() => new TimerManager(), []);

  // Error handler for Lua script errors
  const handleLuaError = (error: Error) => {
    const errorMessage = `Lua error: ${error.message}`;
    dispatch({
      type: 'OUTPUT_LINE_RECEIVED',
      line: errorMessage,
      segments: [{ text: errorMessage, color: '#ff0000' }],
    });
  };

  useEffect(() => {
    if (profile && !state.connection.currentConnection) {
      const connection = new TelnetConnection();

      connection.on('data', async (data: string) => {
        // Split by newlines and emit each line separately
        const lines = data.split(/\r?\n/);
        for (const line of lines) {
          if (line.trim().length > 0) {
            const segments = ansiParser.parse(line);
            const plainText = ansiParser.strip(line);

            // Process triggers with error handling
            const shouldGag = await triggerManager.processLine(
              plainText,
              handleLuaError
            );

            // Only display if not gagged
            if (!shouldGag) {
              dispatch({ type: 'OUTPUT_LINE_RECEIVED', line: plainText, segments });
            }
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

  // Keep connection ref up to date
  useEffect(() => {
    connectionRef.current = state.connection.currentConnection;
  }, [state.connection.currentConnection]);

  // Initialize Lua engine and load scripts
  useEffect(() => {
    const initLua = async () => {
      const engine = new LuaEngine({
        send: (text: string) => {
          if (connectionRef.current) {
            connectionRef.current.send(text);
          }
        },
        echo: (text: string) => {
          // Display Lua output in the output area
          const segments = [{ text }];
          dispatch({ type: 'OUTPUT_LINE_RECEIVED', line: text, segments });
        },
        createTrigger: (pattern: string, callback: any, options?: any) => {
          return triggerManager.createTrigger(pattern, callback, options);
        },
        createAlias: (pattern: string, callback: any, options?: any) => {
          return aliasManager.createAlias(pattern, callback, options);
        },
        createTimer: (interval: number, callback: any, options?: any) => {
          return timerManager.createTimer(interval, callback, options);
        },
        getTimers: () => {
          return timerManager.getTimers().map((t) => ({
            id: t.id,
            interval: t.interval,
            repeating: t.repeating,
            enabled: t.enabled,
            running: t.running,
            name: t.name,
          }));
        },
        removeTimer: (id: string) => {
          return timerManager.removeTimer(id);
        },
        enableTimer: (id: string) => {
          timerManager.enableTimer(id);
        },
        disableTimer: (id: string) => {
          timerManager.disableTimer(id);
        },
      });

      // Set error handler for timers
      timerManager.setErrorHandler(handleLuaError);

      await engine.initialize();
      setLuaEngine(engine);

      // Load scripts if provided
      if (scripts.length > 0) {
        const loader = new ScriptLoader(engine);
        const results = await loader.loadScripts(scripts);

        // Report script loading results
        for (const result of results) {
          if (result.success) {
            dispatch({
              type: 'OUTPUT_LINE_RECEIVED',
              line: `Loaded script: ${result.path}`,
              segments: [{ text: `Loaded script: ${result.path}`, color: '#00ff00' }],
            });
          } else {
            dispatch({
              type: 'OUTPUT_LINE_RECEIVED',
              line: `Script error: ${result.error}`,
              segments: [{ text: `Script error: ${result.error}`, color: '#ff0000' }],
            });
          }
        }
      }
    };

    initLua();

    return () => {
      if (luaEngine) {
        luaEngine.cleanup();
      }
      timerManager.stopAll();
    };
  }, [scripts]);

  // Auto-exit when connection is closed
  const previousStatus = useRef(state.connection.status);
  useEffect(() => {
    // Exit if we transition from 'connected' to 'disconnected'
    if (previousStatus.current === 'connected' && state.connection.status === 'disconnected') {
      process.exit(0);
    }
    previousStatus.current = state.connection.status;
  }, [state.connection.status]);

  const handleSubmit = async (text: string) => {
    // Handle /lua commands
    if (text.startsWith('/lua ')) {
      const luaCode = text.slice(5); // Remove "/lua " prefix
      if (luaEngine) {
        // Try to execute as "return <code>" first to capture expression values
        // If that fails (syntax error), fall back to executing normally
        let result = await luaEngine.execute(`return ${luaCode}`);
        if (!result.success) {
          // Failed with return prefix, try without
          result = await luaEngine.execute(luaCode);
        }
        if (!result.success) {
          dispatch({
            type: 'OUTPUT_LINE_RECEIVED',
            line: `Lua error: ${result.error}`,
            segments: [{ text: `Lua error: ${result.error}`, color: '#ff0000' }],
          });
        } else if (result.result !== undefined && result.result !== null) {
          // Display the result if there is one
          const resultText = typeof result.result === 'object'
            ? JSON.stringify(result.result, null, 2)
            : String(result.result);
          dispatch({
            type: 'OUTPUT_LINE_RECEIVED',
            line: resultText,
            segments: [{ text: resultText, color: '#ffff00' }],
          });
        }
      } else {
        dispatch({
          type: 'OUTPUT_LINE_RECEIVED',
          line: 'Lua engine not initialized',
          segments: [{ text: 'Lua engine not initialized', color: '#ff0000' }],
        });
      }
      return;
    }

    // Process aliases with error handling
    const aliasMatched = await aliasManager.processInput(text, handleLuaError);
    if (aliasMatched) {
      // Alias consumed the input
      return;
    }

    // Normal command - send to server
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
