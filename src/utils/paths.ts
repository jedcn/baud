import os from 'node:os';
import path from 'node:path';

/**
 * Get the platform-specific configuration directory for baud
 * - macOS: ~/Library/Application Support/baud/
 * - Linux: ~/.config/baud/
 * - Windows: %APPDATA%/baud/
 */
export function getConfigDir(): string {
  const platform = os.platform();
  const homeDir = os.homedir();

  switch (platform) {
    case 'darwin':
      return path.join(homeDir, 'Library', 'Application Support', 'baud');
    case 'win32':
      return path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), 'baud');
    default: // linux, freebsd, etc.
      return path.join(homeDir, '.config', 'baud');
  }
}

/**
 * Get the full path to a config file
 */
export function getConfigPath(filename: string): string {
  return path.join(getConfigDir(), filename);
}

/**
 * Standard config file names
 */
export const CONFIG_FILES = {
  MAIN: 'config.json',
  PROFILES: 'profiles.json',
  ALIASES: 'aliases.json',
  TRIGGERS: 'triggers.json',
} as const;
