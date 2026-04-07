// Main plugin system entry point

import type {
  PluginCandidate,
  PluginLogger,
  PluginManifest,
  PluginRecord,
  PluginRegistry,
} from "./types.js";
import type { PluginRuntime } from "./sdk/core.js";
import { discoverPlugins, getPluginsDir } from "./discovery.js";
import { parsePluginManifest } from "./manifest.js";
import { loadPluginModule } from "./loader.js";
import { createPluginRegistry, registerPlugin } from "./registry.js";
import { buildPluginApi, setGlobalRegistry } from "./api-builder.js";
import { getDefaultPluginRuntime } from "./runtime/index.js";
import type { HookHandler } from "./types.js";

export type { PluginRegistry, PluginRecord, PluginCandidate, PluginManifest };
export { createPluginRegistry };

// ============================================================================
// Logger
// ============================================================================

const defaultLogger: PluginLogger = {
  info: (msg) => console.log(`[plugins] ${msg}`),
  warn: (msg) => console.warn(`[plugins] ${msg}`),
  error: (msg) => console.error(`[plugins] ${msg}`),
  debug: (msg) => {
    if (process.env.DEBUG) console.log(`[plugins:debug] ${msg}`);
  },
};

// ============================================================================
// Load Options
// ============================================================================

export type LoadPluginsOptions = {
  pluginsDir?: string;
  logger?: PluginLogger;
  config?: Record<string, unknown>;
  runtime?: PluginRuntime;
  enabledPlugins?: string[];
  disabledPlugins?: string[];
};

// ============================================================================
// Load Plugins
// ============================================================================

/**
 * Load all plugins from the plugins directory.
 */
export async function loadPlugins(
  options: LoadPluginsOptions = {},
): Promise<PluginRegistry> {
  const {
    pluginsDir = getPluginsDir(),
    logger = defaultLogger,
    config = {},
    runtime = getDefaultPluginRuntime(),
    enabledPlugins,
    disabledPlugins = [],
  } = options;

  logger.info(`loading plugins from ${pluginsDir}`);

  // Create registry
  const registry = createPluginRegistry();
  setGlobalRegistry(registry);

  // Discover plugin candidates
  const candidates = await discoverPlugins(pluginsDir);
  logger.info(`found ${candidates.length} plugin candidate(s)`);

  // Load each plugin
  for (const candidate of candidates) {
    const result = await loadPlugin(candidate, {
      logger,
      config,
      runtime,
      enabledPlugins,
      disabledPlugins,
      registry,
    });

    if (result.ok) {
      registerPlugin(registry, result.record);
      logger.info(`loaded plugin: ${result.record.id}`);
    } else {
      logger.error(`failed to load plugin ${candidate.idHint}: ${result.errors.join(", ")}`);
    }
  }

  logger.info(`plugin loading complete: ${registry.plugins.size} plugin(s) enabled`);

  return registry;
}

/**
 * Load a single plugin from a candidate.
 */
async function loadPlugin(
  candidate: PluginCandidate,
  options: {
    logger: PluginLogger;
    config: Record<string, unknown>;
    runtime: PluginRuntime;
    enabledPlugins?: string[];
    disabledPlugins?: string[];
    registry: PluginRegistry;
  },
): Promise<
  | { ok: true; record: PluginRecord }
  | { ok: false; errors: string[] }
> {
  const { logger, config, runtime, enabledPlugins, disabledPlugins, registry } = options;
  const { rootDir, source } = candidate;

  // Parse manifest
  const manifestResult = await parsePluginManifest(rootDir);
  if (!manifestResult.ok) {
    return { ok: false, errors: manifestResult.errors };
  }

  const manifest = manifestResult.manifest;

  // Check if plugin is enabled
  const pluginId = manifest.id;

  if (disabledPlugins?.includes(pluginId)) {
    return { ok: false, errors: [`plugin ${pluginId} is explicitly disabled`] };
  }

  if (enabledPlugins && enabledPlugins.length > 0 && !enabledPlugins.includes(pluginId)) {
    return { ok: false, errors: [`plugin ${pluginId} is not in enabled list`] };
  }

  // Check if enabled by default
  if (manifest.enabledByDefault === false && (!enabledPlugins || !enabledPlugins.includes(pluginId))) {
    return { ok: false, errors: [`plugin ${pluginId} is disabled by default and not explicitly enabled`] };
  }

  // Load module
  logger.debug?.(`loading plugin module: ${source}`);
  const moduleResult = await loadPluginModule(source, rootDir);
  if (!moduleResult.ok) {
    return { ok: false, errors: moduleResult.errors };
  }

  const entry = moduleResult.entry;

  // Build plugin API
  const api = buildPluginApi({
    id: entry.id,
    name: entry.name,
    version: entry.version,
    description: entry.description,
    config,
    pluginConfig: {},
    logger: {
      debug: logger.debug,
      info: (msg: string) => logger.info(`[${entry.id}] ${msg}`),
      warn: (msg: string) => logger.warn(`[${entry.id}] ${msg}`),
      error: (msg: string) => logger.error(`[${entry.id}] ${msg}`),
    },
    rootDir,
    runtime,
    registry,
    registrationMode: "full",
  });

  // Register plugin
  try {
    entry.register(api);
  } catch (err) {
    return { ok: false, errors: [`plugin register() threw: ${String(err)}`] };
  }

  const record: PluginRecord = {
    id: entry.id,
    name: entry.name,
    version: entry.version,
    description: entry.description,
    source,
    rootDir,
    manifest,
    enabled: true,
  };

  return { ok: true, record };
}

// ============================================================================
// Service Lifecycle
// ============================================================================

/**
 * Initialize all registered services.
 */
export async function initializeServices(registry: PluginRegistry): Promise<void> {
  for (const [id, serviceRecord] of registry.services) {
    const service = serviceRecord.service as { init?: (api: unknown) => Promise<void> };
    if (service?.init) {
      try {
        await service.init({});
        console.log(`[plugins] service initialized: ${id}`);
      } catch (err) {
        console.error(`[plugins] service init failed: ${id}`, err);
      }
    }
  }
}

/**
 * Destroy all registered services.
 */
export async function destroyServices(registry: PluginRegistry): Promise<void> {
  for (const [id, serviceRecord] of registry.services) {
    const service = serviceRecord.service as { destroy?: (api: unknown) => Promise<void> };
    if (service?.destroy) {
      try {
        await service.destroy({});
        console.log(`[plugins] service destroyed: ${id}`);
      } catch (err) {
        console.error(`[plugins] service destroy failed: ${id}`, err);
      }
    }
  }
}

// ============================================================================
// Hook Execution
// ============================================================================

/**
 * Execute all handlers for a specific hook event.
 */
export async function executeHooks(
  registry: PluginRegistry,
  event: string,
  eventData: unknown,
  context: { sessionId?: string; userId?: string; agentId?: string },
): Promise<void> {
  const handlers = registry.hooks.get(event);
  if (!handlers || handlers.size === 0) return;

  for (const handler of handlers) {
    try {
      await handler(eventData, context);
    } catch (err) {
      console.error(`[plugins] hook ${event} failed:`, err);
    }
  }
}

// ============================================================================
// Re-exports
// ============================================================================

export { getPlugin, getAllPlugins } from "./registry.js";
export { getTool, getAllTools, registerTool } from "./registry.js";
export { getAllHttpRoutes } from "./registry.js";
export { getAllChannels, getChannel } from "./registry.js";
export { getContextEngine } from "./registry.js";
export { getGlobalRegistry } from "./api-builder.js";
