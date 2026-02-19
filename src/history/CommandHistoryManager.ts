import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { getConfigPath, getConfigDir } from '../utils/paths.js';

const HISTORY_FILE = 'history.json';
const MAX_HISTORY_SIZE = 1000;

export class CommandHistoryManager {
  private static instance: CommandHistoryManager;

  private constructor() {}

  static getInstance(): CommandHistoryManager {
    if (!CommandHistoryManager.instance) {
      CommandHistoryManager.instance = new CommandHistoryManager();
    }
    return CommandHistoryManager.instance;
  }

  async load(): Promise<string[]> {
    const filePath = getConfigPath(HISTORY_FILE);

    if (!existsSync(filePath)) {
      return [];
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      if (Array.isArray(data.commands)) {
        return data.commands;
      }
      return [];
    } catch {
      return [];
    }
  }

  async save(commands: string[]): Promise<void> {
    const configDir = getConfigDir();
    if (!existsSync(configDir)) {
      await fs.mkdir(configDir, { recursive: true });
    }

    const filePath = getConfigPath(HISTORY_FILE);
    // Keep only the most recent commands if over the limit
    const trimmed = commands.length > MAX_HISTORY_SIZE
      ? commands.slice(commands.length - MAX_HISTORY_SIZE)
      : commands;

    await fs.writeFile(filePath, JSON.stringify({ commands: trimmed }, null, 2), 'utf-8');
  }
}
