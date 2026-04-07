// Plugin runtime implementation

import type {
  ChannelRuntime,
  ChannelSendParams,
  ChannelSendResult,
  PluginRuntime,
  SubagentRuntime,
  SubagentRunParams,
  SubagentRunResult,
  SubagentWaitParams,
  SubagentWaitResult,
  SubagentGetSessionMessagesParams,
  SubagentGetSessionMessagesResult,
  SubagentDeleteSessionParams,
} from "../sdk/core.js";

/**
 * Default subagent runtime implementation.
 * Uses the backend_js deepagent for actual execution.
 */
export function createSubagentRuntime(deepAgentInvoke: unknown): SubagentRuntime {
  return {
    async run(params: SubagentRunParams): Promise<SubagentRunResult> {
      // This would call into the actual deepagent
      // For now, return a placeholder that matches the expected interface
      console.log(`[subagent.run] agentId=${params.agentId}, sessionKey=${params.sessionKey}, messages=${params.messages.length}`);

      // TODO: Integrate with actual deepagent
      return {
        reply: "Plugin subagent not yet integrated",
        sessionId: params.sessionKey,
      };
    },

    async waitForRun(params: SubagentWaitParams): Promise<SubagentWaitResult> {
      console.log(`[subagent.waitForRun] runId=${params.runId}`);
      // Placeholder - would wait for actual subagent run completion
      return {
        completed: true,
      };
    },

    async getSessionMessages(params: SubagentGetSessionMessagesParams): Promise<SubagentGetSessionMessagesResult> {
      console.log(`[subagent.getSessionMessages] sessionKey=${params.sessionKey}`);
      // Placeholder - would retrieve from session storage
      return {
        messages: [],
      };
    },

    async deleteSession(params: SubagentDeleteSessionParams): Promise<void> {
      console.log(`[subagent.deleteSession] sessionKey=${params.sessionKey}`);
      // Placeholder - would delete from session storage
    },
  };
}

/**
 * Default channel runtime implementation.
 */
export function createChannelRuntime(): ChannelRuntime {
  return {
    async sendMessage(params: ChannelSendParams): Promise<ChannelSendResult> {
      console.log(`[channel.sendMessage] channel=${params.channel}, to=${params.to}`);
      // Placeholder - would send via actual channel
      return {
        messageId: `msg-${Date.now()}`,
      };
    },
  };
}

/**
 * Create a PluginRuntime instance with version and runtime interfaces.
 */
export function createPluginRuntime(version: string): PluginRuntime {
  return {
    version,
    subagent: createSubagentRuntime(null),
    channel: createChannelRuntime(),
    log: (msg: string) => console.log(`[plugin-runtime] ${msg}`),
  };
}

// Default runtime instance
let defaultRuntime: PluginRuntime | null = null;

export function getDefaultPluginRuntime(): PluginRuntime {
  if (!defaultRuntime) {
    defaultRuntime = createPluginRuntime("1.0.0");
  }
  return defaultRuntime;
}

export function setDefaultPluginRuntime(runtime: PluginRuntime): void {
  defaultRuntime = runtime;
}
