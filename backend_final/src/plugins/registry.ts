// Central plugin registry

import type {
  HookHandler,
  HttpRoute,
  OpenClawPluginService,
  PluginRecord,
  PluginRegistry,
  ServiceRecord,
} from "./types.js";
import type {
  ChannelPlugin,
  OpenClawPluginToolDefinition,
  PluginRuntime,
} from "./sdk/core.js";

/**
 * Create a new empty plugin registry.
 */
export function createPluginRegistry(): PluginRegistry {
  return {
    plugins: new Map(),
    tools: new Map(),
    hooks: new Map(),
    httpRoutes: [],
    services: new Map(),
    channels: new Map(),
    contextEngines: new Map(),
  };
}

/**
 * Register a plugin in the registry.
 */
export function registerPlugin(
  registry: PluginRegistry,
  record: PluginRecord,
): void {
  registry.plugins.set(record.id, record);
}

/**
 * Get a plugin by ID.
 */
export function getPlugin(
  registry: PluginRegistry,
  id: string,
): PluginRecord | undefined {
  return registry.plugins.get(id);
}

/**
 * Get all registered plugins.
 */
export function getAllPlugins(registry: PluginRegistry): PluginRecord[] {
  return Array.from(registry.plugins.values());
}

/**
 * Register a tool in the registry.
 */
export function registerTool(
  registry: PluginRegistry,
  pluginId: string,
  tool: OpenClawPluginToolDefinition,
): void {
  registry.tools.set(tool.name, tool);
}

/**
 * Get a tool by name.
 */
export function getTool(
  registry: PluginRegistry,
  name: string,
): OpenClawPluginToolDefinition | undefined {
  return registry.tools.get(name);
}

/**
 * Get all registered tools.
 */
export function getAllTools(registry: PluginRegistry): OpenClawPluginToolDefinition[] {
  return Array.from(registry.tools.values());
}

/**
 * Register a hook handler.
 */
export function registerHook(
  registry: PluginRegistry,
  pluginId: string,
  event: string,
  handler: HookHandler,
): void {
  if (!registry.hooks.has(event)) {
    registry.hooks.set(event, new Set());
  }
  registry.hooks.get(event)!.add(handler);
}

/**
 * Get all handlers for a specific hook event.
 */
export function getHookHandlers(
  registry: PluginRegistry,
  event: string,
): HookHandler[] {
  const handlers = registry.hooks.get(event);
  return handlers ? Array.from(handlers) : [];
}

/**
 * Register an HTTP route.
 */
export function registerHttpRoute(
  registry: PluginRegistry,
  route: HttpRoute,
): void {
  registry.httpRoutes.push(route);
}

/**
 * Get all registered HTTP routes.
 */
export function getAllHttpRoutes(registry: PluginRegistry): HttpRoute[] {
  return registry.httpRoutes;
}

/**
 * Register a service.
 */
export function registerService(
  registry: PluginRegistry,
  service: OpenClawPluginService,
): void {
  registry.services.set(service.id, {
    id: service.id,
    name: service.name,
    service,
  });
}

/**
 * Get a service by ID.
 */
export function getService(
  registry: PluginRegistry,
  id: string,
): ServiceRecord | undefined {
  return registry.services.get(id);
}

/**
 * Get all registered services.
 */
export function getAllServices(registry: PluginRegistry): ServiceRecord[] {
  return Array.from(registry.services.values());
}

/**
 * Register a channel plugin.
 */
export function registerChannel(
  registry: PluginRegistry,
  channel: ChannelPlugin,
): void {
  registry.channels.set(channel.id, channel);
}

/**
 * Get a channel by ID.
 */
export function getChannel(
  registry: PluginRegistry,
  id: string,
): ChannelPlugin | undefined {
  return registry.channels.get(id);
}

/**
 * Get all registered channels.
 */
export function getAllChannels(registry: PluginRegistry): ChannelPlugin[] {
  return Array.from(registry.channels.values());
}

/**
 * Register a context engine.
 */
export function registerContextEngine(
  registry: PluginRegistry,
  id: string,
  engine: unknown,
): void {
  registry.contextEngines.set(id, engine);
}

/**
 * Get a context engine by ID.
 */
export function getContextEngine(
  registry: PluginRegistry,
  id: string,
): unknown | undefined {
  return registry.contextEngines.get(id);
}
