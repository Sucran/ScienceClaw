import { describe, it, expect } from 'vitest'
import {
  createSubagentRuntime,
  createChannelRuntime,
  createPluginRuntime,
  getDefaultPluginRuntime,
  setDefaultPluginRuntime
} from '../../src/plugins/runtime/index.ts'

describe('Plugin Runtime', () => {
  describe('createSubagentRuntime', () => {
    it('should create a subagent runtime with run method', async () => {
      const runtime = createSubagentRuntime(null)

      const result = await runtime.run({
        agentId: 'test-agent',
        sessionKey: 'session-1',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false
      })

      expect(result.reply).toBe('Plugin subagent not yet integrated')
      expect(result.sessionId).toBe('session-1')
    })

    it('should create a subagent runtime with waitForRun method', async () => {
      const runtime = createSubagentRuntime(null)

      const result = await runtime.waitForRun({
        runId: 'run-1',
        timeoutMs: 5000
      })

      expect(result.completed).toBe(true)
    })

    it('should create a subagent runtime with getSessionMessages method', async () => {
      const runtime = createSubagentRuntime(null)

      const result = await runtime.getSessionMessages({
        sessionKey: 'session-1',
        limit: 10
      })

      expect(result.messages).toEqual([])
    })

    it('should create a subagent runtime with deleteSession method', async () => {
      const runtime = createSubagentRuntime(null)

      await runtime.deleteSession({ sessionKey: 'session-1' })

      // Should not throw
      expect(true).toBe(true)
    })
  })

  describe('createChannelRuntime', () => {
    it('should create a channel runtime with sendMessage method', async () => {
      const runtime = createChannelRuntime()

      const result = await runtime.sendMessage({
        channel: 'slack',
        accountId: 'account-1',
        to: 'user-1',
        text: 'Hello'
      })

      expect(result.messageId).toBeDefined()
      expect(result.messageId).toMatch(/^msg-\d+$/)
    })

    it('should include optional parameters in sendMessage', async () => {
      const runtime = createChannelRuntime()

      const result = await runtime.sendMessage({
        channel: 'slack',
        to: 'user-1',
        text: 'Hello',
        contextToken: 'token-123'
      })

      expect(result.messageId).toBeDefined()
    })
  })

  describe('createPluginRuntime', () => {
    it('should create a plugin runtime with version', () => {
      const runtime = createPluginRuntime('2.0.0')

      expect(runtime.version).toBe('2.0.0')
    })

    it('should create a plugin runtime with subagent', () => {
      const runtime = createPluginRuntime('1.0.0')

      expect(runtime.subagent).toBeDefined()
      expect(typeof runtime.subagent.run).toBe('function')
    })

    it('should create a plugin runtime with channel', () => {
      const runtime = createPluginRuntime('1.0.0')

      expect(runtime.channel).toBeDefined()
      expect(typeof runtime.channel.sendMessage).toBe('function')
    })

    it('should create a plugin runtime with log function', () => {
      const runtime = createPluginRuntime('1.0.0')

      expect(runtime.log).toBeDefined()
      expect(typeof runtime.log).toBe('function')
    })

    it('should log messages with plugin-runtime prefix', () => {
      const runtime = createPluginRuntime('1.0.0')
      const consoleSpy = vi.spyOn(console, 'log')

      runtime.log('Test message')

      expect(consoleSpy).toHaveBeenCalledWith('[plugin-runtime] Test message')
    })
  })

  describe('getDefaultPluginRuntime', () => {
    it('should return a singleton instance', () => {
      const runtime1 = getDefaultPluginRuntime()
      const runtime2 = getDefaultPluginRuntime()

      expect(runtime1).toBe(runtime2)
    })

    it('should return runtime with default version', () => {
      const runtime = getDefaultPluginRuntime()

      expect(runtime.version).toBe('1.0.0')
    })
  })

  describe('setDefaultPluginRuntime', () => {
    it('should override default runtime', () => {
      const customRuntime = createPluginRuntime('3.0.0')
      setDefaultPluginRuntime(customRuntime)

      const runtime = getDefaultPluginRuntime()
      expect(runtime.version).toBe('3.0.0')
    })
  })
})
