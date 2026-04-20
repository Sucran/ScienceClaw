/**
 * 将 runner 产出的事件转为前端 SSE 期望的扁平 JSON（对齐 ScienceClaw/backend/route/sessions.py 的 _map_science_stream_to_agent_event）。
 */
import shortuuid from "short-uuid"
import { EventType } from "@core/deepagent/sse-protocol.js"

export interface RunnerChunk {
  event: string
  data: unknown
}

function nowTs(): number {
  return Math.floor(Date.now() / 1000)
}

function isProtocolEnvelope(x: unknown): x is { event: string; data?: unknown; timestamp: string } {
  return (
    typeof x === "object"
    && x !== null
    && "timestamp" in x
    && "event" in x
    && typeof (x as { event: unknown }).event === "string"
    && typeof (x as { timestamp: unknown }).timestamp === "string"
  )
}

function finalizeWireFields(fields: Record<string, unknown>, defaultTs: number): Record<string, unknown> {
  const out = { ...fields }
  if (out.event_id === undefined || out.event_id === "") {
    out.event_id = shortuuid.generate()
  }
  if (typeof out.timestamp !== "number") {
    out.timestamp = defaultTs
  }
  return out
}

/** 展开 protocol.createEvent() 或已是扁平的 data */
export function flattenWireData(raw: unknown): Record<string, unknown> {
  let defaultTs = nowTs()
  let fields: Record<string, unknown> = {}

  if (isProtocolEnvelope(raw)) {
    defaultTs = Math.floor(new Date(raw.timestamp).getTime() / 1000)
    if (raw.data !== undefined && typeof raw.data === "object" && raw.data !== null && !Array.isArray(raw.data)) {
      fields = { ...(raw.data as Record<string, unknown>) }
    }
    return finalizeWireFields(fields, defaultTs)
  }

  if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
    fields = { ...(raw as Record<string, unknown>) }
  }
  return finalizeWireFields(fields, defaultTs)
}

function mapPlanStatus(s: string): string {
  const x = (s || "pending").toLowerCase()
  if (x === "in_progress" || x === "running") return "running"
  if (x === "completed" || x === "done") return "completed"
  if (x === "blocked" || x === "failed") return "failed"
  return "pending"
}

function mapPlanToSteps(plan: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(plan)) return []
  const ts = nowTs()
  return plan.map((step) => {
    const st = step as Record<string, unknown>
    return {
      event_id: shortuuid.generate(),
      timestamp: ts,
      status: mapPlanStatus(String(st.status || "pending")),
      id: String(st.id || ""),
      description: String(st.content ?? st.description ?? ""),
      tools: Array.isArray(st.tools) ? st.tools : []
    }
  })
}

function inferToolName(toolFunction: string): string {
  const func = (toolFunction || "").trim()
  if (!func) return "info"
  if (["web_search", "web_crawl", "internet_search"].includes(func)) return "web_search"
  if (["sandbox_exec", "terminal_execute", "sandbox_execute_bash", "sandbox_execute_code"].includes(func)) return func
  if (["sandbox_write_file", "file_write", "sandbox_file_operations", "sandbox_str_replace_editor"].includes(func)) {
    return func
  }
  if (["sandbox_read_file", "file_read"].includes(func)) return func
  if (["sandbox_find_files", "file_list"].includes(func)) return func
  if (func === "file_search") return "grep"
  if (func === "file_replace") return "edit_file"
  if (func === "terminal_kill") return "execute"
  return func
}

/**
 * runner 单条 → 发往浏览器的 event + data；null 表示不发送（与 Python 映射为 null 一致）。
 */
export function mapRunnerChunkToWire(chunk: RunnerChunk): { event: string; data: Record<string, unknown> } | null {
  const ev = chunk.event

  if (ev === EventType.AGENT_STEP || ev === "agent_step") {
    return null
  }

  if (ev === EventType.ERROR || ev === "error") {
    const d = chunk.data
    if (d && typeof d === "object" && !Array.isArray(d) && "error" in d && "event_id" in d) {
      return { event: "error", data: { ...(d as Record<string, unknown>) } }
    }
    return { event: "error", data: flattenWireData(chunk.data) }
  }

  if (ev === EventType.PLAN_UPDATE || ev === "plan" || ev === "plan_update") {
    let planArr: unknown
    if (isProtocolEnvelope(chunk.data)) {
      const inner = chunk.data.data
      if (inner && typeof inner === "object" && inner !== null && !Array.isArray(inner)) {
        planArr = (inner as Record<string, unknown>).plan
      }
    } else if (chunk.data && typeof chunk.data === "object" && !Array.isArray(chunk.data)) {
      planArr = (chunk.data as Record<string, unknown>).plan
    }
    return {
      event: "plan",
      data: {
        event_id: shortuuid.generate(),
        timestamp: nowTs(),
        steps: mapPlanToSteps(planArr)
      }
    }
  }

  if (ev === EventType.AGENT_THINKING || ev === "thinking") {
    return { event: "thinking", data: flattenWireData(chunk.data) }
  }

  if (ev === EventType.AGENT_RESPONSE_CHUNK || ev === "message_chunk") {
    const flat = flattenWireData(chunk.data)
    flat.role = "assistant"
    return { event: "message_chunk", data: flat }
  }

  if (ev === EventType.AGENT_RESPONSE_DONE || ev === "message_chunk_done") {
    return { event: "message_chunk_done", data: flattenWireData(chunk.data) }
  }

  if (ev === EventType.AGENT_TOOL_START || ev === "agent_tool_start") {
    return null
  }

  if (ev === EventType.AGENT_TOOL_END || ev === "agent_tool_end") {
    const flat = flattenWireData(chunk.data)
    const fn = String(flat.function || "")
    return {
      event: "tool",
      data: finalizeWireFields({
        tool_call_id: String(flat.tool_call_id || ""),
        name: inferToolName(fn),
        status: "called",
        function: fn,
        content: flat.result_summary ?? flat.content ?? "",
        duration_ms: flat.duration_ms,
        tool_meta: flat.tool_meta
      }, nowTs())
    }
  }

  if (ev === EventType.AGENT_ACTION || ev === "agent_action") {
    const flat = flattenWireData(chunk.data)
    const fn = String(flat.function || "")
    const args = (flat.args as Record<string, unknown>) || {}
    return {
      event: "tool",
      data: finalizeWireFields({
        tool_call_id: String(flat.tool_call_id || shortuuid.generate()),
        name: inferToolName(fn),
        status: "calling",
        function: fn,
        args,
        tool_meta: flat.tool_meta
      }, nowTs())
    }
  }

  if (ev === EventType.DONE || ev === "done") {
    const flat = flattenWireData(chunk.data)
    const stats = flat.statistics
    return {
      event: "done",
      data: finalizeWireFields({
        session_id: flat.session_id,
        statistics: (stats && typeof stats === "object") ? stats : {}
      }, nowTs())
    }
  }

  return null
}
