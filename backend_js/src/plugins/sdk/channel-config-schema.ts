// Channel config schema builder - provides buildChannelConfigSchema function

import type { OpenClawPluginConfigSchema } from "./core.js";

export type { OpenClawPluginConfigSchema };

/**
 * Build a channel config schema by combining a channel-specific schema
 * with the base channel schema structure.
 */
export function buildChannelConfigSchema(
  channelSchema: OpenClawPluginConfigSchema,
): OpenClawPluginConfigSchema {
  return {
    ...channelSchema,
  };
}
