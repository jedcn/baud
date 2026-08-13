import { Box } from 'ink';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AliasManager } from '../aliases/AliasManager.js';
import { ANSIParser, type PaletteName } from '../connection/ANSIParser.js';
import { TelnetConnection } from '../connection/TelnetConnection.js';
import { describeConnectError } from '../connection/connectError.js';
import { CommandHistoryManager } from '../history/CommandHistoryManager.js';
import { HttpClient } from '../http/HttpClient.js';
import { createLuaHttpApi } from '../http/luaHttp.js';
import { splitCommandChain } from '../input/splitCommandChain.js';
import { SessionDiagnostics } from '../logging/SessionDiagnostics.js';
import { SessionLogger } from '../logging/SessionLogger.js';
import { TextLogger } from '../logging/TextLogger.js';
import { LuaEngine } from '../scripting/LuaEngine.js';
import { ScriptLoader } from '../scripting/ScriptLoader.js';
import { SoundManager } from '../sound/SoundManager.js';
import type { ConnectionProfile, StatusSegment } from '../state/AppState.js';
import { useAppState } from '../state/StateContext.js';
import { TimerManager } from '../timers/TimerManager.js';
import { OutboundTriggerManager } from '../triggers/OutboundTriggerManager.js';
import { TriggerManager } from '../triggers/TriggerManager.js';
import { InputArea } from './InputArea.js';
import { OutputArea } from './OutputArea.js';
import { StatusArea } from './StatusArea.js';
import { evaluateStatusFn } from './evaluateStatusFn.js';

/** How long a failed connection stays on screen before the process gives up. */
const FAILED_CONNECT_EXIT_DELAY_MS = 5000;

interface AppProps {
  profile?: ConnectionProfile;
  scripts?: string[];
  initialHistory?: string[];
  logBytesFile?: string;
  logTextFile?: string;
  palette?: PaletteName;
}

export function App({
  profile,
  scripts = [],
  initialHistory = [],
  logBytesFile,
  logTextFile,
  palette = 'modern',
}: AppProps) {
  const { state, dispatch } = useAppState();
  const ansiParser = useMemo(() => new ANSIParser(palette), [palette]);
  const [luaEngine, setLuaEngine] = useState<LuaEngine | null>(null);
  const connectionRef = useRef(state.connection.currentConnection);
  const statusFnRef = useRef<(() => any) | null>(null);
  const textLoggerRef = useRef<TextLogger | undefined>(undefined);
  const triggerManager = useMemo(() => new TriggerManager(), []);
  const outboundTriggerManager = useMemo(() => new OutboundTriggerManager(), []);
  const aliasManager = useMemo(() => new AliasManager(), []);
  const timerManager = useMemo(() => new TimerManager(), []);
  const soundManager = useMemo(() => new SoundManager(), []);
  const httpClient = useMemo(() => new HttpClient(), []);
  const historyManager = useMemo(() => CommandHistoryManager.getInstance(), []);

  const handleHistoryChange = useCallback(
    (commands: string[]) => {
      historyManager.save(commands).catch(() => {});
    },
    [historyManager],
  );

  // Read live literal alias names for TAB completion. Aliases populate asynchronously
  // after scripts load, so this getter is called at TAB-press time rather than snapshotting.
  const getAliasNames = useCallback(
    () =>
      aliasManager
        .getAliases()
        .filter((a) => a.enabled && a.type === 'literal')
        .map((a) => a.pattern),
    [aliasManager],
  );

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
    textLoggerRef.current?.logRecv(errorMessage);
    dispatch({
      type: 'OUTPUT_LINE_RECEIVED',
      line: errorMessage,
      segments: [{ text: errorMessage, color: '#ff0000' }],
    });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: connection is set up once for the given profile; re-running on every dep change would reconnect
  useEffect(() => {
    if (profile && !state.connection.currentConnection) {
      const bytesLogger = logBytesFile ? new SessionLogger(logBytesFile) : undefined;
      const textLogger = logTextFile ? new TextLogger(logTextFile) : undefined;
      textLoggerRef.current = textLogger;

      // Collect why-did-it-end facts for a diagnostic report. Print it on any
      // process exit — a clean quit, a server drop, or a network error all
      // funnel through here — so there's always meaningful output to hand a
      // future Claude when debugging "I keep losing my connection".
      const diagnostics = new SessionDiagnostics(profile.host, profile.port);
      const printDiagnostics = () => {
        // If nothing set a terminal reason, we're still connected and the
        // process is exiting — that's a normal user quit (e.g. Ctrl+C).
        diagnostics.end('user-quit');
        diagnostics.printOnce();
      };
      process.on('exit', printDiagnostics);

      const connection = new TelnetConnection(bytesLogger, diagnostics);

      // Publish the profile before dialling so the status bar can name the host
      // it's connecting to (and, if it fails, the one that didn't answer).
      dispatch({ type: 'CONNECTION_STARTED', profile });

      connection.on('data', async (data: string) => {
        // Split by newlines and emit each line separately
        const lines = data.split(/\r?\n/);
        const nonEmptyLines = lines.filter((l) => l.trim().length > 0);
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

          dispatch({ type: 'OUTPUT_LINE_RECEIVED', line: plainText, segments });
        }

        // Re-evaluate status bar after processing server data
        evaluateStatus();
      });

      connection.on('status', (status: string, error?: string) => {
        dispatch({
          type: 'CONNECTION_STATUS_CHANGED',
          status: status as any,
          error,
        });
      });

      connection.on('error', (error: Error) => {
        dispatch({
          type: 'CONNECTION_STATUS_CHANGED',
          status: 'error',
          error: describeConnectError(error),
        });
      });

      connection
        .connect(profile)
        .then(() => {
          dispatch({
            type: 'CONNECTION_ESTABLISHED',
            connection,
            profile,
          });
        })
        .catch((error) => {
          dispatch({
            type: 'CONNECTION_STATUS_CHANGED',
            status: 'error',
            error: describeConnectError(error),
          });
        });

      return () => {
        process.removeListener('exit', printDiagnostics);
        connection.disconnect().catch(() => {});
      };
    }
  }, [profile]);

  // Keep connection ref up to date
  useEffect(() => {
    connectionRef.current = state.connection.currentConnection;
  }, [state.connection.currentConnection]);

  // Initialize Lua engine and load scripts
  // biome-ignore lint/correctness/useExhaustiveDependencies: the engine is initialized once and only reloads when the script list changes
  useEffect(() => {
    const initLua = async () => {
      const httpApi = createLuaHttpApi(httpClient, handleLuaError);

      const engine = new LuaEngine({
        send: (text: string) => {
          // Process outbound triggers before sending
          outboundTriggerManager.processCommand(text, handleLuaError);
          // Log it the same way typed input is logged. Without this a session
          // log holds only what the user typed and what the server said, so a
          // script's own traffic has to be inferred from the server's echoes
          // of it -- and a script that sends the *wrong* thing leaves no
          // direct evidence at all.
          textLoggerRef.current?.logSend(text);
          if (connectionRef.current) {
            connectionRef.current.send(text);
          }
        },
        echo: (text: string) => {
          textLoggerRef.current?.logRecv(text);
          const segments = [{ text }];
          dispatch({ type: 'OUTPUT_LINE_RECEIVED', line: text, segments });
        },
        cecho: (color: string, text: string) => {
          const segments = [{ text, color }];
          dispatch({ type: 'OUTPUT_LINE_RECEIVED', line: text, segments });
        },
        cechoBg: (color: string, backgroundColor: string, text: string, bold?: boolean) => {
          const segments = [{ text, color, backgroundColor, bold }];
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
        removeTrigger: (id: string) => {
          return triggerManager.removeTrigger(id);
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
        httpRequest: httpApi.httpRequest,
        httpGet: httpApi.httpGet,
        httpPost: httpApi.httpPost,
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

  // Auto-exit when the connection is gone. Once we've been connected, reaching
  // 'disconnected' means the session is over — whether it got there cleanly or
  // by way of an 'error' first (a network drop is connected -> error ->
  // disconnected). Exiting lets the process 'exit' hook print the diagnostics.
  //
  // If we never connected at all there's nothing to sit in front of, so rather
  // than parking in a dead TUI we report the failure like `telnet` does and
  // exit non-zero. The delay leaves the reason readable in the status bar first.
  const hasConnected = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the exit decision follows the status; profile/error are read at the moment it changes
  useEffect(() => {
    const { status, error } = state.connection;

    if (status === 'connected') {
      hasConnected.current = true;
    }

    if (hasConnected.current) {
      if (status === 'disconnected') {
        process.exit(0);
      }
      return;
    }

    if (status !== 'error' || !profile) return;

    const timer = setTimeout(() => {
      const reason = error ?? 'Unknown error';
      process.stderr.write(
        `baud: connect to ${profile.host}:${profile.port}: ${reason}\nbaud: Unable to connect to remote host\n`,
      );
      process.exit(1);
    }, FAILED_CONNECT_EXIT_DELAY_MS);

    return () => clearTimeout(timer);
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
          const resultText =
            typeof result.result === 'object'
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

  // Write the physical screen clear after React has re-rendered with the new generation,
  // so <Static> has already remounted before Ink's cursor tracking is affected.
  useEffect(() => {
    if (state.output.generation > 0) {
      process.stdout.write('\x1B[2J\x1B[H');
    }
  }, [state.output.generation]);

  return (
    <>
      <OutputArea lines={state.output.lines} generation={state.output.generation} />
      <Box flexDirection="column" borderStyle="round" borderColor="cyan">
        <InputArea
          onSubmit={handleSubmit}
          initialHistory={initialHistory}
          onHistoryChange={handleHistoryChange}
          getAliasNames={getAliasNames}
        />
        <Box
          borderStyle="single"
          borderColor="gray"
          borderBottom={false}
          borderLeft={false}
          borderRight={false}
        />
        <StatusArea />
      </Box>
    </>
  );
}
