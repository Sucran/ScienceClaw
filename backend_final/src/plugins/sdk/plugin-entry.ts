// Plugin entry compatibility - exports definePluginEntry and OpenClawPluginApi type

import type {
  OpenClawPluginApi,
  OpenClawPluginConfigSchema,
  PluginLogger,
} from "./core.js";

export type { OpenClawPluginApi, OpenClawPluginConfigSchema, PluginLogger };

// ============================================================================
// Plugin Definition
// ============================================================================

export type OpenClawPluginDefinition = {
  id: string;
  name: string;
  description: string;
  kind?: "memory" | "context-engine";
  configSchema?: OpenClawPluginConfigSchema;
  register: (api: OpenClawPluginApi) => void;
};

export type OpenClawPluginCommandDefinition = {
  id: string;
  name: string;
  description?: string;
  run: (ctx: PluginCommandContext) => Promise<void>;
};

export type PluginCommandContext = {
  config: Record<string, unknown>;
  pluginConfig: Record<string, unknown>;
  logger: PluginLogger;
  args: string[];
};

export type PluginInteractiveTelegramHandlerContext = {
  config: Record<string, unknown>;
  pluginConfig: Record<string, unknown>;
  logger: PluginLogger;
  update: unknown;
};

// ============================================================================
// Service Types
// ============================================================================

export type { OpenClawPluginService, OpenClawPluginServiceContext } from "./core.js";

// ============================================================================
// Provider Auth Types
// ============================================================================

export type {
  ProviderAuthContext,
  ProviderAuthMethod,
  ProviderAuthResult,
} from "./core.js";

// ============================================================================
// Config Schema Helpers
// ============================================================================

const emptyConfigSchema: OpenClawPluginConfigSchema = {
  safeParse: () => ({ success: true }),
  parse: (v) => v,
  validate: () => ({ ok: true }),
};

export function emptyPluginConfigSchema(): OpenClawPluginConfigSchema {
  return emptyConfigSchema;
}

// ============================================================================
// definePluginEntry
// ============================================================================

type DefinePluginEntryOptions = {
  id: string;
  name: string;
  description: string;
  kind?: OpenClawPluginDefinition["kind"];
  configSchema?: OpenClawPluginConfigSchema | (() => OpenClawPluginConfigSchema);
  register: (api: OpenClawPluginApi) => void;
};

function resolvePluginConfigSchema(
  configSchema: DefinePluginEntryOptions["configSchema"] = emptyConfigSchema,
): OpenClawPluginConfigSchema {
  return typeof configSchema === "function" ? configSchema() : configSchema;
}

/**
 * Canonical entry helper for non-channel plugins.
 */
export function definePluginEntry({
  id,
  name,
  description,
  kind,
  configSchema = emptyConfigSchema,
  register,
}: DefinePluginEntryOptions): {
  id: string;
  name: string;
  description: string;
  configSchema: OpenClawPluginConfigSchema;
  register: (api: OpenClawPluginApi) => void;
  kind?: "memory" | "context-engine";
} {
  return {
    id,
    name,
    description,
    ...(kind ? { kind } : {}),
    configSchema: resolvePluginConfigSchema(configSchema),
    register,
  };
}
