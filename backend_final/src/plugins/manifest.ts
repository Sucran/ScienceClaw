// Manifest parsing and validation

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { PluginManifest } from "./types.js";

const MANIFEST_FILENAME = "openclaw.plugin.json";

export type ManifestParseResult =
  | { ok: true; manifest: PluginManifest }
  | { ok: false; errors: string[] };

/**
 * Parse and validate a plugin manifest from a directory.
 */
export async function parsePluginManifest(
  pluginDir: string,
): Promise<ManifestParseResult> {
  const manifestPath = join(pluginDir, MANIFEST_FILENAME);

  try {
    const content = await readFile(manifestPath, "utf-8");
    const raw = JSON.parse(content);

    const errors: string[] = [];

    // Required fields
    if (!raw.id || typeof raw.id !== "string") {
      errors.push("manifest must have a string 'id' field");
    }

    if (!raw.configSchema || typeof raw.configSchema !== "object") {
      errors.push("manifest must have an object 'configSchema' field");
    }

    if (errors.length > 0) {
      return { ok: false, errors };
    }

    const manifest: PluginManifest = {
      id: raw.id,
      name: raw.name,
      description: raw.description,
      version: raw.version,
      configSchema: raw.configSchema,
      enabledByDefault: raw.enabledByDefault ?? true,
      kind: raw.kind,
      channels: raw.channels,
      providers: raw.providers,
      cliBackends: raw.cliBackends,
      skills: raw.skills,
      contracts: raw.contracts,
    };

    return { ok: true, manifest };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { ok: false, errors: [`manifest file not found at ${manifestPath}`] };
    }
    return { ok: false, errors: [`failed to parse manifest: ${String(err)}`] };
  }
}

/**
 * Validate a manifest has required fields for loading.
 */
export function validateManifest(manifest: PluginManifest): string[] {
  const errors: string[] = [];

  if (!manifest.id) {
    errors.push("manifest missing 'id'");
  }

  if (!manifest.configSchema) {
    errors.push("manifest missing 'configSchema'");
  }

  return errors;
}
