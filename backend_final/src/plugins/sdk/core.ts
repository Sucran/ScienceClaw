// Core types for OpenClaw SDK compatibility layer
// These types mirror the OpenClaw plugin SDK interfaces

import type { Elysia } from "elysia";

// ============================================================================
// Plugin Logger
// ============================================================================

export type PluginLogger = {
  debug?: (message: string) => void;
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

// ============================================================================
// Plugin Config Schema
// ============================================================================

export type PluginConfigValidation =
  | { ok: true; value?: unknown }
  | { ok: false; errors: string[] };

export type PluginConfigUiHint = {
  label?: string;
  help?: string;
  tags?: string[];
  advanced?: boolean;
  sensitive?: boolean;
  placeholder?: string;
};

export type OpenClawPluginConfigSchema = {
  safeParse?: (value: unknown) => {
    success: boolean;
    data?: unknown;
    error?: {
      issues?: Array<{ path: Array<string | number>; message: string }>;
    };
  };
  parse?: (value: unknown) => unknown;
  validate?: (value: unknown) => PluginConfigValidation;
  uiHints?: Record<string, PluginConfigUiHint>;
  jsonSchema?: Record<string, unknown>;
};

// ============================================================================
// Plugin Tool
// ============================================================================

export type OpenClawPluginToolContext = {
  config?: OpenClawConfig;
  runtimeConfig?: OpenClawConfig;
  workspaceDir?: string;
  agentDir?: string;
  agentId?: string;
  sessionKey?: string;
  sessionId?: string;
  browser?: {
    sandboxBridgeUrl?: string;
    allowHostControl?: boolean;
  };
  messageChannel?: string;
  agentAccountId?: string;
  requesterSenderId?: string;
  senderIsOwner?: boolean;
  sandboxed?: boolean;
};

// ============================================================================
// Provider Auth Types
// ============================================================================

export type ProviderAuthKind = "oauth" | "api_key" | "token" | "device_code" | "custom";

export type ProviderAuthResult = {
  profiles: Array<{ profileId: string; credential: unknown }>;
  configPatch?: Partial<OpenClawConfig>;
  defaultModel?: string;
  notes?: string[];
};

export type ProviderAuthMethod = {
  id: string;
  label: string;
  hint?: string;
  kind: ProviderAuthKind;
  run: (ctx: ProviderAuthContext) => Promise<ProviderAuthResult>;
  runNonInteractive?: (ctx: ProviderAuthMethodNonInteractiveContext) => Promise<OpenClawConfig | null>;
};

export type ProviderAuthContext = {
  config: OpenClawConfig;
  env?: NodeJS.ProcessEnv;
  agentDir?: string;
  workspaceDir?: string;
  prompter?: unknown;
  runtime?: RuntimeEnv;
  isRemote: boolean;
};

export type ProviderAuthMethodNonInteractiveContext = {
  authChoice: string;
  config: OpenClawConfig;
  baseConfig: OpenClawConfig;
  opts: Record<string, unknown>;
  runtime: RuntimeEnv;
  agentDir?: string;
  workspaceDir?: string;
  resolveApiKey?: (params: unknown) => Promise<unknown>;
  toApiKeyCredential?: (params: unknown) => unknown;
};

export type RuntimeEnv = {
  version: string;
  homeDir?: string;
  tmpDir?: string;
};

// ============================================================================
// OpenClaw Config (minimal type for plugin interface)
// ============================================================================

export type OpenClawConfig = Record<string, unknown>;

// ============================================================================
// Service Types
// ============================================================================

export type OpenClawPluginServiceContext = {
  config: OpenClawConfig;
  logger: PluginLogger;
};

export type OpenClawPluginService = {
  id: string;
  name?: string;
  init?: (api: OpenClawPluginApi) => Promise<void>;
  destroy?: (api: OpenClawPluginApi) => Promise<void>;
};

// ============================================================================
// OpenClawPluginApi - Main plugin API interface
// ============================================================================

export type OpenClawPluginApiOptions = {
  id: string;
  name: string;
  version?: string;
  description?: string;
  config: Record<string, unknown>;
  pluginConfig: Record<string, unknown>;
  logger: PluginLogger;
  rootDir: string;
  runtime?: PluginRuntime;
  registrationMode?: "setup" | "cli-metadata" | "full";
};

export type OpenClawPluginApi = {
  // Identity
  id: string;
  name: string;
  version?: string;
  description?: string;

  // Config
  config: Record<string, unknown>;
  pluginConfig: Record<string, unknown>;

  // Runtime
  runtime?: PluginRuntime;

  // Registration mode (setup, cli-metadata, full)
  registrationMode?: "setup" | "cli-metadata" | "full";

  // Tool registration
  registerTool: (tool: OpenClawPluginToolDefinition) => void;
  registerHook: (events: string | string[], handler: HookHandler) => void;
  registerService: (service: OpenClawPluginService) => void;
  registerHttpRoute: (route: HttpRoute) => void;
  registerChannel: (registration: ChannelRegistration) => void;
  registerContextEngine?: (id: string, engine: unknown) => void;

  // Utilities
  resolvePath: (input: string) => string;
  logger: PluginLogger;
};

// ============================================================================
// Tool Definition
// ============================================================================

export type OpenClawPluginToolDefinition = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  execute: (input: unknown, context: OpenClawPluginToolContext) => Promise<unknown>;
};

// ============================================================================
// Hook Handler
// ============================================================================

export type HookHandler = (event: unknown, context: HookContext) => Promise<void>;

export type HookContext = {
  sessionId?: string;
  userId?: string;
  agentId?: string;
  config?: Record<string, unknown>;
  runtime?: PluginRuntime;
  timestamp?: number;
};

// ============================================================================
// HTTP Route
// ============================================================================

export type HttpRoute = {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  handler: (ctx: HttpContext) => Promise<unknown>;
  auth?: "required" | "optional" | "none";
};

export type HttpContext = {
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  session?: unknown;
};

// ============================================================================
// Channel Registration
// ============================================================================

export type ChannelRegistration = {
  plugin: ChannelPlugin;
  setupRuntime?: (runtime: PluginRuntime) => void;
};

// ============================================================================
// Channel Plugin Types (simplified from OpenClaw)
// ============================================================================

export type ChannelPlugin<
  TResolvedAccount extends { accountId?: string | null } = { accountId?: string | null },
> = {
  id: string;
  meta: ChannelMeta;
  configSchema?: ChannelConfigSchema;
  capabilities: ChannelCapabilities;
  streaming?: ChannelStreaming;
  messaging?: ChannelMessaging;
  agentPrompt?: ChannelAgentPrompt;
  reload?: ChannelReload;
  config: ChannelConfig<TResolvedAccount>;
  outbound: ChannelOutbound<TResolvedAccount>;
  status: ChannelStatus<TResolvedAccount>;
  auth?: ChannelAuth<TResolvedAccount>;
  gateway?: ChannelGateway<TResolvedAccount>;
};

export type ChannelMeta = {
  id: string;
  label: string;
  selectionLabel: string;
  docsPath?: string;
  docsLabel?: string;
  blurb?: string;
  order?: number;
};

export type ChannelCapabilities = {
  chatTypes: ("direct" | "group")[];
  media?: boolean;
  blockStreaming?: boolean;
};

export type ChannelStreaming = {
  blockStreamingCoalesceDefaults?: {
    minChars?: number;
    idleMs?: number;
  };
};

export type ChannelMessaging = {
  targetResolver?: {
    looksLikeId?: (raw: string) => boolean;
  };
};

export type ChannelAgentPrompt = {
  messageToolHints?: () => string[];
};

export type ChannelReload = {
  configPrefixes?: string[];
};

export type ChannelConfigSchema = {
  schema?: Record<string, unknown>;
  uiHints?: Record<string, unknown>;
};

export type ChannelConfig<TResolvedAccount> = {
  listAccountIds: (cfg: OpenClawConfig) => string[];
  resolveAccount: (cfg: OpenClawConfig, accountId: string) => TResolvedAccount;
  isConfigured: (account: TResolvedAccount) => boolean;
  describeAccount: (account: TResolvedAccount) => AccountDescription;
};

export type AccountDescription = {
  accountId: string;
  name?: string;
  enabled?: boolean;
  configured?: boolean;
};

export type ChannelOutbound<TResolvedAccount> = {
  deliveryMode: "direct" | "broadcast" | "announce";
  textChunkLimit?: number;
  sendText: (ctx: ChannelOutboundContext<TResolvedAccount>) => Promise<{ channel: string; messageId: string }>;
  sendMedia?: (ctx: ChannelOutboundMediaContext<TResolvedAccount>) => Promise<{ channel: string; messageId: string }>;
};

export type ChannelOutboundContext<TResolvedAccount> = {
  cfg: OpenClawConfig;
  accountId?: string | null;
  to: string;
  text: string;
  contextToken?: string;
  mediaUrl?: string;
  account: TResolvedAccount;
};

export type ChannelOutboundMediaContext<TResolvedAccount> = ChannelOutboundContext<TResolvedAccount> & {
  mediaUrl: string;
};

export type ChannelStatus<TResolvedAccount> = {
  defaultRuntime: Record<string, unknown>;
  collectStatusIssues: () => ChannelStatusIssue[];
  buildChannelSummary: (ctx: { snapshot: ChannelStatusSnapshot }) => ChannelStatusSummary;
  buildAccountSnapshot: (ctx: { account: TResolvedAccount; runtime: unknown }) => ChannelStatusSnapshot;
};

export type ChannelStatusIssue = {
  severity: "error" | "warning" | "info";
  message: string;
};

export type ChannelStatusSnapshot = {
  configured?: boolean;
  lastError?: string | null;
  lastInboundAt?: number | null;
  lastOutboundAt?: number | null;
  running?: boolean;
};

export type ChannelStatusSummary = {
  configured?: boolean;
  lastError?: string | null;
  lastInboundAt?: number | null;
  lastOutboundAt?: number | null;
};

export type ChannelAuth<TResolvedAccount> = {
  login?: (ctx: ChannelAuthContext<TResolvedAccount>) => Promise<void>;
};

export type ChannelAuthContext<TResolvedAccount> = {
  cfg: OpenClawConfig;
  accountId: string;
  verbose?: boolean;
  runtime?: {
    log?: (msg: string) => void;
  };
};

export type ChannelGateway<TResolvedAccount> = {
  startAccount?: (ctx: ChannelGatewayContext<TResolvedAccount>) => Promise<void>;
  loginWithQrStart?: (params: ChannelQrStartParams) => Promise<ChannelQrStartResult>;
  loginWithQrWait?: (params: ChannelQrWaitParams) => Promise<ChannelQrWaitResult>;
};

export type ChannelGatewayContext<TResolvedAccount> = {
  cfg: OpenClawConfig;
  account: TResolvedAccount;
  runtime: PluginRuntime;
  abortSignal?: AbortSignal;
  log?: {
    info?: (msg: string) => void;
    warn?: (msg: string) => void;
    error?: (msg: string) => void;
  };
  setStatus?: (status: ChannelStatusUpdate) => void;
};

export type ChannelStatusUpdate = {
  accountId: string;
  running?: boolean;
  lastStartAt?: number;
  lastEventAt?: number;
  lastError?: string | null;
};

export type ChannelQrStartParams = {
  accountId?: string;
  force?: boolean;
  timeoutMs?: number;
  verbose?: boolean;
};

export type ChannelQrStartResult = {
  qrDataUrl?: string;
  message: string;
  sessionKey?: string;
};

export type ChannelQrWaitParams = {
  accountId?: string;
  timeoutMs?: number;
  sessionKey?: string;
};

export type ChannelQrWaitResult = {
  connected: boolean;
  message: string;
  accountId?: string;
  botToken?: string;
  baseUrl?: string;
  userId?: string;
};

// ============================================================================
// Plugin Runtime
// ============================================================================

export type PluginRuntime = {
  version: string;
  subagent: SubagentRuntime;
  channel: ChannelRuntime;
  log?: (msg: string) => void;
};

export type SubagentRuntime = {
  run: (params: SubagentRunParams) => Promise<SubagentRunResult>;
  waitForRun: (params: SubagentWaitParams) => Promise<SubagentWaitResult>;
  getSessionMessages: (params: SubagentGetSessionMessagesParams) => Promise<SubagentGetSessionMessagesResult>;
  deleteSession: (params: SubagentDeleteSessionParams) => Promise<void>;
};

export type SubagentRunParams = {
  agentId: string;
  sessionKey: string;
  messages: Array<{ role: string; content: string }>;
  stream?: boolean;
};

export type SubagentRunResult = {
  reply: string;
  sessionId: string;
};

export type SubagentWaitParams = {
  runId: string;
  timeoutMs?: number;
};

export type SubagentWaitResult = {
  completed: boolean;
  result?: SubagentRunResult;
};

export type SubagentGetSessionMessagesParams = {
  sessionKey: string;
  limit?: number;
};

export type SubagentGetSessionMessagesResult = {
  messages: Array<{ role: string; content: string; timestamp: number }>;
};

export type SubagentDeleteSessionParams = {
  sessionKey: string;
};

export type ChannelRuntime = {
  sendMessage: (params: ChannelSendParams) => Promise<ChannelSendResult>;
};

export type ChannelSendParams = {
  channel: string;
  accountId?: string;
  to: string;
  text: string;
  contextToken?: string;
};

export type ChannelSendResult = {
  messageId: string;
};
