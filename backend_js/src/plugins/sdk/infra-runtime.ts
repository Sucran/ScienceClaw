// Infrastructure runtime utilities

import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Resolve the preferred temporary directory for OpenClaw plugin operations.
 * Returns a path under the system temp directory.
 */
export function resolvePreferredOpenClawTmpDir(): string {
  return join(tmpdir(), "openclaw");
}

/**
 * Resolve a path that may contain OpenClaw-specific path variables.
 */
export function resolveOpenClawPath(input: string, baseDir?: string): string {
  if (input.startsWith("~/.openclaw/")) {
    const homeDir = process.env.HOME || process.env.USERPROFILE || "";
    return input.replace("~/.openclaw/", join(homeDir, ".openclaw/"));
  }
  return input;
}
