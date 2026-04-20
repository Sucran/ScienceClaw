// Helper function for defining plugins (alternative to definePluginEntry)

import { definePluginEntry } from "./sdk/plugin-entry.js";
import type { OpenClawPluginApi, PluginKind } from "./types.js";

export type { PluginKind };
export { definePluginEntry };

/**
 * Define a simple plugin with just tools.
 */
export function definePlugin(options: {
  id: string;
  name: string;
  description: string;
  kind?: PluginKind;
  tools?: Array<{
    name: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
    execute: (input: unknown, ctx: unknown) => Promise<unknown>;
  }>;
  hooks?: Array<{
    events: string | string[];
    handler: (event: unknown, ctx: unknown) => Promise<void>;
  }>;
  register?: (api: OpenClawPluginApi) => void;
}) {
  return definePluginEntry({
    id: options.id,
    name: options.name,
    description: options.description,
    kind: options.kind,
    register: (api) => {
      // Register tools
      if (options.tools) {
        for (const tool of options.tools) {
          api.registerTool({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
            execute: tool.execute as (input: unknown, ctx: unknown) => Promise<unknown>,
          });
        }
      }

      // Register hooks
      if (options.hooks) {
        for (const hook of options.hooks) {
          api.registerHook(hook.events, hook.handler as (event: unknown, ctx: unknown) => Promise<void>);
        }
      }

      // Custom register callback
      options.register?.(api);
    },
  });
}
