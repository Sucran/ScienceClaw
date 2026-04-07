// Account ID normalization utilities

/**
 * Normalize an account ID to a filesystem-safe string.
 * Replaces special characters like @ with - for safe file paths.
 */
export function normalizeAccountId(accountId: string): string {
  if (!accountId) return accountId;
  // Replace @ and similar special characters that are problematic in file paths
  return accountId.replace(/[@:!]/g, "-").replace(/\//g, "_");
}

/**
 * Default account ID constant
 */
export const DEFAULT_ACCOUNT_ID = "default";
