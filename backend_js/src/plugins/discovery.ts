// Plugin discovery from filesystem

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { PluginCandidate } from "./types.js";

const MANIFEST_FILENAME = "openclaw.plugin.json";

/**
 * Discover plugin candidates by scanning a plugins directory.
 * Each subdirectory containing an openclaw.plugin.json is a candidate.
 */
export async function discoverPlugins(
  pluginsDir: string,
): Promise<PluginCandidate[]> {
  const candidates: PluginCandidate[] = [];

  try {
    const entries = await readdir(pluginsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const rootDir = join(pluginsDir, entry.name);

      // Check for manifest file
      try {
        const manifestPath = join(rootDir, MANIFEST_FILENAME);
        const { access } = await import("node:fs/promises");
        await access(manifestPath);

        candidates.push({
          idHint: entry.name,
          source: `./${entry.name}`,
          rootDir,
        });
      } catch {
        // No manifest file, skip this directory
      }
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error(`failed to discover plugins in ${pluginsDir}:`, err);
    }
  }

  // Sort by id for consistent loading order
  candidates.sort((a, b) => a.idHint.localeCompare(b.idHint));

  return candidates;
}

/**
 * Get the plugins directory path.
 * Can be overridden via PLUGINS_DIR environment variable.
 */
export function getPluginsDir(): string {
  return process.env.PLUGINS_DIR || "./plugins";
}
