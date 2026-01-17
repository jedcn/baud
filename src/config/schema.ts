import { z } from 'zod';

/**
 * Connection profile schema
 */
export const ConnectionProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  protocol: z.enum(['telnet', 'ssh']),
  host: z.string(),
  port: z.number().int().positive(),
  username: z.string().optional(),
  password: z.string().optional(),
  privateKey: z.string().optional(),
});

export type ConnectionProfile = z.infer<typeof ConnectionProfileSchema>;

/**
 * Profiles file schema (array of profiles)
 */
export const ProfilesConfigSchema = z.object({
  profiles: z.array(ConnectionProfileSchema),
});

export type ProfilesConfig = z.infer<typeof ProfilesConfigSchema>;

/**
 * Main application configuration schema
 */
export const MainConfigSchema = z.object({
  scripts: z.array(z.string()).default([]),
  maxOutputLines: z.number().int().positive().default(1000),
  defaultProfile: z.string().optional(),
  ui: z
    .object({
      theme: z.enum(['default', 'monokai', 'solarized']).default('default'),
      showTimestamps: z.boolean().default(false),
    })
    .default({}),
});

export type MainConfig = z.infer<typeof MainConfigSchema>;

/**
 * Alias schema
 */
export const AliasSchema = z.object({
  id: z.string(),
  pattern: z.string(),
  expansion: z.string(),
  enabled: z.boolean().default(true),
});

export type Alias = z.infer<typeof AliasSchema>;

/**
 * Aliases file schema
 */
export const AliasesConfigSchema = z.object({
  aliases: z.array(AliasSchema),
});

export type AliasesConfig = z.infer<typeof AliasesConfigSchema>;

/**
 * Trigger schema
 */
export const TriggerSchema = z.object({
  id: z.string(),
  pattern: z.string(),
  type: z.enum(['literal', 'regex']).default('literal'),
  enabled: z.boolean().default(true),
  priority: z.number().int().default(0),
  gag: z.boolean().default(false),
});

export type Trigger = z.infer<typeof TriggerSchema>;

/**
 * Triggers file schema
 */
export const TriggersConfigSchema = z.object({
  triggers: z.array(TriggerSchema),
});

export type TriggersConfig = z.infer<typeof TriggersConfigSchema>;
