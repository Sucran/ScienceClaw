import { describe, it, expect, beforeEach } from 'vitest'
import { SSEMonitoringMiddleware, type ToolRuntime } from '../../src/core/deepagent/sse-middleware.ts'
import { ToolCategory } from '../../src/core/deepagent/sse-protocol.ts'

describe('SSE Monitoring Middleware', () => {
  let middleware: SSEMonitoringMiddleware

  beforeEach(() => {
    middleware = new SSEMonitoringMiddleware(async () => {})
  })

  describe('constructor', () => {
    it('should create middleware with default options', () => {
      expect(middleware).toBeDefined()
    })

    it('should accept custom agent name', () => {
      const custom = new SSEMonitoringMiddleware(async () => {}, 'custom-agent')
      expect(custom).toBeDefined()
    })

    it('should accept parent agent', () => {
      const child = new SSEMonitoringMiddleware(async () => {}, 'child', 'parent')
      expect(child).toBeDefined()
    })

    it('should accept verbose mode', () => {
      const verbose = new SSEMonitoringMiddleware(async () => {}, 'agent', undefined, true)
      expect(verbose).toBeDefined()
    })
  })

  describe('wrapToolCall (sync)', () => {
    it('should wrap tool call and return result', () => {
      const runtime: ToolRuntime = {
        name: 'test_tool',
        args: { arg1: 'value1' }
      }
      const handler = () => 'test_result'

      const result = middleware.wrapToolCall(runtime, handler)

      expect(result).toBe('test_result')
    })

    it('should emit tool start event', () => {
      const runtime: ToolRuntime = {
        name: 'web_search',
        args: { query: 'test' }
      }
      const handler = () => 'result'

      middleware.wrapToolCall(runtime, handler)
      const events = middleware.drainEvents()

      const startEvent = events.find(e => e.event === 'middleware_tool_start')
      expect(startEvent).toBeDefined()
      expect(startEvent?.data.function).toBe('web_search')
    })

    it('should emit tool complete event', () => {
      const runtime: ToolRuntime = {
        name: 'web_search',
        args: { query: 'test' }
      }
      const handler = () => 'result'

      middleware.wrapToolCall(runtime, handler)
      const events = middleware.drainEvents()

      const completeEvent = events.find(e => e.event === 'middleware_tool_complete')
      expect(completeEvent).toBeDefined()
      expect(completeEvent?.data.function).toBe('web_search')
      expect(completeEvent?.data.duration_ms).toBeGreaterThanOrEqual(0)
    })

    it('should handle tool_call format', () => {
      const runtime: ToolRuntime = {
        tool_call: {
          name: 'file_read',
          id: 'call-123',
          args: { path: '/test.txt' }
        }
      }
      const handler = () => 'file content'

      middleware.wrapToolCall(runtime, handler)
      const events = middleware.drainEvents()

      const startEvent = events.find(e => e.event === 'middleware_tool_start')
      expect(startEvent?.data.function).toBe('file_read')
      expect(startEvent?.data.tool_call_id).toBe('call-123')
    })

    it('should handle null/undefined args', () => {
      const runtime: ToolRuntime = {
        name: 'test_tool'
      }
      const handler = () => 'result'

      middleware.wrapToolCall(runtime, handler)
      const events = middleware.drainEvents()

      expect(events.length).toBeGreaterThan(0)
    })

    it('should handle tool without name', () => {
      const runtime: ToolRuntime = {}
      const handler = () => 'result'

      middleware.wrapToolCall(runtime, handler)
      const events = middleware.drainEvents()

      // Should not throw, events may be empty
      expect(Array.isArray(events)).toBe(true)
    })

    it('should track tool call statistics', () => {
      const runtime: ToolRuntime = {
        name: 'test_tool',
        args: {}
      }
      const handler = () => 'result'

      middleware.wrapToolCall(runtime, handler)

      const stats = middleware.getStatistics()
      expect(stats.total_tool_calls).toBe(1)
    })
  })

  describe('wrapToolCallAsync (async)', () => {
    it('should wrap async tool call and return result', async () => {
      const runtime: ToolRuntime = {
        name: 'async_tool',
        args: {}
      }
      const handler = async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return 'async_result'
      }

      const result = await middleware.wrapToolCallAsync(runtime, handler)

      expect(result).toBe('async_result')
    })

    it('should emit events for async calls', async () => {
      const runtime: ToolRuntime = {
        name: 'async_tool',
        args: {}
      }
      const handler = async () => 'result'

      await middleware.wrapToolCallAsync(runtime, handler)
      const events = middleware.drainEvents()

      expect(events.some(e => e.event === 'middleware_tool_start')).toBe(true)
      expect(events.some(e => e.event === 'middleware_tool_complete')).toBe(true)
    })

    it('should handle rejected promises', async () => {
      const runtime: ToolRuntime = {
        name: 'failing_tool',
        args: {}
      }
      const handler = async () => {
        throw new Error('Tool failed')
      }

      await expect(middleware.wrapToolCallAsync(runtime, handler)).rejects.toThrow('Tool failed')
    })
  })

  describe('drainEvents', () => {
    it('should return all events', () => {
      middleware.wrapToolCall({ name: 'tool1', args: {} }, () => 'r1')
      middleware.wrapToolCall({ name: 'tool2', args: {} }, () => 'r2')

      const events = middleware.drainEvents()

      expect(events.length).toBe(4) // 2 start + 2 complete
    })

    it('should clear events after draining', () => {
      middleware.wrapToolCall({ name: 'tool', args: {} }, () => 'r')

      middleware.drainEvents()
      const events2 = middleware.drainEvents()

      expect(events2.length).toBe(0)
    })

    it('should return copy of events', () => {
      middleware.wrapToolCall({ name: 'tool', args: {} }, () => 'r')

      const events = middleware.drainEvents()
      events.push({ event: 'custom', data: {} })

      const events2 = middleware.drainEvents()
      expect(events2.length).toBe(0)
    })
  })

  describe('clear', () => {
    it('should clear all events', () => {
      middleware.wrapToolCall({ name: 'tool', args: {} }, () => 'r')
      middleware.clear()

      const events = middleware.drainEvents()
      expect(events.length).toBe(0)
    })

    it('should reset statistics', () => {
      middleware.wrapToolCall({ name: 'tool', args: {} }, () => 'r')
      middleware.clear()

      const stats = middleware.getStatistics()
      expect(stats.total_tool_calls).toBe(0)
    })
  })

  describe('getStatistics', () => {
    it('should return initial statistics', () => {
      const stats = middleware.getStatistics()

      expect(stats.total_tool_calls).toBe(0)
      expect(stats.total_tool_duration_ms).toBe(0)
      expect(stats.todos_updates).toBe(0)
      expect(stats.input_tokens).toBe(0)
      expect(stats.output_tokens).toBe(0)
    })

    it('should track tool calls', () => {
      middleware.wrapToolCall({ name: 'tool1', args: {} }, () => 'r1')
      middleware.wrapToolCall({ name: 'tool2', args: {} }, () => 'r2')

      const stats = middleware.getStatistics()
      expect(stats.total_tool_calls).toBe(2)
    })

    it('should track duration', () => {
      middleware.wrapToolCall({ name: 'tool', args: {} }, () => 'r')

      const stats = middleware.getStatistics()
      expect(stats.total_tool_duration_ms).toBeGreaterThanOrEqual(0)
    })
  })

  describe('addTokens', () => {
    it('should add input tokens', () => {
      middleware.addTokens(100, 0)

      const stats = middleware.getStatistics()
      expect(stats.input_tokens).toBe(100)
    })

    it('should add output tokens', () => {
      middleware.addTokens(0, 200)

      const stats = middleware.getStatistics()
      expect(stats.output_tokens).toBe(200)
    })

    it('should accumulate tokens', () => {
      middleware.addTokens(100, 50)
      middleware.addTokens(50, 100)

      const stats = middleware.getStatistics()
      expect(stats.input_tokens).toBe(150)
      expect(stats.output_tokens).toBe(150)
    })

    it('should ignore zero values', () => {
      middleware.addTokens(100, 50)
      middleware.addTokens()

      const stats = middleware.getStatistics()
      expect(stats.input_tokens).toBe(100)
      expect(stats.output_tokens).toBe(50)
    })
  })

  describe('categorize', () => {
    it('should categorize file tools', () => {
      expect(middleware.categorize('read_file')).toBe(ToolCategory.FILE)
      expect(middleware.categorize('write_file')).toBe(ToolCategory.FILE)
      expect(middleware.categorize('edit_file')).toBe(ToolCategory.FILE)
      expect(middleware.categorize('glob')).toBe(ToolCategory.FILE)
      expect(middleware.categorize('grep')).toBe(ToolCategory.FILE)
      expect(middleware.categorize('ls')).toBe(ToolCategory.FILE)
    })

    it('should categorize execution tools', () => {
      expect(middleware.categorize('execute')).toBe(ToolCategory.EXECUTION)
      expect(middleware.categorize('run_command')).toBe(ToolCategory.EXECUTION)
      expect(middleware.categorize('shell')).toBe(ToolCategory.EXECUTION)
      expect(middleware.categorize('terminal')).toBe(ToolCategory.EXECUTION)
    })

    it('should categorize search tools', () => {
      expect(middleware.categorize('search')).toBe(ToolCategory.SEARCH)
    })

    it('should categorize network tools', () => {
      expect(middleware.categorize('crawl')).toBe(ToolCategory.NETWORK)
      expect(middleware.categorize('fetch_data')).toBe(ToolCategory.NETWORK)
      expect(middleware.categorize('http_request')).toBe(ToolCategory.NETWORK)
      expect(middleware.categorize('web_request')).toBe(ToolCategory.NETWORK)
    })

    it('should categorize planning tools', () => {
      expect(middleware.categorize('todo')).toBe(ToolCategory.PLANNING)
      expect(middleware.categorize('plan')).toBe(ToolCategory.PLANNING)
    })

    it('should return OTHER for unknown tools', () => {
      expect(middleware.categorize('unknown_tool')).toBe(ToolCategory.OTHER)
      expect(middleware.categorize('xyz')).toBe(ToolCategory.OTHER)
    })

    it('should be case insensitive', () => {
      expect(middleware.categorize('READ_FILE')).toBe(ToolCategory.FILE)
      expect(middleware.categorize('Execute')).toBe(ToolCategory.EXECUTION)
    })
  })

  describe('ToolRuntime interface', () => {
    it('should accept runtime with name and args', () => {
      const runtime: ToolRuntime = {
        name: 'test',
        args: { key: 'value' }
      }
      expect(runtime.name).toBe('test')
    })

    it('should accept runtime with tool_call', () => {
      const runtime: ToolRuntime = {
        tool_call: {
          name: 'test',
          id: 'id-123',
          args: { key: 'value' }
        }
      }
      expect(runtime.tool_call?.name).toBe('test')
    })
  })
})
