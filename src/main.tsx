#!/usr/bin/env bun
import { render } from 'ink';
import React from 'react';
import { ConfigManager } from './config/ConfigManager.js';
import { CommandHistoryManager } from './history/CommandHistoryManager.js';
import type { ConnectionProfile } from './state/AppState.js';
import { StateProvider } from './state/StateContext.js';
import { App } from './ui/App.js';

// Default liveness thresholds (seconds). Detection is purely time-based, so
// the dead timeout is deliberately generous to avoid killing a legitimately
// quiet session. Override or disable (0) via --idle-timeout / --idle-warn.
const DEFAULT_IDLE_WARN_SECONDS = 120;
const DEFAULT_IDLE_TIMEOUT_SECONDS = 300;

async function parseArgs(): Promise<{
  profile?: ConnectionProfile;
  scripts: string[];
  logBytesFile?: string;
  logTextFile?: string;
  idleWarnMs: number;
  idleDeadMs: number;
}> {
  const args = process.argv.slice(2);
  const configManager = ConfigManager.getInstance();

  let host: string | undefined;
  let port: number | undefined;
  let profileName: string | undefined;
  let saveProfile: string | undefined;
  let logBytesFile: string | undefined;
  let logTextFile: string | undefined;
  let idleWarnSeconds = DEFAULT_IDLE_WARN_SECONDS;
  let idleTimeoutSeconds = DEFAULT_IDLE_TIMEOUT_SECONDS;
  const scripts: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--host' && args[i + 1]) {
      host = args[i + 1];
      i++;
    } else if (args[i] === '--port' && args[i + 1]) {
      port = Number.parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--profile' && args[i + 1]) {
      profileName = args[i + 1];
      i++;
    } else if (args[i] === '--save-profile' && args[i + 1]) {
      saveProfile = args[i + 1];
      i++;
    } else if (args[i] === '--log-bytes' && args[i + 1]) {
      logBytesFile = args[i + 1];
      i++;
    } else if (args[i] === '--log-text' && args[i + 1]) {
      logTextFile = args[i + 1];
      i++;
    } else if (args[i] === '--script' && args[i + 1]) {
      scripts.push(args[i + 1]);
      i++;
    } else if (args[i] === '--idle-timeout' && args[i + 1]) {
      idleTimeoutSeconds = Number.parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--idle-warn' && args[i + 1]) {
      idleWarnSeconds = Number.parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
baud - Terminal MUD/BBS Client

Usage:
  baud --profile <name> [--script <path>]...
  baud --host <hostname> --port <port> [--save-profile <name>] [--script <path>]...

Options:
  --profile <name>         Connect using a saved profile
  --host <hostname>        Server hostname or IP address
  --port <port>            Server port number
  --save-profile <name>    Save this connection as a profile
  --script <path>          Load a Lua script file (can be specified multiple times)
  --log-bytes <path>       Log all session bytes (sent/received) as a hex dump
  --log-text <path>        Log session as plain text (received output and sent commands)
  --idle-timeout <sec>     Exit non-zero after this many seconds of inbound
                           silence (presumed dead connection). Default ${DEFAULT_IDLE_TIMEOUT_SECONDS}. 0 disables.
  --idle-warn <sec>        Show a visible warning after this many seconds of
                           inbound silence. Default ${DEFAULT_IDLE_WARN_SECONDS}. 0 disables.
  --help, -h               Show this help message

Examples:
  baud --profile myserver
  baud --host localhost --port 4000
  baud --host bbs.example.com --port 23 --save-profile mybbs
  baud --profile myserver --script ./triggers.lua --script ./aliases.lua
  baud --profile myserver --log-text ./session.txt
  baud --profile myserver --log-bytes ./session.bin.log
      `);
      process.exit(0);
    }
  }

  // Clamp negative/NaN idle values to 0 (disabled) and convert to ms.
  const idleWarnMs =
    Number.isFinite(idleWarnSeconds) && idleWarnSeconds > 0 ? idleWarnSeconds * 1000 : 0;
  const idleDeadMs =
    Number.isFinite(idleTimeoutSeconds) && idleTimeoutSeconds > 0 ? idleTimeoutSeconds * 1000 : 0;

  // Load profile from config if --profile was specified
  if (profileName) {
    const profile = await configManager.getProfile(profileName);
    if (!profile) {
      console.error(`Error: Profile '${profileName}' not found\n`);
      console.error('Use --host and --port to connect directly, or check your profiles.');
      process.exit(1);
    }
    return { profile, scripts, logBytesFile, logTextFile, idleWarnMs, idleDeadMs };
  }

  // Otherwise, require --host and --port
  if (!host || !port) {
    console.error('Error: Either --profile or both --host and --port are required\n');
    console.error('Usage: baud --profile <name>');
    console.error('   or: baud --host <hostname> --port <port>');
    console.error('Try: baud --help for more information');
    process.exit(1);
  }

  const profile: ConnectionProfile = {
    id: saveProfile || 'temp',
    name: saveProfile || `${host}:${port}`,
    protocol: 'telnet',
    host,
    port,
  };

  // Save the profile if --save-profile was specified
  if (saveProfile) {
    await configManager.saveProfile(profile);
    console.log(`Profile '${saveProfile}' saved successfully.`);
  }

  return { profile, scripts, logBytesFile, logTextFile, idleWarnMs, idleDeadMs };
}

const { profile, scripts, logBytesFile, logTextFile, idleWarnMs, idleDeadMs } = await parseArgs();
const initialHistory = await CommandHistoryManager.getInstance().load();

render(
  <StateProvider>
    <App
      profile={profile}
      scripts={scripts}
      initialHistory={initialHistory}
      logBytesFile={logBytesFile}
      logTextFile={logTextFile}
      idleWarnMs={idleWarnMs}
      idleDeadMs={idleDeadMs}
    />
  </StateProvider>,
);
