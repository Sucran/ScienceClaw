import { describe, it, expect, beforeEach } from 'vitest'
import {
  EventType,
  ToolCategory,
  SSEProtocolManager,
  getProtocolManager,
  type SSEEvent,
  type ToolMeta
} from '../../src/deepagent/sse-protocol.ts'

describe('SSE Protocol', () => {
  let manager: SSEProtocolManager

  beforeEach(() => {
    manager = new SSEProtocolManager()
  })

  describe('EventType enum', () => {
    it('should have all expected event types', () => {
      expect(EventType.AGENT_STEP).toBe('agent_step')
      expect(EventType.AGENT_ACTION).toBe('agent_action')
      expect(EventType.AGENT_THINKING).toBe('thinking')
      expect(EventType.AGENT_RESPONSE_CHUNK).toBe('message_chunk')
      expect(EventType.AGENT_RESPONSE_DONE).toBe('message_chunk_done')
      expect(EventType.AGENT_TOOL_START).toBe('agent_tool_start')
      expect(EventType.AGENT_TOOL_END).toBe('agent_tool_end')
      expect(EventType.PLAN_UPDATE).toBe('plan')
      expect(EventType.ERROR).toBe('error')
      expect(EventType.DONE).toBe('done')
    })
  })

  describe('ToolCategory enum', () => {
    it('should have all expected categories', () => {
      expect(ToolCategory.FILE).toBe('file')
      expect(ToolCategory.FILESYSTEM).toBe('filesystem')
      expect(ToolCategory.EXECUTION).toBe('execution')
      expect(ToolCategory.SEARCH).toBe('search')
      expect(ToolCategory.NETWORK).toBe('network')
      expect(ToolCategory.PLANNING).toBe('planning')
      expect(ToolCategory.DATA).toBe('data')
      expect(ToolCategory.SKILL).toBe('skill')
      expect(ToolCategory.SYSTEM).toBe('system')
      expect(ToolCategory.OTHER).toBe('other')
      expect(ToolCategory.CUSTOM).toBe('custom')
    })
  })

  describe('SSEProtocolManager', () => {
    describe('createEvent', () => {
      it('should create an SSE event with correct structure', () => {
        const event = manager.createEvent(EventType.AGENT_STEP, { content: 'test' })

        expect(event.event).toBe(EventType.AGENT_STEP)
        expect(event.data).toEqual({ content: 'test' })
        expect(event.timestamp).toBeDefined()
        expect(typeof event.timestamp).toBe('string')
      })

      it('should include ISO timestamp', () => {
        const event = manager.createEvent(EventType.ERROR, { message: 'error' })

        const timestamp = new Date(event.timestamp)
        expect(timestamp.toISOString()).toBe(event.timestamp)
      })

      it('should handle different event types', () => {
        const types = [
          EventType.AGENT_STEP,
          EventType.AGENT_ACTION,
          EventType.AGENT_THINKING,
          EventType.AGENT_RESPONSE_CHUNK,
          EventType.AGENT_TOOL_START,
          EventType.AGENT_TOOL_END,
          EventType.PLAN_UPDATE,
          EventType.ERROR,
          EventType.DONE
        ]

        types.forEach(type => {
          const event = manager.createEvent(type, {})
          expect(event.event).toBe(type)
        })
      })

      it('should handle string event type', () => {
        const event = manager.createEvent('custom_event', { data: 'test' })
        expect(event.event).toBe('custom_event')
      })

      it('should handle complex data', () => {
        const complexData = {
          tool_call_id: 'call-123',
          function: 'web_search',
          args: { query: 'test' },
          nested: { deep: { value: true } },
          array: [1, 2, 3]
        }
        const event = manager.createEvent(EventType.AGENT_TOOL_START, complexData)
        expect(event.data).toEqual(complexData)
      })
    })

    describe('getToolMeta', () => {
      it('should return meta for known tools', () => {
        const meta = manager.getToolMeta('web_search')

        expect(meta.name).toBe('web_search')
        expect(meta.category).toBe(ToolCategory.SEARCH)
        expect(meta.icon).toBe('🔍')
        expect(meta.description).toBe('Web Search')
      })

      it('should return default meta for unknown tools', () => {
        const meta = manager.getToolMeta('unknown_tool')

        expect(meta.name).toBe('unknown_tool')
        expect(meta.category).toBe(ToolCategory.CUSTOM)
        expect(meta.icon).toBe('🔧')
        expect(meta.description).toBe('unknown_tool')
      })

      it('should return meta for file tools', () => {
        const meta = manager.getToolMeta('file_read')

        expect(meta.name).toBe('file_read')
        expect(meta.category).toBe(ToolCategory.FILESYSTEM)
        expect(meta.icon).toBe('📖')
      })

      it('should return meta for execution tools', () => {
        const meta = manager.getToolMeta('execute')

        expect(meta.name).toBe('execute')
        expect(meta.category).toBe(ToolCategory.EXECUTION)
        expect(meta.icon).toBe('⚡')
      })

      it('should return meta for skill tools', () => {
        const meta = manager.getToolMeta('propose_skill_save')

        expect(meta.name).toBe('propose_skill_save')
        expect(meta.category).toBe(ToolCategory.SKILL)
        expect(meta.icon).toBe('💾')
      })

      it('should return meta for planning tools', () => {
        const meta = manager.getToolMeta('write_todos')

        expect(meta.name).toBe('write_todos')
        expect(meta.category).toBe(ToolCategory.PLANNING)
        expect(meta.icon).toBe('📝')
      })

      it('should return meta for ToolUniverse tools', () => {
        const meta = manager.getToolMeta('tooluniverse_run')

        expect(meta.name).toBe('tooluniverse_run')
        expect(meta.category).toBe(ToolCategory.DATA)
        expect(meta.icon).toBe('🧪')
      })

      it('should return meta for sandbox tools', () => {
        const meta = manager.getToolMeta('sandbox_execute_code')

        expect(meta.name).toBe('sandbox_execute_code')
        expect(meta.category).toBe(ToolCategory.EXECUTION)
        expect(meta.icon).toBe('🐍')
      })

      it('should return meta for browser tools', () => {
        const meta = manager.getToolMeta('browser_navigate')

        expect(meta.name).toBe('browser_navigate')
        expect(meta.category).toBe(ToolCategory.NETWORK)
        expect(meta.icon).toBe('🌐')
      })
    })

    describe('registerTool', () => {
      it('should register a new tool', () => {
        manager.registerTool('custom_tool', ToolCategory.DATA, '🔬', 'Custom Tool')

        const meta = manager.getToolMeta('custom_tool')
        expect(meta.name).toBe('custom_tool')
        expect(meta.category).toBe(ToolCategory.DATA)
        expect(meta.icon).toBe('🔬')
        expect(meta.description).toBe('Custom Tool')
      })

      it('should override existing tool', () => {
        manager.registerTool('web_search', ToolCategory.CUSTOM, '⭐', 'Custom Web Search')

        const meta = manager.getToolMeta('web_search')
        expect(meta.icon).toBe('⭐')
        expect(meta.description).toBe('Custom Web Search')
      })
    })

    describe('registerSandboxTool', () => {
      it('should register a sandbox tool with CUSTOM category', () => {
        manager.registerSandboxTool('my_sandbox_tool', 'My Sandbox Tool')

        const meta = manager.getToolMeta('my_sandbox_tool')
        expect(meta.name).toBe('my_sandbox_tool')
        expect(meta.category).toBe(ToolCategory.CUSTOM)
        expect(meta.icon).toBe('🔧')
        expect(meta.description).toBe('My Sandbox Tool')
        expect(meta.sandbox).toBe(true)
      })

      it('should mark sandbox tools with sandbox: true', () => {
        manager.registerSandboxTool('sandbox_only', 'Sandbox Only')

        const meta = manager.getToolMeta('sandbox_only') as Record<string, unknown>
        expect(meta.sandbox).toBe(true)
      })
    })
  })

  describe('getProtocolManager', () => {
    it('should return a singleton instance', () => {
      const instance1 = getProtocolManager()
      const instance2 = getProtocolManager()

      expect(instance1).toBe(instance2)
    })

    it('should return a valid protocol manager', () => {
      const instance = getProtocolManager()

      expect(instance).toBeDefined()
      expect(typeof instance.createEvent).toBe('function')
      expect(typeof instance.getToolMeta).toBe('function')
      expect(typeof instance.registerTool).toBe('function')
      expect(typeof instance.registerSandboxTool).toBe('function')
    })
  })

  describe('SSEEvent type', () => {
    it('should have correct structure', () => {
      const event: SSEEvent<{ test: string }> = {
        event: EventType.AGENT_STEP,
        data: { test: 'value' },
        timestamp: '2024-01-01T00:00:00.000Z'
      }

      expect(event.event).toBe(EventType.AGENT_STEP)
      expect(event.data.test).toBe('value')
    })
  })

  describe('ToolMeta type', () => {
    it('should have correct structure', () => {
      const meta: ToolMeta = {
        name: 'test_tool',
        category: ToolCategory.EXECUTION,
        icon: '⚡',
        description: 'Test Tool',
        sandbox: true
      }

      expect(meta.name).toBe('test_tool')
      expect(meta.category).toBe(ToolCategory.EXECUTION)
      expect(meta.sandbox).toBe(true)
    })
  })
})
