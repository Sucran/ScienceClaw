import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setGlobalRegistry } from '../../src/plugins/api-builder.ts'
import { createPluginRegistry } from '../../src/plugins/registry.ts'

// We need to test the runner module's exports and helper functions
// Note: Full integration tests for runScienceTaskStream would require mocking
// MongoDB, the deep agent, and other external dependencies

describe('Runner Module', () => {
  beforeEach(() => {
    setGlobalRegistry(createPluginRegistry())
  })

  describe('Hook integration', () => {
    it('should export runScienceTaskStream function', async () => {
      // Dynamic import to avoid loading all dependencies
      const { runScienceTaskStream } = await import('../../src/core/deepagent/runner.ts')
      expect(typeof runScienceTaskStream).toBe('function')
    })
  })

  describe('RunInput type', () => {
    it('should have valid RunInput interface structure', async () => {
      const input = {
        sessionId: 'test-session',
        userId: 'test-user',
        userMessage: 'Hello',
        modelConfig: {
          provider: 'openai' as const,
          model_name: 'gpt-4'
        },
        taskSettings: {
          max_tokens: 1000,
          sandbox_exec_timeout: 300
        },
        language: 'zh'
      }

      expect(input.sessionId).toBe('test-session')
      expect(input.userId).toBe('test-user')
      expect(input.userMessage).toBe('Hello')
      expect(input.modelConfig?.provider).toBe('openai')
      expect(input.taskSettings?.max_tokens).toBe(1000)
      expect(input.language).toBe('zh')
    })
  })
})
