#!/usr/bin/env bun
import React from 'react';
import { render } from 'ink';
import { App } from './ui/App.js';
import { StateProvider } from './state/StateContext.js';
import type { ConnectionProfile } from './state/AppState.js';

function parseArgs(): { profile?: ConnectionProfile } {
  const args = process.argv.slice(2);

  // Simple argument parsing for Phase 1
  // Will expand in later phases for --profile, --script flags

  let host: string | undefined;
  let port: number | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--host' && args[i + 1]) {
      host = args[i + 1];
      i++;
    } else if (args[i] === '--port' && args[i + 1]) {
      port = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
baud - Terminal MUD/BBS Client

Usage:
  baud --host <hostname> --port <port>

Options:
  --host <hostname>  Server hostname or IP address
  --port <port>      Server port number
  --help, -h         Show this help message

Example:
  baud --host localhost --port 4000
      `);
      process.exit(0);
    }
  }

  if (!host || !port) {
    console.error('Error: Both --host and --port are required\n');
    console.error('Usage: baud --host <hostname> --port <port>');
    console.error('Try: baud --help for more information');
    process.exit(1);
  }

  const profile: ConnectionProfile = {
    id: 'default',
    name: `${host}:${port}`,
    protocol: 'telnet',
    host,
    port,
  };

  return { profile };
}

const { profile } = parseArgs();

render(
  <StateProvider>
    <App profile={profile} />
  </StateProvider>
);
