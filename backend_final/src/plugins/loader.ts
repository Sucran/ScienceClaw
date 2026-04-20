// Dynamic module loader for plugins

import { join } from "node:path";
import type { PluginEntry } from "./types.js";

export type PluginLoadResult<T = PluginEntry> =
  | { ok: true; entry: T }
  | { ok: false; errors: string[] };

/**
 * Load a plugin module dynamically using Bun's native ESM support.
 */
export async function loadPluginModule(
  source: string,
  rootDir: string,
): Promise<PluginLoadResult> {
  const errors: string[] = [];

  try {
    // Build the module path
    const modulePath = join(rootDir, source);

    // Dynamic import using Bun's native ESM support
    const module = await import(modulePath);

    // Get the default export
    const entry = module.default;

    if (!entry) {
      return { ok: false, errors: ["module has no default export"] };
    }

    // Validate entry structure
    if (!entry.id || typeof entry.id !== "string") {
      errors.push("entry must have a string 'id' field");
    }

    if (!entry.name || typeof entry.name !== "string") {
      errors.push("entry must have a string 'name' field");
    }

    if (!entry.description || typeof entry.description !== "string") {
      errors.push("entry must have a string 'description' field");
    }

    if (typeof entry.register !== "function") {
      errors.push("entry must have a 'register' function");
    }

    if (errors.length > 0) {
      return { ok: false, errors };
    }

    return { ok: true, entry: entry as PluginEntry };
  } catch (err) {
    return {
      ok: false,
      errors: [`failed to load plugin from ${source}: ${String(err)}`],
    };
  }
}

/**
 * Get the entry point path for a plugin.
 * Defaults to "index.ts" in the plugin root.
 */
export function getPluginEntryPath(rootDir: string, entryPoint?: string): string {
  return entryPoint ? join(rootDir, entryPoint) : join(rootDir, "index.ts");
}
