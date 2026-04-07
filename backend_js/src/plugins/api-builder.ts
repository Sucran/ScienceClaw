// API builder - constructs OpenClawPluginApi for each plugin

import { resolve } from "node:path";
import type {
  ChannelRegistration,
  HookHandler,
  HttpRoute,
  OpenClawPluginApi,
  OpenClawPluginService,
} from "./types.js";
import type {
  ChannelPlugin,
  OpenClawPluginToolDefinition,
  PluginLogger,
  PluginRuntime,
} from "./sdk/core.js";
import {
  registerChannel,
  registerHook as registryRegisterHook,
  registerHttpRoute,
  registerService,
  registerTool as registryRegisterTool,
} from "./registry.js";

// Global registry reference (set during loadPlugins)
let globalRegistry: ReturnType<typeof import("./registry.js").createPluginRegistry> | null = null;

export function setGlobalRegistry(
  registry: ReturnType<typeof import("./registry.js").createPluginRegistry>,
): void {
  globalRegistry = registry;
}

export function getGlobalRegistry() {
  return globalRegistry;
}

/**
 * Build an OpenClawPluginApi instance for a plugin.
 */
export function buildPluginApi(options: {
  id: string;
  name: string;
  version?: string;
  description?: string;
  config: Record<string, unknown>;
  pluginConfig: Record<string, unknown>;
  logger: PluginLogger;
  rootDir: string;
  runtime?: PluginRuntime;
  registry: ReturnType<typeof import("./registry.js").createPluginRegistry>;
  registrationMode?: "setup" | "cli-metadata" | "full";
}): OpenClawPluginApi {
  const {
    id,
    name,
    version,
    description,
    config,
    pluginConfig,
    logger,
    rootDir,
    runtime,
    registry,
    registrationMode = "full",
  } = options;

  const api: OpenClawPluginApi = {
    // Identity
    id,
    name,
    version,
    description,

    // Config
    config,
    pluginConfig,

    // Runtime
    runtime,

    // Registration mode
    registrationMode,

    // Tool registration
    registerTool(tool: OpenClawPluginToolDefinition) {
      if (registrationMode === "cli-metadata") return;
      registryRegisterTool(registry, id, tool);
      logger.debug?.(`registered tool: ${tool.name}`);
    },

    // Hook registration
    registerHook(
      events: string | string[],
      handler: HookHandler,
    ) {
      if (registrationMode === "cli-metadata") return;
      const eventList = Array.isArray(events) ? events : [events];
      for (const event of eventList) {
        registryRegisterHook(registry, id, event, handler);
      }
      logger.debug?.(`registered hook(s): ${eventList.join(", ")}`);
    },

    // Service registration
    registerService(service: OpenClawPluginService) {
      if (registrationMode === "cli-metadata") return;
      registerService(registry, service);
      logger.debug?.(`registered service: ${service.id}`);
    },

    // HTTP route registration
    registerHttpRoute(route: HttpRoute) {
      if (registrationMode === "cli-metadata") return;
      registerHttpRoute(registry, route);
      logger.debug?.(`registered HTTP route: ${route.method} ${route.path}`);
    },

    // Channel registration
    registerChannel(registration: ChannelRegistration) {
      if (registrationMode === "cli-metadata") return;
      const plugin = registration.plugin as ChannelPlugin;
      registerChannel(registry, plugin);
      if (registration.setupRuntime && runtime) {
        registration.setupRuntime(runtime);
      }
      logger.debug?.(`registered channel: ${plugin.id}`);
    },

    // Context engine registration (if supported)
    registerContextEngine(engineId: string, engine: unknown) {
      if (registrationMode === "cli-metadata") return;
      registry.contextEngines.set(engineId, engine);
      logger.debug?.(`registered context engine: ${engineId}`);
    },

    // Utilities
    resolvePath(input: string): string {
      if (input.startsWith("~/")) {
        const homeDir = process.env.HOME || process.env.USERPROFILE || "";
        return resolve(homeDir, input.slice(2));
      }
      if (input.startsWith("./") || input.startsWith("../")) {
        return resolve(rootDir, input);
      }
      return input;
    },

    // Logger
    logger,
  };

  return api;
}
