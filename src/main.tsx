#!/usr/bin/env bun
import React from 'react';
import { render } from 'ink';
import { App } from './ui/App.js';
import { StateProvider } from './state/StateContext.js';
import { ConfigManager } from './config/ConfigManager.js';
import type { ConnectionProfile } from './state/AppState.js';

async function parseArgs(): Promise<{ profile?: ConnectionProfile; scripts: string[] }> {
  const args = process.argv.slice(2);
  const configManager = ConfigManager.getInstance();

  let host: string | undefined;
  let port: number | undefined;
  let profileName: string | undefined;
  let saveProfile: string | undefined;
  const scripts: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--host' && args[i + 1]) {
      host = args[i + 1];
      i++;
    } else if (args[i] === '--port' && args[i + 1]) {
      port = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--profile' && args[i + 1]) {
      profileName = args[i + 1];
      i++;
    } else if (args[i] === '--save-profile' && args[i + 1]) {
      saveProfile = args[i + 1];
      i++;
    } else if (args[i] === '--script' && args[i + 1]) {
      scripts.push(args[i + 1]);
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
  --help, -h               Show this help message

Examples:
  baud --profile myserver
  baud --host localhost --port 4000
  baud --host bbs.example.com --port 23 --save-profile mybbs
  baud --profile myserver --script ./triggers.lua --script ./aliases.lua
      `);
      process.exit(0);
    }
  }

  // Load profile from config if --profile was specified
  if (profileName) {
    const profile = await configManager.getProfile(profileName);
    if (!profile) {
      console.error(`Error: Profile '${profileName}' not found\n`);
      console.error('Use --host and --port to connect directly, or check your profiles.');
      process.exit(1);
    }
    return { profile, scripts };
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

  return { profile, scripts };
}

const { profile, scripts } = await parseArgs();

render(
  <StateProvider>
    <App profile={profile} scripts={scripts} />
  </StateProvider>
);
