import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box } from 'ink';
import { StatusArea } from './StatusArea.js';
import { OutputArea } from './OutputArea.js';
import { InputArea } from './InputArea.js';
import { useAppState } from '../state/StateContext.js';
import { TelnetConnection } from '../connection/TelnetConnection.js';
import { ANSIParser } from '../connection/ANSIParser.js';
import { LuaEngine } from '../scripting/LuaEngine.js';
import { ScriptLoader } from '../scripting/ScriptLoader.js';
import { evaluateStatusFn } from './evaluateStatusFn.js';
import { TriggerManager } from '../triggers/TriggerManager.js';
import { OutboundTriggerManager } from '../triggers/OutboundTriggerManager.js';
import { AliasManager } from '../aliases/AliasManager.js';
import { TimerManager } from '../timers/TimerManager.js';
import { SoundManager } from '../sound/SoundManager.js';
import { CommandHistoryManager } from '../history/CommandHistoryManager.js';
import { SessionLogger } from '../logging/SessionLogger.js';
import { TextLogger } from '../logging/TextLogger.js';
import type { ConnectionProfile, StatusSegment } from '../state/AppState.js';
import { splitCommandChain } from '../input/splitCommandChain.js';

interface AppProps {
  profile?: ConnectionProfile;
  scripts?: string[];
  initialHistory?: string[];
  logBytesFile?: string;
  logTextFile?: string;
}

export function App({ profile, scripts = [], initialHistory = [], logBytesFile, logTextFile }: AppProps) {
  const { state, dispatch } = useAppState();
  const ansiParser = useMemo(() => new ANSIParser(), []);
  const [luaEngine, setLuaEngine] = useState<LuaEngine | null>(null);
  const connectionRef = useRef(state.connection.currentConnection);
  const statusFnRef = useRef<(() => any) | null>(null);
  const textLoggerRef = useRef<TextLogger | undefined>(undefined);
  const triggerManager = useMemo(() => new TriggerManager(), []);
  const outboundTriggerManager = useMemo(() => new OutboundTriggerManager(), []);
  const aliasManager = useMemo(() => new AliasManager(), []);
  const timerManager = useMemo(() => new TimerManager(), []);
  const soundManager = useMemo(() => new SoundManager(), []);
  const historyManager = useMemo(() => CommandHistoryManager.getInstance(), []);

  const handleHistoryChange = useCallback((commands: string[]) => {
    historyManager.save(commands).catch(() => {});
  }, [historyManager]);

  // Evaluate the stored status function and dispatch segments
  const evaluateStatus = () => {
    const fn = statusFnRef.current;
    if (!fn) return;
    const segments = evaluateStatusFn(fn);
    dispatch({ type: 'SET_STATUS_SEGMENTS', segments });
  };

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
      const bytesLogger = logBytesFile ? new SessionLogger(logBytesFile) : undefined;
      const textLogger = logTextFile ? new TextLogger(logTextFile) : undefined;
      textLoggerRef.current = textLogger;
      const connection = new TelnetConnection(bytesLogger);

      connection.on('data', async (data: string) => {
        // Split by newlines and process each line
        const lines = data.split(/\r?\n/);
        const nonEmptyLines = lines.filter((l) => l.trim().length > 0);
        const parsed: Array<{ line: string; segments: import('../state/AppState.js').TextSegment[] }> = [];
        for (let i = 0; i < nonEmptyLines.length; i++) {
          const line = nonEmptyLines[i];
          const segments = ansiParser.parse(line);
          const plainText = ansiParser.strip(line);
          if (textLogger) {
            textLogger.logRecv(plainText);
          }

          // Process triggers with error handling and context
          const context = { isLastLine: i === nonEmptyLines.length - 1 };
          await triggerManager.processLine(plainText, handleLuaError, context);

          parsed.push({ line: plainText, segments });
        }

        // Dispatch all lines in a single action to avoid per-line re-renders
        if (parsed.length > 0) {
          dispatch({ type: 'OUTPUT_LINES_RECEIVED', lines: parsed });
        }

        // Re-evaluate status bar after processing server data
        evaluateStatus();
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
          // Process outbound triggers before sending
          outboundTriggerManager.processCommand(text, handleLuaError);
          if (connectionRef.current) {
            connectionRef.current.send(text);
          }
        },
        echo: (text: string) => {
          // Display Lua output in the output area
          const segments = [{ text }];
          dispatch({ type: 'OUTPUT_LINE_RECEIVED', line: text, segments });
        },
        cecho: (color: string, text: string) => {
          const segments = [{ text, color }];
          dispatch({ type: 'OUTPUT_LINE_RECEIVED', line: text, segments });
        },
        createTrigger: (pattern: string, callback: any, options?: any) => {
          return triggerManager.createTrigger(pattern, callback, options);
        },
        createOutboundTrigger: (pattern: string, callback: any, options?: any) => {
          return outboundTriggerManager.createOutboundTrigger(pattern, callback, options);
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
        getAliases: () => {
          return aliasManager.getAliases().map((a) => ({
            id: a.id,
            pattern: a.pattern,
            type: a.type,
            enabled: a.enabled,
          }));
        },
        getTriggers: () => {
          return triggerManager.getTriggers().map((t) => ({
            id: t.id,
            pattern: t.pattern,
            type: t.type,
            enabled: t.enabled,
          }));
        },
        getOutboundTriggers: () => {
          return outboundTriggerManager.getOutboundTriggers().map((t) => ({
            id: t.id,
            pattern: t.pattern,
            type: t.type,
            enabled: t.enabled,
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
        setStatus: (segmentsOrFunction: any) => {
          if (typeof segmentsOrFunction === 'function') {
            statusFnRef.current = segmentsOrFunction;
            evaluateStatus();
          } else if (Array.isArray(segmentsOrFunction)) {
            statusFnRef.current = null;
            const segments: StatusSegment[] = segmentsOrFunction.map((s: any) => ({
              text: String(s.text ?? ''),
              fg: s.fg,
            }));
            dispatch({ type: 'SET_STATUS_SEGMENTS', segments });
          } else {
            statusFnRef.current = null;
            dispatch({ type: 'SET_STATUS_SEGMENTS', segments: [] });
          }
        },
        registerSound: (name: string, filepath: string) => {
          soundManager.registerSound(name, filepath);
        },
        removeSound: (name: string) => {
          return soundManager.removeSound(name);
        },
        playSound: (name: string, options?: any) => {
          soundManager.playSound(name, options);
        },
        getSounds: () => {
          return soundManager.getSounds();
        },
        say: (text: string, options?: any) => {
          soundManager.say(text, options);
        },
        reloadScript: async () => {
          // Clear all triggers, aliases, timers, and sounds
          triggerManager.clearTriggers();
          outboundTriggerManager.clearOutboundTriggers();
          aliasManager.clearAliases();
          timerManager.clearTimers();
          soundManager.clearSounds();

          // Reload all scripts
          if (scripts.length > 0) {
            const loader = new ScriptLoader(engine);
            const results = await loader.loadScripts(scripts);

            // Report script loading results
            for (const result of results) {
              if (result.success) {
                dispatch({
                  type: 'OUTPUT_LINE_RECEIVED',
                  line: `Reloaded script: ${result.path}`,
                  segments: [{ text: `Reloaded script: ${result.path}`, color: '#00ff00' }],
                });
              } else {
                dispatch({
                  type: 'OUTPUT_LINE_RECEIVED',
                  line: `Script error: ${result.error}`,
                  segments: [{ text: `Script error: ${result.error}`, color: '#ff0000' }],
                });
              }
            }
          } else {
            dispatch({
              type: 'OUTPUT_LINE_RECEIVED',
              line: 'No scripts to reload',
              segments: [{ text: 'No scripts to reload', color: '#ffff00' }],
            });
          }
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
    // Handle command chaining: "look && get sword && south"
    const parts = splitCommandChain(text);
    if (parts.length > 1) {
      for (const part of parts) {
        await handleSubmit(part);
      }
      return;
    }

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
      // Echo the alias input so user sees what they typed
      dispatch({
        type: 'OUTPUT_LINE_RECEIVED',
        line: text,
        segments: [{ text: text, color: '#00ffff' }],
      });
      return;
    }

    // Normal command - process outbound triggers and send to server
    if (state.connection.currentConnection) {
      await outboundTriggerManager.processCommand(text, handleLuaError);
      if (textLoggerRef.current) {
        textLoggerRef.current.logSend(text);
      }
      state.connection.currentConnection.send(text);
    }
  };

  return (
    <Box flexDirection="column" height="100%">
      <OutputArea lines={state.output.lines} />
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" flexShrink={0}>
        <InputArea onSubmit={handleSubmit} initialHistory={initialHistory} onHistoryChange={handleHistoryChange} />
        <Box borderStyle="single" borderColor="gray" borderBottom={false} borderLeft={false} borderRight={false} />
        <StatusArea />
      </Box>
    </Box>
  );
}
