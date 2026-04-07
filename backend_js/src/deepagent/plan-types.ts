/**
 * 参考注释：
 * - "Plan 类型定义（精简版，替代 planner_middleware.py）。仅保留前端 SSE 事件所需..."
 * 参考代码：
 * - /ScienceClaw/backend/deepagent/plan_types.py:1-5
 */
export type PlanStatus = "pending" | "in_progress" | "completed" | "failed"

export interface PlanStep {
  id: string
  content: string
  status: PlanStatus | string
  tools: string[]
  files: string[]
  priority: "high" | "medium" | "low" | string
  inputs?: Record<string, unknown>
  outputs?: Record<string, unknown>
  created_at: number
}

/**
 * 参考注释：
 * - "对计划步骤进行字段归一化，保证前端展示具备稳定结构。"
 * 参考代码：
 * - /ScienceClaw/backend/deepagent/plan_types.py:22-38
 */
export function normalizePlanSteps(plan: Partial<PlanStep>[]): PlanStep[] {
  const now = Math.floor(Date.now() / 1000)
  return plan.map((step, index) => ({
    id: step.id ?? `step-${index + 1}`,
    content: step.content ?? "",
    status: step.status ?? "pending",
    priority: step.priority ?? "medium",
    tools: step.tools ?? [],
    files: step.files ?? [],
    created_at: step.created_at ?? now,
    inputs: step.inputs ?? {},
    outputs: step.outputs ?? {}
  }))
}
