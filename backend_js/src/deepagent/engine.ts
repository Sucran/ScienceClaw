/**
 * 参考注释：
 * - "模型工厂：根据配置构造 LLM 实例。"
 * - "context window 解析优先级..."
 * 参考代码：
 * - /ScienceClaw/backend/deepagent/engine.py:1-450
 */
import "dotenv/config"
import { ChatOpenAI } from "@langchain/openai"
import type { BaseChatModel, BaseMessage } from "@langchain/core/language_models"
import { config } from "../config.js"

export interface ModelConfig {
  provider: string
  model_name: string
  api_key?: string
  base_url?: string
  max_tokens?: number
  temperature?: number
  top_p?: number
  context_window?: number
}

/**
 * 参考代码：
 * - _KNOWN_CONTEXT_WINDOWS: /ScienceClaw/backend/deepagent/engine.py:96-219
 * 匹配顺序：从上到下，先匹配先生效（更具体的模式放前面）
 * 最后更新：2026-03
 */
const KNOWN_CONTEXT_WINDOWS: Record<string, number> = {
  // DeepSeek
  "deepseek-v4": 1_000_000,
  "deepseek-chat": 131_072,
  "deepseek-reasoner": 131_072,
  "deepseek-v3": 131_072,
  "deepseek-r1": 131_072,
  "deepseek-r2": 131_072,
  "deepseek-coder": 128_000,
  // OpenAI
  "gpt-5.4": 1_000_000,
  "gpt-5.2": 1_000_000,
  "gpt-5": 1_000_000,
  "gpt-4.1": 1_047_576,
  "gpt-4.1-mini": 1_047_576,
  "gpt-4.1-nano": 1_047_576,
  "o4-mini": 200_000,
  "o4": 200_000,
  "o3-pro": 200_000,
  "o3-mini": 200_000,
  "o3": 200_000,
  "o1-pro": 200_000,
  "o1-mini": 128_000,
  "o1": 200_000,
  "gpt-4o-mini": 128_000,
  "gpt-4o": 128_000,
  "gpt-4.5": 128_000,
  "gpt-4-turbo": 128_000,
  "gpt-4": 8_192,
  "gpt-3.5-turbo": 16_385,
  // Anthropic
  "claude-opus-4.6": 200_000,
  "claude-sonnet-4.6": 200_000,
  "claude-opus-4.5": 200_000,
  "claude-sonnet-4.5": 200_000,
  "claude-sonnet-4": 200_000,
  "claude-opus-4": 200_000,
  "claude-haiku-4": 200_000,
  "claude-3.7-sonnet": 200_000,
  "claude-3.5-sonnet": 200_000,
  "claude-3.5-haiku": 200_000,
  "claude-3-opus": 200_000,
  "claude-3-sonnet": 200_000,
  "claude-3-haiku": 200_000,
  "claude": 200_000,
  // Google
  "gemini-3": 1_048_576,
  "gemini-2.5-pro": 1_048_576,
  "gemini-2.5-flash": 1_048_576,
  "gemini-2.5": 1_048_576,
  "gemini-2.0-flash": 1_048_576,
  "gemini-2.0": 1_048_576,
  "gemini-1.5-pro": 2_097_152,
  "gemini-1.5-flash": 1_048_576,
  "gemini": 1_048_576,
  // Qwen (Alibaba)
  "qwen3-coder": 131_072,
  "qwen3-235b": 131_072,
  "qwen3": 131_072,
  "qwq": 131_072,
  "qwen-max": 256_000,
  "qwen2.5-coder": 131_072,
  "qwen2.5": 131_072,
  "qwen-plus": 131_072,
  "qwen-turbo": 131_072,
  "qwen": 32_768,
  // xAI
  "grok-4": 2_000_000,
  "grok-3": 131_072,
  "grok-code": 256_000,
  "grok-2": 131_072,
  "grok": 131_072,
  // Mistral
  "mistral-large": 128_000,
  "mistral-medium": 128_000,
  "mistral-small": 128_000,
  "pixtral-large": 128_000,
  "pixtral": 128_000,
  "codestral": 256_000,
  "mistral": 32_000,
  // Meta Llama
  "llama-4-maverick": 1_000_000,
  "llama-4-scout": 10_000_000,
  "llama-4": 1_000_000,
  "llama-3.3": 131_072,
  "llama-3.1": 131_072,
  "llama-3": 8_192,
  // Moonshot / Kimi
  "kimi-k2.5": 256_000,
  "kimi-k2-0905-preview": 256_000,
  "kimi-k2-turbo-preview": 256_000,
  "kimi-k2-thinking-turbo": 256_000,
  "kimi-k2-thinking": 256_000,
  "kimi-k2-0711-preview": 128_000,
  "kimi-k2": 128_000,
  "kimi": 128_000,
  "moonshot-v1-128k": 128_000,
  "moonshot-v1-32k": 32_000,
  "moonshot": 128_000,
  // ByteDance Doubao
  "doubao-seed-code": 256_000,
  "doubao-pro": 128_000,
  "doubao": 128_000,
  // MiniMax
  "minimax-text-01": 4_000_000,
  "minimax-m2.5": 1_000_000,
  "minimax": 200_000,
  // 01.AI (Yi)
  "yi-lightning": 16_384,
  "yi-large": 32_768,
  "yi-medium": 16_384,
  "yi": 16_384,
  // Zhipu GLM
  "glm-4.7": 200_000,
  "glm-4.6": 200_000,
  "glm-4.5": 128_000,
  "glm-4": 128_000,
  "glm-3": 128_000,
  "glm": 128_000,
  // Baichuan
  "baichuan4": 128_000,
  "baichuan3": 128_000,
  "baichuan": 32_000
}

/**
 * 参考代码：
 * - _infer_context_window: /ScienceClaw/backend/deepagent/engine.py:224-230
 */
export function inferContextWindow(modelName: string): number {
  const lower = modelName.toLowerCase()
  for (const [pattern, ctx] of Object.entries(KNOWN_CONTEXT_WINDOWS)) {
    if (lower.includes(pattern)) {
      return ctx
    }
  }
  return 128_000 // Return a value indicating "unknown"
}

/**
 * 参考代码：
 * - _resolve_context_window: /ScienceClaw/backend/deepagent/engine.py:233-251
 */
export function resolveContextWindow(modelName: string, explicit?: number): number {
  if (explicit) return explicit
  const inferred = inferContextWindow(modelName)
  if (inferred !== 128_000) {
    console.info(`[Engine] Auto-detected context_window=${inferred.toLocaleString()} for model '${modelName}'`)
    return inferred
  }
  // Fallback to config context window
  console.warn(`[Engine] Unknown model '${modelName}', using default context_window=${config.contextWindow.toLocaleString()}. Set context_window in model config for accurate summarization thresholds.`)
  return config.contextWindow
}

export interface ChatModel {
  provider: string
  model: string
  modelName: string
  apiKey?: string
  baseUrl?: string
  contextWindow: number
  maxTokens?: number
  temperature?: number
  topP?: number
}

// Thinking model patterns (MiniMax, Kimi, Moonshot need reasoning_content)
const THINKING_MODEL_PATTERNS = ["minimax", "kimi", "moonshot", "deepseek-reasoner", "deepseek-r1", "deepseek-r2"]

function isThinkingModel(modelName: string): boolean {
  const lower = modelName.toLowerCase()
  return THINKING_MODEL_PATTERNS.some(p => lower.includes(p))
}

/**
 * 扁平化消息内容
 * 参考 Python: _flatten_content
 * 许多 OpenAI 兼容 API (DeepSeek, Qwen 等) 拒绝数组类型的 content
 */
function flattenContent(msg: Record<string, any>): Record<string, any> {
  const content = msg.content
  if (!Array.isArray(content)) {
    return msg
  }
  const parts: string[] = []
  for (const block of content) {
    if (typeof block === "object" && block !== null) {
      const text = block.text || block.content
      if (text) {
        parts.push(String(text))
      } else if (block.type === "thinking") {
        continue
      } else {
        parts.push(JSON.stringify(block))
      }
    } else {
      parts.push(String(block))
    }
  }
  return { ...msg, content: parts.join("\n") || "(empty)" }
}

/**
 * 确保消息包含 reasoning_content (用于思维模型)
 * 参考 Python: _SafeChatOpenAI._ensure_reasoning_content
 */
function ensureReasoningContent(msg: Record<string, any>): Record<string, any> {
  if (!isThinkingModel(msg.model || "")) {
    return msg
  }
  const additional_kwargs = msg.additional_kwargs || {}
  if (!("reasoning_content" in additional_kwargs)) {
    return {
      ...msg,
      additional_kwargs: { ...additional_kwargs, reasoning_content: "" }
    }
  }
  return msg
}

/**
 * 创建 OpenAI 兼容的聊天模型 (DeepSeek, MiniMax, 等)
 * 参考 Python: _SafeChatOpenAI 类
 */
function createOpenAICompatibleModel(
  modelName: string,
  apiKey: string,
  baseUrl?: string,
  maxTokens?: number,
  temperature?: number
): ChatOpenAI {
  const resolvedBaseUrl = baseUrl || config.dsBaseUrl

  const model = new ChatOpenAI({
    model: modelName,
    apiKey: apiKey,
    baseURL: resolvedBaseUrl,
    maxTokens: maxTokens,
    temperature: temperature,
    maxRetries: 3,
    timeout: 120000,
    streaming: true,
  })

  // Note: profile and stream reassignment removed - caused "readonly property" errors
  // in newer LangChain versions
  return model
}

/**
 * 根据配置创建 LangChain 模型实例
 * 参考 Python: get_llm_model() 函数
 *
 * 支持的 provider:
 * - "anthropic": 使用 ChatOpenAI (OpenAI 兼容格式，可配置 baseUrl)
 * - "openai" 或其他: 使用 ChatOpenAI (OpenAI 兼容格式)
 *
 * 注意: 对于真正的 Anthropic API，需要设置 base_url 为 Anthropic 的端点
 * 例如: base_url: "https://api.anthropic.com"
 */
export function createModel(config: {
  model_name: string
  provider?: string
  api_key?: string
  base_url?: string
  max_tokens?: number
  temperature?: number
  context_window?: number
}): BaseChatModel {
  const {
    model_name,
    api_key = config.dsApiKey || "",
    base_url = config.dsBaseUrl,
    max_tokens,
    temperature
  } = config

  // Default: OpenAI-compatible (DeepSeek, MiniMax, Anthropic compatible, etc.)
  if (!api_key) {
    throw new Error("API key is required")
  }
  return createOpenAICompatibleModel(model_name, api_key, base_url, max_tokens, temperature)
}

/**
 * 参考注释：
 * - "构建 LLM 模型实例。"
 * 参考代码：
 * - /ScienceClaw/backend/deepagent/engine.py:385-450
 */
export function getLlmModel(cfg: ModelConfig, maxTokensOverride?: number): ChatModel {
  const ctxWindow = resolveContextWindow(cfg.model_name, cfg.context_window)
  return {
    provider: cfg.provider,
    model: cfg.model_name,
    modelName: cfg.model_name,
    apiKey: cfg.api_key,
    baseUrl: cfg.base_url,
    contextWindow: ctxWindow,
    maxTokens: maxTokensOverride ?? cfg.max_tokens,
    temperature: cfg.temperature,
    topP: cfg.top_p
  }
}