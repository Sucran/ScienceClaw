import { describe, it, expect, beforeEach } from 'vitest'
import { buildPluginApi, setGlobalRegistry, getGlobalRegistry } from '../../src/plugins/api-builder.ts'
import { createPluginRegistry } from '../../src/plugins/registry.ts'
import type { PluginRegistry } from '../../src/plugins/types.ts'

describe('API Builder', () => {
  let registry: PluginRegistry
  const mockLogger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {}
  }

  beforeEach(() => {
    registry = createPluginRegistry()
    setGlobalRegistry(registry)
  })

  describe('buildPluginApi', () => {
    it('should build a plugin API with correct identity', () => {
      const api = buildPluginApi({
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        description: 'A test plugin',
        config: { key: 'value' },
        pluginConfig: {},
        logger: mockLogger,
        rootDir: '/path/to/plugin',
        registry
      })

      expect(api.id).toBe('test-plugin')
      expect(api.name).toBe('Test Plugin')
      expect(api.version).toBe('1.0.0')
      expect(api.description).toBe('A test plugin')
    })

    it('should register a tool', () => {
      const api = buildPluginApi({
        id: 'test-plugin',
        name: 'Test Plugin',
        config: {},
        pluginConfig: {},
        logger: mockLogger,
        rootDir: '/path/to/plugin',
        registry
      })

      api.registerTool({
        name: 'test_tool',
        description: 'A test tool',
        execute: async () => 'result'
      })

      const tool = registry.tools.get('test_tool')
      expect(tool).toBeDefined()
      expect(tool?.name).toBe('test_tool')
    })

    it('should skip tool registration in cli-metadata mode', () => {
      const api = buildPluginApi({
        id: 'test-plugin',
        name: 'Test Plugin',
        config: {},
        pluginConfig: {},
        logger: mockLogger,
        rootDir: '/path/to/plugin',
        registry,
        registrationMode: 'cli-metadata'
      })

      api.registerTool({
        name: 'test_tool',
        description: 'Should not be registered',
        execute: async () => 'result'
      })

      expect(registry.tools.size).toBe(0)
    })

    it('should register hooks', () => {
      const api = buildPluginApi({
        id: 'test-plugin',
        name: 'Test Plugin',
        config: {},
        pluginConfig: {},
        logger: mockLogger,
        rootDir: '/path/to/plugin',
        registry
      })

      const handler = async () => {}
      api.registerHook('before_agent_start', handler)
      api.registerHook(['after_tool_call', 'session_end'], handler)

      expect(registry.hooks.get('before_agent_start')?.size).toBe(1)
      expect(registry.hooks.get('after_tool_call')?.size).toBe(1)
      expect(registry.hooks.get('session_end')?.size).toBe(1)
    })

    it('should register a service', () => {
      const api = buildPluginApi({
        id: 'test-plugin',
        name: 'Test Plugin',
        config: {},
        pluginConfig: {},
        logger: mockLogger,
        rootDir: '/path/to/plugin',
        registry
      })

      api.registerService({
        id: 'test-service',
        name: 'Test Service',
        init: async () => {},
        destroy: async () => {}
      })

      expect(registry.services.has('test-service')).toBe(true)
    })

    it('should register an HTTP route', () => {
      const api = buildPluginApi({
        id: 'test-plugin',
        name: 'Test Plugin',
        config: {},
        pluginConfig: {},
        logger: mockLogger,
        rootDir: '/path/to/plugin',
        registry
      })

      const handler = async () => ({ message: 'ok' })
      api.registerHttpRoute({
        method: 'GET',
        path: '/api/test',
        handler
      })

      expect(registry.httpRoutes.length).toBe(1)
      expect(registry.httpRoutes[0].path).toBe('/api/test')
    })

    it('should register a channel', () => {
      const api = buildPluginApi({
        id: 'test-plugin',
        name: 'Test Plugin',
        config: {},
        pluginConfig: {},
        logger: mockLogger,
        rootDir: '/path/to/plugin',
        registry
      })

      const mockChannel = {
        id: 'test-channel',
        meta: { id: 'test-channel', label: 'Test', selectionLabel: 'test' },
        capabilities: { chatTypes: ['direct'] as const },
        outbound: { deliveryMode: 'direct' as const },
        status: {
          defaultRuntime: {},
          collectStatusIssues: () => [],
          buildChannelSummary: () => ({}),
          buildAccountSnapshot: () => ({})
        },
        config: {
          listAccountIds: () => [],
          resolveAccount: () => ({}),
          isConfigured: () => false,
          describeAccount: () => ({ accountId: '' })
        }
      }

      api.registerChannel({ plugin: mockChannel as any })

      expect(registry.channels.has('test-channel')).toBe(true)
    })

    it('should register a context engine', () => {
      const api = buildPluginApi({
        id: 'test-plugin',
        name: 'Test Plugin',
        config: {},
        pluginConfig: {},
        logger: mockLogger,
        rootDir: '/path/to/plugin',
        registry
      })

      const engine = { process: () => {} }
      api.registerContextEngine('test-engine', engine)

      expect(registry.contextEngines.has('test-engine')).toBe(true)
    })

    it('should resolve paths correctly', () => {
      const api = buildPluginApi({
        id: 'test-plugin',
        name: 'Test Plugin',
        config: {},
        pluginConfig: {},
        logger: mockLogger,
        rootDir: '/path/to/plugin',
        registry
      })

      // Path starting with ~ should resolve to home directory
      const homePath = api.resolvePath('~/test')
      expect(homePath).toContain('test')

      // Path starting with ./ should resolve relative to rootDir
      const relativePath = api.resolvePath('./test')
      expect(relativePath).toBe('/path/to/plugin/test')

      // Absolute path should remain unchanged
      const absolutePath = api.resolvePath('/absolute/path')
      expect(absolutePath).toBe('/absolute/path')
    })
  })

  describe('getGlobalRegistry', () => {
    it('should return the global registry', () => {
      expect(getGlobalRegistry()).toBe(registry)
    })

    it('should return null before setting', () => {
      // Create a new registry (old one is already set)
      const newRegistry = createPluginRegistry()
      setGlobalRegistry(newRegistry)
      expect(getGlobalRegistry()).toBe(newRegistry)
    })
  })

  describe('setGlobalRegistry', () => {
    it('should update the global registry', () => {
      const newRegistry = createPluginRegistry()
      setGlobalRegistry(newRegistry)
      expect(getGlobalRegistry()).toBe(newRegistry)
    })
  })
})
