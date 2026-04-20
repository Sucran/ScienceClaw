import { describe, it, expect } from 'vitest'
import { normalizePlanSteps, type PlanStep, type PlanStatus } from '../../src/deepagent/plan-types.ts'

describe('Plan Types', () => {
  describe('normalizePlanSteps', () => {
    it('should return empty array for empty input', () => {
      const result = normalizePlanSteps([])
      expect(result).toEqual([])
    })

    it('should normalize a single step with minimal fields', () => {
      const result = normalizePlanSteps([{ content: 'Test step' }])

      expect(result.length).toBe(1)
      expect(result[0].content).toBe('Test step')
      expect(result[0].status).toBe('pending')
      expect(result[0].priority).toBe('medium')
      expect(result[0].tools).toEqual([])
      expect(result[0].files).toEqual([])
      expect(result[0].inputs).toEqual({})
      expect(result[0].outputs).toEqual({})
      expect(result[0].id).toBe('step-1')
    })

    it('should generate sequential IDs for steps without id', () => {
      const result = normalizePlanSteps([
        { content: 'Step 1' },
        { content: 'Step 2' },
        { content: 'Step 3' }
      ])

      expect(result[0].id).toBe('step-1')
      expect(result[1].id).toBe('step-2')
      expect(result[2].id).toBe('step-3')
    })

    it('should preserve existing id fields', () => {
      const result = normalizePlanSteps([
        { id: 'custom-id-1', content: 'Step 1' },
        { id: 'custom-id-2', content: 'Step 2' }
      ])

      expect(result[0].id).toBe('custom-id-1')
      expect(result[1].id).toBe('custom-id-2')
    })

    it('should preserve all provided fields', () => {
      const result = normalizePlanSteps([{
        id: 'test-step',
        content: 'Test content',
        status: 'in_progress',
        priority: 'high',
        tools: ['tool1', 'tool2'],
        files: ['file1.txt'],
        inputs: { key: 'value' },
        outputs: { result: 'output' },
        created_at: 1234567890
      }])

      const step = result[0]
      expect(step.id).toBe('test-step')
      expect(step.content).toBe('Test content')
      expect(step.status).toBe('in_progress')
      expect(step.priority).toBe('high')
      expect(step.tools).toEqual(['tool1', 'tool2'])
      expect(step.files).toEqual(['file1.txt'])
      expect(step.inputs).toEqual({ key: 'value' })
      expect(step.outputs).toEqual({ result: 'output' })
      expect(step.created_at).toBe(1234567890)
    })

    it('should use defaults for missing fields', () => {
      const result = normalizePlanSteps([{}])

      expect(result[0].id).toBe('step-1')
      expect(result[0].content).toBe('')
      expect(result[0].status).toBe('pending')
      expect(result[0].priority).toBe('medium')
      expect(result[0].tools).toEqual([])
      expect(result[0].files).toEqual([])
      expect(result[0].created_at).toBeDefined()
      expect(typeof result[0].created_at).toBe('number')
    })

    it('should handle mixed steps with some and without ids', () => {
      const result = normalizePlanSteps([
        { id: 'first', content: 'First' },
        { content: 'Second' },
        { id: 'third', content: 'Third' }
      ])

      expect(result[0].id).toBe('first')
      expect(result[1].id).toBe('step-2')
      expect(result[2].id).toBe('third')
    })

    it('should handle completed status', () => {
      const result = normalizePlanSteps([{
        status: 'completed'
      }])

      expect(result[0].status).toBe('completed')
    })

    it('should handle failed status', () => {
      const result = normalizePlanSteps([{
        status: 'failed'
      }])

      expect(result[0].status).toBe('failed')
    })

    it('should handle low priority', () => {
      const result = normalizePlanSteps([{
        priority: 'low'
      }])

      expect(result[0].priority).toBe('low')
    })

    it('should allow string status values', () => {
      const result = normalizePlanSteps([{
        status: 'custom_status'
      }])

      expect(result[0].status).toBe('custom_status')
    })

    it('should allow string priority values', () => {
      const result = normalizePlanSteps([{
        priority: 'custom_priority'
      }])

      expect(result[0].priority).toBe('custom_priority')
    })
  })

  describe('PlanStep type', () => {
    it('should have correct structure', () => {
      const step: PlanStep = {
        id: 'test',
        content: 'Test',
        status: 'pending',
        tools: [],
        files: [],
        priority: 'medium',
        created_at: Date.now(),
        inputs: {},
        outputs: {}
      }

      expect(step.id).toBe('test')
      expect(step.content).toBe('Test')
      expect(step.status).toBe('pending')
    })
  })

  describe('PlanStatus type', () => {
    it('should allow pending status', () => {
      const status: PlanStatus = 'pending'
      expect(status).toBe('pending')
    })

    it('should allow in_progress status', () => {
      const status: PlanStatus = 'in_progress'
      expect(status).toBe('in_progress')
    })

    it('should allow completed status', () => {
      const status: PlanStatus = 'completed'
      expect(status).toBe('completed')
    })

    it('should allow failed status', () => {
      const status: PlanStatus = 'failed'
      expect(status).toBe('failed')
    })
  })
})
