// Plugin system core types

import type {
  ChannelPlugin,
  OpenClawConfig,
  OpenClawPluginApi,
  OpenClawPluginToolDefinition,
  PluginLogger,
  PluginRuntime,
  HttpRoute,
  HookHandler,
} from "./sdk/core.js";

// Re-export SDK types
export type {
  ChannelPlugin,
  OpenClawConfig,
  OpenClawPluginApi,
  OpenClawPluginToolDefinition,
  PluginLogger,
  PluginRuntime,
  HttpRoute,
  OpenClawPluginConfigSchema,
  OpenClawPluginService,
  ChannelRegistration,
  HookHandler,
  HookContext,
  ChannelMeta,
  ChannelCapabilities,
  AccountDescription,
  ChannelOutboundContext,
  ChannelStatusIssue,
  ChannelStatusSnapshot,
  ChannelStatusSummary,
  ChannelAuthContext,
  ChannelGatewayContext,
  ChannelStatusUpdate,
  ChannelQrStartParams,
  ChannelQrStartResult,
  ChannelQrWaitParams,
  ChannelQrWaitResult,
} from "./sdk/core.js";

// ============================================================================
// Plugin Manifest
// ============================================================================

export type PluginKind = "memory" | "context-engine";

export type PluginManifestContracts = {
  tools?: string[];
  speechProviders?: string[];
  mediaUnderstandingProviders?: string[];
  imageGenerationProviders?: string[];
  webSearchProviders?: string[];
};

export type PluginManifest = {
  id: string;
  name?: string;
  description?: string;
  version?: string;
  configSchema: Record<string, unknown>;
  enabledByDefault?: boolean;
  kind?: PluginKind | PluginKind[];
  channels?: string[];
  providers?: string[];
  cliBackends?: string[];
  skills?: string[];
  contracts?: PluginManifestContracts;
};

// ============================================================================
// Plugin Discovery
// ============================================================================

export type PluginCandidate = {
  idHint: string;
  source: string;
  rootDir: string;
  packageName?: string;
  packageVersion?: string;
};

// ============================================================================
// Plugin Registry
// ============================================================================

export type PluginRecord = {
  id: string;
  name: string;
  version?: string;
  description?: string;
  source: string;
  rootDir: string;
  manifest: PluginManifest;
  enabled: boolean;
};

export type PluginRegistry = {
  plugins: Map<string, PluginRecord>;
  tools: Map<string, OpenClawPluginToolDefinition>;
  hooks: Map<string, Set<HookHandler>>;
  httpRoutes: HttpRoute[];
  services: Map<string, ServiceRecord>;
  channels: Map<string, ChannelPlugin>;
  contextEngines: Map<string, unknown>;
};

export type ServiceRecord = {
  id: string;
  name?: string;
  service: unknown;
};

// ============================================================================
// Hook Types
// ============================================================================

export type HookName =
  | "before_model_resolve"
  | "before_prompt_build"
  | "before_agent_start"
  | "before_agent_reply"
  | "before_tool_call"
  | "after_tool_call"
  | "session_start"
  | "session_end"
  | "agent:bootstrap"
  | "command:new"
  | "command:reset";

// ============================================================================
// Plugin Loader Result
// ============================================================================

export type PluginLoadResult = {
  id: string;
  name: string;
  version?: string;
  description?: string;
  source: string;
  rootDir: string;
  manifest: PluginManifest;
  entry: PluginEntry;
  enabled: boolean;
};

export type PluginEntry = {
  id: string;
  name: string;
  description: string;
  version?: string;
  configSchema: unknown;
  register: (api: OpenClawPluginApi) => void;
  kind?: PluginKind;
};
