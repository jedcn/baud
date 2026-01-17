import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { ZodSchema } from 'zod';
import { getConfigDir, getConfigPath } from '../utils/paths.js';
import {
  MainConfigSchema,
  ProfilesConfigSchema,
  AliasesConfigSchema,
  TriggersConfigSchema,
  type MainConfig,
  type ProfilesConfig,
  type AliasesConfig,
  type TriggersConfig,
  type ConnectionProfile,
} from './schema.js';

export class ConfigManager {
  private static instance: ConfigManager;

  private constructor() {}

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Ensure the config directory exists
   */
  async ensureConfigDir(): Promise<void> {
    const configDir = getConfigDir();
    if (!existsSync(configDir)) {
      await fs.mkdir(configDir, { recursive: true });
    }
  }

  /**
   * Load a config file with schema validation
   */
  private async loadConfig<T>(
    filename: string,
    schema: ZodSchema<T>,
    defaultValue: T
  ): Promise<T> {
    const configPath = getConfigPath(filename);

    if (!existsSync(configPath)) {
      return defaultValue;
    }

    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const json = JSON.parse(content);
      return schema.parse(json);
    } catch (error) {
      console.error(`Error loading ${filename}:`, error);
      return defaultValue;
    }
  }

  /**
   * Save a config file
   */
  private async saveConfig<T>(filename: string, data: T): Promise<void> {
    await this.ensureConfigDir();
    const configPath = getConfigPath(filename);
    const content = JSON.stringify(data, null, 2);
    await fs.writeFile(configPath, content, 'utf-8');
  }

  /**
   * Load main config
   */
  async loadMainConfig(): Promise<MainConfig> {
    return this.loadConfig('config.json', MainConfigSchema, {
      scripts: [],
      maxOutputLines: 1000,
      ui: {
        theme: 'default',
        showTimestamps: false,
      },
    });
  }

  /**
   * Save main config
   */
  async saveMainConfig(config: MainConfig): Promise<void> {
    await this.saveConfig('config.json', config);
  }

  /**
   * Load profiles config
   */
  async loadProfiles(): Promise<ProfilesConfig> {
    return this.loadConfig('profiles.json', ProfilesConfigSchema, {
      profiles: [],
    });
  }

  /**
   * Save profiles config
   */
  async saveProfiles(config: ProfilesConfig): Promise<void> {
    await this.saveConfig('profiles.json', config);
  }

  /**
   * Get a specific profile by ID or name
   */
  async getProfile(idOrName: string): Promise<ConnectionProfile | null> {
    const { profiles } = await this.loadProfiles();
    return (
      profiles.find((p) => p.id === idOrName || p.name === idOrName) || null
    );
  }

  /**
   * Add or update a profile
   */
  async saveProfile(profile: ConnectionProfile): Promise<void> {
    const config = await this.loadProfiles();
    const index = config.profiles.findIndex((p) => p.id === profile.id);

    if (index >= 0) {
      config.profiles[index] = profile;
    } else {
      config.profiles.push(profile);
    }

    await this.saveProfiles(config);
  }

  /**
   * Delete a profile
   */
  async deleteProfile(id: string): Promise<void> {
    const config = await this.loadProfiles();
    config.profiles = config.profiles.filter((p) => p.id !== id);
    await this.saveProfiles(config);
  }

  /**
   * Load aliases config
   */
  async loadAliases(): Promise<AliasesConfig> {
    return this.loadConfig('aliases.json', AliasesConfigSchema, {
      aliases: [],
    });
  }

  /**
   * Save aliases config
   */
  async saveAliases(config: AliasesConfig): Promise<void> {
    await this.saveConfig('aliases.json', config);
  }

  /**
   * Load triggers config
   */
  async loadTriggers(): Promise<TriggersConfig> {
    return this.loadConfig('triggers.json', TriggersConfigSchema, {
      triggers: [],
    });
  }

  /**
   * Save triggers config
   */
  async saveTriggers(config: TriggersConfig): Promise<void> {
    await this.saveConfig('triggers.json', config);
  }
}
